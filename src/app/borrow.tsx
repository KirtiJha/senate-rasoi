import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { BORROW_CATEGORIES, LendItem, fetchItems, subscribeItems } from '../lib/borrow';
import { useThemeColors } from '../theme';

const ACCENT = '#0891B2';
const catMeta = (key: string | null) => BORROW_CATEGORIES.find((c) => c.key === key) ?? BORROW_CATEGORIES[BORROW_CATEGORIES.length - 1];

export default function BorrowScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { userId, communityId } = useAuth();

  const [rows, setRows] = useState<LendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>('all');
  const [mine, setMine] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchItems({ category: cat, availableOnly: !mine, mine: mine && userId ? userId : undefined })); }
    catch { /* keep */ } finally { setLoading(false); }
  }, [cat, mine, userId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); return subscribeItems(communityId, load); }, [load, communityId]));

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="swap-horizontal-outline"
        iconColor={ACCENT}
        title="Borrow & Lend"
        showBack
        onAdd={() => router.push('/borrow/new' as any)}
        addLabel="Lend"
        subBar={
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
              <Text className="font-sans-bold text-[15px] text-ink">{mine ? "You haven't lent anything yet" : 'Nothing to borrow yet'}</Text>
              <Text className="mt-1 max-w-[300px] text-center text-[13px] text-muted">
                Got a drill, ladder, folding chairs or a board game you rarely use? Lend it to a neighbour.
              </Text>
              <Pressable onPress={() => router.push('/borrow/new' as any)} className="mt-5 flex-row items-center gap-2 rounded-2xl px-5 py-3 active:opacity-90" style={{ backgroundColor: ACCENT }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="font-sans-bold text-[14px] text-white">Lend something</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              {rows.map((it) => {
                const m = catMeta(it.category);
                const lent = it.status !== 'available';
                return (
                  <Pressable key={it.id} onPress={() => router.push(`/borrow/${it.id}` as any)} className="flex-row overflow-hidden rounded-2xl border border-line bg-surface active:opacity-90">
                    <View style={{ width: 92, height: 92, backgroundColor: c.inset }} className="items-center justify-center">
                      {it.photo_url ? <Image source={{ uri: it.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={120} /> : <Ionicons name={m.icon as any} size={26} color={c.faint} />}
                    </View>
                    <View className="flex-1 p-3">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[11px] font-sans-sb" style={{ color: ACCENT }}>{m.label}</Text>
                        {lent ? <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#9CA3AF22' }}><Text className="text-[10px] font-sans-sb text-muted">{it.status === 'lent' ? 'Lent out' : 'Unavailable'}</Text></View> : <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#16A34A22' }}><Text className="text-[10px] font-sans-sb" style={{ color: '#16A34A' }}>Available</Text></View>}
                      </View>
                      <Text className="mt-0.5 font-sans-bold text-[14px] text-ink" numberOfLines={1}>{it.title}</Text>
                      {it.description ? <Text className="text-[12px] text-muted" numberOfLines={2}>{it.description}</Text> : null}
                      <Text className="mt-auto pt-1 text-[11px] text-faint">{it.owner?.name ?? 'A neighbour'}{it.owner?.flat ? ` · Flat ${it.owner.flat}` : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}
