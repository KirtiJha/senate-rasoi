import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MyListingsSection } from '../../components/MyListingsSection';
import { SavedSection } from '../../components/SavedSection';
import { Avatar, Badge, Container, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { Community, fetchCommunityById } from '../../lib/communities';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';

type Tab = 'listings' | 'saved';

export default function YouScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { profile, communityId, isAdmin, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('listings');
  const [community, setCommunity] = useState<Community | null>(null);

  useEffect(() => {
    if (communityId && isSupabaseConfigured) {
      fetchCommunityById(communityId).then(setCommunity).catch(() => {});
    }
  }, [communityId]);

  return (
    <View className="flex-1 bg-bg">
      <View style={{ paddingTop: isDesktop ? insets.top + 18 : 14 }} className="px-4 pb-2">
        <Container narrow>
          {/* account header */}
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.push('/profile/me' as any)}>
              <Avatar name={profile?.name ?? 'You'} size={46} />
            </Pressable>
            <View className="flex-1">
              <Text className="font-display-x text-[22px] text-ink" numberOfLines={1}>
                {profile?.name ?? 'You'}
              </Text>
              <Text className="text-[12px] text-muted">{profile?.phone ?? ''}</Text>
              {community ? (
                <View className="mt-1 flex-row items-center gap-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: '#7C3AED1A' }}>
                  <Ionicons name="business" size={11} color="#7C3AED" />
                  <Text className="text-[11px] font-sans-sb" numberOfLines={1} style={{ color: '#7C3AED' }}>{community.name}</Text>
                </View>
              ) : null}
            </View>
            <Pressable onPress={() => router.push('/profile/me' as any)} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full bg-inset active:opacity-70">
              <Ionicons name="person-outline" size={20} color={c.muted} />
            </Pressable>
          </View>

          {/* role chip */}
          <View className="mt-2 flex-row gap-1.5">
            <Badge label={isAdmin ? 'Admin' : 'Member'} tone={isAdmin ? 'accent' : 'neutral'} />
          </View>

          {isAdmin ? (
            <Pressable onPress={() => router.push('/admin')} className="mt-3 flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
              <Ionicons name="shield-checkmark-outline" size={18} color={c.accent} />
              <Text className="flex-1 font-sans-sb text-[13px] text-ink">Admin · manage members & roles</Text>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          ) : null}

          {/* segments — food lives in the Food tab now; You = your listings & saved */}
          <View className="mt-3 flex-row rounded-2xl bg-inset p-1">
            <Segment label="My Listings" icon="list-outline" active={tab === 'listings'} onPress={() => setTab('listings')} c={c} />
            <Segment label="Saved" icon="bookmark-outline" active={tab === 'saved'} onPress={() => setTab('saved')} c={c} />
          </View>
        </Container>
      </View>

      {tab === 'saved' ? <SavedSection /> : <MyListingsSection />}
    </View>
  );
}

function Segment({
  label,
  icon,
  active,
  onPress,
  c,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable onPress={onPress} className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 ${active ? 'bg-surface' : ''}`}>
      <Ionicons name={icon} size={16} color={active ? c.accent : c.muted} />
      <Text className={`text-[13px] ${active ? 'font-sans-sb text-ink' : 'font-sans-md text-muted'}`}>{label}</Text>
    </Pressable>
  );
}
