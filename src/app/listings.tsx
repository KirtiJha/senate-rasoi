import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState, ScreenHeader, useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { useBlocks } from '../context/blocks';
import { useToast } from '../context/toast';
import { fetchDishes } from '../lib/dishes';
import { fetchAllListings } from '../lib/listings';
import { SERVICES, getService } from '../lib/services';
import { isSupabaseConfigured } from '../lib/supabase';
import { listTiffinPlans } from '../lib/tiffin';
import { DishRow, ListingRow, TiffinPlanWithChef } from '../lib/types';
import { LendItem, fetchItems as fetchBorrowItems } from '../lib/borrow';
import { LostFoundItem, fetchLostFoundItems, LOST_FOUND_CATEGORIES } from '../lib/lostFound';
import { PlaceRow, fetchPlaces, placeTypeMeta } from '../lib/places';
import { layout, useThemeColors } from '../theme';

const LIST_MAX = layout.maxContent; // same content width as every other tab
const FOOD_COLOR = '#E8650A';
const TIFFIN_COLOR = '#F59E0B';
const BORROW_COLOR = '#0891B2';

// Listings, food dishes, tiffins, borrow and lost-found items — unified into one browsable list.
type AllItem =
  | { kind: 'listing'; id: string; raw: ListingRow }
  | { kind: 'dish'; id: string; raw: DishRow }
  | { kind: 'tiffin'; id: string; raw: TiffinPlanWithChef }
  | { kind: 'borrow'; id: string; raw: LendItem }
  | { kind: 'place'; id: string; raw: PlaceRow }
  | { kind: 'lost_found'; id: string; raw: LostFoundItem };

const PLACES_COLOR = '#0D9488';
const LOST_FOUND_COLOR = '#D97706';

interface ItemDisplay {
  title: string;
  catKey: string;
  catLabel: string;
  icon: string;
  priceText: string;
  location: string | null;
}

function display(item: AllItem): ItemDisplay {
  if (item.kind === 'dish') {
    return { title: item.raw.dish_name, catKey: 'food', catLabel: 'Home Food', icon: 'restaurant', priceText: `₹${item.raw.price}`, location: null };
  }
  if (item.kind === 'tiffin') {
    return { title: item.raw.title, catKey: 'tiffin', catLabel: 'Tiffin', icon: 'repeat', priceText: `₹${item.raw.price}/day`, location: null };
  }
  if (item.kind === 'borrow') {
    const b = item.raw;
    return {
      title: b.title,
      catKey: b.kind === 'request' ? 'borrow-request' : 'borrow-offer',
      catLabel: b.kind === 'request' ? '🙏 Needs to borrow' : '🤝 Lending',
     
      icon: 'swap-horizontal',
      priceText: 'Free',
      location: b.owner?.flat ? `Flat ${b.owner.flat}` : null,
    };
  }
  if (item.kind === 'place') {
    const p = item.raw;
    const m = placeTypeMeta(p.place_type);
    return {
      title: p.name,
      catKey: 'places',
      catLabel: `📍 ${m.label}`,
     
      icon: m.icon,
      priceText: '—',
      location: p.address ?? null,
    };
  }
  if (item.kind === 'lost_found') {
    const lf = item.raw;
    const lfCat = LOST_FOUND_CATEGORIES.find((c) => c.key === lf.category) ?? LOST_FOUND_CATEGORIES[LOST_FOUND_CATEGORIES.length - 1];
    return {
      title: lf.title,
      catKey: lf.kind === 'lost' ? 'lost_found-lost' : 'lost_found-found',
      catLabel: lf.kind === 'lost' ? '🔍 Lost' : '📦 Found',
     
      icon: lfCat.icon,
      priceText: '—',
      location: lf.owner?.flat ? `Flat ${lf.owner.flat}` : null,
    };
  }
  const l = item.raw;
  const cat = getService(l.category);
  return {
    title: l.is_referral ? l.referral_name ?? l.title : l.title,
    catKey: l.category,
    catLabel: cat?.label ?? l.category,
    icon: (cat?.icon as string) ?? 'grid-outline',
    priceText: l.price != null ? `₹${l.price.toLocaleString('en-IN')}${l.price_unit ? ` ${l.price_unit}` : ''}` : '—',
    location: l.location,
  };
}

