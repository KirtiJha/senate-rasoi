import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DishCard } from '../components/DishCard';
import { Empty } from '../components/Empty';
import { FoodDisclaimer } from '../components/FoodDisclaimer';
import { KitchenSection } from '../components/KitchenSection';
import { MyTiffinsSection } from '../components/MyTiffinsSection';
import { OrderModal } from '../components/OrderModal';
import { OrdersSection } from '../components/OrdersSection';
import { SetupBanner } from '../components/SetupBanner';
import { SubscribeModal } from '../components/SubscribeModal';
import { TiffinCard } from '../components/TiffinCard';
import { TiffinEditSheet } from '../components/TiffinEditSheet';
import PostScreen from './post';
import { Container, DishCardSkeleton, LiveDot, ScreenHeader, useResponsive } from '../components/ui';
import { useThemeColors } from '../theme';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { useConfirm } from '../context/confirm';
import { buildWhatsAppOrderLink, ChefReputation, deleteDish, fetchChefReputations, fetchDishes, getCachedDishes, placeOrder, subscribeToDishes, waLink } from '../lib/dishes';
import { haptics } from '../lib/haptics';
import { shareDish } from '../lib/share';
import { isSupabaseConfigured } from '../lib/supabase';
import { listTiffinPlans, myActiveSubscriptionIds, subscribe, todayStr as tdy } from '../lib/tiffin';
import { DishRow, SLOTS, Slot, SLOT_EMOJI, TiffinPlanWithChef } from '../lib/types';

const FILTERS: ('All' | Slot)[] = ['All', ...SLOTS];

type FoodTab = 'discover' | 'orders' | 'kitchen' | 'tiffins';
const FOOD_TABS: { key: FoodTab; label: string }[] = [
  { key: 'discover', label: 'Discover' },
  { key: 'orders', label: 'Orders' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'tiffins', label: 'Tiffins' },
];

