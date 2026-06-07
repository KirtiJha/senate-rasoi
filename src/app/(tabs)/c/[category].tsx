import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '../../../components/listings/ListingCard';
import { Empty } from '../../../components/Empty';
import { Button, Container, useResponsive } from '../../../components/ui';
import { useAuth } from '../../../context/auth';
import { useToast } from '../../../context/toast';
import { fetchListings, getCachedListings, subscribeToListings } from '../../../lib/listings';
import { getService } from '../../../lib/services';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { ListingRow } from '../../../lib/types';
import { useThemeColors } from '../../../theme';

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId } = useAuth();
  const c = useThemeColors();

  const cat = getService(category ?? '');
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !category) {
      setLoading(false);
      return;
    }
    try {
      setListings(await fetchListings(category));
    } catch (e) {
      console.error(e);
      toast.show('Could not load listings — check your connection');
    } finally {
      setLoading(false);
    }
  }, [category, toast]);

  useEffect(() => {
    if (!category) return;
    let alive = true;
    getCachedListings(category).then((cached) => {
      if (alive && cached.length) { setListings(cached); setLoading(false); }
    });
    load();
    const unsub = subscribeToListings(category, load);
    return () => { alive = false; unsub(); };
  }, [category, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!cat) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Category not found.</Text>
      </View>
    );
  }

  const cols = isDesktop ? 3 : 2;

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingTop: isDesktop ? insets.top + 24 : 20, paddingBottom: 40, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Container>
          {/* Category header */}
          <View className="mb-5 flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: cat.color + '22' }}
            >
              <Ionicons name={cat.icon as any} size={24} color={cat.color} />
            </View>
            <View className="flex-1">
              <Text className="font-display-x text-[22px] text-ink">{cat.label}</Text>
              <Text className="text-[13px] font-sans-md text-muted">{cat.blurb}</Text>
            </View>
          </View>

          {/* Listings grid */}
          {loading ? (
            <LoadingGrid cols={cols} />
          ) : listings.length === 0 ? (
            <Empty
              icon={cat.icon.includes('construct') ? '🔧' : cat.icon.includes('bag') ? '🛍️' : '📋'}
              title={`No ${cat.label} yet`}
            >
              Neighbours can post {cat.listingType === 'product' ? 'items' : cat.listingType === 'recommendation' ? 'recommendations' : 'services'} here and connect directly. Tap + to be first.
            </Empty>
          ) : (
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              {listings.map((l) => (
                <View key={l.id} style={{ width: `${100 / cols}%`, padding: 6 }}>
                  <ListingCard
                    listing={l}
                    onPress={() => router.push(`/listing/${l.id}` as any)}
                  />
                </View>
              ))}
            </View>
          )}
        </Container>
      </ScrollView>

      {/* FAB to post */}
      <View className="absolute bottom-5 right-5">
        <Button
          label="Post"
          icon="add"
          size="sm"
          onPress={() => router.push({ pathname: '/post', params: { category: cat.key } } as any)}
        />
      </View>
    </View>
  );
}

function LoadingGrid({ cols }: { cols: number }) {
  return (
    <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
      {Array.from({ length: cols * 2 }).map((_, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, padding: 6 }}>
          <View className="overflow-hidden rounded-2xl bg-surface" style={{ height: 200 }}>
            <View className="animate-pulse h-full w-full bg-inset" />
          </View>
        </View>
      ))}
    </View>
  );
}
