import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { T } from '../components/T';
import { Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { BORROW_CATEGORIES, LendItem, LendKind, fetchItems, subscribeItems } from '../lib/borrow';
import { IMAGE_CACHE_PROPS } from '../lib/image';
import { useThemeColors } from '../theme';

const ACCENT = '#0891B2';
const catMeta = (key: string | null) => BORROW_CATEGORIES.find((c) => c.key === key) ?? BORROW_CATEGORIES[BORROW_CATEGORIES.length - 1];

export default function BorrowScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { userId, communityId } = useAuth();

  const [tab, setTab] = useState<LendKind>('offer');
  const [rows, setRows] = useState<LendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>('all');
  const [mine, setMine] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fetchItems({
        kind: tab,
        category: cat,
        availableOnly: tab === 'offer' && !mine,
        mine: mine && userId ? userId : undefined,
      }));
    } catch { /* keep */ } finally { setLoading(false); }
  }, [tab, cat, mine, userId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    return subscribeItems(communityId, load);
  }, [load, communityId]));

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
        iconColor={ACCENT}
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
                <Pressable key={k} onPress={() => setCat(k)} className="rounded-full px-3 py-1.5" style={{ backgroundColor: cat === k ? ACCENT : c.inset }}>
                  <Text className="text-[12px] font-sans-sb" style={{ color: cat === k ? '#fff' : c.muted }}>{label}</Text>
                </Pressable>
              ))}
              <View style={{ width: 1, height: 18, backgroundColor: c.line, alignSelf: 'center' }} />
              <Pressable onPress={() => setMine((m) => !m)} className="rounded-full px-3 py-1.5" style={{ backgroundColor: mine ? ACCENT : c.inset }}>
                <Text className="text-[12px] font-sans-sb" style={{ color: mine ? '#fff' : c.muted }}>Mine</Text>
              </Pressable>
            </ScrollView>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container>
          {loading ? (
            <Text className="px-1 py-10 text-center text-[13px] text-muted">Loading…</Text>
          ) : rows.length === 0 ? (
            <View className="items-center px-6 py-16">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: ACCENT + '18' }}>
                <Ionicons name="swap-horizontal" size={26} color={ACCENT} />
              </View>
              <Text className="font-sans-bold text-[15px] text-ink">{emptyTitle}</Text>
              <Text className="mt-1 max-w-[300px] text-center text-[13px] text-muted">{emptyBlurb}</Text>
              <Pressable onPress={() => router.push(addHref as any)} className="mt-5 flex-row items-center gap-2 rounded-2xl px-5 py-3 active:opacity-90" style={{ backgroundColor: ACCENT }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="font-sans-bold text-[14px] text-white">{isOffer ? 'Lend something' : 'Post a request'}</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              {rows.map((it) => <ItemCard key={it.id} item={it} isOffer={isOffer} />)}
            </View>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function ItemCard({ item, isOffer }: { item: LendItem; isOffer: boolean }) {
  const c = useThemeColors();
  const router = useRouter();
  const m = catMeta(item.category);
  const lent = item.status !== 'available';

  return (
    <Pressable onPress={() => router.push(`/borrow/${item.id}` as any)} className="flex-row overflow-hidden rounded-2xl border border-line bg-surface active:opacity-90">
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
          ) : null}
        </View>
        <T source="borrow" id={item.id} field="title" text={item.title} showToggle={false} className="mt-0.5 font-sans-bold text-[14px] text-ink" numberOfLines={1} />
        {item.description ? <T source="borrow" id={item.id} field="description" text={item.description} showToggle={false} className="text-[12px] text-muted" numberOfLines={2} /> : null}
        <Text className="mt-auto pt-1 text-[11px] text-faint">{item.owner?.name ?? 'A neighbour'}{item.owner?.flat ? ` · Flat ${item.owner.flat}` : ''}</Text>
      </View>
    </Pressable>
  );
}