export default function FoodScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, communityId, isAdmin } = useAuth();
  const { columns, isDesktop } = useResponsive();
  const c = useThemeColors();
  // /food?tab=orders — so a notification or a link from a dish can land on
  // the right tab instead of dumping you on the menu to find it yourself.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<FoodTab>(
    FOOD_TABS.some((t) => t.key === tabParam) ? (tabParam as FoodTab) : 'discover',
  );
  const [posting, setPosting] = useState<'dish' | 'tiffin' | null>(null);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [reputations, setReputations] = useState<Map<string, ChefReputation>>(new Map());
  const [filter, setFilter] = useState<'All' | Slot>('All');
  const [vegOnly, setVegOnly] = useState(false);
  const [when, setWhen] = useState<'today' | 'upcoming'>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orderDish, setOrderDish] = useState<DishRow | null>(null);
  const [plans, setPlans] = useState<TiffinPlanWithChef[]>([]);
  const [subIds, setSubIds] = useState<Set<string>>(new Set());
  const [subPlan, setSubPlan] = useState<TiffinPlanWithChef | null>(null);
  const [editTiffin, setEditTiffin] = useState<TiffinPlanWithChef | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const [rows, planRows, ids] = await Promise.all([
        fetchDishes(communityId),
        listTiffinPlans(communityId),
        userId ? myActiveSubscriptionIds(userId) : Promise.resolve(new Set<string>()),
      ]);
      setDishes(rows);
      setPlans(planRows);
      setSubIds(ids);

      // Standings load after the board, not with it. They are decoration on a
      // dish you can already see and order — blocking the food on them, or
      // failing the load because they failed, would trade the thing that
      // matters for the thing that helps.
      const chefs = rows.map((d) => d.chef_user_id).filter(Boolean) as string[];
      fetchChefReputations(chefs).then(setReputations).catch(() => {});
    } catch (e) {
      console.error(e);
      toast.show('Could not load the board — check your connection');
    } finally {
      setLoading(false);
    }
  }, [toast, userId, communityId]);

  useEffect(() => {
    let alive = true;
    getCachedDishes().then((cached) => {
      if (alive && cached.length) {
        setDishes(cached);
        setLoading(false);
      }
    });
    load();
    const unsub = subscribeToDishes(() => load());
    return () => {
      alive = false;
      unsub();
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleConfirmOrder = async (dish: DishRow, qty: number, via: 'app' | 'whatsapp') => {
    setOrderDish(null);
    try {
      const orderId = await placeOrder(dish.id, qty);
      if (!orderId) {
        haptics.warning();
        toast.show('Sorry — those plates just went, or ordering closed. Refreshing…');
        await load();
        return;
      }
      haptics.success();
      // The order itself notifies the chef either way; WhatsApp only opens
      // when it was asked for.
      if (via === 'whatsapp') {
        const url = buildWhatsAppOrderLink(dish, qty);
        toast.show('Plates reserved! Opening WhatsApp 📲');
        if (Platform.OS === 'web') window.open(url, '_blank');
        else Linking.openURL(url);
      } else {
        toast.show(`Plates reserved — ${dish.chef_name} has been notified 🛎️`);
      }
      await load();
    } catch (e) {
      console.error(e);
      toast.show('Could not place the order — please try again');
    }
  };

  const handleSubscribe = async (plan: TiffinPlanWithChef, qty: number, startToday: boolean, via: 'app' | 'whatsapp') => {
    setSubPlan(null);
    if (!userId) return;
    try {
      const start = startToday ? tdy() : new Date(Date.now() + 86400_000).toLocaleDateString('en-CA');
      await subscribe(plan.id, userId, qty, start);
      haptics.success();
      // 0104 notifies the chef from the subscription row itself, so WhatsApp
      // is a courtesy now rather than the delivery mechanism.
      if (via === 'whatsapp') {
        toast.show('Subscribed! Opening WhatsApp 📲');
        const msg = `Hi ${plan.chef?.name ?? ''}! I subscribed to your *${plan.title}* tiffin on Aangan (${qty}/day). Thanks!`;
        const url = waLink(plan.chef?.whatsapp, msg);
        if (Platform.OS === 'web') window.open(url, '_blank');
        else Linking.openURL(url);
      } else {
        toast.show(`Subscribed — ${plan.chef?.name ?? 'the cook'} has been notified 🍱`);
      }
      await load();
    } catch (e) {
      console.error(e);
      toast.show('Could not subscribe — please try again');
    }
  };

  const handleShare = async (dish: DishRow) => {
    haptics.tap();
    const res = await shareDish(dish);
    if (res === 'unsupported') toast.show("Sharing isn't available here — try on your phone");
  };

  const handleRemove = (dish: DishRow) => {
    const doDelete = async () => {
      try {
        const ok = await deleteDish(dish.id);
        haptics.success();
        toast.show(ok ? 'Your dish has been removed ✅' : 'Could not remove this dish');
        await load();
      } catch (e) {
        console.error(e);
        toast.show('Could not remove — check your connection');
      }
    };
    confirm({ title: 'Remove post', message: `Remove "${dish.dish_name}" from the board?`, confirmLabel: 'Remove', destructive: true }).then((ok) => { if (ok) doDelete(); });
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const filtered = dishes
    .filter((d) => (when === 'today' ? d.serve_date === todayStr : d.serve_date > todayStr))
    .filter((d) => (filter === 'All' ? true : d.slot === filter))
    .filter((d) => (vegOnly ? d.veg_type === 'Veg' : true));
  const upcomingCount = dishes.filter((d) => d.serve_date > todayStr).length;
  const hero = filtered[0];
  const rest = filtered.slice(1);
  const daypart = getDaypart();

  const renderCard = (dish: DishRow, isHero?: boolean) => (
    <DishCard
      dish={dish}
      owned={!!userId && dish.chef_user_id === userId}
      hero={isHero}
      onOrder={setOrderDish}
      onRemove={handleRemove}
      onShare={handleShare}
      reputation={dish.chef_user_id ? reputations.get(dish.chef_user_id) : undefined}
    />
  );

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="restaurant-outline" title="Home Food" showBack />
      {/* Food tabs — browse the board, plus your own orders & kitchen */}
      <View className="border-b border-line bg-bg px-4 pb-2.5 pt-2.5">
        <Container>
          <View className="flex-row rounded-2xl bg-inset p-1">
            {FOOD_TABS.map((t) => {
              const on = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => { setTab(t.key); setPosting(null); }}
                  className={`flex-1 items-center rounded-xl py-2 ${on ? 'bg-surface' : ''}`}
                >
                  <Text className={`text-[13px] ${on ? 'font-sans-sb text-ink' : 'font-sans-md text-muted'}`}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Container>
      </View>

      {tab === 'orders' ? (
        <OrdersSection onBrowse={() => setTab('discover')} />
      ) : tab === 'kitchen' ? (
        posting === 'dish'
          ? <PostScreen embedded category="food" kind="dish" onDone={() => setPosting(null)} />
          : <KitchenSection onPost={() => setPosting('dish')} />
      ) : tab === 'tiffins' ? (
        posting === 'tiffin'
          ? <PostScreen embedded category="food" kind="tiffin" onDone={() => setPosting(null)} />
          : <MyTiffinsSection onBrowse={() => setTab('discover')} onPost={() => setPosting('tiffin')} />
      ) : (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Container>
          {/* header */}
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[13px] font-sans-md text-accent">{daypart.greeting}</Text>
              <Text className="font-display-x text-[29px] leading-9 text-ink">{daypart.headline}</Text>
            </View>
            <View className="mt-1 flex-row items-center gap-1.5 rounded-full bg-inset px-2.5 py-1">
              <LiveDot color={c.accent} size={6} />
              <Text className="font-sans-sb text-[11px] text-muted">Live</Text>
            </View>
          </View>

          {/* Today / Upcoming + date */}
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row gap-2">
              {(['today', 'upcoming'] as const).map((w) => {
                const on = when === w;
                return (
                  <Pressable
                    key={w}
                    onPress={() => setWhen(w)}
                    className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 ${on ? 'bg-ink' : 'bg-inset'}`}
                  >
                    <Text className={`text-[13px] font-sans-sb ${on ? 'text-bg' : 'text-muted'}`}>
                      {w === 'today' ? 'Today' : 'Upcoming'}
                    </Text>
                    {w === 'upcoming' && upcomingCount > 0 ? (
                      <View className={`rounded-full px-1.5 ${on ? 'bg-bg/25' : 'bg-accent'}`}>
                        <Text className={`text-[10px] font-sans-bold ${on ? 'text-bg' : 'text-on-accent'}`}>{upcomingCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-[12px] font-sans-md text-faint" numberOfLines={1}>{shortDate()}</Text>
          </View>

          {!isSupabaseConfigured && <SetupBanner />}

          {/* filters + veg toggle */}
          <View className="mb-4 flex-row items-center gap-2">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 8 }}
              className="flex-1 -mx-1 px-1"
            >
              {FILTERS.map((f) => {
                const on = filter === f;
                const isNow = f !== 'All' && f === daypart.slot;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2 ${
                      on ? 'border-ink bg-ink' : 'border-line bg-surface active:bg-inset'
                    }`}
                  >
                    <Text className={`text-[13px] font-sans-sb ${on ? 'text-bg' : 'text-ink'}`}>
                      {f === 'All' ? '🍴 All' : `${SLOT_EMOJI[f]} ${f}`}
                    </Text>
                    {isNow ? <View className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-accent' : 'bg-accent'}`} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => setVegOnly((v) => !v)}
              className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
                vegOnly ? 'border-veg bg-[#E4F5EC] dark:bg-[#10271D]' : 'border-line bg-surface active:bg-inset'
              }`}
            >
              <View className={`h-3.5 w-3.5 items-center justify-center rounded-[3px] border-[1.5px] ${vegOnly ? 'border-veg' : 'border-faint'}`}>
                <View className={`h-1.5 w-1.5 rounded-full ${vegOnly ? 'bg-veg' : 'bg-faint'}`} />
              </View>
              <Text className={`text-[12px] font-sans-sb ${vegOnly ? 'text-veg' : 'text-muted'}`}>Veg</Text>
            </Pressable>
          </View>

          {/* Daily tiffin services */}
          {when === 'today' && plans.length > 0 ? (
            <View className="mb-5">
              <Text className="mb-2 font-display text-[16px] text-ink">🍱 Daily tiffin services</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }} className="-mx-1 px-1">
                {plans.map((p) => (
                  <TiffinCard key={p.id} plan={p} subscribed={subIds.has(p.id)} onPress={setSubPlan} onEdit={isAdmin || (!!userId && p.chef_user_id === userId) ? () => setEditTiffin(p) : undefined} width={250} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* content */}
          {loading ? (
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              {Array.from({ length: columns * 2 }).map((_, i) => (
                <View key={i} style={{ width: `${100 / columns}%`, padding: 6 }}>
                  <DishCardSkeleton />
                </View>
              ))}
            </View>
          ) : filtered.length === 0 ? (
            <Empty
              icon="restaurant-outline"
              title={
                when === 'upcoming'
                  ? 'No upcoming dishes'
                  : vegOnly
                    ? 'No veg dishes yet'
                    : filter === 'All'
                      ? 'No dishes yet today'
                      : `Nothing for ${filter} yet`
              }
            >
              Nothing on the menu right now — check back soon. Cooking something? Post it from the Kitchen tab.
            </Empty>
          ) : isDesktop ? (
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              {filtered.map((dish) => (
                <View key={dish.id} style={{ width: `${100 / columns}%`, padding: 6 }}>
                  {renderCard(dish)}
                </View>
              ))}
            </View>
          ) : (
            <>
              {hero ? <View className="mb-3">{renderCard(hero, true)}</View> : null}
              {rest.map((dish) => (
                <View key={dish.id} className="mb-3">
                  {renderCard(dish)}
                </View>
              ))}
            </>
          )}

          <FoodDisclaimer />
        </Container>
      </ScrollView>
      )}

      <OrderModal dish={orderDish} onClose={() => setOrderDish(null)} onConfirm={handleConfirmOrder} />
      <SubscribeModal plan={subPlan} onClose={() => setSubPlan(null)} onConfirm={handleSubscribe} />
      {editTiffin ? (
        <TiffinEditSheet plan={editTiffin} visible={!!editTiffin} onClose={() => setEditTiffin(null)} onSaved={() => { setEditTiffin(null); load(); }} />
      ) : null}
    </View>
  );
}

function getDaypart() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return { greeting: 'Good morning ☀️', headline: "What's for breakfast?", slot: 'Breakfast' as Slot };
  if (h >= 11 && h < 16) return { greeting: 'Good afternoon 🍛', headline: "What's for lunch?", slot: 'Lunch' as Slot };
  if (h >= 16 && h < 22) return { greeting: 'Good evening 🌙', headline: "What's for dinner?", slot: 'Dinner' as Slot };
  return { greeting: 'Late night 🫙', headline: 'Cooking something?', slot: 'Snack' as Slot };
}

function shortDate() {
  try {
    return new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
