import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../../components/BrandMark';
import { T } from '../../components/T';
import { Container, useResponsive, VegMark } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useUnreadDms } from '../../context/unread';
import { fetchSocietyDigest, SocietyDigest } from '../../lib/ai';
import { PostRow, fetchLatestAnnouncement } from '../../lib/posts';
import { DishRow, ListingRow, SLOT_EMOJI } from '../../lib/types';
import { fetchDishes } from '../../lib/dishes';
import { fetchAllListings, fetchCategoryCounts } from '../../lib/listings';
import { fetchHomeTileCounts } from '../../lib/homeCounts';
import { PropertyRow, fetchProperties, propertySubtitle } from '../../lib/properties';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { SERVICES, ServiceCategory, getService } from '../../lib/services';
import { fetchBorrowCounts, fetchItems as fetchBorrowItems, LendItem, BORROW_CATEGORIES } from '../../lib/borrow';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AppVersion, fetchLatestVersion, isNewer } from '../../lib/appVersion';
import { useThemeColors } from '../../theme';

const DISMISSED_ANNOUNCEMENT_KEY = 'aangan:dismissed-announcement';
const DISMISSED_DIGEST_KEY = 'aangan:dismissed-digest';

/** Monday (local) of the current week — used to dismiss the digest for the week. */
function currentWeekId(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

type CommunityTile = { key: string; label: string; blurb: string; icon: string; color: string; href: string };

const COMMUNITY_TILES: CommunityTile[] = [
  {
    key: 'feed',
    label: 'Feed',
    blurb: 'Posts, announcements & issues',
    icon: 'chatbubbles',
    color: '#E8650A',
    href: '/feed',
  },
  {
    key: 'directory',
    label: 'Residents',
    blurb: 'Owner & tenant directory',
    icon: 'people',
    color: '#8B5CF6',
    href: '/directory',
  },
  {
    key: 'messages',
    label: 'Messages',
    blurb: 'Private chats with neighbours',
    icon: 'mail',
    color: '#0EA5E9',
    href: '/messages',
  },
  {
    key: 'sports',
    label: 'Sports',
    blurb: 'Teams, practice & tournaments',
    icon: 'football',
    color: '#16A34A',
    href: '/sports',
  },
  {
    key: 'documents',
    label: 'Documents',
    blurb: 'Society files, public or shared',
    icon: 'folder',
    color: '#0EA5E9',
    href: '/documents',
  },
  {
    key: 'payments',
    label: 'Payments',
    blurb: 'Track UPI payments & receipts',
    icon: 'wallet',
    color: '#16A34A',
    href: '/payments',
  },
  {
    key: 'properties',
    label: 'Flats',
    blurb: 'Buy, sell or rent a flat',
    icon: 'key',
    color: '#7C3AED',
    href: '/properties',
  },
  {
    key: 'recommend',
    label: 'Ask & Recommend',
    blurb: 'Find trusted doctors, tutors, vendors',
    icon: 'sparkles',
    color: '#CA8A04',
    href: '/recommend',
  },
  {
    key: 'borrow',
    label: 'Borrow & Lend',
    blurb: 'Share tools & things with neighbours',
    icon: 'swap-horizontal',
    color: '#0891B2',
    href: '/borrow',
  },
  {
    key: 'helpers',
    label: 'Blood & SOS',
    blurb: 'Donors & emergency helpers nearby',
    icon: 'heart',
    color: '#DC2626',
    href: '/helpers',
  },
  {
    key: 'polls',
    label: 'Polls',
    blurb: 'Vote on community decisions',
    icon: 'stats-chart',
    color: '#6366F1',
    href: '/polls',
  },
  {
    key: 'emergency',
    label: 'Emergency',
    blurb: 'Quick-dial security & services',
    icon: 'call',
    color: '#EF4444',
    href: '/emergency',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { profile, communityId, userId } = useAuth();
  const c = useThemeColors();
  const unread = useUnreadDms();
  const [updateBanner, setUpdateBanner] = useState<AppVersion | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [announcement, setAnnouncement] = useState<PostRow | null>(null);
  const [digest, setDigest] = useState<SocietyDigest | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tileCounts, setTileCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<ListingRow[]>([]);
  const [recentProps, setRecentProps] = useState<PropertyRow[]>([]);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [recentBorrow, setRecentBorrow] = useState<LendItem[]>([]);
  const [borrowCount, setBorrowCount] = useState(0);

  // Per-category counts + newest listings, dishes, borrow items — refreshed on focus.
  useFocusEffect(useCallback(() => {
    if (!communityId || !isSupabaseConfigured) return;
    fetchCategoryCounts(communityId).then(setCounts).catch(() => {});
    fetchHomeTileCounts(communityId, userId).then(setTileCounts).catch(() => {});
    fetchAllListings(communityId, 0, 12, 'created_at').then(setRecent).catch(() => {});
    fetchProperties({ availableOnly: true }, communityId).then((r) => setRecentProps(r.slice(0, 12))).catch(() => {});
    fetchDishes(communityId).then(setDishes).catch(() => {});
    fetchBorrowItems({ availableOnly: false }, communityId).then((rows) =>
      setRecentBorrow(rows.slice(0, 10))
    ).catch(() => {});
    fetchBorrowCounts(communityId).then((c) => setBorrowCount(c.offers + c.requests)).catch(() => {});
  }, [communityId, userId]));

  useEffect(() => {
    if (communityId && isSupabaseConfigured) {
      fetchLatestAnnouncement(communityId).then(async (post) => {
        if (!post) return;
        const dismissed = await AsyncStorage.getItem(DISMISSED_ANNOUNCEMENT_KEY);
        if (dismissed !== post.id) setAnnouncement(post);
      }).catch(() => {});
    }
  }, [communityId]);

  useEffect(() => {
    if (!communityId || !isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const dismissed = await AsyncStorage.getItem(DISMISSED_DIGEST_KEY).catch(() => null);
      if (dismissed === currentWeekId()) return;
      const d = await fetchSocietyDigest();
      if (!cancelled && d.summary) setDigest(d);
    })();
    return () => { cancelled = true; };
  }, [communityId]);

  const dismissDigest = () => {
    AsyncStorage.setItem(DISMISSED_DIGEST_KEY, currentWeekId()).catch(() => {});
    setDigest(null);
  };

  const dismissAnnouncement = () => {
    if (announcement) AsyncStorage.setItem(DISMISSED_ANNOUNCEMENT_KEY, announcement.id).catch(() => {});
    setAnnouncement(null);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
    fetchLatestVersion().then((latest) => {
      if (latest && isNewer(latest.version, currentVersion)) {
        setUpdateBanner(latest);
      }
    }).catch(() => {});
  }, []);

  const greeting = getGreeting();

  const handleCategoryPress = (cat: ServiceCategory) => {
    if (cat.key === 'food') {
      router.push('/food' as any);
    } else {
      router.push(`/c/${cat.key}` as any);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: isDesktop ? insets.top + 24 : 24, paddingBottom: 40, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Container>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-[13px] font-sans-md text-accent">{greeting}</Text>
          <Text className="font-display-x text-[28px] leading-9 text-ink">
            {profile?.name ? `Hi, ${profile.name.split(' ')[0]} 👋` : 'Your neighbourhood hub'}
          </Text>
          <Text className="mt-2 text-[14px] font-sans-md text-muted">
            What can your society help you with today?
          </Text>
        </View>

        {/* Ask Aangan — AI front door */}
        <Pressable
          onPress={() => router.push('/ask' as any)}
          className="mb-5 flex-row items-center gap-3 overflow-hidden rounded-2xl border active:opacity-90"
          style={{ borderColor: c.accent + '55', backgroundColor: c.accent + '12' }}
        >
          <View style={{ marginLeft: 12, marginVertical: 11 }}>
            <BrandMark size={42} />
          </View>
          <View className="min-w-0 flex-1 py-3">
            <Text className="font-sans-bold text-[15px] text-ink">Ask Aangan</Text>
            <Text className="text-[12px] font-sans-md text-muted" numberOfLines={1}>Food, flats, borrow, recommendations — just ask</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={c.accent} style={{ marginRight: 14 }} />
        </Pressable>

        {/* Weekly society digest */}
        {digest ? (
          <View className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface">
            <View style={{ height: 3, backgroundColor: c.accent }} />
            <View className="p-4">
              <View className="mb-1.5 flex-row items-center gap-2">
                <Ionicons name="sparkles" size={14} color={c.accent} />
                <Text className="flex-1 text-[11px] font-sans-sb uppercase tracking-wider" style={{ color: c.accent }}>This week in your society</Text>
                <Pressable onPress={dismissDigest} hitSlop={8}>
                  <Ionicons name="close" size={16} color={c.faint} />
                </Pressable>
              </View>
              <Text className="text-[14px] leading-5 text-ink">{digest.summary}</Text>
              {digest.highlights.length ? (
                <View className="mt-2.5 gap-1.5">
                  {digest.highlights.map((h, i) => (
                    <View key={i} className="flex-row gap-2">
                      <Text className="text-[13px]" style={{ color: c.accent }}>•</Text>
                      <Text className="min-w-0 flex-1 text-[13px] leading-5 text-muted">{h}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Announcement banner */}
        {announcement ? (
          <Pressable
            onPress={() => router.push(`/feed/${announcement.id}` as any)}
            className="mb-5 overflow-hidden rounded-2xl border active:opacity-90"
            style={{ borderColor: '#F59E0B55', backgroundColor: '#F59E0B12' }}
          >
            <View style={{ height: 3, backgroundColor: '#F59E0B' }} />
            <View className="flex-row items-start gap-3 p-4">
              <View className="h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: '#F59E0B22' }}>
                <Ionicons name="megaphone" size={18} color="#F59E0B" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[11px] font-sans-sb uppercase tracking-wider" style={{ color: '#B45309' }}>Announcement</Text>
                {announcement.title ? <T source="post" id={announcement.id} field="title" text={announcement.title} showToggle={false} className="font-sans-bold text-[14px] text-ink" numberOfLines={1} /> : null}
                <T source="post" id={announcement.id} field="body" text={announcement.body} showToggle={false} className="text-[13px] text-muted" numberOfLines={2} />
              </View>
              <Pressable onPress={dismissAnnouncement} hitSlop={8}>
                <Ionicons name="close" size={18} color={c.faint} />
              </Pressable>
            </View>
          </Pressable>
        ) : null}

        {/* Update banner */}
        {updateBanner && !bannerDismissed ? (
          <View
            className="mb-5 overflow-hidden rounded-2xl"
            style={{ backgroundColor: updateBanner.force_update ? '#EF444420' : c.surface, borderWidth: 1, borderColor: updateBanner.force_update ? '#EF4444' : c.line }}
          >
            <View style={{ height: 3, backgroundColor: updateBanner.force_update ? '#EF4444' : c.accent }} />
            <View className="flex-row items-start gap-3 p-4">
              <View
                className="h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
                style={{ backgroundColor: (updateBanner.force_update ? '#EF4444' : c.accent) + '20' }}
              >
                <Ionicons name="arrow-up-circle-outline" size={20} color={updateBanner.force_update ? '#EF4444' : c.accent} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-sans-sb text-[14px] text-ink">
                  {updateBanner.force_update ? 'Update required' : `Version ${updateBanner.version} available`}
                </Text>
                <Text className="mt-0.5 text-[12px] text-muted">
                  {updateBanner.release_notes ?? (updateBanner.force_update ? 'Please update to continue.' : 'Refresh to get the latest version.')}
                </Text>
                <View className="mt-3 flex-row gap-2">
                  {Platform.OS === 'web' ? (
                    <Pressable
                      onPress={() => window.location.reload()}
                      className="rounded-xl bg-accent px-3.5 py-2 active:opacity-80"
                    >
                      <Text className="font-sans-sb text-[12px] text-on-accent">Refresh now</Text>
                    </Pressable>
                  ) : null}
                  {!updateBanner.force_update ? (
                    <Pressable
                      onPress={() => setBannerDismissed(true)}
                      className="rounded-xl border border-line bg-inset px-3.5 py-2 active:opacity-70"
                    >
                      <Text className="font-sans-sb text-[12px] text-muted">Dismiss</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Fresh from kitchens — today's & upcoming home-cooked dishes */}
        <FreshFoodStrip items={dishes} isDesktop={isDesktop} />

        {/* Just listed — newest listings + borrow items */}
        <JustListedStrip listings={recent} borrows={recentBorrow} properties={recentProps} isDesktop={isDesktop} />

        {/* Service grid */}
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          {SERVICES.map((cat) => (
            <ServiceTile key={cat.key} cat={cat} count={counts[cat.key] ?? 0} onPress={() => handleCategoryPress(cat)} />
          ))}
        </View>

        {/* Community tools */}
        <View className="mt-6">
          <Text className="mb-3 px-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Community</Text>
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
            {COMMUNITY_TILES.map((tile) => {
              const badge =
                tile.key === 'messages' ? (unread > 0 ? unread : 0)
                : tile.key === 'borrow' ? borrowCount
                : (tileCounts[tile.key] ?? 0);
              return (
                <View key={tile.key} style={{ width: '50%', padding: 6 }}>
                  <Pressable
                    onPress={() => router.push(tile.href as any)}
                    className="overflow-hidden rounded-2xl bg-surface active:opacity-80"
                    style={{ borderWidth: 1, borderColor: c.line }}
                  >
                    <View style={{ height: 4, backgroundColor: tile.color }} />
                    <View className="p-4">
                      <View
                        className="mb-3 h-11 w-11 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: tile.color + '20' }}
                      >
                        <Ionicons name={tile.icon as any} size={22} color={tile.color} />
                      </View>
                      <Text className="font-sans-bold text-[15px] text-ink" numberOfLines={1}>{tile.label}</Text>
                      <Text className="mt-0.5 text-[12px] font-sans-md leading-[18px] text-muted" numberOfLines={2}>{tile.blurb}</Text>
                    </View>
                    {badge > 0 ? (
                      <View
                        className="absolute items-center justify-center rounded-full px-1.5"
                        style={{ top: 12, right: 12, minWidth: 20, height: 20, backgroundColor: tile.color }}
                      >
                        <Text className="font-sans-bold text-white" style={{ fontSize: 11 }}>
                          {badge > 99 ? '99+' : badge > 9 ? '9+' : badge}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </Container>
    </ScrollView>
  );
}

function ServiceTile({ cat, count = 0, onPress }: { cat: ServiceCategory; count?: number; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <View style={{ width: '50%', padding: 6 }}>
      <Pressable
        onPress={onPress}
        className="overflow-hidden rounded-2xl bg-surface active:opacity-80"
        style={{ borderWidth: 1, borderColor: c.line }}
      >
        <View style={{ height: 4, backgroundColor: cat.color }} />
        <View className="p-4">
          <View
            className="mb-3 h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: cat.color + '20' }}
          >
            <Ionicons name={cat.icon as any} size={22} color={cat.color} />
          </View>
          <Text className="font-sans-bold text-[15px] text-ink" numberOfLines={1}>{cat.label}</Text>
          <Text className="mt-0.5 text-[12px] font-sans-md leading-[18px] text-muted" numberOfLines={2}>{cat.blurb}</Text>
        </View>
        {count > 0 ? (
          <View
            className="absolute items-center justify-center rounded-full px-1.5"
            style={{ top: 12, right: 12, minWidth: 22, height: 22, backgroundColor: cat.color }}
            accessibilityLabel={`${count} listed`}
          >
            <Text className="font-sans-bold text-white" style={{ fontSize: 11 }}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

type StripItem =
  | { kind: 'listing'; id: string; ts: string; raw: ListingRow }
  | { kind: 'borrow'; id: string; ts: string; raw: LendItem }
  | { kind: 'property'; id: string; ts: string; raw: PropertyRow };

/** Horizontal carousel (mobile) / wrapped row (desktop) of the newest listings + borrow items. */
function JustListedStrip({ listings, borrows, properties, isDesktop }: { listings: ListingRow[]; borrows: LendItem[]; properties: PropertyRow[]; isDesktop: boolean }) {
  const router = useRouter();
  const c = useThemeColors();
  const BORROW_COLOR = '#0891B2';
  const PROP_COLOR = '#7C3AED';

  const items: StripItem[] = [
    ...listings.map((l): StripItem => ({ kind: 'listing', id: l.id, ts: l.created_at, raw: l })),
    ...borrows.map((b): StripItem => ({ kind: 'borrow', id: b.id, ts: b.created_at, raw: b })),
    ...properties.map((p): StripItem => ({ kind: 'property', id: p.id, ts: p.created_at, raw: p })),
  ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 12);

  if (!items.length) return null;

  const ListingCard = ({ l }: { l: ListingRow }) => {
    const cat = getService(l.category);
    const color = cat?.color ?? '#888';
    const photo = l.photos?.[0];
    const title = l.is_referral ? (l.referral_name ?? l.title) : l.title;
    return (
      <Pressable
        onPress={() => router.push(`/listing/${l.id}` as any)}
        className="overflow-hidden rounded-2xl bg-surface active:opacity-90"
        style={{ width: 152, borderWidth: 1, borderColor: c.line }}
      >
        <View style={{ height: 96 }} className="w-full">
          {photo
            ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
            : <View style={{ flex: 1, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={(cat?.icon as any) ?? 'pricetag'} size={28} color={color} /></View>}
        </View>
        <View className="p-2.5">
          <View className="mb-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: color + '20' }}>
            <Text className="text-[10px] font-sans-sb" style={{ color }} numberOfLines={1}>{cat?.label ?? l.category}</Text>
          </View>
          <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{title}</Text>
          {l.price != null
            ? <Text className="text-[12px] font-sans-md text-muted">₹{l.price.toLocaleString('en-IN')}</Text>
            : <Text className="text-[11px] text-faint">Contact for price</Text>}
        </View>
      </Pressable>
    );
  };

  const BorrowCard = ({ b }: { b: LendItem }) => {
    const catMeta = BORROW_CATEGORIES.find((bc) => bc.key === b.category) ?? BORROW_CATEGORIES[BORROW_CATEGORIES.length - 1];
    const label = b.kind === 'request' ? '🙏 Needs' : '🤝 Lending';
    return (
      <Pressable
        onPress={() => router.push(`/borrow/${b.id}` as any)}
        className="overflow-hidden rounded-2xl bg-surface active:opacity-90"
        style={{ width: 152, borderWidth: 1, borderColor: c.line }}
      >
        <View style={{ height: 96, backgroundColor: BORROW_COLOR + '18' }} className="w-full items-center justify-center">
          {b.photo_url
            ? <Image source={{ uri: b.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
            : <Ionicons name={catMeta.icon as any} size={32} color={BORROW_COLOR} />}
        </View>
        <View className="p-2.5">
          <View className="mb-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: BORROW_COLOR + '20' }}>
            <Text className="text-[10px] font-sans-sb" style={{ color: BORROW_COLOR }} numberOfLines={1}>{label} · {catMeta.label}</Text>
          </View>
          <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{b.title}</Text>
          <Text className="text-[11px] text-faint">{b.owner?.name ?? 'A neighbour'}</Text>
        </View>
      </Pressable>
    );
  };

  const PropertyCard = ({ p }: { p: PropertyRow }) => {
    const photo = p.photos?.[0];
    const tag = p.listing_type === 'rent' ? '🔑 For rent' : '🏠 For sale';
    return (
      <Pressable
        onPress={() => router.push(`/property/${p.id}` as any)}
        className="overflow-hidden rounded-2xl bg-surface active:opacity-90"
        style={{ width: 152, borderWidth: 1, borderColor: c.line }}
      >
        <View style={{ height: 96 }} className="w-full">
          {photo
            ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
            : <View style={{ flex: 1, backgroundColor: PROP_COLOR + '20', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="key" size={28} color={PROP_COLOR} /></View>}
        </View>
        <View className="p-2.5">
          <View className="mb-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: PROP_COLOR + '20' }}>
            <Text className="text-[10px] font-sans-sb" style={{ color: PROP_COLOR }} numberOfLines={1}>{tag}{p.config ? ` · ${p.config}` : ''}</Text>
          </View>
          <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{p.title}</Text>
          <Text className="text-[11px] text-faint" numberOfLines={1}>{propertySubtitle(p)}</Text>
        </View>
      </Pressable>
    );
  };

  const renderCard = (i: StripItem) =>
    i.kind === 'listing' ? <ListingCard key={i.id} l={i.raw} />
    : i.kind === 'borrow' ? <BorrowCard key={i.id} b={i.raw} />
    : <PropertyCard key={i.id} p={i.raw} />;

  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center justify-between px-1.5">
        <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">Just listed</Text>
        <Pressable onPress={() => router.push('/listings' as any)} hitSlop={8}>
          <Text className="text-[12px] font-sans-sb text-accent">See all →</Text>
        </Pressable>
      </View>
      {isDesktop ? (
        <View className="flex-row flex-wrap gap-3">
          {items.slice(0, 6).map(renderCard)}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
          {items.map(renderCard)}
        </ScrollView>
      )}
    </View>
  );
}

// Accent colour per meal slot — matches the DishCard chip.
const SLOT_COLOR: Record<string, string> = {
  Breakfast: '#E8650A',
  Lunch: '#16A34A',
  Dinner: '#6366F1',
  Snack: '#DB2777',
};
const SLOT_PLACEHOLDER: Record<string, [string, string]> = {
  Breakfast: ['#FFD9A8', '#FFB877'],
  Lunch: ['#CDEBC5', '#A6D89B'],
  Dinner: ['#C9C2EC', '#A99FE0'],
  Snack: ['#F6C6DA', '#EFA3C2'],
};

/** Friendly serve-date label if it isn't today, else null. */
function freshServeLabel(serveDate: string): string | null {
  const today = new Date().toLocaleDateString('en-CA');
  if (!serveDate || serveDate <= today) return null;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (serveDate === tomorrow.toLocaleDateString('en-CA')) return 'Tomorrow';
  try {
    return new Date(serveDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
}

/** Horizontal carousel (mobile) / wrapped row (desktop) of the freshest dishes. */
function FreshFoodStrip({ items, isDesktop }: { items: DishRow[]; isDesktop: boolean }) {
  const router = useRouter();
  const c = useThemeColors();
  if (!items.length) return null;

  const Card = ({ d }: { d: DishRow }) => {
    const color = SLOT_COLOR[d.slot] ?? '#16A34A';
    const [g1, g2] = SLOT_PLACEHOLDER[d.slot] ?? ['#CDEBC5', '#A6D89B'];
    const soldOut = d.plates_left <= 0;
    const serveLabel = freshServeLabel(d.serve_date);
    return (
      <Pressable
        onPress={() => router.push(`/dish/${d.id}` as any)}
        className="overflow-hidden rounded-2xl bg-surface active:opacity-90"
        style={{ width: 152, borderWidth: 1, borderColor: c.line }}
      >
        <View style={{ height: 96 }} className="w-full">
          {d.photo_url ? (
            <Image source={{ uri: d.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
          ) : (
            <LinearGradient colors={[g1, g2]} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 40 }}>{SLOT_EMOJI[d.slot] ?? '🍽️'}</Text>
            </LinearGradient>
          )}
          <View className="absolute left-2 top-2 rounded-md bg-white/95 p-0.5">
            <VegMark type={d.veg_type} size={13} />
          </View>
          {serveLabel ? (
            <View className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5">
              <Text className="text-[10px] font-sans-sb text-white">{serveLabel}</Text>
            </View>
          ) : null}
          {soldOut ? (
            <View className="absolute inset-0 items-center justify-center bg-black/45">
              <Text className="font-sans-bold text-[12px] uppercase tracking-wide text-white">Sold out</Text>
            </View>
          ) : null}
        </View>
        <View className="p-2.5">
          <View className="mb-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: color + '20' }}>
            <Text className="text-[10px] font-sans-sb" style={{ color }} numberOfLines={1}>{SLOT_EMOJI[d.slot] ?? '🍽️'} {d.slot}</Text>
          </View>
          <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{d.dish_name}</Text>
          <Text className="text-[12px] font-sans-md text-muted">₹{d.price} · Flat {d.flat}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center justify-between px-1.5">
        <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">Fresh from kitchens</Text>
        <Pressable onPress={() => router.push('/food' as any)} hitSlop={8}>
          <Text className="text-[12px] font-sans-sb text-accent">See all →</Text>
        </Pressable>
      </View>
      {isDesktop ? (
        <View className="flex-row flex-wrap gap-3">{items.slice(0, 6).map((d) => <Card key={d.id} d={d} />)}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
          {items.map((d) => <Card key={d.id} d={d} />)}
        </ScrollView>
      )}
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning ☀️';
  if (h >= 12 && h < 17) return 'Good afternoon 🍛';
  if (h >= 17 && h < 21) return 'Good evening 🌙';
  return 'Good night 🌃';
}
