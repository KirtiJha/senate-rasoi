import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Empty } from './Empty';
import { Avatar, Badge, Button, Container, VegMark } from './ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { fetchDishes, listChefOrders, setOrderStatus, statusMessageForFoodie, waLink } from '../lib/dishes';
import { haptics } from '../lib/haptics';
import { subscribeToOrders } from '../lib/orders';
import { chefTiffinForDate, deleteTiffinPlan, listMyTiffinPlans, setPlanActive, todayStr } from '../lib/tiffin';
import { countdown } from '../lib/time';
import { ACTIVE_STATUSES, ChefOrder, DishRow, OrderStatus, SLOT_EMOJI, TiffinDayRow, TiffinPlan } from '../lib/types';
import { useThemeColors } from '../theme';
import { daysLabel } from './TiffinCard';

const EARN: OrderStatus[] = ['accepted', 'cooking', 'delivered'];
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

export function KitchenSection() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const { userId } = useAuth();
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [ordersByDish, setOrdersByDish] = useState<Record<string, ChefOrder[]>>({});
  const [plans, setPlans] = useState<TiffinPlan[]>([]);
  const [tiffinRows, setTiffinRows] = useState<TiffinDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [all, myPlans, rows] = await Promise.all([
        fetchDishes(),
        userId ? listMyTiffinPlans(userId) : Promise.resolve([]),
        chefTiffinForDate(todayStr()),
      ]);
      const mine = all.filter((d) => d.chef_user_id === userId);
      setDishes(mine);
      setPlans(myPlans);
      setTiffinRows(rows);
      const entries = await Promise.all(mine.map(async (d) => [d.id, await listChefOrders(d.id)] as const));
      setOrdersByDish(Object.fromEntries(entries));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => subscribeToOrders(load), [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Container narrow>
        {loading ? null : dishes.length === 0 && plans.length === 0 ? (
          <Empty
            icon="👨‍🍳"
            title="Your kitchen is empty"
            action={<Button label="Post your first dish" icon="add" onPress={() => router.push({ pathname: '/post', params: { category: 'food' } })} />}
          >
            Post a one-off dish or a recurring tiffin and manage everything here.
          </Empty>
        ) : (
          <>
            {/* Tiffin services */}
            {plans.length > 0 ? (
              <>
                <Text className="mb-2 font-display text-[16px] text-ink">🍱 Tiffin services</Text>
                {plans.map((p) => (
                  <KitchenTiffinCard
                    key={p.id}
                    plan={p}
                    rows={tiffinRows.filter((r) => r.plan_id === p.id)}
                    onToggle={async () => {
                      await setPlanActive(p.id, !p.active);
                      await load();
                    }}
                    onDelete={async () => {
                      await deleteTiffinPlan(p.id);
                      toast.show('Tiffin removed');
                      await load();
                    }}
                  />
                ))}
                <Pressable
                  onPress={() => router.push({ pathname: '/post', params: { category: 'food', kind: 'tiffin' } })}
                  className="mb-4 flex-row items-center justify-center gap-1.5 rounded-2xl border border-line py-3 active:bg-inset"
                >
                  <Ionicons name="add" size={16} color={c.muted} />
                  <Text className="font-sans-sb text-[13px] text-muted">New tiffin service</Text>
                </Pressable>
              </>
            ) : null}

            {/* One-off dishes */}
            {dishes.length > 0 ? <Text className="mb-2 font-display text-[16px] text-ink">🍽️ Today's dishes</Text> : null}
            {dishes.map((dish) => (
              <KitchenDishCard key={dish.id} dish={dish} orders={ordersByDish[dish.id] ?? []} onAct={act} />
            ))}
            <Pressable
              onPress={() => router.push({ pathname: '/post', params: { category: 'food' } })}
              className="mb-2 flex-row items-center justify-center gap-1.5 rounded-2xl border border-line py-3 active:bg-inset"
            >
              <Ionicons name="add" size={16} color={c.muted} />
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
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const platesOrdered = active.reduce((s, o) => s + o.qty, 0);
  const revenue = orders.filter((o) => EARN.includes(o.status)).reduce((s, o) => s + o.qty * dish.price, 0);
  const cd = countdown(dish.order_by);

  return (
    <View className="mb-4 rounded-3xl border border-line bg-surface p-4">
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
          <Text className="py-2 text-[13px] text-faint">No orders yet — sit tight!</Text>
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
                  <Text className="text-[12px] text-muted">
                    {o.qty} plate{o.qty !== 1 ? 's' : ''} · ₹{o.qty * dish.price}
                  </Text>
                </View>

                {/* message foodie on WhatsApp (free tap-to-notify) */}
                {wa && ACTIVE_STATUSES.includes(o.status) ? (
                  <Pressable
                    onPress={() => openUrl(waLink(wa, statusMessageForFoodie(dish.dish_name, o.status)))}
                    hitSlop={6}
                    className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70"
                  >
                    <Ionicons name="logo-whatsapp" size={17} color={c.success} />
                  </Pressable>
                ) : null}

                {o.status === 'placed' ? (
                  <View className="flex-row items-center gap-1.5">
                    <Pressable onPress={() => onAct(o.id, 'rejected', 'Declined — plates released')} className="h-9 w-9 items-center justify-center rounded-full border border-line active:bg-inset">
                      <Ionicons name="close" size={18} color={c.muted} />
                    </Pressable>
                    <Pressable onPress={() => onAct(o.id, 'accepted', 'Order confirmed ✓')} className="h-9 flex-row items-center gap-1 rounded-full bg-success px-3 active:opacity-90">
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text className="font-sans-sb text-[12px] text-white">Accept</Text>
                    </Pressable>
                  </View>
                ) : o.status === 'accepted' ? (
                  <Pressable onPress={() => onAct(o.id, 'cooking', 'Cooking started 🍳')} className="h-9 flex-row items-center gap-1 rounded-full bg-accent px-3 active:bg-accent-press">
                    <Ionicons name="flame-outline" size={15} color={c.onAccent} />
                    <Text className="font-sans-sb text-[12px] text-on-accent">Cook</Text>
                  </Pressable>
                ) : o.status === 'cooking' ? (
                  <Pressable onPress={() => onAct(o.id, 'delivered', 'Marked delivered 🍽️')} className="h-9 flex-row items-center gap-1 rounded-full bg-success px-3 active:opacity-90">
                    <Ionicons name="bag-check-outline" size={15} color="#fff" />
                    <Text className="font-sans-sb text-[12px] text-white">Delivered</Text>
                  </Pressable>
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
      <Text className="text-[11px] text-muted">{label}</Text>
    </View>
  );
}

function KitchenTiffinCard({
  plan,
  rows,
  onToggle,
  onDelete,
}: {
  plan: TiffinPlan;
  rows: TiffinDayRow[];
  onToggle: () => void;
  onDelete: () => void;
}) {
  const c = useThemeColors();
  const plates = rows.reduce((s, r) => s + r.qty, 0);
  const servesToday = plan.days_of_week.includes(new Date().getDay());

  return (
    <View className={`mb-4 rounded-3xl border border-line bg-surface p-4 ${plan.active ? '' : 'opacity-60'}`}>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-display-sb text-[18px] text-ink" numberOfLines={1}>
          {SLOT_EMOJI[plan.slot]} {plan.title}
        </Text>
        <Pressable onPress={onToggle} hitSlop={6} className="rounded-full bg-inset px-3 py-1.5">
          <Text className="font-sans-sb text-[12px] text-ink">{plan.active ? 'Pause' : 'Resume'}</Text>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full border border-line">
          <Ionicons name="trash-outline" size={15} color={c.nonveg} />
        </Pressable>
      </View>
      <Text className="mt-0.5 text-[12px] text-faint">{daysLabel(plan.days_of_week)} · ₹{plan.price}/day · max {plan.max_per_day}</Text>

      <View className="mt-3 rounded-2xl bg-inset px-3 py-2.5">
        <Text className="mb-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
          {servesToday ? `Today · ${plates} plate${plates !== 1 ? 's' : ''} for ${rows.length} subscriber${rows.length !== 1 ? 's' : ''}` : 'Not served today'}
        </Text>
        {servesToday && rows.length === 0 ? (
          <Text className="text-[13px] text-faint">No active subscribers today.</Text>
        ) : (
          rows.map((r) => (
            <View key={r.subscription_id} className="flex-row items-center gap-2 py-1">
              <Avatar name={r.subscriber_name} size={22} />
              <Text className="flex-1 text-[13px] text-ink" numberOfLines={1}>
                {r.subscriber_name}
                {r.subscriber_flat ? <Text className="text-faint"> · {r.subscriber_flat}</Text> : null}
              </Text>
              <Text className="text-[12px] text-muted">{r.qty} plate{r.qty !== 1 ? 's' : ''}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
