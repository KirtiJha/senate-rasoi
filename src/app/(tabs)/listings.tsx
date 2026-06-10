import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { fetchDishes, waLink } from '../../lib/dishes';
import { sendInquiry } from '../../lib/inquiries';
import { buildInquiryWhatsAppLink, fetchAllListings } from '../../lib/listings';
import { SERVICES, getService } from '../../lib/services';
import { isSupabaseConfigured } from '../../lib/supabase';
import { listTiffinPlans } from '../../lib/tiffin';
import { DishRow, ListingRow, TiffinPlanWithChef } from '../../lib/types';
import { layout, useThemeColors } from '../../theme';

const LIST_MAX = layout.maxContent; // same content width as every other tab
const FOOD_COLOR = '#E8650A';
const TIFFIN_COLOR = '#F59E0B';

// Listings, food dishes and tiffins are different tables — here they're unified
// into one browsable list with "Home Food" and "Tiffin" as their own categories.
type AllItem =
  | { kind: 'listing'; id: string; raw: ListingRow }
  | { kind: 'dish'; id: string; raw: DishRow }
  | { kind: 'tiffin'; id: string; raw: TiffinPlanWithChef };

interface ItemDisplay {
  title: string;
  catKey: string;
  catLabel: string;
  color: string;
  icon: string;
  priceText: string;
  location: string | null;
}

