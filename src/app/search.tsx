import { Ionicons } from '@expo/vector-icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Avatar, ErrorState, RowSkeleton, ScreenHeader } from '../components/ui';
import { SaathiMark } from '../components/SaathiMark';
import { useAuth } from '../context/auth';
import { qk } from '../lib/queryClient';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '../lib/recentSearches';
import { SEARCH_MIN_CHARS, searchSociety, type SearchHit, type SearchKind } from '../lib/search';
import { isSupabaseConfigured } from '../lib/supabase';
import { layout, useThemeColors } from '../theme';

const SEARCH_MAX = layout.maxContent;

// How each kind of hit presents itself. Residents draw an avatar instead.
const KIND: Record<SearchKind, { label: string; icon: string }> = {
  resident: { label: 'Residents', icon: 'person' },
  sport: { label: 'Sports', icon: 'football' },
  document: { label: 'Documents', icon: 'document-text' },
  dish: { label: 'Home Food', icon: 'restaurant' },
  tiffin: { label: 'Tiffins', icon: 'repeat' },
  listing: { label: 'Listings', icon: 'pricetag' },
  post: { label: 'Posts', icon: 'chatbubble' },
  borrow: { label: 'Borrow & Lend', icon: 'swap-horizontal' },
  lost_found: { label: 'Lost & Found', icon: 'search-circle' },
  place: { label: 'Nearby', icon: 'location' },
  recommend: { label: 'Ask & Recommend', icon: 'help-circle' },
};

export default function SearchScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { communityId } = useAuth();

  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  // The search used to download the whole society on open and score it here.
  // Now it is one question to the database per pause in typing, ranked
  // across every tile and remembered for five minutes so backing out and
  // retyping the same word costs nothing.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const active = debounced.length >= SEARCH_MIN_CHARS;

  const search = useQuery({
    queryKey: qk.search(communityId ?? '', debounced),
    enabled: active && !!communityId && isSupabaseConfigured,
    queryFn: () => searchSociety(communityId!, debounced),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  useFocusEffect(useCallback(() => { getRecentSearches().then(setRecents); }, []));

  // Grouped by kind, in the order each kind first appears — so the group
  // holding the best match sits at the top rather than a fixed sequence.
  const grouped = useMemo(() => {
    const rows = search.data ?? [];
    const byKind = new Map<SearchKind, SearchHit[]>();
    for (const hit of rows) {
      if (!KIND[hit.kind]) continue;
      const arr = byKind.get(hit.kind) ?? [];
      arr.push(hit);
      byKind.set(hit.kind, arr);
    }
    return [...byKind.entries()].map(([kind, hits]) => ({ kind, rows: hits }));
  }, [search.data]);

  const typed = query.trim();
  const total = search.data?.length ?? 0;

  const onPick = (hit: SearchHit) => {
    if (typed) addRecentSearch(typed).then(setRecents);
    router.push(hit.route as never);
  };

  return (
    <View className="flex-1 overflow-hidden bg-bg">
      <ScreenHeader
        showBack
        icon="search-outline"
        title="Search"
        subBar={
          <View className="flex-row items-center gap-2 card px-3 py-2.5">
            <Ionicons name="search-outline" size={19} color={c.faint} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              placeholder="Search your society…"
              placeholderTextColor={c.faint}
              className="min-w-0 flex-1 font-sans text-[15px] text-ink"
              style={{ outline: 'none', minWidth: 0 } as any}
              returnKeyType="search"
              accessibilityLabel="Search"
            />
            {query.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={() => { setQuery(''); inputRef.current?.focus(); }} hitSlop={8}>
                <Ionicons name="close-circle" size={19} color={c.faint} />
              </Pressable>
            ) : null}
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="w-full self-center" style={{ maxWidth: SEARCH_MAX }}>
          {!typed ? (
            <>
              <Pressable
                onPress={() => router.push('/ask' as any)}
                className="mb-5 flex-row items-center gap-3 rounded-2xl border active:opacity-90"
                style={{ borderColor: c.accent + '55', backgroundColor: c.accent + '12' }}
              >
                <View style={{ marginLeft: 12, marginVertical: 11 }}>
                  <SaathiMark size={38} />
                </View>
                <View className="flex-1 py-3">
                  <Text className="font-sans-bold text-[14px] text-ink">Ask Saathi a question</Text>
                  <Text className="text-[12px] font-sans-md text-muted" numberOfLines={1}>“Any veg tiffin?” · “2 BHK for rent?” · “Borrow a drill?”</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={c.accent} style={{ marginRight: 14 }} />
              </Pressable>
              <RecentsOrHint recents={recents} onPick={(q) => setQuery(q)} onClear={() => { clearRecentSearches(); setRecents([]); }} c={c} />
            </>
          ) : typed.length < SEARCH_MIN_CHARS ? (
            <Text className="py-6 text-center font-sans text-[13px] text-muted">Keep typing…</Text>
          ) : search.isError ? (
            <ErrorState
              title="Search isn't ready"
              message="We couldn't reach your society just now. Try again."
              onRetry={() => search.refetch()}
              retrying={search.isFetching}
            />
          ) : search.isPending || !active ? (
            <View className="overflow-hidden card"><RowSkeleton count={5} /></View>
          ) : total === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="search-outline" size={40} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink mb-1">No results</Text>
              <Text className="font-sans text-[14px] text-muted text-center max-w-xs">Nothing matched “{debounced}”. Try a different word, or ask Saathi.</Text>
            </View>
          ) : (
            <View style={{ opacity: search.isPlaceholderData ? 0.6 : 1 }}>
              {grouped.map((g) => (
                <View key={g.kind} className="mb-5">
                  <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-faint">{KIND[g.kind].label} · {g.rows.length}</Text>
                  <View className="overflow-hidden card">
                    {g.rows.map((hit, i) => (
                      <ResultRow key={`${hit.kind}:${hit.id}`} hit={hit} first={i === 0} c={c} onPress={() => onPick(hit)} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ResultRow({ hit, first, c, onPress }: { hit: SearchHit; first: boolean; c: ReturnType<typeof useThemeColors>; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${hit.title}, ${hit.subtitle}`}
      onPress={onPress}
      className={`flex-row items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-line'} active:bg-inset`}
    >
      {hit.kind === 'resident' ? (
        <Avatar name={hit.title} size={36} />
      ) : (
        <View className="h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: c.accentSoft }}>
          <Ionicons name={KIND[hit.kind].icon as any} size={18} color={c.accent} />
        </View>
      )}
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{hit.title}</Text>
        <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>{hit.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.faint} />
    </Pressable>
  );
}

function RecentsOrHint({
  recents, onPick, onClear, c,
}: {
  recents: string[]; onPick: (q: string) => void; onClear: () => void; c: ReturnType<typeof useThemeColors>;
}) {
  if (recents.length === 0) {
    return (
      <View className="items-center py-16">
        <Ionicons name="sparkles-outline" size={36} color={c.faint} />
        <Text className="mt-3 font-display text-xl text-ink mb-1">Search anything</Text>
        <Text className="font-sans text-[14px] text-muted text-center max-w-xs">Neighbours, food, listings, posts, things to borrow, places nearby — all in one place.</Text>
      </View>
    );
  }
  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-faint">Recent</Text>
        <Pressable onPress={onClear} hitSlop={8}><Text className="text-[12px] font-sans-md text-accent">Clear</Text></Pressable>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {recents.map((r) => (
          <Pressable key={r} onPress={() => onPick(r)} className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 active:bg-inset">
            <Ionicons name="time-outline" size={13} color={c.muted} />
            <Text className="text-[13px] font-sans-md text-ink">{r}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
