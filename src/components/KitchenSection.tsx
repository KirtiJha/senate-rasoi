import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Empty } from './Empty';
import { MessageIconButton } from './MessageNeighbour';
import { Avatar, Badge, Button, Container, VegMark } from './ui';
import { useAuth } from '../context/auth';
import { RepeatList } from './food/RepeatDish';
import { useToast } from '../context/toast';
import { fetchDishes, listChefOrders, orderTotal, setOrderStatus, statusMessageForFoodie, waLink } from '../lib/dishes';
import { haptics } from '../lib/haptics';
import { subscribeToOrders } from '../lib/orders';
import { countdown } from '../lib/time';
import { ChefOrder, DishRow, OrderStatus, SLOT_EMOJI } from '../lib/types';
import { useThemeColors } from '../theme';

const EARN: OrderStatus[] = ['accepted', 'cooking', 'delivered'];

// When a WhatsApp message still makes sense to send by hand.
//
// Deliberately NOT ACTIVE_STATUSES, which means "still holds reserved stock" —
// the two lists overlapped by coincidence, and that coincidence ended at
// 'delivered': stock is settled, but "enjoy your dinner" is exactly the message
// a chef wants to send. Declined and cancelled are absent because those get
// their message automatically at the moment they happen.
const CAN_MESSAGE: OrderStatus[] = ['placed', 'accepted', 'cooking', 'delivered'];
const STATUS_TONE: Record<OrderStatus, 'accent' | 'success' | 'neutral'> = {
  placed: 'accent', accepted: 'success', cooking: 'accent', delivered: 'success', rejected: 'neutral', cancelled: 'neutral',
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'New', accepted: 'Confirmed', cooking: 'Cooking', delivered: 'Delivered', rejected: 'Declined', cancelled: 'Cancelled',
};

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

