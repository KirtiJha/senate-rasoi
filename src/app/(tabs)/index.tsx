import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, {
  Extrapolation, interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../../components/BrandMark';
import { T } from '../../components/T';
import { Avatar, Container, ErrorRow, ModuleTile, Rise, Touchable, useResponsive, VegMark } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useUnreadDms } from '../../context/unread';
import { fetchSocietyDigest, SocietyDigest } from '../../lib/ai';
import { AScrollView, dur, ease } from '../../lib/motion';
import { timeAgo } from '../../lib/time';
import { PostRow, fetchLatestAnnouncement } from '../../lib/posts';
import { DishRow, ListingRow, SLOT_EMOJI } from '../../lib/types';
import { fetchDishes } from '../../lib/dishes';
import { fetchAllListings, fetchCategoryCounts } from '../../lib/listings';
import { fetchHomeTileCounts } from '../../lib/homeCounts';
import { PropertyRow, fetchProperties, propertySubtitle } from '../../lib/properties';
import { PlaceRow, fetchPlaces, placeTypeMeta } from '../../lib/places';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { SERVICES, ServiceCategory, getService } from '../../lib/services';
import { fetchBorrowCounts, fetchItems as fetchBorrowItems, LendItem, BORROW_CATEGORIES } from '../../lib/borrow';
import { fetchLostFoundItems, LostFoundItem, fetchLostFoundCounts, LOST_FOUND_CATEGORIES } from '../../lib/lostFound';
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
    key: 'lost_found',
    label: 'Lost & Found',
    blurb: 'Report or find missing items in the society',
    icon: 'search',
    color: '#D97706',
    href: '/lost-found',
  },
  {
    key: 'events',
    label: 'Functions',
    blurb: 'Plan festivals, collect & track every rupee',
    icon: 'sparkles',
    color: '#7C3AED',
    href: '/events',
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
    key: 'places',
    label: 'Nearby',
    blurb: 'Hospitals, schools, shops & more',
    icon: 'location',
    color: '#0D9488',
    href: '/places',
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
  const toast = useToast();
  const unread = useUnreadDms();
  const [updateBanner, setUpdateBanner] = useState<AppVersion | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [announcement, setAnnouncement] = useState<PostRow | null>(null);
  const [digest, setDigest] = useState<SocietyDigest | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tileCounts, setTileCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<ListingRow[]>([]);
  const [recentProps, setRecentProps] = useState<PropertyRow[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<PlaceRow[]>([]);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [recentBorrow, setRecentBorrow] = useState<LendItem[]>([]);
  const [borrowCount, setBorrowCount] = useState(0);
  const [recentLostFound, setRecentLostFound] = useState<LostFoundItem[]>([]);
  const [lostFoundCount, setLostFoundCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Per-category counts + newest listings, dishes, borrow items — refreshed on
  // focus. Each fetch is independent: one failing must not blank the others,
  // so failures are counted rather than thrown. If every one fails we say so
  // and offer a retry, instead of rendering a wall of tiles over silence.
  const loadHome = useCallback(async () => {
    if (!communityId || !isSupabaseConfigured) return;

    const results = await Promise.allSettled([
      fetchCategoryCounts(communityId).then(setCounts),
      fetchHomeTileCounts(communityId, userId).then(setTileCounts),
      fetchAllListings(communityId, 0, 12, 'created_at').then(setRecent),
      fetchProperties({ availableOnly: true }, communityId).then((r) => setRecentProps(r.slice(0, 12))),
      fetchPlaces({}, communityId).then((r) => setRecentPlaces(r.slice(0, 12))),
      fetchDishes(communityId).then(setDishes),
      fetchBorrowItems({ availableOnly: false }, communityId).then((rows) => setRecentBorrow(rows.slice(0, 10))),
      fetchBorrowCounts(communityId).then((c) => setBorrowCount(c.offers + c.requests)),
      fetchLostFoundItems({ openOnly: true }, communityId).then((rows) => setRecentLostFound(rows.slice(0, 10))),
      fetchLostFoundCounts(communityId).then(setLostFoundCount),
    ]);

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) console.error('home: ' + failed.length + ' section(s) failed to load', failed);
    setLoadFailed(failed.length === results.length);
  }, [communityId, userId]);

  useFocusEffect(useCallback(() => { loadHome(); }, [loadHome]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadHome();
    setRefreshing(false);
  }, [loadHome]);

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

  // Native: pull the newest OTA bundle and restart into it. A version that also
  // changed native code can't ship over the air — point those at the store.
  const applyUpdate = async () => {
    setUpdating(true);
    try {
      if (!Updates.isEnabled) {
        toast.show('Please update Aangan from the app store');
        return;
      }
      const res = await Updates.fetchUpdateAsync();
      if (res.isNew) await Updates.reloadAsync();
      else toast.show('Please update Aangan from the app store');
    } catch {
      toast.show('Could not update — try again');
    } finally {
      setUpdating(false);
    }
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

  // ── Zone 4 data ──────────────────────────────────────────────────────
  // "Around the aangan" needs no new query: loadHome already fetches all five
  // sources. This is a client-side merge of what is on screen anyway.
  const around = [
    ...recent.map((r) => ({ id: 'l' + r.id, at: r.created_at, icon: 'pricetag-outline' as const, title: r.title, where: 'Marketplace', photo: r.photos?.[0] ?? null, href: `/listing/${r.id}` })),
    ...recentProps.map((r) => ({ id: 'p' + r.id, at: r.created_at, icon: 'key-outline' as const, title: r.title, where: 'Flats', photo: r.photos?.[0] ?? null, href: `/property/${r.id}` })),
    ...recentBorrow.map((r) => ({ id: 'b' + r.id, at: r.created_at, icon: 'swap-horizontal-outline' as const, title: r.title, where: 'Borrow', photo: r.photo_url ?? null, href: `/borrow/${r.id}` })),
    ...recentPlaces.map((r) => ({ id: 'pl' + r.id, at: r.created_at, icon: 'location-outline' as const, title: r.name, where: 'Places', photo: null, href: `/place/${r.id}` })),
    ...recentLostFound.map((r) => ({ id: 'lf' + r.id, at: r.created_at, icon: 'help-circle-outline' as const, title: r.title, where: 'Lost & found', photo: null, href: `/lost-found/${r.id}` })),
  ]
    .filter((x) => x.title)
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, 5);

  // ── Zone 2 data ──────────────────────────────────────────────────────
  // Four separately-styled banners become one mechanism — and, critically,
  // this renders nothing when there is nothing. A calm society gets a calm
  // home; today a resident with no news still meets a digest card, an update
  // card and thirty tiles.
  const needsYou: { key: string; eyebrow: string; title: string; onPress: () => void }[] = [];
  if (updateBanner && !bannerDismissed) {
    needsYou.push({
      key: 'update',
      eyebrow: updateBanner.force_update ? 'Update required' : 'Update available',
      title: updateBanner.release_notes ?? `Version ${updateBanner.version} is ready`,
      onPress: () => setBannerDismissed(true),
    });
  }
  if (announcement) {
    needsYou.push({
      key: 'ann',
      eyebrow: 'Announcement',
      title: announcement.title || announcement.body,
      onPress: () => router.push(`/feed/${announcement.id}` as any),
    });
  }
  if (unread > 0) {
    needsYou.push({
      key: 'dm',
      eyebrow: unread === 1 ? '1 new message' : `${unread} new messages`,
      title: 'Open your inbox',
      onPress: () => router.push('/messages' as any),
    });
  }
  if (digest?.summary) {
    needsYou.push({
      key: 'digest',
      eyebrow: 'This week',
      title: digest.summary,
      onPress: () => router.push('/feed' as any),
    });
  }

  // Scroll-linked hero. The greeting is the largest thing on the screen at
  // rest and gives that size up as you move: it lifts, shrinks and fades over
  // the first 90px while a compact bar takes its place. Two states of one
  // header rather than a title that just scrolls away.
  const scrollY = useSharedValue(0);
  const pastThreshold = useSharedValue(false);
  const [floatingVisible, setFloatingVisible] = useState(false);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
    const past = e.contentOffset.y > 56;
    if (past !== pastThreshold.get()) {
      pastThreshold.set(past);
      runOnJS(setFloatingVisible)(past);
    }
  });

  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      opacity: interpolate(y, [0, 36], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [0, 60], [0, -12], Extrapolation.CLAMP) },
        { scale: interpolate(y, [0, 60], [1, 0.96], Extrapolation.CLAMP) },
      ],
    };
  });

  const compactStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      opacity: interpolate(y, [30, 62], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(y, [30, 62], [-10, 0], Extrapolation.CLAMP) }],
    };
  });


  return (
    <View className="flex-1 bg-bg">
      {/* Compact header — fades in as the hero leaves, so the screen always
          says whose society you are in without a permanent bar. */}
      {/* Only interactive once it is actually visible — an invisible bar that
          still swallows taps is worse than no bar. */}
      <View
        pointerEvents={floatingVisible ? 'box-none' : 'none'}
        style={{ position: 'absolute', top: 8, left: 20, right: 20, zIndex: 10 }}
      >
        <Animated.View style={compactStyle}>
          <Touchable
            haptic={null}
            onPress={() => router.push('/ask' as any)}
            accessibilityRole="button"
            accessibilityLabel="Ask or search Aangan"
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                boxShadow: c.shadowBar,
              } as any}
            >
              <BrandMark size={22} />
              <Text
                className="text-[14px] font-sans-md text-subtle"
                style={{ flex: 1, minWidth: 0, marginLeft: 10 }}
                numberOfLines={1}
              >
                Ask or search Aangan
              </Text>
              <Ionicons name="arrow-forward" size={16} color={c.accent} />
            </View>
          </Touchable>
        </Animated.View>
      </View>

    <AScrollView
      className="flex-1 bg-bg"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingTop: isDesktop ? insets.top + 24 : 0, paddingBottom: 40, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.muted} colors={[c.accent]} />}
    >
      <Container>
        {loadFailed ? (
          <ErrorRow message="Couldn't refresh your society just now." onRetry={refresh} />
        ) : null}

        {/* ── 1. Hero ──────────────────────────────────────────────────
            Society identity appears here, once, rather than in a pill
            hardcoded above twenty screens. */}
        <Animated.View style={heroStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <Avatar name={profile?.name ?? 'You'} size={44} />
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
              <Text className="text-[12px] font-sans-md text-muted" numberOfLines={1}>
                {greeting}
              </Text>
              <Text
                className="font-display-x text-[26px] leading-[30px]"
                style={{ color: c.accent }}
                numberOfLines={1}
              >
                {profile?.name ? profile.name.split(' ')[0] : 'Neighbour'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* The ask-or-search bar takes hero position because it answers the
            most common intent. A resident who needs a plumber is asking a
            question, not scanning thirty labels for the right one. */}
        <Rise index={0}>
        <Touchable haptic={null} onPress={() => router.push('/ask' as any)} className="mt-5">
          <View
            className="flex-row items-center gap-3 rounded-full px-4"
            style={{ height: 52, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, boxShadow: c.shadowCard } as any}
          >
            <BrandMark size={24} />
            <Text className="min-w-0 flex-1 text-[15px] font-sans-md text-subtle" numberOfLines={1}>
              Ask or search Aangan
            </Text>
            <Ionicons name="arrow-forward" size={17} color={c.accent} />
          </View>
        </Touchable>
        </Rise>

        {/* ── 2. Needs you ────────────────────────────────────────────── */}
        {needsYou.length ? (
          <Rise index={1} style={{ marginTop: 22 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
              {needsYou.map((n) => (
                <Touchable key={n.key} haptic={null} onPress={n.onPress}>
                  <View
                    style={{
                      flexDirection: 'row',
                      width: 268,
                      height: 88,
                      overflow: 'hidden',
                      backgroundColor: c.surface,
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                      borderBottomLeftRadius: 14,
                      borderBottomRightRadius: 14,
                      boxShadow: c.shadowCard,
                    } as any}
                  >
                    <View style={{ width: 3, backgroundColor: c.highlight, marginVertical: 14, marginLeft: 12, borderRadius: 2 }} />
                    <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 14, justifyContent: 'center' }}>
                      <Text className="text-[11px] font-sans-sb uppercase tracking-[0.06em]" style={{ color: c.highlightInk }} numberOfLines={1}>
                        {n.eyebrow}
                      </Text>
                      <Text className="mt-1 font-sans-sb text-[14px] leading-[19px] text-ink" numberOfLines={2}>
                        {n.title}
                      </Text>
                    </View>
                  </View>
                </Touchable>
              ))}
            </ScrollView>
          </Rise>
        ) : null}

        {/* ── 3. Cooking today ────────────────────────────────────────── */}
        <Rise index={2}>
          <FreshFoodStrip items={dishes} isDesktop={isDesktop} />
        </Rise>

        {/* ── 4. Around the aangan ─────────────────────────────────────
            What IS happening, rather than a menu of what could. */}
        {around.length ? (
          <Rise index={3} style={{ marginBottom: 32 }}>
            <SectionHead label="Around the aangan" actionLabel="See all" onAction={() => router.push('/listings' as any)} c={c} />
            <View
              className="overflow-hidden"
              style={{
                backgroundColor: c.surface,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                borderBottomLeftRadius: 14,
                borderBottomRightRadius: 14,
                boxShadow: c.shadowCard,
              } as any}
            >
              {around.map((a, i) => (
                <AroundRow
                  key={a.id}
                  item={a}
                  last={i === around.length - 1}
                  onPress={() => router.push(a.href as any)}
                  c={c}
                />
              ))}
            </View>
          </Rise>
        ) : null}

        {/* ── 5. All of Aangan ────────────────────────────────────────── */}
        <SectionHead label="All of Aangan" c={c} />
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
          {SERVICES.map((cat) => (
            <View key={cat.key} style={{ width: isDesktop ? '33.333%' : '50%', padding: 5 }}>
              <ModuleTile
                icon={cat.icon as any}
                label={cat.label}
                blurb={cat.blurb}
                onPress={() => handleCategoryPress(cat)}
              />
            </View>
          ))}
          {COMMUNITY_TILES.map((tile) => (
            <View key={tile.key} style={{ width: isDesktop ? '33.333%' : '50%', padding: 5 }}>
              <ModuleTile
                icon={tile.icon as any}
                label={tile.label}
                blurb={tile.blurb}
                badge={
                  tile.key === 'messages' ? unread
                    : tile.key === 'borrow' ? borrowCount
                      : tile.key === 'lost_found' ? lostFoundCount
                        : (tileCounts[tile.key] ?? 0)
                }
                onPress={() => router.push(tile.href as any)}
              />
            </View>
          ))}
        </View>
      </Container>
    </AScrollView>
    </View>
  );
}

