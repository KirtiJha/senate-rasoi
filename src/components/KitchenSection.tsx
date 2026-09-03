import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Empty } from './Empty';
import { MessageIconButton } from './MessageNeighbour';
import { Avatar, Badge, Button, Container, VegMark } from './ui';
import { useAuth } from '../context/auth';
import { ChefFeedbackList } from './food/ChefFeedbackList';
import { RepeatList } from './food/RepeatDish';
import { useConfirm } from '../context/confirm';
import { useToast } from '../context/toast';
import { fetchMyKitchen, listChefOrders, orderTotal, setOrderStatus, statusMessageForFoodie, waLink, withdrawDish } from '../lib/dishes';
import { haptics } from '../lib/haptics';
import { subscribeToOrders } from '../lib/orders';
import { fetchOrderPayments, markReceived, OrderPayment } from '../lib/payments';
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
  const confirm = useConfirm();
  const { userId } = useAuth();
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [ordersByDish, setOrdersByDish] = useState<Record<string, ChefOrder[]>>({});
  const [payments, setPayments] = useState<Record<string, OrderPayment>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      // The chef's own dishes, not the public board filtered down: the board
      // hides anything before today and anything withdrawn, which is exactly
      // where the orders still waiting on a chef end up.
      const mine = await fetchMyKitchen(userId);
      setDishes(mine);
      const entries = await Promise.all(mine.map(async (d) => [d.id, await listChefOrders(d.id)] as const));
      setOrdersByDish(Object.fromEntries(entries));
      // Who has actually paid. The chef could see this only by leaving for the
      // Payments ledger and matching names to dishes by hand.
      setPayments(await fetchOrderPayments(entries.flatMap(([, os]) => os.map((o) => o.id))));
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

  /** Confirm the money arrived. Only the payee may, and the RPC enforces it. */
  const confirmPaid = async (paymentId: string) => {
    try {
      haptics.success();
      const ok = await markReceived(paymentId);
      toast.show(ok ? 'Marked as received ✅' : 'Could not confirm this payment');
      await load();
    } catch (e) {
      console.error(e);
      toast.show('Could not confirm this payment — try again');
    }
  };

  /**
   * Take a dish off the board without touching the orders already on it.
   *
   * The only other exit was "Remove", which 0092 blocks the moment somebody
   * has ordered — correctly, since deleting would take their order and their
   * review with it. That left a chef who could not cook with no move at all.
   */
  const withdraw = async (dish: DishRow) => {
    const open = (ordersByDish[dish.id] ?? []).filter(
      (o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'cooking',
    ).length;
    const ok = await confirm({
      title: 'Stop taking orders?',
      message: open
        ? `"${dish.dish_name}" comes off the board. The ${open} order${open === 1 ? '' : 's'} already on it stay — decline or cancel each one to let those neighbours know.`
        : `"${dish.dish_name}" comes off the board. Nobody has ordered it, so nothing else changes.`,
      confirmLabel: 'Stop taking orders',
      destructive: true,
    });
    if (!ok) return;
    try {
      const done = await withdrawDish(dish.id);
      toast.show(done ? 'Taken off the board' : 'Could not withdraw this dish');
      await load();
    } catch {
      toast.show('Could not withdraw — try again');
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
              <KitchenDishCard
                key={dish.id}
                dish={dish}
                orders={ordersByDish[dish.id] ?? []}
                payments={payments}
                onAct={act}
                onConfirmPaid={confirmPaid}
                onWithdraw={withdraw}
              />
            ))}
            <Pressable
              onPress={postDish}
              className="mb-2 flex-row items-center justify-center gap-1.5 rounded-2xl border border-line py-3 active:bg-inset"
            >
              <Ionicons name="add" size={16} color="#9CA3AF" />
              <Text className="font-sans-sb text-[13px] text-muted">Post a dish</Text>
            </Pressable>

            {/* Reviews, where the cook will actually see them. */}
            <ChefFeedbackList />
          </>
        )}
      </Container>
    </ScrollView>
  );
}

