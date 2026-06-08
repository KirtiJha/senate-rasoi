import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Container, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { Community, fetchCommunityById } from '../../lib/communities';
import { SERVICES, ServiceCategory } from '../../lib/services';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';

type CommunityTile = { key: string; label: string; blurb: string; icon: string; color: string; href: string };

const COMMUNITY_TILES: CommunityTile[] = [
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
  const [community, setCommunity] = useState<Community | null>(null);

  useEffect(() => {
    if (communityId && isSupabaseConfigured) {
      fetchCommunityById(communityId).then(setCommunity).catch(() => {});
    }
  }, [communityId]);

  const greeting = getGreeting();

  const handleCategoryPress = (cat: ServiceCategory) => {
    if (cat.key === 'food') {
      router.push('/food');
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
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-[13px] font-sans-md text-accent">{greeting}</Text>
              <Text className="font-display-x text-[28px] leading-9 text-ink">
                {profile?.name ? `Hi, ${profile.name.split(' ')[0]} 👋` : 'Your neighbourhood hub'}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/profile/me' as any)}
              className="ml-3 mt-1 h-10 w-10 items-center justify-center rounded-full bg-inset active:opacity-70"
            >
              <Ionicons name="person-outline" size={20} color={c.muted} />
            </Pressable>
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