/**
 * A row in "Around the aangan".
 *
 * The generic list row was too quiet for the most interesting section on the
 * screen. This one leads with the actual photo when there is one — a thing
 * your neighbour posted, not an icon standing in for a category — falling back
 * to a glyph plate. The category and the time share one line beneath the
 * title, so the row reads title-first, and the time sits at the end where it
 * is a glance rather than a competing headline.
 */
function AroundRow({
  item, last, onPress, c,
}: {
  item: { icon: any; title: string; where: string; at: string | null; photo: string | null };
  last: boolean;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Touchable haptic={null} onPress={onPress} accessibilityRole="button" accessibilityLabel={item.title}>
      <View>
        <View className="flex-row items-center gap-3 px-4" style={{ minHeight: 58, paddingVertical: 9 }}>
          {item.photo ? (
            <Image
              source={{ uri: item.photo }}
              style={{ width: 40, height: 40, borderRadius: 13 }}
              contentFit="cover"
              {...IMAGE_CACHE_PROPS}
            />
          ) : (
            <View
              className="items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.accentSoft }}
            >
              <Ionicons name={item.icon} size={19} color={c.accent} />
            </View>
          )}

          <View className="min-w-0 flex-1">
            <Text className="font-sans-sb text-[15px] text-ink" numberOfLines={1}>{item.title}</Text>
            <Text className="mt-0.5 text-[12px] font-sans-md text-subtle" numberOfLines={1}>
              <Text style={{ color: c.accent }} className="font-sans-sb">{item.where}</Text>
              {'  ·  ' + timeAgo(item.at)}
            </Text>
          </View>

        </View>
        {!last ? <View style={{ height: 1, marginLeft: 67, backgroundColor: c.line }} /> : null}
      </View>
    </Touchable>
  );
}

