import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { T } from '../components/T';
import { Chip, Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import {
  LOST_FOUND_CATEGORIES,
  LostFoundItem,
  LostFoundKind,
  fetchLostFoundItems,
  subscribeLostFoundItems,
} from '../lib/lostFound';
import { IMAGE_CACHE_PROPS } from '../lib/image';
import { timeAgo } from '../lib/time';
import { useThemeColors } from '../theme';

const catMeta = (key: string | null) =>
  LOST_FOUND_CATEGORIES.find((c) => c.key === key) ?? LOST_FOUND_CATEGORIES[LOST_FOUND_CATEGORIES.length - 1];

export default function LostFoundScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const { userId, communityId } = useAuth();

  const [tab, setTab] = useState<LostFoundKind>('lost');
  const [rows, setRows] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(false);
  const [cat, setCat] = useState<string>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await fetchLostFoundItems({
        kind: tab,
        openOnly: !mine,
        mine: mine && userId ? userId : undefined,
      }));
    } catch { /* keep */ } finally { setLoading(false); }
  }, [tab, mine, userId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    return subscribeLostFoundItems(communityId, load);
  }, [load, communityId]));

  const isLost = tab === 'lost';
  const addHref = isLost ? '/lost-found/new?kind=lost' : '/lost-found/new?kind=found';

  // Categories were collected on the way in and shown on every card, but there
  // was no way to browse by them — the one question people arrive with ("has
  // anyone handed in keys?") had to be answered by scrolling.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) =>
      (cat === 'all' || r.category === cat)
      && (!q || r.title.toLowerCase().includes(q)
        || (r.description ?? '').toLowerCase().includes(q)
        || (r.owner?.name ?? '').toLowerCase().includes(q)));
  }, [rows, cat, query]);

  const emptyTitle = mine
    ? (isLost ? "You haven't reported any lost items" : "You haven't reported any found items")
    : (isLost ? 'No lost items reported' : 'No found items reported');
  const emptyBlurb = isLost
    ? 'Lost something in the society? Report it and neighbours can help.'
    : 'Found something in a common area? Report it so the owner can claim it.';

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="search-outline"
        title="Lost & Found"
        showBack
        onAdd={() => router.push(addHref as any)}
        addLabel={isLost ? 'Lost' : 'Found'}
        subBar={
          <View className="gap-2">
            <View className="flex-row rounded-2xl p-1" style={{ backgroundColor: c.inset }}>
              {([['lost', '🔍 Lost'], ['found', '📦 Found']] as [LostFoundKind, string][]).map(([k, label]) => (
                <Pressable
                  key={k}
                  onPress={() => { setTab(k); setMine(false); }}
                  className="flex-1 items-center rounded-xl py-2"
                  style={{ backgroundColor: tab === k ? c.bg : 'transparent' }}
                >
                  <Text className="text-[13px] font-sans-sb" style={{ color: tab === k ? ACCENT : c.muted }}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Chip label="All" selected={cat === 'all' && !mine} onPress={() => { setCat('all'); setMine(false); }} />
              <Chip label="Mine" selected={mine} onPress={() => setMine((v) => !v)} />
              <View style={{ width: 1, height: 18, backgroundColor: c.line, alignSelf: 'center' }} />
              {LOST_FOUND_CATEGORIES.map((b) => (
                <Chip key={b.key} label={b.label} selected={cat === b.key} onPress={() => setCat(cat === b.key ? 'all' : b.key)} />
              ))}
            </ScrollView>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container>
          {rows.length > 4 ? (
            <View className="mb-3 flex-row items-center gap-2 rounded-full border border-line bg-surface px-3.5" style={{ height: 44 }}>
              <Ionicons name="search" size={16} color={c.faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={isLost ? 'Search lost reports' : 'Search found items'}
                placeholderTextColor={c.faint}
                className="flex-1 text-[14px] text-ink"
                style={{ outline: 'none' } as never}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={c.faint} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <View className="gap-3">
              {[0, 1, 2, 3].map((i) => (
                <View key={i} className="h-24 rounded-2xl bg-inset animate-pulse" />
              ))}
            </View>
          ) : rows.length > 0 && filtered.length === 0 ? (
            <View className="items-center px-6 py-14">
              <Ionicons name="search-outline" size={26} color={c.faint} />
              <Text className="font-sans mt-2 text-center text-[13px] text-muted">
                Nothing here{query ? ` matching “${query.trim()}”` : ' in that category'}.
              </Text>
              <Pressable onPress={() => { setQuery(''); setCat('all'); }} hitSlop={8} className="mt-2 px-3 py-1 active:opacity-60">
                <Text className="text-[13px] font-sans-sb" style={{ color: ACCENT }}>Show everything</Text>
              </Pressable>
            </View>
          ) : rows.length === 0 ? (
            <View className="items-center py-20">
              <Text style={{ fontSize: 44 }} className="mb-3">{isLost ? '🔍' : '📦'}</Text>
              <Text className="font-display text-xl text-ink mb-1">{emptyTitle}</Text>
              <Text className="font-sans text-[14px] text-muted text-center max-w-xs">{emptyBlurb}</Text>
              <Pressable
                onPress={() => router.push(addHref as any)}
                className="mt-6 rounded-2xl px-5 py-3 active:opacity-80"
                style={{ backgroundColor: ACCENT }}
              >
                <Text className="font-sans-sb text-[14px] text-white">
                  Report {isLost ? 'a lost item' : 'a found item'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              {filtered.map((item) => <ItemCard key={item.id} item={item} />)}
            </View>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function ItemCard({ item }: { item: LostFoundItem }) {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const cm = catMeta(item.category);
  const isResolved = item.status === 'resolved';

  return (
    <Pressable
      onPress={() => router.push(`/lost-found/${item.id}` as any)}
      className="overflow-hidden rounded-2xl border bg-surface active:opacity-90"
      style={{ borderColor: c.line, opacity: isResolved ? 0.65 : 1 }}
    >
      <View className="flex-row gap-3 p-3.5">
        <View className="h-16 w-16 overflow-hidden rounded-xl flex-shrink-0" style={{ backgroundColor: ACCENT + '18' }}>
          {item.photo_url
            ? <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
            : <View className="flex-1 items-center justify-center"><Ionicons name={cm.icon as any} size={26} color={ACCENT} /></View>}
        </View>

        <View className="flex-1 min-w-0">
          <View className="flex-row flex-wrap items-center gap-1.5 mb-1">
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: item.kind === 'lost' ? '#EF444420' : '#16A34A20' }}>
              <Text className="text-[10px] font-sans-sb" style={{ color: item.kind === 'lost' ? '#DC2626' : '#15803D' }}>
                {item.kind === 'lost' ? '🔍 Lost' : '📦 Found'}
              </Text>
            </View>
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ACCENT + '20' }}>
              <Text className="text-[10px] font-sans-sb" style={{ color: ACCENT }}>{cm.label}</Text>
            </View>
            {isResolved ? (
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#16A34A20' }}>
                <Text className="text-[10px] font-sans-sb" style={{ color: '#15803D' }}>✓ Resolved</Text>
              </View>
            ) : null}
          </View>
          <T source="lost_found" id={item.id} field="title" text={item.title} showToggle={false}
            className="font-sans-bold text-[14px] text-ink" numberOfLines={1} />
          {item.description ? (
            <T source="lost_found" id={item.id} field="description" text={item.description} showToggle={false}
              className="text-[12px] text-muted" numberOfLines={1} />
          ) : null}
          {/* When matters as much as what here: a phone lost this morning and
              one lost in March are not the same notice. */}
          <Text className="font-sans text-[11px] text-faint mt-0.5">
            {item.owner?.name ?? 'A neighbour'}{item.owner?.flat ? ` · Flat ${item.owner.flat}` : ''} · {timeAgo(item.created_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
