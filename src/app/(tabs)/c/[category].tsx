import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty } from '../../../components/Empty';
import { ServiceDirectory } from '../../../components/ServiceDirectory';
import { ListingCard } from '../../../components/listings/ListingCard';
import { ListingCardSkeleton, useResponsive } from '../../../components/ui';
import { useAuth } from '../../../context/auth';
import { useToast } from '../../../context/toast';
import { fetchListings, getCachedListings, subscribeToListings } from '../../../lib/listings';
import { getService } from '../../../lib/services';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { ListingRow } from '../../../lib/types';
import { layout } from '../../../theme';

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId } = useAuth();

  const PAGE = 20;
  const cat = getService(category ?? '');
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (pageIndex = 0) => {
    if (!isSupabaseConfigured || !category) {
      setLoading(false);
      return;
    }
    try {
      const rows = await fetchListings(category, communityId ?? undefined, pageIndex * PAGE, PAGE);
      if (pageIndex === 0) {
        setListings(rows);
      } else {
        setListings((prev: ListingRow[]) => [...prev, ...rows]);
      }
      setHasMore(rows.length === PAGE);
      setPage(pageIndex);
    } catch (e) {
      console.error(e);
      toast.show('Could not load listings — check your connection');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category, communityId, toast]);

  useEffect(() => {
    if (!category) return;
    let alive = true;
    getCachedListings(category).then((cached) => {
      if (alive && cached.length) { setListings(cached); setLoading(false); }
    });
    load(0);
    const unsub = subscribeToListings(category, communityId ?? undefined, () => load(0));
    return () => { alive = false; unsub(); };
  }, [category, communityId, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(0);
    setRefreshing(false);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await load(page + 1);
  }, [load, loadingMore, hasMore, page]);

  if (!cat) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Category not found.</Text>
      </View>
    );
  }

  // The Service Directory (recommendation contacts) reads better as a call list.
  if (cat.listingType === 'recommendation') {
    return <ServiceDirectory cat={cat} />;
  }

  const cols = isDesktop ? 3 : 2;

  const header = (
    <View className="mb-5 flex-row items-center gap-3" style={{ paddingHorizontal: 6 }}>
      <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: cat.color + '22' }}>
        <Ionicons name={cat.icon as any} size={24} color={cat.color} />
      </View>
      <View className="flex-1">
        <Text className="font-display-x text-[22px] text-ink">{cat.label}</Text>
        <Text className="text-[13px] font-sans-md text-muted">{cat.blurb}</Text>
      </View>
      <Pressable
        onPress={() => router.push({ pathname: '/post', params: { category: cat.key } } as any)}
        className="h-11 w-11 items-center justify-center rounded-full active:opacity-80"
        style={{ backgroundColor: cat.color }}
        accessibilityLabel={`Post in ${cat.label}`}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-bg">
      <View style={{ flex: 1, width: '100%', maxWidth: layout.maxContent, alignSelf: 'center' }}>
        <FlashList
          key={cols}
          data={loading ? [] : listings}
          numColumns={cols}
          keyExtractor={(item: ListingRow) => item.id}
          renderItem={({ item }: { item: ListingRow }) => (
            <View style={{ flex: 1, padding: 6 }}>
              <ListingCard listing={item} onPress={() => router.push(`/listing/${item.id}` as any)} />
            </View>
          )}
          contentContainerStyle={{
            paddingTop: isDesktop ? insets.top + 24 : 20,
            paddingBottom: 100,
            paddingHorizontal: 10,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListEmptyComponent={
            loading ? (
              <View className="flex-row flex-wrap">
                {Array.from({ length: cols * 2 }).map((_, i) => (
                  <View key={i} style={{ width: `${100 / cols}%`, padding: 6 }}>
                    <ListingCardSkeleton />
                  </View>
                ))}
              </View>
            ) : (
              <Empty
                icon={cat.icon.includes('construct') ? '🔧' : cat.icon.includes('bag') ? '🛍️' : '📋'}
                title={`No ${cat.label} yet`}
              >
                Neighbours can post {cat.listingType === 'product' ? 'items' : 'services'} here and connect directly. Tap + to be first.
              </Empty>
            )
          }
          ListFooterComponent={
            !loading && hasMore && listings.length > 0 ? (
              <Pressable
                onPress={loadMore}
                disabled={loadingMore}
                className="mt-4 items-center rounded-2xl border border-line bg-surface py-3"
                style={{ marginHorizontal: 6 }}
              >
                <Text className="text-[13px] font-sans-md text-muted">
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Text>
              </Pressable>
            ) : null
          }
        />
      </View>
    </View>
  );
}