export default function AllListingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId } = useAuth();
  const { filterBlocked } = useBlocks();

  const [items, setItems] = useState<AllItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filterChips = useMemo(() => [
    { key: 'food', label: 'Home Food', icon: 'restaurant' },
    { key: 'tiffin', label: 'Tiffin', icon: 'repeat' },
    { key: 'borrow-offer', label: '🤝 Lending', icon: 'swap-horizontal' },
    { key: 'borrow-request', label: '🙏 Needs', icon: 'hand-left-outline' },
    { key: 'lost_found-lost', label: '🔍 Lost', icon: 'search' },
    { key: 'lost_found-found', label: '📦 Found', icon: 'search' },
    { key: 'places', label: '📍 Nearby', icon: 'location' },
    ...SERVICES.filter((s) => s.kind === 'listing').map((s) => ({ key: s.key, label: s.label, color: c.accent, icon: s.icon })),
  ], []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      const [listings, dishes, tiffins, borrows, places, lostFounds] = await Promise.all([
        fetchAllListings(communityId, 0, 200),
        fetchDishes(communityId).catch(() => [] as DishRow[]),
        listTiffinPlans(communityId).catch(() => [] as TiffinPlanWithChef[]),
        fetchBorrowItems({}, communityId).catch(() => [] as LendItem[]),
        fetchPlaces({}, communityId).catch(() => [] as PlaceRow[]),
        fetchLostFoundItems({ openOnly: true }, communityId).catch(() => [] as LostFoundItem[]),
      ]);
      setItems([
        ...dishes.map((d): AllItem => ({ kind: 'dish', id: d.id, raw: d })),
        ...tiffins.map((t): AllItem => ({ kind: 'tiffin', id: t.id, raw: t })),
        ...borrows.map((b): AllItem => ({ kind: 'borrow', id: b.id, raw: b })),
        ...places.map((p): AllItem => ({ kind: 'place', id: p.id, raw: p })),
        ...lostFounds.map((lf): AllItem => ({ kind: 'lost_found', id: lf.id, raw: lf })),
        ...listings.map((l): AllItem => ({ kind: 'listing', id: l.id, raw: l })),
      ]);
      setLoadFailed(false);
    } catch (e) {
      console.error('listings: load failed', e);
      setLoadFailed(true);
    } finally { setLoading(false); }
  }, [communityId, toast]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCategory = category ? items.filter((i) => display(i).catKey === category) : items;
    const bySearch = !q ? byCategory : byCategory.filter((i) => {
      const d = display(i);
      const raw = i.raw as unknown as Record<string, unknown>;
      const hay = [
        d.title, d.catLabel, d.location, d.priceText,
        typeof raw.description === 'string' ? raw.description : null,
        typeof raw.note === 'string' ? raw.note : null,
        (raw.owner as { name?: string } | undefined)?.name,
        (raw.chef_name as string | undefined),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    // Content from blocked members never appears in the unified feed.
    return filterBlocked(bySearch, (i) =>
      i.kind === 'listing' ? i.raw.owner_user_id
      : i.kind === 'borrow' ? i.raw.owner_user_id
      : i.kind === 'lost_found' ? i.raw.owner_user_id
      : i.kind === 'dish' ? i.raw.chef_user_id
      : null);
  }, [items, category, query, filterBlocked]);

  /**
   * A row opens the thing. Contacting happens on the detail screen.
   *
   * There used to be a second, green button on every row that fired WhatsApp
   * directly — and for a listing it also silently recorded an inquiry the
   * person had not written yet. It was the last place in the app where
   * WhatsApp was the only way through: no in-app option, and nothing at all
   * for a neighbour who never added a number. On a dish it skipped ordering
   * entirely, messaging the cook about plates that were never reserved.
   *
   * Every detail screen now offers both channels properly — the inquiry sheet,
   * the order sheet, Message in Aangan — so the row does not need to guess
   * which one you meant.
   */
  const openItem = (i: AllItem) => {
    if (i.kind === 'listing') router.push(`/listing/${i.raw.id}` as any);
    else if (i.kind === 'borrow') router.push(`/borrow/${i.raw.id}` as any);
    else if (i.kind === 'place') router.push(`/place/${i.raw.id}` as any);
    else if (i.kind === 'lost_found') router.push(`/lost-found/${i.raw.id}` as any);
    else router.push('/food' as any);
  };

  const chipRow = (
    <>
      <Pressable
        onPress={() => setCategory(null)}
        className={`rounded-full px-3 py-1.5 ${!category ? 'bg-accent' : 'bg-inset'}`}
      >
        <Text className={`text-[12px] font-sans-sb ${!category ? 'text-on-accent' : 'text-muted'}`}>All</Text>
      </Pressable>
      {filterChips.map((svc) => (
        <Pressable
          key={svc.key}
          onPress={() => setCategory(category === svc.key ? null : svc.key)}
          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ backgroundColor: category === svc.key ? c.accent : c.accentSoft }}
        >
          <Ionicons name={svc.icon as any} size={11} color={category === svc.key ? c.onAccent : c.accent} />
          <Text className="text-[12px] font-sans-sb" style={{ color: category === svc.key ? c.onAccent : c.accent }}>
            {svc.label}
          </Text>
        </Pressable>
      ))}
    </>
  );

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        showBack
        icon="pricetags-outline"
        title="All listings"
        onAdd={() => router.push('/post' as any)}
        addLabel="New listing"
        subBar={
          isDesktop ? (
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>{chipRow}</View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4" contentContainerStyle={{ gap: 6 }}>
              {chipRow}
            </ScrollView>
          )
        }
      />

      <View style={{ flex: 1, width: '100%', maxWidth: LIST_MAX, alignSelf: 'center' }}>
        <View className="px-4 pb-1 pt-3">
          <View
            className="flex-row items-center gap-2 rounded-full border border-line bg-surface px-3.5"
            style={{ height: 44 }}
          >
            <Ionicons name="search" size={16} color={c.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search what neighbours have posted"
              placeholderTextColor={c.faint}
              className="flex-1 text-[14px] text-ink"
              style={{ outline: 'none' } as never}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={c.faint} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <FlashList
          data={loading ? [] : filtered}
          keyExtractor={(item: AllItem) => `${item.kind}:${item.id}`}
          renderItem={({ item }: { item: AllItem }) => (
            <ItemRow item={item} isDesktop={isDesktop} onOpen={() => openItem(item)} c={c} />
          )}
          ListHeaderComponent={
            isDesktop && filtered.length > 0 ? (
              <View className="flex-row items-center gap-3 px-3 pb-2 pt-1">
                <View style={{ width: 36 }} />
                <Text className="flex-1 text-[11px] font-sans-sb uppercase tracking-wider text-faint">Listing</Text>
                <Text style={{ width: 130 }} className="text-[11px] font-sans-sb uppercase tracking-wider text-faint">Category</Text>
                <Text style={{ width: 100 }} className="text-[11px] font-sans-sb uppercase tracking-wider text-faint">Price</Text>
                <View style={{ width: 186 }} />
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: 13, paddingTop: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? (
              <View>
                {Array.from({ length: 8 }).map((_, i) => (
                  <View key={i} className="flex-row items-center gap-3 border-b border-line px-3 py-3">
                    <View className="h-9 w-9 rounded-xl bg-inset animate-pulse" />
                    <View className="flex-1 gap-1.5">
                      <View className="h-3.5 w-1/2 rounded bg-inset animate-pulse" />
                      <View className="h-3 w-1/3 rounded bg-inset animate-pulse" />
                    </View>
                  </View>
                ))}
              </View>
            ) : loadFailed ? (
              <ErrorState
                title="Couldn't load listings"
                message="Nothing has been taken down — we just couldn't reach them. Try again."
                onRetry={onRefresh}
                retrying={refreshing}
              />
            ) : (
              <View className="items-center py-20">
                <Text style={{ fontSize: 40 }} className="mb-3">🗂️</Text>
                <Text className="font-display text-xl text-ink mb-1">{category ? 'Nothing here yet' : 'Nothing posted yet'}</Text>
                <Text className="font-sans text-[14px] text-muted text-center max-w-xs">
                  Dishes, tiffins and listings your neighbours post show up here.
                </Text>
              </View>
            )
          }
        />
      </View>
    </View>
  );
}