/** Kitchen = the one-off dishes you've posted + their incoming orders. */
export function KitchenSection({ onPost }: { onPost?: () => void } = {}) {
  const router = useRouter();
  const toast = useToast();
  const { userId, communityId } = useAuth();
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [ordersByDish, setOrdersByDish] = useState<Record<string, ChefOrder[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await fetchDishes(communityId);
      const mine = all.filter((d) => d.chef_user_id === userId);
      setDishes(mine);
      const entries = await Promise.all(mine.map(async (d) => [d.id, await listChefOrders(d.id)] as const));
      setOrdersByDish(Object.fromEntries(entries));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, communityId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => subscribeToOrders(load), [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /**
   * Every status change already notifies the buyer.
   *
   * `set_order_status` writes the notification row and 0066 pushes it, so
   * accepting an order tells the buyer "confirmed ✅" on their phone without
   * anyone typing anything. This used to ALSO launch WhatsApp on every tap —
   * so a chef working through six orders was thrown out of the app six times
   * to send a message the buyer had already received. The buyer is told; the
   * chef can still message them from the row when there is something to say.
   */
  const act = async (orderId: string, status: OrderStatus, msg: string) => {
    try {
      haptics.success();
      await setOrderStatus(orderId, status);
      toast.show(msg);
      await load();
    } catch (e) {
      console.error(e);
      toast.show('Could not update the order — try again');
    }
  };

  const postDish = () => (onPost ? onPost() : router.push({ pathname: '/post', params: { category: 'food' } }));

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Container narrow>
        {/* Standing dishes first: they are the ones a chef manages rather than
            watches, and burying them under today's orders means nobody
            remembers they exist. Renders nothing until there is one. */}
        <RepeatList />

        {loading ? null : dishes.length === 0 ? (
          <Empty
            icon="flame-outline"
            title="Your kitchen is empty"
            action={<Button label="Post your first dish" icon="add" onPress={postDish} />}
          >
            Post a dish and manage every incoming order right here.
          </Empty>
        ) : (
          <>
            {dishes.map((dish) => (
              <KitchenDishCard key={dish.id} dish={dish} orders={ordersByDish[dish.id] ?? []} onAct={act} />
            ))}
            <Pressable
              onPress={postDish}
              className="mb-2 flex-row items-center justify-center gap-1.5 rounded-2xl border border-line py-3 active:bg-inset"
            >
              <Ionicons name="add" size={16} color="#9CA3AF" />
              <Text className="font-sans-sb text-[13px] text-muted">Post a dish</Text>
            </Pressable>
          </>
        )}
      </Container>
    </ScrollView>
  );
}

function KitchenDishCard({
  dish,
  orders,
  onAct,
}: {
  dish: DishRow;
  orders: ChefOrder[];
  onAct: (orderId: string, status: OrderStatus, msg: string) => void;
}) {
  const c = useThemeColors();
  // Plates reserved = max − left (set_order_status / place_order keep plates_left
  // accurate); this avoids depending on the orders array being fully loaded.
  const platesOrdered = Math.max(0, dish.max_plates - dish.plates_left);
  const revenue = orders.filter((o) => EARN.includes(o.status))
    .reduce((s, o) => s + orderTotal(o, dish.price), 0);
  const cd = countdown(dish.order_by);

  return (
    <View className="mb-4 card p-4">
      <View className="flex-row items-center gap-2">
        <VegMark type={dish.veg_type} size={15} />
        <Text className="flex-1 font-display-sb text-[18px] text-ink" numberOfLines={1}>
          {SLOT_EMOJI[dish.slot]} {dish.dish_name}
        </Text>
        {cd ? <Badge label={cd.closed ? 'Closed' : `⏱ ${cd.label.replace('Order in ', '')}`} tone={cd.closed ? 'neutral' : 'accent'} /> : null}
      </View>

      <View className="mt-3 flex-row gap-2">
        <Stat label="Ordered" value={`${platesOrdered}`} />
        <Stat label="Left" value={`${dish.plates_left}`} />
        <Stat label="Earnings" value={`₹${revenue}`} accent />
      </View>

      <View className="mt-3">
        {orders.length === 0 ? (
          <Text className="font-sans py-2 text-[13px] text-faint">No orders yet — sit tight!</Text>
        ) : (
          orders.map((o) => {
            const wa = o.orderer?.whatsapp ?? o.orderer?.phone;
            return (
              <View key={o.id} className="flex-row items-center gap-2.5 border-t border-line py-2.5">
                <Avatar name={o.buyer_name} size={32} />
                <View className="flex-1">
                  <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>
                    {o.buyer_name}
                    {o.buyer_flat ? <Text className="font-sans text-faint"> · {o.buyer_flat}</Text> : null}
                  </Text>
                  <Text className="font-sans text-[12px] text-muted">
                    {o.qty} plate{o.qty !== 1 ? 's' : ''} · ₹{orderTotal(o, dish.price)}
                  </Text>
                </View>

                {CAN_MESSAGE.includes(o.status) ? (
                  <MessageIconButton userId={o.orderer_user_id} label={`Message ${o.buyer_name}`} />
                ) : null}

                {wa && CAN_MESSAGE.includes(o.status) ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Open WhatsApp"
                    onPress={() => openUrl(waLink(wa, statusMessageForFoodie(dish.dish_name, o.status)))}
                    hitSlop={6}
                    className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70"
                  >
                    <Ionicons name="logo-whatsapp" size={17} color={c.success} />
                  </Pressable>
                ) : null}

                {o.status === 'placed' ? (
                  <View className="flex-row items-center gap-1.5">
                    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => onAct(o.id, 'rejected', 'Declined — plates released')} className="h-9 w-9 items-center justify-center rounded-full border border-line active:bg-inset">
                      <Ionicons name="close" size={18} color={c.muted} />
                    </Pressable>
                    <Pressable onPress={() => onAct(o.id, 'accepted', 'Order confirmed ✓')} className="h-9 flex-row items-center gap-1 rounded-full bg-success px-3 active:opacity-90">
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text className="font-sans-sb text-[12px] text-white">Accept</Text>
                    </Pressable>
                  </View>
                ) : o.status === 'accepted' ? (
                  /* Accepting used to be one-way here. set_order_status has
                     always allowed cancelling from any active state; the only
                     escape the UI offered was WhatsApp, or deleting the whole
                     dish — which took every other buyer's order with it. */
                  <View className="flex-row items-center gap-1.5">
                    <Pressable accessibilityRole="button" accessibilityLabel="Cancel this order"
                      onPress={() => onAct(o.id, 'cancelled', 'Cancelled — plates released')}
                      className="h-9 w-9 items-center justify-center rounded-full border border-line active:bg-inset">
                      <Ionicons name="close" size={18} color={c.muted} />
                    </Pressable>
                    <Pressable onPress={() => onAct(o.id, 'cooking', 'Cooking started 🍳')} className="h-9 flex-row items-center gap-1 rounded-full bg-accent px-3 active:bg-accent-press">
                      <Ionicons name="flame-outline" size={15} color={c.onAccent} />
                      <Text className="font-sans-sb text-[12px] text-on-accent">Cook</Text>
                    </Pressable>
                  </View>
                ) : o.status === 'cooking' ? (
                  <View className="flex-row items-center gap-1.5">
                    <Pressable accessibilityRole="button" accessibilityLabel="Cancel this order"
                      onPress={() => onAct(o.id, 'cancelled', 'Cancelled — plates released')}
                      className="h-9 w-9 items-center justify-center rounded-full border border-line active:bg-inset">
                      <Ionicons name="close" size={18} color={c.muted} />
                    </Pressable>
                    <Pressable onPress={() => onAct(o.id, 'delivered', 'Marked delivered 🍽️')} className="h-9 flex-row items-center gap-1 rounded-full bg-success px-3 active:opacity-90">
                      <Ionicons name="bag-check-outline" size={15} color="#fff" />
                      <Text className="font-sans-sb text-[12px] text-white">Delivered</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Badge label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className={`flex-1 rounded-2xl px-3 py-2 ${accent ? 'bg-accent-soft' : 'bg-inset'}`}>
      <Text className={`font-display text-[18px] ${accent ? 'text-accent' : 'text-ink'}`}>{value}</Text>
      <Text className="font-sans text-[11px] text-muted">{label}</Text>
    </View>
  );
}
