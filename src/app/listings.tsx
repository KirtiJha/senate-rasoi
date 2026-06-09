import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { sendInquiry } from '../lib/inquiries';
import { buildInquiryWhatsAppLink, fetchAllListings } from '../lib/listings';
import { SERVICES, getService } from '../lib/services';
import { isSupabaseConfigured } from '../lib/supabase';
import { ListingRow } from '../lib/types';
import { layout, useThemeColors } from '../theme';

export default function AllListingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId, communityId, profile } = useAuth();

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const listingServices = useMemo(() => SERVICES.filter((s) => s.kind === 'listing'), []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      setListings(await fetchAllListings(communityId, 0, 200));
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
    () => (category ? listings.filter((l) => l.category === category) : listings),
    [listings, category],
  );

  const openListing = (l: ListingRow) => router.push(`/listing/${l.id}` as any);

  const contact = (l: ListingRow) => {
    const url = buildInquiryWhatsAppLink(l, profile?.name ?? 'A neighbour', '');
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
    if (userId) sendInquiry(l.id, userId, null).catch(() => {});
    toast.show('Opening WhatsApp 📲');
  };

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg pb-3">
        <View className="flex-row items-center gap-2 px-4">
          <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
          <Text className="flex-1 font-display-x text-[22px] text-ink">All listings</Text>
          <Text className="text-[12px] font-sans-md text-faint">{filtered.length} item{filtered.length === 1 ? '' : 's'}</Text>
        </View>

        {/* Category filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2.5" contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          <Pressable
            onPress={() => setCategory(null)}
            className={`rounded-full px-3 py-1.5 ${!category ? 'bg-accent' : 'bg-inset'}`}
          >
            <Text className={`text-[12px] font-sans-sb ${!category ? 'text-on-accent' : 'text-muted'}`}>All</Text>
          </Pressable>
          {listingServices.map((svc) => (
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
        </ScrollView>
      </View>

      <View style={{ flex: 1, width: '100%', maxWidth: layout.maxContent, alignSelf: 'center' }}>
        <FlashList
          data={loading ? [] : filtered}
          keyExtractor={(item: ListingRow) => item.id}
          renderItem={({ item }: { item: ListingRow }) => (
            <ListingTableRow listing={item} isDesktop={isDesktop} onOpen={() => openListing(item)} onContact={() => contact(item)} c={c} />
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
                <Text className="font-display text-xl text-ink mb-1">{category ? 'Nothing here yet' : 'No listings yet'}</Text>
                <Text className="text-[14px] text-muted text-center max-w-xs">
                  Listings your neighbours post across all categories show up here.
                </Text>
              </View>
            )
          }
        />
      </View>
    </View>
  );
}

function ListingTableRow({
  listing, isDesktop, onOpen, onContact, c,
}: {
  listing: ListingRow;
  isDesktop: boolean;
  onOpen: () => void;
  onContact: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const cat = getService(listing.category);
  const title = listing.is_referral ? listing.referral_name ?? listing.title : listing.title;
  const price = listing.price != null
    ? `₹${listing.price.toLocaleString('en-IN')}${listing.price_unit ? ` ${listing.price_unit}` : ''}`
    : '—';

  return (
    <Pressable onPress={onOpen} className="flex-row items-center gap-3 border-b border-line px-3 py-3 active:bg-inset">
      <View className="h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: (cat?.color ?? '#888') + '20' }}>
        <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={18} color={cat?.color ?? c.muted} />
      </View>

      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{title}</Text>
        {!isDesktop ? (
          <Text className="text-[12px] text-muted" numberOfLines={1}>
            {cat?.label ?? listing.category}{listing.price != null ? ` · ${price}` : ''}
          </Text>
        ) : listing.location ? (
          <Text className="text-[12px] text-faint" numberOfLines={1}>📍 {listing.location}</Text>
        ) : null}
      </View>

      {isDesktop ? (
        <>
          <Text style={{ width: 130 }} className="text-[13px] font-sans-md text-muted" numberOfLines={1}>{cat?.label ?? listing.category}</Text>
          <Text style={{ width: 100 }} className="text-[13px] font-sans-sb text-accent" numberOfLines={1}>{price}</Text>
          <View className="flex-row justify-end gap-2" style={{ width: 186 }}>
            <RowBtn icon="open-outline" label="View" onPress={onOpen} c={c} />
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
