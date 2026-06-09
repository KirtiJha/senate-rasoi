import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { daysLabel } from './TiffinCard';
import { Avatar, Badge, Button, Container, VegMark } from './ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { waLink } from '../lib/dishes';
import {
  cancelSubscription, chefTiffinForDate, deleteTiffinPlan, listMySubscriptions,
  listMyTiffinPlans, setPlanActive, setSubscriptionPaused, todayStr,
} from '../lib/tiffin';
import { SLOT_EMOJI, SubscriptionWithPlan, TiffinDayRow, TiffinPlan } from '../lib/types';
import { useThemeColors } from '../theme';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

/**
 * The Tiffins tab — everything recurring in one place: post & manage the tiffin
 * services you offer (cook side), and the tiffins you subscribe to (eater side).
 */
export function MyTiffinsSection({ onBrowse, onPost }: { onBrowse?: () => void; onPost?: () => void } = {}) {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const { userId } = useAuth();
  const [plans, setPlans] = useState<TiffinPlan[]>([]);
  const [planRows, setPlanRows] = useState<TiffinDayRow[]>([]);
  const [subs, setSubs] = useState<SubscriptionWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const [myPlans, rows, mySubs] = await Promise.all([
        listMyTiffinPlans(userId),
        chefTiffinForDate(todayStr()),
        listMySubscriptions(userId),
      ]);
      setPlans(myPlans);
      setPlanRows(rows);
      setSubs(mySubs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const postTiffin = () => (onPost ? onPost() : router.push({ pathname: '/post', params: { category: 'food', kind: 'tiffin' } }));

  const togglePause = async (s: SubscriptionWithPlan) => {
    await setSubscriptionPaused(s.id, !s.paused);
    toast.show(s.paused ? 'Resumed' : 'Paused');
    await load();
  };

  const cancel = (s: SubscriptionWithPlan) => {
    const run = async () => {
      await cancelSubscription(s.id);
      toast.show('Subscription cancelled');
      await load();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Cancel your ${s.plan?.title ?? 'tiffin'} subscription?`)) run();
    } else {
      Alert.alert('Cancel subscription', `Cancel your ${s.plan?.title ?? 'tiffin'} subscription?`, [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: run },
      ]);
    }
  };

  const empty = !loading && plans.length === 0 && subs.length === 0;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Container narrow>
        {empty ? (
          <View className="items-center px-6 py-16">
            <Text style={{ fontSize: 34 }} className="mb-3">🍱</Text>
            <Text className="mb-1.5 font-display text-xl text-ink">No tiffins yet</Text>
            <Text className="mb-5 max-w-xs text-center text-[14px] leading-6 text-muted">
              Subscribe to a neighbour's daily tiffin from Discover, or post your own tiffin service.
            </Text>
            <View className="flex-row gap-2">
              <Button label="Browse tiffins" variant="outline" size="sm" icon="compass-outline" onPress={() => (onBrowse ? onBrowse() : router.push('/food' as any))} />
              <Button label="Post a tiffin" icon="add" size="sm" onPress={postTiffin} />
            </View>
          </View>
        ) : (
          <>
            {/* Cook side — tiffin services I offer */}
            {plans.length > 0 ? (
              <Text className="mb-2 font-display text-[16px] text-ink">🍱 My tiffin services</Text>
            ) : null}
            {plans.map((p) => (
              <TiffinPlanCard
                key={p.id}
                plan={p}
                rows={planRows.filter((r) => r.plan_id === p.id)}
                onToggle={async () => { await setPlanActive(p.id, !p.active); await load(); }}
                onDelete={async () => { await deleteTiffinPlan(p.id); toast.show('Tiffin removed'); await load(); }}
              />
            ))}
            <Pressable
              onPress={postTiffin}
              className="mb-4 flex-row items-center justify-center gap-1.5 rounded-2xl border border-line py-3 active:bg-inset"
            >
              <Ionicons name="add" size={16} color={c.muted} />
              <Text className="font-sans-sb text-[13px] text-muted">Post a tiffin service</Text>
            </Pressable>

            {/* Eater side — tiffins I subscribe to */}
            {subs.length > 0 ? (
              <Text className="mb-2 mt-1 font-display text-[16px] text-ink">🥡 My subscriptions</Text>
            ) : null}
            {subs.map((s) => {
              const plan = s.plan;
              const wa = plan?.chef?.whatsapp;
              return (
                <View key={s.id} className="mb-3 rounded-3xl border border-line bg-surface p-3.5">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-inset">
                      <Text style={{ fontSize: 24 }}>🍱</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        {plan ? <VegMark type={plan.veg_type} size={12} /> : null}
                        <Text className="flex-1 font-display-sb text-[16px] text-ink" numberOfLines={1}>{plan?.title ?? 'Tiffin'}</Text>
                      </View>
                      <View className="mt-0.5 flex-row items-center gap-1.5">
                        <Avatar name={plan?.chef?.name ?? '?'} size={16} />
                        <Text className="text-[12px] text-muted" numberOfLines={1}>
                          {plan?.chef?.name ?? 'Chef'} · {plan ? `${SLOT_EMOJI[plan.slot]} ${daysLabel(plan.days_of_week)}` : ''}
                        </Text>
                      </View>
                    </View>
                    <Text className="font-display text-[16px] text-ink">₹{(plan?.price ?? 0) * s.qty}<Text className="font-sans text-[11px] text-faint">/day</Text></Text>
                  </View>

                  <View className="mt-2.5 flex-row items-center justify-between border-t border-line pt-2.5">
                    <Badge label={s.paused ? '⏸ Paused' : `${s.qty}/day · Active`} tone={s.paused ? 'neutral' : 'success'} />
                    <View className="flex-row items-center gap-3">
                      {wa ? (
                        <Pressable onPress={() => openUrl(waLink(wa, `Hi ${plan?.chef?.name ?? ''}! About my ${plan?.title ?? ''} tiffin…`))} hitSlop={6}>
                          <Ionicons name="logo-whatsapp" size={18} color={c.success} />
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => togglePause(s)} hitSlop={6}>
                        <Text className="text-[12px] font-sans-sb text-accent">{s.paused ? 'Resume' : 'Pause'}</Text>
                      </Pressable>
                      <Pressable onPress={() => cancel(s)} hitSlop={6}>
                        <Text className="text-[12px] font-sans-sb text-nonveg">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </Container>
    </ScrollView>
  );
}

function TiffinPlanCard({
  plan, rows, onToggle, onDelete,
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