function SectionHead({
  label, actionLabel, onAction, c,
}: {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View className="mb-3 mt-6 flex-row items-center justify-between">
      <Text className="text-[11px] font-sans-sb uppercase tracking-[0.06em] text-subtle">{label}</Text>
      {actionLabel && onAction ? (
        <Touchable haptic={null} onPress={onAction}>
          <Text className="text-[13px] font-sans-sb" style={{ color: c.accent }}>{actionLabel}</Text>
        </Touchable>
      ) : null}
    </View>
  );
}




type StripItem =
  | { kind: 'listing'; id: string; ts: string; raw: ListingRow }
  | { kind: 'borrow'; id: string; ts: string; raw: LendItem }
  | { kind: 'property'; id: string; ts: string; raw: PropertyRow }
  | { kind: 'place'; id: string; ts: string; raw: PlaceRow }
  | { kind: 'lost_found'; id: string; ts: string; raw: LostFoundItem };



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

  // 196 wide, not 152: at 152 a plate of home-cooked food is a postage stamp.
  // The dish name sits ON the photo over a scrim — the single change that makes
  // this strip read as a food app rather than a directory — and the meal slot
  // becomes a plain uppercase word instead of a coloured emoji chip, because
  // colour here means "you can act on this", not "this is lunch".
  const Card = ({ d }: { d: DishRow }) => {
    const soldOut = d.plates_left <= 0;
    const serveLabel = freshServeLabel(d.serve_date);
    const scarce = !soldOut && d.plates_left > 0 && d.plates_left <= 2;
    return (
      <Touchable
        feel="card"
        haptic={null}
        onPress={() => router.push(`/dish/${d.id}` as any)}
        style={{ width: 196 }}
      >
        <View
          style={{
            overflow: 'hidden',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            backgroundColor: c.surface,
            boxShadow: c.shadowCard,
          } as any}
        >
          <View style={{ height: 140 }} className="w-full">
            {d.photo_url ? (
              <Image source={{ uri: d.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
            ) : (
              <View style={{ width: '100%', height: '100%', backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="restaurant-outline" size={34} color={c.subtle} />
              </View>
            )}

            {/* Scrim so the name stays legible on any photo. */}
            <LinearGradient
              colors={['transparent', 'rgba(8,14,10,0.72)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 74 }}
            />

            <View className="absolute left-2 top-2 rounded-md bg-surface/95 p-0.5">
              <VegMark type={d.veg_type} size={13} />
            </View>
            {serveLabel ? (
              <View className="absolute right-2 top-2 rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(10,14,11,0.62)' }}>
                <Text className="text-[10px] font-sans-sb text-white">{serveLabel}</Text>
              </View>
            ) : null}

            <Text
              className="absolute bottom-3 left-3 right-3 font-sans-sb text-[17px] text-white"
              numberOfLines={1}
            >
              {d.dish_name}
            </Text>

            {soldOut ? (
              <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(10,14,11,0.55)' }}>
                <Text className="font-sans-bold text-[12px] uppercase tracking-wide text-white">Sold out</Text>
              </View>
            ) : null}
          </View>

          <View style={{ padding: 12 }}>
            <View className="flex-row items-baseline gap-1.5">
              <Text className="font-display-x text-[22px] text-ink">₹{d.price}</Text>
              <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-subtle">
                {d.slot}
              </Text>
            </View>
            {/* Scarcity is the only marigold in the strip, so it genuinely pulls
                the eye — nothing else nearby is warm. */}
            <Text
              className="mt-0.5 text-[12px] font-sans-md"
              style={{ color: scarce ? c.highlightInk : c.muted }}
              numberOfLines={1}
            >
              {scarce ? `Only ${d.plates_left} left` : `Flat ${d.flat}`}
            </Text>
          </View>
        </View>
      </Touchable>
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
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}
