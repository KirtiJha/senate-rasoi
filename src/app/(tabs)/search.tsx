import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '../../components/listings/ListingCard';
import { ListingCardSkeleton, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { searchListings } from '../../lib/listings';
import { SERVICES } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { layout, useThemeColors } from '../../theme';

export default function SearchScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId } = useAuth();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [results, setResults] = useState<ListingRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const doSearch = useCallback(async (q: string, cat: string | null) => {
    if (!q.trim() && !cat) { setResults([]); setHasSearched(false); return; }
    if (!communityId) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const rows = await searchListings(q.trim() || '', communityId, cat ?? undefined);
      setResults(rows);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [communityId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { doSearch(query, selectedCategory); }, 350);
    return () => clearTimeout(t);
  }, [query, selectedCategory, doSearch]);

  const cols = isDesktop ? 3 : 2;
  const listingServices = SERVICES.filter((s) => s.kind === 'listing');
  const showGrid = hasSearched && !searching && results.length > 0;

  return (
    <View className="flex-1 bg-bg">
      {/* Search bar */}
      <View style={{ paddingTop: isDesktop ? insets.top + 16 : 12 }} className="border-b border-line bg-bg px-4 pb-3">
        <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
          <Ionicons name="search-outline" size={18} color={c.faint} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search listings…"
            placeholderTextColor={c.faint}
            className="flex-1 font-sans text-[15px] text-ink"
            style={{ outline: 'none' } as any}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoFocus
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={c.faint} />
            </Pressable>
          ) : null}
        </View>

        {/* Category filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2.5" contentContainerStyle={{ gap: 6 }}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            className={`rounded-full px-3 py-1.5 ${!selectedCategory ? 'bg-accent' : 'bg-inset'}`}
          >
            <Text className={`text-[12px] font-sans-sb ${!selectedCategory ? 'text-on-accent' : 'text-muted'}`}>All</Text>
          </Pressable>
          {listingServices.map((svc) => (
            <Pressable
              key={svc.key}
              onPress={() => setSelectedCategory(selectedCategory === svc.key ? null : svc.key)}
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ backgroundColor: selectedCategory === svc.key ? svc.color : svc.color + '18' }}
            >
              <Ionicons name={svc.icon as any} size={11} color={selectedCategory === svc.key ? '#fff' : svc.color} />
              <Text className="text-[12px] font-sans-sb" style={{ color: selectedCategory === svc.key ? '#fff' : svc.color }}>
                {svc.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {showGrid ? (
        <View style={{ flex: 1, width: '100%', maxWidth: layout.maxContent, alignSelf: 'center' }}>
          <FlashList
            key={cols}
            data={results}
            numColumns={cols}
            keyExtractor={(item: ListingRow) => item.id}
            renderItem={({ item }: { item: ListingRow }) => (
              <View style={{ flex: 1, padding: 6 }}>
                <ListingCard listing={item} onPress={() => router.push(`/listing/${item.id}` as any)} />
              </View>
            )}
            contentContainerStyle={{ padding: 10, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text className="mb-2 text-[13px] font-sans-md text-muted" style={{ paddingHorizontal: 6 }}>
                {results.length} result{results.length === 1 ? '' : 's'}
              </Text>
            }
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="w-full self-center" style={{ maxWidth: layout.maxContent }}>
            {!hasSearched ? (
              <View className="items-center py-20">
                <Ionicons name="search-outline" size={44} color={c.faint} />
                <Text className="mt-3 font-display text-xl text-ink">Search your society</Text>
                <Text className="mt-1 max-w-xs text-center text-[14px] text-muted">
                  Find services, items for sale, tutors, and more posted by your neighbours.
                </Text>
              </View>
            ) : searching ? (
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                {Array.from({ length: cols * 2 }).map((_, i) => (
                  <View key={i} style={{ width: `${100 / cols}%`, padding: 6 }}>
                    <ListingCardSkeleton />
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center py-16">
                <Text style={{ fontSize: 38 }} className="mb-3">🔍</Text>
                <Text className="font-display text-xl text-ink mb-1">No results found</Text>
                <Text className="text-[14px] text-muted text-center max-w-xs">
                  Try different keywords or clear the category filter.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
