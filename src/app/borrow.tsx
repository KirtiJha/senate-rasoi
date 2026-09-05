import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { T } from '../components/T';
import { Chip, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { BORROW_CATEGORIES, LendItem, LendKind, fetchItems, fetchWaitingCounts, subscribeItems } from '../lib/borrow';
import { IMAGE_CACHE_PROPS } from '../lib/image';
import { qk } from '../lib/queryClient';
import { useRefreshOnFocus } from '../lib/useRefreshOnFocus';
import { layout, useThemeColors } from '../theme';

const catMeta = (key: string | null) => BORROW_CATEGORIES.find((c) => c.key === key) ?? BORROW_CATEGORIES[BORROW_CATEGORIES.length - 1];

export default function BorrowScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const { userId, communityId } = useAuth();

  const [tab, setTab] = useState<LendKind>('offer');
  const [cat, setCat] = useState<string>('all');
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState('');

  // Cached per tab, category and "Mine": switching back to a list you have
  // already seen paints it at once, and the refetch happens behind it.
  const items = useQuery({
    queryKey: qk.borrow(communityId, tab, cat, mine, userId),
    enabled: !!communityId,
    queryFn: () => fetchItems({
      kind: tab,
      category: cat,
      // Lent-out things stay on the list for everyone; only what the owner
      // took down leaves it, and only for other people.
      publicOnly: !mine,
      viewerId: userId,
      mine: mine && userId ? userId : undefined,
    }, communityId),
  });
  const waiting = useQuery({
    queryKey: qk.borrowWaiting(communityId, userId),
    enabled: !!communityId && !!userId,
    queryFn: () => fetchWaitingCounts(userId!, communityId),
  });
  const subscribe = useCallback((bump: () => void) => subscribeItems(communityId, bump), [communityId]);
  useRefreshOnFocus(['borrow', communityId], subscribe);

  const rows = items.data ?? [];
  const waitingOn = waiting.data ?? {};
  const loading = items.isPending;

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
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === k }}
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

      <View className="flex-1">
        {rows.length > 4 ? (
          <View className="w-full self-center px-4 pt-4" style={{ maxWidth: layout.maxContent }}>
            <View className="flex-row items-center gap-2 rounded-full border border-line bg-surface px-3.5" style={{ height: 44 }}>
              <Ionicons name="search" size={16} color={c.faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={isOffer ? 'Search what neighbours lend' : 'Search what neighbours need'}
                placeholderTextColor={c.faint}
                className="flex-1 text-[14px] text-ink"
                style={{ outline: 'none' } as never}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search this list"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={c.faint} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Virtualised: cards are recycled as you scroll rather than all drawn
            at once, and the list keeps its place when a card updates. */}
        <FlashList
          data={filtered}
          keyExtractor={(it) => it.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            loading ? (
              <View className="w-full self-center gap-3" style={{ maxWidth: layout.maxContent }}>
                {[0, 1, 2, 3].map((i) => <View key={i} className="h-[92px] rounded-2xl bg-inset animate-pulse" />)}
              </View>
            ) : items.isError ? (
              <View className="items-center px-6 py-14">
                <Ionicons name="cloud-offline-outline" size={26} color={c.faint} />
                <Text className="font-sans mt-2 text-center text-[13px] text-muted">Couldn't load this list.</Text>
                <Pressable onPress={() => items.refetch()} hitSlop={8} className="mt-2 px-3 py-1 active:opacity-60" accessibilityRole="button">
                  <Text className="text-[13px] font-sans-sb" style={{ color: ACCENT }}>Try again</Text>
                </Pressable>
              </View>
            ) : query && rows.length > 0 ? (
              <View className="items-center px-6 py-14">
                <Ionicons name="search-outline" size={26} color={c.faint} />
                <Text className="font-sans mt-2 text-center text-[13px] text-muted">Nothing matching “{query.trim()}”.</Text>
              </View>
            ) : (
              <View className="items-center px-6 py-16">
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: ACCENT + '18' }}>
                  <Ionicons name="swap-horizontal" size={26} color={ACCENT} />
                </View>
                <Text className="font-sans-bold text-[15px] text-ink">{emptyTitle}</Text>
                <Text className="font-sans mt-1 max-w-[300px] text-center text-[13px] text-muted">{emptyBlurb}</Text>
                <Pressable onPress={() => router.push(addHref as any)} className="mt-5 flex-row items-center gap-2 rounded-2xl px-5 py-3 active:opacity-90" style={{ backgroundColor: ACCENT }} accessibilityRole="button">
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text className="font-sans-bold text-[14px] text-white">{isOffer ? 'Lend something' : 'Post a request'}</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View className="w-full self-center" style={{ maxWidth: layout.maxContent }}>
              <ItemCard item={item} isOffer={isOffer} waiting={waitingOn[item.id] ?? 0} yours={!!userId && item.owner_user_id === userId} />
            </View>
          )}
        />
      </View>
    </View>
  );
}

function ItemCard({ item, isOffer, waiting = 0, yours = false }: { item: LendItem; isOffer: boolean; waiting?: number; yours?: boolean }) {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const m = catMeta(item.category);
  const lent = item.status !== 'available';

  return (
    <Pressable onPress={() => router.push(`/borrow/${item.id}` as any)} className="flex-row overflow-hidden card active:opacity-90" accessibilityRole="button" accessibilityLabel={item.title}>
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
          {/* Availability badge (offers only).

              "Lent out" and "Hidden" used to share one grey pill, though they
              mean opposite things: one is out with a neighbour and coming
              back, the other you took down yourself. Lent out gets the
              marigold — the app's colour for "in progress, needs nothing from
              you yet" — and hidden stays grey, because it is dormant. */}
          {isOffer ? (item.status === 'lent'
            ? <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.highlightSoft }}><Text className="text-[10px] font-sans-sb" style={{ color: c.highlightInk }}>Lent out</Text></View>
            : item.status === 'unavailable'
              ? <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#9CA3AF22' }}><Text className="text-[10px] font-sans-sb text-muted">Hidden</Text></View>
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
        {/* Your own name told you nothing. On your own listings this says
            "You", and when the listing is one only you can see, it says so
            outright — which is the question a lent-out item on an otherwise
            available list actually raises. */}
        <Text className="font-sans mt-auto pt-1 text-[11px] text-faint" numberOfLines={1}>
          {yours
            ? (item.status === 'available' ? 'You' : 'You · only you can see this')
            : `${item.owner?.name ?? 'A neighbour'}${item.owner?.flat ? ` · Flat ${item.owner.flat}` : ''}`}
        </Text>
      </View>
    </Pressable>
  );
}
