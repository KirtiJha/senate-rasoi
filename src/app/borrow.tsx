import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { T } from '../components/T';
import { Chip, Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { BORROW_CATEGORIES, LendItem, LendKind, fetchItems, fetchWaitingCounts, subscribeItems } from '../lib/borrow';
import { IMAGE_CACHE_PROPS } from '../lib/image';
import { useThemeColors } from '../theme';

const catMeta = (key: string | null) => BORROW_CATEGORIES.find((c) => c.key === key) ?? BORROW_CATEGORIES[BORROW_CATEGORIES.length - 1];

export default function BorrowScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const { userId, communityId } = useAuth();

  const [tab, setTab] = useState<LendKind>('offer');
  const [rows, setRows] = useState<LendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>('all');
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState('');
  const [waitingOn, setWaitingOn] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      setRows(await fetchItems({
        kind: tab,
        category: cat,
        // A request that's been sorted is history, not a live ask — it drops
        // off the browse list the same way a lent-out item does.
        availableOnly: !mine,
        mine: mine && userId ? userId : undefined,
      }));
      if (userId) setWaitingOn(await fetchWaitingCounts(userId, communityId).catch(() => ({})));
    } catch { /* keep */ } finally { setLoading(false); }
  }, [tab, cat, mine, userId, communityId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    return subscribeItems(communityId, load);
  }, [load, communityId]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.title.toLowerCase().includes(q)
      || (r.description ?? '').toLowerCase().includes(q)
      || (r.owner?.name ?? '').toLowerCase().includes(q));
  }, [rows, query]);

  const isOffer = tab === 'offer';
  const addLabel = isOffer ? 'Lend' : 'Need';
  const addHref = isOffer ? '/borrow/new?kind=offer' : '/borrow/new?kind=request';

  const emptyTitle = mine
    ? (isOffer ? "You haven't lent anything yet" : "You haven't posted any requests yet")
    : (isOffer ? 'Nothing to borrow yet' : 'No borrow requests yet');
  const emptyBlurb = isOffer
    ? 'Got a drill, ladder, folding chairs or a board game you rarely use? Lend it to a neighbour.'
    : 'Need something temporarily? Post a request and a neighbour may have it.';

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="swap-horizontal-outline"
        title="Borrow & Lend"
        showBack
        onAdd={() => router.push(addHref as any)}
        addLabel={addLabel}
        subBar={
          <View className="gap-2">
            {/* Tabs */}
            <View className="flex-row rounded-2xl p-1" style={{ backgroundColor: c.inset }}>
              {([['offer', '🤝 Lend'], ['request', '🙏 Borrow']] as [LendKind, string][]).map(([k, label]) => (
                <Pressable
                  key={k}
                  onPress={() => { setTab(k); setCat('all'); setMine(false); }}
                  className="flex-1 items-center rounded-xl py-2"
                  style={{ backgroundColor: tab === k ? c.bg : 'transparent' }}
                >
                  <Text className="text-[13px] font-sans-sb" style={{ color: tab === k ? ACCENT : c.muted }}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Category + Mine filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {([['all', 'All'] as const, ...BORROW_CATEGORIES.map((b) => [b.key, b.label] as const)]).map(([k, label]) => (
                <Chip
                  key={k}
                  label={label}
                  selected={cat === k}
                  onPress={() => setCat(k)}
                />
              ))}
              <View style={{ width: 1, height: 18, backgroundColor: c.line, alignSelf: 'center' }} />
              <Chip
                  label={"Mine"}
                  selected={mine}
                  onPress={() => setMine((m) => !m)}
                />
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
                placeholder={isOffer ? 'Search what neighbours lend' : 'Search what neighbours need'}
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
            <Text className="font-sans px-1 py-10 text-center text-[13px] text-muted">Loading…</Text>
          ) : query && filtered.length === 0 ? (
            <View className="items-center px-6 py-14">
              <Ionicons name="search-outline" size={26} color={c.faint} />
              <Text className="font-sans mt-2 text-center text-[13px] text-muted">Nothing matching “{query.trim()}”.</Text>
            </View>
          ) : rows.length === 0 ? (
            <View className="items-center px-6 py-16">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: ACCENT + '18' }}>
                <Ionicons name="swap-horizontal" size={26} color={ACCENT} />
              </View>
              <Text className="font-sans-bold text-[15px] text-ink">{emptyTitle}</Text>
              <Text className="font-sans mt-1 max-w-[300px] text-center text-[13px] text-muted">{emptyBlurb}</Text>
              <Pressable onPress={() => router.push(addHref as any)} className="mt-5 flex-row items-center gap-2 rounded-2xl px-5 py-3 active:opacity-90" style={{ backgroundColor: ACCENT }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="font-sans-bold text-[14px] text-white">{isOffer ? 'Lend something' : 'Post a request'}</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              {filtered.map((it) => <ItemCard key={it.id} item={it} isOffer={isOffer} waiting={waitingOn[it.id] ?? 0} />)}
            </View>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function ItemCard({ item, isOffer, waiting = 0 }: { item: LendItem; isOffer: boolean; waiting?: number }) {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const m = catMeta(item.category);
  const lent = item.status !== 'available';

  return (
    <Pressable onPress={() => router.push(`/borrow/${item.id}` as any)} className="flex-row overflow-hidden card active:opacity-90">
      <View style={{ width: 92, height: 92, backgroundColor: c.inset }} className="items-center justify-center flex-shrink-0">
        {item.photo_url
          ? <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
          : <Ionicons name={isOffer ? (m.icon as any) : 'hand-left-outline'} size={26} color={c.faint} />}
      </View>
      <View className="flex-1 p-3">
        <View className="flex-row items-center gap-1.5 flex-wrap">
          {/* Kind badge */}
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ACCENT + '18' }}>
            <Text className="text-[10px] font-sans-sb" style={{ color: ACCENT }}>{isOffer ? '🤝 Lending' : '🙏 Needs'}</Text>
          </View>
          {/* Category badge */}
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.inset }}>
            <Text className="text-[10px] font-sans-sb text-muted">{m.label}</Text>
          </View>
          {/* Availability badge (offers only) */}
          {isOffer ? (lent
            ? <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#9CA3AF22' }}><Text className="text-[10px] font-sans-sb text-muted">{item.status === 'lent' ? 'Lent out' : 'Unavailable'}</Text></View>
            : <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#16A34A22' }}><Text className="text-[10px] font-sans-sb" style={{ color: '#16A34A' }}>Available</Text></View>
          ) : lent ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#9CA3AF22' }}><Text className="text-[10px] font-sans-sb text-muted">Sorted</Text></View>
          ) : null}
          {/* Your own listing with neighbours waiting — otherwise you'd have to
              open each card to discover somebody had asked. */}
          {waiting > 0 ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ACCENT }}>
              <Text className="text-[10px] font-sans-sb text-white">{waiting} waiting</Text>
            </View>
          ) : null}
        </View>
        <T source="borrow" id={item.id} field="title" text={item.title} showToggle={false} className="mt-0.5 font-sans-bold text-[14px] text-ink" numberOfLines={1} />
        {item.description ? <T source="borrow" id={item.id} field="description" text={item.description} showToggle={false} className="text-[12px] text-muted" numberOfLines={2} /> : null}
        <Text className="font-sans mt-auto pt-1 text-[11px] text-faint">{item.owner?.name ?? 'A neighbour'}{item.owner?.flat ? ` · Flat ${item.owner.flat}` : ''}</Text>
      </View>
    </Pressable>
  );
}
