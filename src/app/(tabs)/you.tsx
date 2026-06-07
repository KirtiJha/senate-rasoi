import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KitchenSection } from '../../components/KitchenSection';
import { MyListingsSection } from '../../components/MyListingsSection';
import { MyTiffinsSection } from '../../components/MyTiffinsSection';
import { OrdersSection } from '../../components/OrdersSection';
import { Avatar, Badge, Container, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { Community, fetchCommunityById } from '../../lib/communities';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';

type Tab = 'orders' | 'tiffins' | 'listings' | 'kitchen';

export default function YouScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { profile, communityId, isChef, isAdmin, addRole, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');
  const [community, setCommunity] = useState<Community | null>(null);

  useEffect(() => {
    if (communityId && isSupabaseConfigured) {
      fetchCommunityById(communityId).then(setCommunity).catch(() => {});
    }
  }, [communityId]);

  const becomeChef = async () => {
    await addRole('chef');
    toast.show('Chef mode on — post your first dish! 🎉');
    setTab('kitchen');
  };

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
                <View className="mt-0.5 flex-row items-center gap-1">
                  <Ionicons name="business-outline" size={11} color={c.faint} />
                  <Text className="text-[11px] text-faint" numberOfLines={1}>{community.name}</Text>
                </View>
              ) : null}
            </View>
            <Pressable onPress={() => router.push('/profile/me' as any)} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full bg-inset active:opacity-70">
              <Ionicons name="person-outline" size={20} color={c.muted} />
            </Pressable>
          </View>

          {/* role chips */}
          <View className="mt-2 flex-row gap-1.5">
            {profile?.roles.map((r) => (
              <Badge key={r} label={r === 'foodie' ? 'Foodie' : r === 'chef' ? 'Chef' : 'Admin'} tone={r === 'admin' ? 'accent' : 'neutral'} />
            ))}
          </View>

          {isAdmin ? (
            <Pressable onPress={() => router.push('/admin')} className="mt-3 flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
              <Ionicons name="shield-checkmark-outline" size={18} color={c.accent} />
              <Text className="flex-1 font-sans-sb text-[13px] text-ink">Admin · manage members & roles</Text>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          ) : null}

          {/* become-a-chef CTA for foodies */}
          {!isChef ? (
            <Pressable onPress={becomeChef} className="mt-3 flex-row items-center gap-3 rounded-2xl border border-accent-soft bg-accent-soft px-4 py-3">
              <Ionicons name="restaurant" size={20} color={c.accent} />
              <View className="flex-1">
                <Text className="font-sans-sb text-[14px] text-ink">Start cooking</Text>
                <Text className="text-[12px] text-muted">Become a chef to post dishes & tiffins</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          ) : null}

          {/* segments */}
          <View className="mt-3 flex-row rounded-2xl bg-inset p-1">
            <Segment label="Orders" icon="receipt-outline" active={tab === 'orders'} onPress={() => setTab('orders')} c={c} />
            <Segment label="Tiffins" icon="repeat-outline" active={tab === 'tiffins'} onPress={() => setTab('tiffins')} c={c} />
            <Segment label="Listings" icon="list-outline" active={tab === 'listings'} onPress={() => setTab('listings')} c={c} />
            {isChef ? <Segment label="Kitchen" icon="restaurant-outline" active={tab === 'kitchen'} onPress={() => setTab('kitchen')} c={c} /> : null}
          </View>
        </Container>
      </View>

      {tab === 'kitchen' && isChef ? (
        <KitchenSection />
      ) : tab === 'tiffins' ? (
        <MyTiffinsSection />
      ) : tab === 'listings' ? (
        <MyListingsSection />
      ) : (
        <OrdersSection />
      )}

      {/* chefs get a quick post entry on this screen too */}
      {isChef && tab === 'kitchen' ? (
        <Pressable
          onPress={() => router.push('/post')}
          className="absolute bottom-5 right-5 h-14 flex-row items-center gap-2 rounded-full bg-accent px-5 shadow-fab active:bg-accent-press"
        >
          <Ionicons name="add" size={22} color={c.onAccent} />
          <Text className="font-sans-sb text-[15px] text-on-accent">Post a dish</Text>
        </Pressable>
      ) : null}
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
