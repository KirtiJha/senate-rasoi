import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '../components/listings/ListingCard';
import { ListingCardSkeleton, useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { fetchAllListings } from '../lib/listings';
import { SERVICES } from '../lib/services';
import { isSupabaseConfigured } from '../lib/supabase';
import { ListingRow } from '../lib/types';
import { layout, useThemeColors } from '../theme';

export default function AllListingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId } = useAuth();

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const listingServices = useMemo(() => SERVICES.filter((s) => s.kind === 'listing'), []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      setListings(await fetchAllListings(communityId, 0, 100));
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

  const cols = isDesktop ? 3 : 2;

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg pb-3">
        <View className="flex-row items-center gap-2 px-4">
          <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
          <Text className="flex-1 font-display-x text-[22px] text-ink">All listings</Text>
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
          key={cols}
          data={loading ? [] : filtered}
          numColumns={cols}
          keyExtractor={(item: ListingRow) => item.id}
          renderItem={({ item }: { item: ListingRow }) => (
            <View style={{ flex: 1, padding: 6 }}>
              <ListingCard listing={item} onPress={() => router.push(`/listing/${item.id}` as any)} />
            </View>
          )}
          contentContainerStyle={{ padding: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
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
              <View className="items-center py-20">
                <Text style={{ fontSize: 40 }} className="mb-3">🗂️</Text>
                <Text className="font-display text-xl text-ink mb-1">
                  {category ? 'Nothing here yet' : 'No listings yet'}
                </Text>
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