function ItemRow({
  item, isDesktop, onOpen, c,
}: {
  item: AllItem;
  isDesktop: boolean;
  onOpen: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const d = display(item);
  const sold = item.kind === 'listing' && (item.raw as { status?: string }).status === 'sold';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={d.title} onPress={onOpen}
      className="flex-row items-center gap-3 border-b border-line px-3 py-3 active:bg-inset"
      style={{ opacity: sold ? 0.55 : 1 }}>
      <View className="h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: c.accentSoft }}>
        <Ionicons name={d.icon as any} size={18} color={c.accent} />
      </View>

      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{d.title}</Text>
        {!isDesktop ? (
          <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>
            {d.catLabel}{d.priceText !== '—' ? ` · ${d.priceText}` : ''}
          </Text>
        ) : d.location ? (
          <Text className="font-sans text-[12px] text-faint" numberOfLines={1}>📍 {d.location}</Text>
        ) : null}
      </View>

      {isDesktop ? (
        <>
          <Text style={{ width: 130 }} className="text-[13px] font-sans-md text-muted" numberOfLines={1}>{d.catLabel}</Text>
          <Text style={{ width: 100 }} className="text-[13px] font-sans-sb text-accent" numberOfLines={1}>
            {sold ? '' : d.priceText}
          </Text>
          <View className="flex-row items-center justify-end gap-2" style={{ width: 186 }}>
            {sold ? (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
                <Text className="text-[11px] font-sans-sb uppercase" style={{ color: c.muted }}>Sold</Text>
              </View>
            ) : null}
            <RowBtn icon="open-outline" label={item.kind === 'dish' || item.kind === 'tiffin' ? 'Order' : 'View'} onPress={onOpen} c={c} />
          </View>
        </>
      ) : (
        sold ? (
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.inset }}>
            <Text className="text-[11px] font-sans-sb uppercase" style={{ color: c.muted }}>Sold</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={c.faint} />
        )
      )}
    </Pressable>
  );
}

function RowBtn({
  icon, label, onPress, c,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-xl border px-2.5 py-1.5 active:opacity-80"
      style={{ borderColor: c.line, backgroundColor: c.inset }}
    >
      <Ionicons name={icon} size={14} color={c.muted} />
      <Text className="text-[12px] font-sans-sb" style={{ color: c.muted }}>{label}</Text>
    </Pressable>
  );
}