function KitchenDishCard({
  dish,
  orders,
  payments,
  onAct,
  onConfirmPaid,
  onWithdraw,
}: {
  dish: DishRow;
  orders: ChefOrder[];
  payments: Record<string, OrderPayment>;
  onAct: (orderId: string, status: OrderStatus, msg: string) => void;
  onConfirmPaid: (paymentId: string) => void;
  onWithdraw: (dish: DishRow) => void;
}) {
  const c = useThemeColors();
  const router = useRouter();
  const today = new Date().toLocaleDateString('en-CA');
  const past = dish.serve_date < today;
  const withdrawn = !!dish.withdrawn_at;
  // Still taking orders? Then the chef can stop taking them — the guard in
  // 0092 refuses to delete a dish people have ordered and says "withdraw it
  // instead", which until now was advice with no button behind it.
  const canWithdraw = !withdrawn && !past && dish.plates_left > 0;
  const openOrders = orders.filter((o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'cooking').length;
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
        <Pressable className="flex-1 active:opacity-70" onPress={() => router.push(`/dish/${dish.id}` as never)}>
          <Text className="font-display-sb text-[18px] text-ink" numberOfLines={1}>
            {SLOT_EMOJI[dish.slot]} {dish.dish_name}
          </Text>
        </Pressable>
        {cd && !past && !withdrawn ? <Badge label={cd.closed ? 'Closed' : `⏱ ${cd.label.replace('Order in ', '')}`} tone={cd.closed ? 'neutral' : 'accent'} /> : null}
      </View>

      {/* Why this card is still here. The tab used to end at midnight, so a
          dish never had to explain itself. */}
      {withdrawn || past ? (
        <Text className="font-sans mt-1 text-[12px] text-muted">
          {withdrawn ? 'Withdrawn' : `For ${serveLabel(dish.serve_date)}`}
          {openOrders > 0
            ? ` · ${openOrders} order${openOrders === 1 ? '' : 's'} still open`
            : ' · nothing left to do'}
        </Text>
      ) : null}

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
                  {/* Whether this plate has been paid for, next to the plate
                      rather than in a separate ledger the chef has to
                      reconcile by name. */}
                  <PaidLine payment={payments[o.id]} onConfirm={onConfirmPaid} c={c} />
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

      {canWithdraw ? (
        <Pressable
          onPress={() => onWithdraw(dish)}
          className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 active:bg-inset"
        >
          <Ionicons name="pause-circle-outline" size={15} color={c.muted} />
          <Text className="font-sans-sb text-[12px] text-muted">Stop taking orders</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "yesterday" / "Mon 1 Sep" — plain enough to read in a list of past days. */
function serveLabel(serveDate: string): string {
  try {
    const d = new Date(serveDate + 'T00:00:00');
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (serveDate === y.toLocaleDateString('en-CA')) return 'yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return serveDate; }
}

/**
 * The payment state of one order, from the chef's side.
 *
 * A buyer recording a payment is a claim, not proof — only the chef knows the
 * money arrived — so an unconfirmed one is offered as an action rather than
 * shown as settled. Renders nothing until a payment exists: most orders are
 * paid in cash at the door and never generate a row.
 */
function PaidLine({
  payment, onConfirm, c,
}: {
  payment: OrderPayment | undefined;
  onConfirm: (paymentId: string) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  if (!payment) return null;

  if (payment.status === 'received') {
    return (
      <View className="mt-1 flex-row items-center gap-1">
        <Ionicons name="checkmark-circle" size={12} color={c.success} />
        <Text className="text-[11px] font-sans-sb" style={{ color: c.success }}>Paid</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Confirm this payment was received"
      onPress={() => onConfirm(payment.id)}
      hitSlop={6}
      className="mt-1 flex-row items-center gap-1 self-start"
    >
      <Ionicons name="time-outline" size={12} color={c.accent} />
      <Text className="text-[11px] font-sans-sb" style={{ color: c.accent }}>
        Payment sent — confirm
      </Text>
    </Pressable>
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
