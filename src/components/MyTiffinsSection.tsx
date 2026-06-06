import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Empty } from './Empty';
import { daysLabel } from './TiffinCard';
import { Avatar, Badge, Button, Container, VegMark } from './ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { waLink } from '../lib/dishes';
import { cancelSubscription, listMySubscriptions, setSubscriptionPaused } from '../lib/tiffin';
import { SLOT_EMOJI, SubscriptionWithPlan } from '../lib/types';
import { useThemeColors } from '../theme';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

export function MyTiffinsSection() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const { userId } = useAuth();
  const [subs, setSubs] = useState<SubscriptionWithPlan[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setSubs(await listMySubscriptions(userId));
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Container narrow>
        {subs.length === 0 ? (
          <Empty
            icon="🍱"
            title="No tiffin subscriptions"
            action={<Button label="Find a tiffin service" icon="compass-outline" onPress={() => router.push('/')} />}
          >
            Subscribe to a neighbour's daily tiffin and it'll show here — pause or cancel anytime.
          </Empty>
        ) : (
          subs.map((s) => {
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
          })
        )}
      </Container>
    </ScrollView>
  );
}
