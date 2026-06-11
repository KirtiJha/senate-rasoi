import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, RowSkeleton, ScreenHeader, useResponsive } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { fetchDirectory } from '../../lib/directory';
import { fetchDishes } from '../../lib/dishes';
import { fetchDocuments, fileGlyph } from '../../lib/documents';
import { fetchAllListings } from '../../lib/listings';
import { POST_CATEGORY_COLORS, POST_CATEGORY_ICONS, fetchPosts } from '../../lib/posts';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '../../lib/recentSearches';
import { getService } from '../../lib/services';
import { fetchGroups, getSport } from '../../lib/sports';
import { isSupabaseConfigured } from '../../lib/supabase';
import { listTiffinPlans } from '../../lib/tiffin';
import { layout, useThemeColors } from '../../theme';

const SEARCH_MAX = layout.maxContent;
const FOOD_COLOR = '#E8650A';
const TIFFIN_COLOR = '#F59E0B';
const RESIDENT_COLOR = '#0EA5E9';

type Kind = 'resident' | 'sport' | 'document' | 'dish' | 'tiffin' | 'listing' | 'post';

interface SearchItem {
  id: string;
  kind: Kind;
  title: string;
  subtitle: string;
  haystack: string;
  icon: string;
  color: string;
  avatar?: string; // residents render an avatar instead of an icon
  open: () => void;
}

const KIND_ORDER: Kind[] = ['resident', 'sport', 'document', 'dish', 'tiffin', 'listing', 'post'];
const KIND_LABEL: Record<Kind, string> = {
  resident: 'Residents', sport: 'Sports', document: 'Documents', dish: 'Home Food', tiffin: 'Tiffins', listing: 'Listings', post: 'Posts',
};

// ── Fuzzy scoring ────────────────────────────────────────────────────
function isSubsequence(q: string, h: string): boolean {
  if (!q) return true;
  let i = 0;
  for (let j = 0; j < h.length && i < q.length; j++) if (h[j] === q[i]) i++;
  return i === q.length;
}
function score(it: SearchItem, q: string): number {
  const title = it.title.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.every((tk) => it.haystack.includes(tk))) {
    if (title.startsWith(q)) return 100;
    if (title.includes(q)) return 86;
    if (tokens.every((tk) => title.includes(tk))) return 72;
    return 56;
  }
  if (isSubsequence(q.replace(/\s+/g, ''), it.haystack)) return 24; // typo tolerance
  return -1;
}