function display(item: AllItem): ItemDisplay {
  if (item.kind === 'dish') {
    return { title: item.raw.dish_name, catKey: 'food', catLabel: 'Home Food', color: FOOD_COLOR, icon: 'restaurant', priceText: `₹${item.raw.price}`, location: null };
  }
  if (item.kind === 'tiffin') {
    return { title: item.raw.title, catKey: 'tiffin', catLabel: 'Tiffin', color: TIFFIN_COLOR, icon: 'repeat', priceText: `₹${item.raw.price}/day`, location: null };
  }
  const l = item.raw;
  const cat = getService(l.category);
  return {
    title: l.is_referral ? l.referral_name ?? l.title : l.title,
    catKey: l.category,
    catLabel: cat?.label ?? l.category,
    color: cat?.color ?? '#888',
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
  const { userId, communityId, profile } = useAuth();

  const [items, setItems] = useState<AllItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const filterChips = useMemo(() => [
    { key: 'food', label: 'Home Food', color: FOOD_COLOR, icon: 'restaurant' },
    { key: 'tiffin', label: 'Tiffin', color: TIFFIN_COLOR, icon: 'repeat' },
    ...SERVICES.filter((s) => s.kind === 'listing').map((s) => ({ key: s.key, label: s.label, color: s.color, icon: s.icon })),
  ], []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      const [listings, dishes, tiffins] = await Promise.all([
        fetchAllListings(communityId, 0, 200),
        fetchDishes(communityId).catch(() => [] as DishRow[]),
        listTiffinPlans(communityId).catch(() => [] as TiffinPlanWithChef[]),
      ]);
      setItems([
        ...dishes.map((d): AllItem => ({ kind: 'dish', id: d.id, raw: d })),
        ...tiffins.map((t): AllItem => ({ kind: 'tiffin', id: t.id, raw: t })),
        ...listings.map((l): AllItem => ({ kind: 'listing', id: l.id, raw: l })),
      ]);
    } catch { toast.show('Could not load listings'); }
    finally { setLoading(false); }
  }, [communityId, toast]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(
    () => (category ? items.filter((i) => display(i).catKey === category) : items),
    [items, category],
  );

  const openItem = (i: AllItem) =>
    i.kind === 'listing' ? router.push(`/listing/${i.raw.id}` as any) : router.push('/food' as any);

  const contactItem = (i: AllItem) => {
    let url: string;
    if (i.kind === 'listing') {
      url = buildInquiryWhatsAppLink(i.raw, profile?.name ?? 'A neighbour', '');
      if (userId) sendInquiry(i.raw.id, userId, null).catch(() => {});
    } else if (i.kind === 'dish') {
      url = waLink(i.raw.whatsapp, `Hi ${i.raw.chef_name}! I'm interested in your *${i.raw.dish_name}* on Aangan 🍽️`);
    } else {
      url = waLink(i.raw.chef?.whatsapp, `Hi ${i.raw.chef?.name ?? ''}! About your *${i.raw.title}* tiffin on Aangan 🍱`);
    }
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
    toast.show('Opening WhatsApp 📲');
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
          style={{ backgroundColor: category === svc.key ? svc.color : svc.color + '18' }}
        >
          <Ionicons name={svc.icon as any} size={11} color={category === svc.key ? '#fff' : svc.color} />
          <Text className="text-[12px] font-sans-sb" style={{ color: category === svc.key ? '#fff' : svc.color }}>
            {svc.label}
          </Text>
        </Pressable>
      ))}
    </>
  );

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="pricetags-outline"
        iconColor={c.accent}
        title="All listings"
        hideSociety
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
        <FlashList
          data={loading ? [] : filtered}
          keyExtractor={(item: AllItem) => `${item.kind}:${item.id}`}
          renderItem={({ item }: { item: AllItem }) => (
            <ItemRow item={item} isDesktop={isDesktop} onOpen={() => openItem(item)} onContact={() => contactItem(item)} c={c} />
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
            ) : (
              <View className="items-center py-20">
                <Text style={{ fontSize: 40 }} className="mb-3">🗂️</Text>
                <Text className="font-display text-xl text-ink mb-1">{category ? 'Nothing here yet' : 'Nothing posted yet'}</Text>
                <Text className="text-[14px] text-muted text-center max-w-xs">
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
  item, isDesktop, onOpen, onContact, c,
}: {
  item: AllItem;
  isDesktop: boolean;
  onOpen: () => void;
  onContact: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const d = display(item);

  return (
    <Pressable onPress={onOpen} className="flex-row items-center gap-3 border-b border-line px-3 py-3 active:bg-inset">
      <View className="h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: d.color + '20' }}>
        <Ionicons name={d.icon as any} size={18} color={d.color} />
      </View>

      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{d.title}</Text>
        {!isDesktop ? (
          <Text className="text-[12px] text-muted" numberOfLines={1}>
            {d.catLabel}{d.priceText !== '—' ? ` · ${d.priceText}` : ''}
          </Text>
        ) : d.location ? (
          <Text className="text-[12px] text-faint" numberOfLines={1}>📍 {d.location}</Text>
        ) : null}
      </View>

      {isDesktop ? (
        <>
          <Text style={{ width: 130 }} className="text-[13px] font-sans-md text-muted" numberOfLines={1}>{d.catLabel}</Text>
          <Text style={{ width: 100 }} className="text-[13px] font-sans-sb text-accent" numberOfLines={1}>{d.priceText}</Text>
          <View className="flex-row justify-end gap-2" style={{ width: 186 }}>
            <RowBtn icon="open-outline" label={item.kind === 'listing' ? 'View' : 'Order'} onPress={onOpen} c={c} />
            <RowBtn icon="logo-whatsapp" label="Contact" onPress={onContact} c={c} whatsapp />
          </View>
        </>
      ) : (
        <Pressable onPress={onContact} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: '#25D36618' }}>
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
        </Pressable>
      )}
    </Pressable>
  );
}

function RowBtn({
  icon, label, onPress, c, whatsapp,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
  whatsapp?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-xl border px-2.5 py-1.5 active:opacity-80"
      style={{ borderColor: whatsapp ? '#25D36655' : c.line, backgroundColor: whatsapp ? '#25D36612' : c.inset }}
    >
      <Ionicons name={icon} size={14} color={whatsapp ? '#25D366' : c.muted} />
      <Text className="text-[12px] font-sans-sb" style={{ color: whatsapp ? '#15803D' : c.muted }}>{label}</Text>
    </Pressable>
  );
}
