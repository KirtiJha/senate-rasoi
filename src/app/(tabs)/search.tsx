import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '../../components/listings/ListingCard';
import { Avatar, ListingCardSkeleton, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { searchListings } from '../../lib/listings';
import {
  POST_CATEGORY_COLORS, POST_CATEGORY_ICONS, POST_CATEGORY_LABELS, PostRow, searchPosts,
} from '../../lib/posts';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '../../lib/recentSearches';
import { SERVICES } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { layout, useThemeColors } from '../../theme';

type Mode = 'listings' | 'posts';

export default function SearchScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId } = useAuth();

  const [mode, setMode] = useState<Mode>('listings');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [results, setResults] = useState<ListingRow[]>([]);
  const [postResults, setPostResults] = useState<PostRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => { getRecentSearches().then(setRecent); }, []);

  const commitSearch = useCallback((term: string) => {
    if (term.trim()) addRecentSearch(term).then(setRecent);
  }, []);

  const doSearch = useCallback(async (q: string, cat: string | null, m: Mode) => {
    if (!q.trim() && !(m === 'listings' && cat)) {
      setResults([]); setPostResults([]); setHasSearched(false); return;
    }
    if (!communityId) return;
    setSearching(true);
    setHasSearched(true);
    try {
      if (m === 'listings') {
        setResults(await searchListings(q.trim() || '', communityId, cat ?? undefined));
      } else {
        setPostResults(await searchPosts(q.trim(), communityId));
      }
    } catch { setResults([]); setPostResults([]); }
    finally { setSearching(false); }
  }, [communityId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { doSearch(query, selectedCategory, mode); }, 350);
    return () => clearTimeout(t);
  }, [query, selectedCategory, mode, doSearch]);

  const cols = isDesktop ? 3 : 2;
  const listingServices = SERVICES.filter((s) => s.kind === 'listing');
  const showListingGrid = mode === 'listings' && hasSearched && !searching && results.length > 0;
  const showPostList = mode === 'posts' && hasSearched && !searching && postResults.length > 0;

  const catChips = (
    <>
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
    </>
  );

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
            placeholder={mode === 'listings' ? 'Search listings…' : 'Search posts…'}
            placeholderTextColor={c.faint}
            className="flex-1 font-sans text-[15px] text-ink"
            style={{ outline: 'none' } as any}
            returnKeyType="search"
            clearButtonMode="while-editing"
            onSubmitEditing={() => commitSearch(query)}
            autoFocus
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={c.faint} />
            </Pressable>
          ) : null}
        </View>

        {/* Mode toggle: Listings | Posts */}
        <View className="mt-2.5 flex-row gap-2">
          {(['listings', 'posts'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5 ${mode === m ? 'bg-accent' : 'bg-inset'}`}
            >
              <Ionicons
                name={m === 'listings' ? 'pricetags-outline' : 'chatbubbles-outline'}
                size={13}
                color={mode === m ? c.onAccent : c.muted}
              />
              <Text className={`text-[12px] font-sans-sb ${mode === m ? 'text-on-accent' : 'text-muted'}`}>
                {m === 'listings' ? 'Listings' : 'Posts'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Category filter chips (listings only) — wrap on desktop so all are reachable */}
        {mode === 'listings' ? (
          isDesktop ? (
            <View className="mt-2.5 flex-row flex-wrap" style={{ gap: 6 }}>{catChips}</View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2.5" contentContainerStyle={{ gap: 6 }}>
              {catChips}
            </ScrollView>
          )
        ) : null}
      </View>

      {showListingGrid ? (
        <View style={{ flex: 1, width: '100%', maxWidth: layout.maxContent, alignSelf: 'center' }}>
          <FlashList
            key={cols}
            data={results}
            numColumns={cols}
            keyExtractor={(item: ListingRow) => item.id}
            renderItem={({ item }: { item: ListingRow }) => (
              <View style={{ flex: 1, padding: 6 }}>
                <ListingCard listing={item} onPress={() => { commitSearch(query); router.push(`/listing/${item.id}` as any); }} />
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
              <View>
                {recent.length > 0 ? (
                  <View className="mb-6">
                    <View className="mb-2.5 flex-row items-center justify-between">
                      <Text className="text-[12px] font-sans-sb uppercase tracking-wider text-muted">Recent</Text>
                      <Pressable onPress={() => { clearRecentSearches(); setRecent([]); }} hitSlop={8}>
                        <Text className="text-[12px] font-sans-sb text-accent">Clear</Text>
                      </Pressable>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {recent.map((term) => (
                        <Pressable
                          key={term}
                          onPress={() => { setQuery(term); commitSearch(term); }}
                          className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 active:opacity-70"
                        >
                          <Ionicons name="time-outline" size={13} color={c.faint} />
                          <Text className="text-[13px] font-sans-md text-ink">{term}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                <View className="items-center py-16">
                  <Ionicons name="search-outline" size={44} color={c.faint} />
                  <Text className="mt-3 font-display text-xl text-ink">Search your society</Text>
                  <Text className="mt-1 max-w-xs text-center text-[14px] text-muted">
                    {mode === 'listings'
                      ? 'Find services, items for sale, tutors, and more posted by your neighbours.'
                      : 'Find announcements, issues, events, and discussions from the community feed.'}
                  </Text>
                </View>
              </View>
            ) : searching ? (
              mode === 'listings' ? (
                <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                  {Array.from({ length: cols * 2 }).map((_, i) => (
                    <View key={i} style={{ width: `${100 / cols}%`, padding: 6 }}>
                      <ListingCardSkeleton />
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="py-10 text-center text-[14px] text-muted">Searching…</Text>
              )
            ) : showPostList ? (
              <>
                <Text className="mb-2 text-[13px] font-sans-md text-muted">
                  {postResults.length} result{postResults.length === 1 ? '' : 's'}
                </Text>
                <View style={{ gap: 10 }}>
                  {postResults.map((p) => (
                    <PostResultRow key={p.id} post={p} onPress={() => { commitSearch(query); router.push(`/feed/${p.id}` as any); }} c={c} />
                  ))}
                </View>
              </>
            ) : (
              <View className="items-center py-16">
                <Text style={{ fontSize: 38 }} className="mb-3">🔍</Text>
                <Text className="font-display text-xl text-ink mb-1">No results found</Text>
                <Text className="text-[14px] text-muted text-center max-w-xs">
                  {mode === 'listings'
                    ? 'Try different keywords or clear the category filter.'
                    : 'Try different keywords, or switch to Listings.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function PostResultRow({ post, onPress, c }: {
  post: PostRow;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const color = POST_CATEGORY_COLORS[post.category];
  const icon = POST_CATEGORY_ICONS[post.category];
  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-2xl border border-line bg-surface p-3.5 active:opacity-80"
    >
      <View className="mb-1.5 flex-row items-center gap-2">
        <View className="flex-row items-center gap-1.5 rounded-full px-2 py-0.5" style={{ backgroundColor: color + '20' }}>
          <Ionicons name={icon as any} size={11} color={color} />
          <Text className="text-[10px] font-sans-sb" style={{ color }}>{POST_CATEGORY_LABELS[post.category]}</Text>
        </View>
        {post.pinned ? <Ionicons name="pin" size={12} color="#D97706" /> : null}
        {post.resolved ? <Ionicons name="checkmark-circle" size={12} color="#059669" /> : null}
      </View>
      {post.title ? (
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{post.title}</Text>
      ) : null}
      <Text className="text-[13px] leading-5 text-muted" numberOfLines={2}>{post.body}</Text>
      <View className="mt-2 flex-row items-center gap-1.5">
        <Avatar name={post.author?.name ?? '?'} size={18} />
        <Text className="text-[11px] font-sans-md text-faint" numberOfLines={1}>
          {post.author?.name ?? 'Someone'}{post.author?.flat ? ` · Flat ${post.author.flat}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}