export default function SearchScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId, userId, isAdmin } = useAuth();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      const [residents, listings, posts, dishes, tiffins, groups, documents] = await Promise.all([
        fetchDirectory(communityId, userId, !!isAdmin).catch(() => []),
        fetchAllListings(communityId, 0, 200).catch(() => []),
        fetchPosts(communityId, undefined, 0, 100).catch(() => []),
        fetchDishes(communityId).catch(() => []),
        listTiffinPlans(communityId).catch(() => []),
        fetchGroups(communityId, userId).catch(() => []),
        fetchDocuments(communityId).catch(() => []),
      ]);

      const next: SearchItem[] = [];

      for (const r of residents) {
        next.push({
          id: `r:${r.key}`, kind: 'resident', title: r.name,
          subtitle: [r.flat ? `Flat ${r.flat}` : null, r.profession, r.resident_type].filter(Boolean).join(' · ') || 'Resident',
          haystack: `${r.name} ${r.flat ?? ''} ${r.profession ?? ''} ${r.vehicle_no ?? ''} ${r.resident_type ?? ''}`.toLowerCase(),
          icon: 'person', color: RESIDENT_COLOR, avatar: r.name,
          open: () => (r.userId ? router.push(`/profile/${r.userId}` as any) : router.push('/directory' as any)),
        });
      }
      for (const g of groups) {
        const sp = getSport(g.sport);
        next.push({
          id: `g:${g.id}`, kind: 'sport', title: g.name, subtitle: `${sp?.label ?? g.sport} · ${g.member_count} member${g.member_count === 1 ? '' : 's'}`,
          haystack: `${g.name} ${sp?.label ?? g.sport}`.toLowerCase(),
          icon: 'football', color: g.color ?? sp?.color ?? '#16A34A', open: () => router.push(`/sports/${g.id}` as any),
        });
      }
      for (const doc of documents) {
        const fg = fileGlyph(doc.mime_type);
        next.push({
          id: `doc:${doc.id}`, kind: 'document', title: doc.name, subtitle: `${doc.is_public ? 'Public' : 'Shared'} · ${doc.owner?.name ?? 'Someone'}`,
          haystack: `${doc.name} ${doc.description ?? ''}`.toLowerCase(),
          icon: fg.icon, color: fg.color, open: () => router.push('/documents' as any),
        });
      }
      for (const d of dishes) {
        next.push({
          id: `d:${d.id}`, kind: 'dish', title: d.dish_name, subtitle: `by ${d.chef_name} · ₹${d.price}`,
          haystack: `${d.dish_name} ${d.chef_name}`.toLowerCase(),
          icon: 'restaurant', color: FOOD_COLOR, open: () => router.push('/food' as any),
        });
      }
      for (const t of tiffins) {
        next.push({
          id: `t:${t.id}`, kind: 'tiffin', title: t.title, subtitle: `Tiffin · ₹${t.price}/day`,
          haystack: `${t.title} ${t.description ?? ''} ${t.chef?.name ?? ''}`.toLowerCase(),
          icon: 'repeat', color: TIFFIN_COLOR, open: () => router.push('/food' as any),
        });
      }
      for (const l of listings) {
        const cat = getService(l.category);
        const title = l.is_referral ? l.referral_name ?? l.title : l.title;
        next.push({
          id: `l:${l.id}`, kind: 'listing', title, subtitle: cat?.label ?? l.category,
          haystack: `${title} ${l.description ?? ''} ${cat?.label ?? ''} ${l.location ?? ''}`.toLowerCase(),
          icon: (cat?.icon as string) ?? 'pricetag', color: cat?.color ?? '#888',
          open: () => router.push(`/listing/${l.id}` as any),
        });
      }
      for (const p of posts) {
        const title = p.title || p.body.split('\n')[0].slice(0, 80);
        next.push({
          id: `p:${p.id}`, kind: 'post', title, subtitle: `${p.author?.name ?? 'Someone'} · Feed`,
          haystack: `${p.title ?? ''} ${p.body} ${p.author?.name ?? ''}`.toLowerCase(),
          icon: (POST_CATEGORY_ICONS[p.category] as string) ?? 'chatbubble',
          color: POST_CATEGORY_COLORS[p.category] ?? c.muted,
          open: () => router.push('/feed' as any),
        });
      }
      setItems(next);
    } catch { /* defensive */ }
    finally { setLoading(false); }
  }, [communityId, userId, isAdmin, router, c.muted]);

  useFocusEffect(useCallback(() => { load(); getRecentSearches().then(setRecents); }, [load]));

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = items
      .map((it) => ({ it, s: score(it, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.it.title.localeCompare(b.it.title));
    const byKind = new Map<Kind, SearchItem[]>();
    for (const { it } of scored) {
      const arr = byKind.get(it.kind) ?? [];
      arr.push(it);
      byKind.set(it.kind, arr);
    }
    return KIND_ORDER.filter((k) => byKind.has(k)).map((k) => ({ kind: k, rows: byKind.get(k)! }));
  }, [items, query]);

  const total = grouped.reduce((s, g) => s + g.rows.length, 0);

  const onPick = (it: SearchItem) => {
    if (query.trim()) addRecentSearch(query.trim()).then(setRecents);
    it.open();
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="search-outline"
        title="Search"
        hideSociety
        subBar={
          <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
            <Ionicons name="search-outline" size={19} color={c.faint} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Search residents, food, listings, posts…"
              placeholderTextColor={c.faint}
              className="flex-1 font-sans text-[15px] text-ink"
              style={{ outline: 'none' } as any}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => { setQuery(''); inputRef.current?.focus(); }} hitSlop={8}>
                <Ionicons name="close-circle" size={19} color={c.faint} />
              </Pressable>
            ) : null}
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="w-full self-center" style={{ maxWidth: SEARCH_MAX }}>
          {!query.trim() ? (
            <>
              <Pressable
                onPress={() => router.push('/ask' as any)}
                className="mb-5 flex-row items-center gap-3 rounded-2xl border active:opacity-90"
                style={{ borderColor: c.accent + '55', backgroundColor: c.accent + '12' }}
              >
                <View className="h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: c.accent + '22', marginLeft: 12, marginVertical: 12 }}>
                  <Ionicons name="sparkles" size={18} color={c.accent} />
                </View>
                <View className="flex-1 py-3">
                  <Text className="font-sans-bold text-[14px] text-ink">Ask Aangan a question</Text>
                  <Text className="text-[12px] font-sans-md text-muted" numberOfLines={1}>“Any veg tiffin?” · “2 BHK for rent?” · “Borrow a drill?”</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={c.accent} style={{ marginRight: 14 }} />
              </Pressable>
              <RecentsOrHint loading={loading} recents={recents} onPick={(q) => setQuery(q)} onClear={() => { clearRecentSearches(); setRecents([]); }} c={c} />
            </>
          ) : total === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="search-outline" size={40} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink mb-1">No results</Text>
              <Text className="text-[14px] text-muted text-center max-w-xs">Nothing matched “{query.trim()}”. Try a different word.</Text>
            </View>
          ) : (
            grouped.map((g) => (
              <View key={g.kind} className="mb-5">
                <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-faint">{KIND_LABEL[g.kind]} · {g.rows.length}</Text>
                <View className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {g.rows.map((it, i) => (
                    <ResultRow key={it.id} it={it} first={i === 0} c={c} onPress={() => onPick(it)} />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ResultRow({ it, first, c, onPress }: { it: SearchItem; first: boolean; c: ReturnType<typeof useThemeColors>; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-line'} active:bg-inset`}>
      {it.avatar ? (
        <Avatar name={it.avatar} size={36} />
      ) : (
        <View className="h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: it.color + '20' }}>
          <Ionicons name={it.icon as any} size={18} color={it.color} />
        </View>
      )}
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{it.title}</Text>
        <Text className="text-[12px] text-muted" numberOfLines={1}>{it.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.faint} />
    </Pressable>
  );
}

function RecentsOrHint({
  loading, recents, onPick, onClear, c,
}: {
  loading: boolean; recents: string[]; onPick: (q: string) => void; onClear: () => void; c: ReturnType<typeof useThemeColors>;
}) {
  if (loading) {
    return <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={5} /></View>;
  }
  if (recents.length === 0) {
    return (
      <View className="items-center py-16">
        <Ionicons name="sparkles-outline" size={36} color={c.faint} />
        <Text className="mt-3 font-display text-xl text-ink mb-1">Search anything</Text>
        <Text className="text-[14px] text-muted text-center max-w-xs">Residents, home food, tiffins, listings and posts — all in one place.</Text>
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
