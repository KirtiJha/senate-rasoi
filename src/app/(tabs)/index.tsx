import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Container, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useUnreadDms } from '../../context/unread';
import { Community, fetchCommunityById } from '../../lib/communities';
import { PostRow, fetchLatestAnnouncement } from '../../lib/posts';
import { SERVICES, ServiceCategory } from '../../lib/services';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AppVersion, fetchLatestVersion, isNewer } from '../../lib/appVersion';
import { useThemeColors } from '../../theme';

const DISMISSED_ANNOUNCEMENT_KEY = 'aangan:dismissed-announcement';

type CommunityTile = { key: string; label: string; blurb: string; icon: string; color: string; href: string };

const COMMUNITY_TILES: CommunityTile[] = [
  {
    key: 'listings',
    label: 'All Listings',
    blurb: 'Browse every category',
    icon: 'pricetags',
    color: '#14B8A6',
    href: '/listings',
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
  const { profile, communityId } = useAuth();
  const c = useThemeColors();
  const unread = useUnreadDms();
  const [community, setCommunity] = useState<Community | null>(null);
  const [updateBanner, setUpdateBanner] = useState<AppVersion | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [announcement, setAnnouncement] = useState<PostRow | null>(null);

  useEffect(() => {
    if (communityId && isSupabaseConfigured) {
      fetchCommunityById(communityId).then(setCommunity).catch(() => {});
      fetchLatestAnnouncement(communityId).then(async (post) => {
        if (!post) return;
        const dismissed = await AsyncStorage.getItem(DISMISSED_ANNOUNCEMENT_KEY);
        if (dismissed !== post.id) setAnnouncement(post);
      }).catch(() => {});
    }
  }, [communityId]);

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
          <View>
            <Text className="text-[13px] font-sans-md text-accent">{greeting}</Text>
            <Text className="font-display-x text-[28px] leading-9 text-ink">
              {profile?.name ? `Hi, ${profile.name.split(' ')[0]} 👋` : 'Your neighbourhood hub'}
            </Text>
          </View>

          {/* Society badge */}
          {community ? (
            <View className="mt-2 flex-row items-center gap-1.5 self-start rounded-full border border-line bg-surface px-3 py-1.5">
              <Ionicons name="business-outline" size={13} color={c.faint} />
              <Text className="text-[12px] font-sans-md text-muted" numberOfLines={1}>{community.name}</Text>
            </View>
          ) : null}

          <Text className="mt-2 text-[14px] font-sans-md text-muted">
            What can your society help you with today?
          </Text>
        </View>

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
              <View className="flex-1">
                <Text className="text-[11px] font-sans-sb uppercase tracking-wider" style={{ color: '#B45309' }}>Announcement</Text>
                {announcement.title ? <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{announcement.title}</Text> : null}
                <Text className="text-[13px] text-muted" numberOfLines={2}>{announcement.body}</Text>
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
              <View className="flex-1">
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

        {/* Service grid */}
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          {SERVICES.map((cat) => (
            <ServiceTile key={cat.key} cat={cat} onPress={() => handleCategoryPress(cat)} />
          ))}
        </View>

        {/* Community tools */}
        <View className="mt-6">
          <Text className="mb-3 px-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Community</Text>
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
            {COMMUNITY_TILES.map((tile) => (
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
                  {tile.key === 'messages' && unread > 0 ? (
                    <View
                      className="absolute items-center justify-center rounded-full px-1.5"
                      style={{ top: 12, right: 12, minWidth: 20, height: 20, backgroundColor: tile.color }}
                    >
                      <Text className="font-sans-bold text-white" style={{ fontSize: 11 }}>
                        {unread > 9 ? '9+' : unread}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </Container>
    </ScrollView>
  );
}

function ServiceTile({ cat, onPress }: { cat: ServiceCategory; onPress: () => void }) {
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
      </Pressable>
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
