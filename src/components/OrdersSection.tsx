import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Empty } from './Empty';
import { Avatar, Badge, Button, Container } from './ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { waLink } from '../lib/dishes';
import { cancelOrder, canSelfCancel, listMyOrders, subscribeToOrders } from '../lib/orders';
import { MyOrder, OrderStatus, SLOT_EMOJI } from '../lib/types';
import { useThemeColors } from '../theme';

const STATUS: Record<OrderStatus, { label: string; tone: 'accent' | 'success' | 'neutral' }> = {
  placed: { label: '⏳ Waiting for chef', tone: 'accent' },
  accepted: { label: '✓ Confirmed', tone: 'success' },
  cooking: { label: '🍳 Cooking now', tone: 'accent' },
  delivered: { label: '🍽️ Delivered', tone: 'success' },
  rejected: { label: 'Declined', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

export function OrdersSection({ onBrowse }: { onBrowse?: () => void } = {}) {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const { userId } = useAuth();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setOrders(await listMyOrders(userId));
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => subscribeToOrders(load), [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const doCancel = (order: MyOrder) => {
    const run = async () => {
      const ok = await cancelOrder(order.id);
      toast.show(ok ? 'Order cancelled' : 'Too late to self-cancel — please call the chef');
      await load();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Cancel your order of ${order.dish?.dish_name ?? 'this dish'}?`)) run();
    } else {
      Alert.alert('Cancel order', `Cancel your order of ${order.dish?.dish_name ?? 'this dish'}?`, [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel order', style: 'destructive', onPress: run },
      ]);
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
        {orders.length === 0 ? (
          <Empty
            icon="🧺"
            title="No orders yet"
            action={<Button label="Browse today's menu" icon="compass-outline" onPress={() => (onBrowse ? onBrowse() : router.push('/food' as any))} />}
          >
            Find something delicious from your neighbours and place your first order.
          </Empty>
        ) : (
          orders.map((o) => {
            const st = STATUS[o.status];
            const selfCancel = canSelfCancel(o);
            const active = o.status === 'placed' || o.status === 'accepted' || o.status === 'cooking';
            const dimmed = o.status === 'cancelled' || o.status === 'rejected';
            const wa = o.dish?.whatsapp;
            return (
              <View key={o.id} className={`mb-3 rounded-3xl border border-line bg-surface p-3.5 ${dimmed ? 'opacity-60' : ''}`}>
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-inset">
                    <Text style={{ fontSize: 24 }}>{o.dish ? SLOT_EMOJI[o.dish.slot] : '🍽️'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-display-sb text-[16px] text-ink" numberOfLines={1}>{o.dish?.dish_name ?? 'Dish'}</Text>
                    <View className="mt-0.5 flex-row items-center gap-1.5">
                      <Avatar name={o.dish?.chef_name ?? '?'} size={16} />
                      <Text className="text-[12px] text-muted" numberOfLines={1}>
                        {o.dish?.chef_name ?? 'Chef'} · {o.qty} plate{o.qty !== 1 ? 's' : ''} · {orderDate(o.created_at)}
                      </Text>
                    </View>
                  </View>
                  <Text className="font-display text-[18px] text-ink">₹{(o.dish?.price ?? 0) * o.qty}</Text>
                </View>

                <View className="mt-2.5 flex-row items-center justify-between border-t border-line pt-2.5">
                  <Badge label={st.label} tone={st.tone} />
                  <View className="flex-row items-center gap-3">
                    {active && wa ? (
                      <Pressable onPress={() => openUrl(waLink(wa, `Hi ${o.dish?.chef_name ?? ''}! About my Senate Rasoi order for ${o.dish?.dish_name ?? ''}…`))} hitSlop={6}>
                        <Ionicons name="logo-whatsapp" size={18} color={c.success} />
                      </Pressable>
                    ) : null}
                    {selfCancel ? (
                      <Pressable onPress={() => doCancel(o)} hitSlop={6}>
                        <Text className="text-[12px] font-sans-sb text-nonveg">Cancel</Text>
                      </Pressable>
                    ) : active && wa ? (
                      <Pressable onPress={() => openUrl(waLink(wa, `Hi ${o.dish?.chef_name ?? ''}! I need to cancel my order for ${o.dish?.dish_name ?? ''}.`))} hitSlop={6}>
                        <Text className="text-[12px] font-sans-sb text-muted">Call chef to cancel</Text>
                      </Pressable>
                    ) : wa ? (
                      <Pressable onPress={() => openUrl(waLink(wa, `Hi ${o.dish?.chef_name ?? ''}! I'd like to order ${o.dish?.dish_name ?? ''} again 🍲`))} hitSlop={6}>
                        <Text className="text-[12px] font-sans-sb text-accent">Order again</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </Container>
    </ScrollView>
  );
}

function orderDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
