import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Container, ScreenHeader, useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { IMAGE_CACHE_PROPS } from '../lib/image';
import { PLACE_TYPES, PlaceRow, fetchPlaces, placeTypeMeta, subscribePlaces } from '../lib/places';
import { isSupabaseConfigured } from '../lib/supabase';
import { useThemeColors } from '../theme';

// Society centre fallback (DS-MAX Senate) so "Nearest" works even if the
// community row has no coordinates yet.
const FALLBACK_CENTER = { lat: 12.8687464, lon: 77.6345485 };

type SortKey = 'az' | 'near' | 'new';

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function PlacesScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { communityId, community } = useAuth();
  const [items, setItems] = useState<PlaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('az');
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // type keys the user opened

  const center = useMemo(
    () => (community?.lat != null && community?.lon != null ? { lat: community.lat, lon: community.lon } : FALLBACK_CENTER),
    [community?.lat, community?.lon],
  );

  const load = useCallback(() => {
    if (!communityId || !isSupabaseConfigured) { setLoading(false); return; }
    fetchPlaces({}, communityId).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [communityId]);

  useFocusEffect(useCallback(() => {
    load();
    return communityId ? subscribePlaces(communityId, load) : undefined;
  }, [load, communityId]));

  const q = query.trim().toLowerCase();

  // Apply text search.
  const shown = useMemo(() => {
    if (!q) return items;
    return items.filter((p) => p.name.toLowerCase().includes(q) || (p.address ?? '').toLowerCase().includes(q));
  }, [items, q]);

  const sortRows = useCallback((rows: PlaceRow[]): PlaceRow[] => {
    const arr = [...rows];
    if (sort === 'az') arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'new') arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else arr.sort((a, b) => {
      const da = a.lat != null && a.lng != null ? distanceKm(center, { lat: a.lat, lon: a.lng }) : Infinity;
      const db = b.lat != null && b.lng != null ? distanceKm(center, { lat: b.lat, lon: b.lng }) : Infinity;
      return da - db;
    });
    return arr;
  }, [sort, center]);

  // Group the (filtered) list by type, in PLACE_TYPES order, rows sorted.
  const groups = useMemo(() => {
    const byType = new Map<string, PlaceRow[]>();
    for (const p of shown) {
      if (!byType.has(p.place_type)) byType.set(p.place_type, []);
      byType.get(p.place_type)!.push(p);
    }
    return PLACE_TYPES.filter((t) => byType.has(t.key)).map((t) => ({ type: t, rows: sortRows(byType.get(t.key)!) }));
  }, [shown, sortRows]);

  // A section is open when searching (force-show matches) or the user opened it.
  const isOpen = (key: string) => !!q || expanded.has(key);
  const toggle = (key: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const allOpen = groups.length > 0 && groups.every((g) => isOpen(g.type.key));
  const toggleAll = () => setExpanded(allOpen ? new Set() : new Set(groups.map((g) => g.type.key)));

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        showBack icon="location-outline" iconColor={ACCENT} title="Nearby" onAdd={() => router.push('/place/new' as any)} addLabel="Add place" />

      {/* Search */}
      <View className="px-4 pt-3">
        <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-inset px-3.5" style={{ paddingVertical: 2 }}>
          <Ionicons name="search" size={16} color={c.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search hospitals, schools, shops…"
            placeholderTextColor={c.faint}
            className="flex-1 py-2.5 text-[15px] text-ink"
            style={{ outline: 'none' } as any}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={17} color={c.faint} /></Pressable>
          ) : null}
        </View>
      </View>

      {/* Sort + expand/collapse */}
      {!loading && items.length > 0 ? (
        <View className="flex-row items-center justify-between px-4 pb-1 pt-2.5">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-faint">Sort</Text>
            <SortChip label="A–Z" active={sort === 'az'} onPress={() => setSort('az')} c={c} />
            <SortChip label="Nearest" active={sort === 'near'} onPress={() => setSort('near')} c={c} />
            <SortChip label="Newest" active={sort === 'new'} onPress={() => setSort('new')} c={c} />
          </View>
          {!q ? (
            <Pressable onPress={toggleAll} hitSlop={6} className="flex-row items-center gap-1">
              <Ionicons name={allOpen ? 'chevron-up' : 'chevron-down'} size={13} color={ACCENT} />
              <Text className="text-[12px] font-sans-sb" style={{ color: ACCENT }}>{allOpen ? 'Collapse all' : 'Expand all'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container>
          {loading ? (
            <View className="items-center justify-center py-20"><ActivityIndicator color={c.muted} /></View>
          ) : items.length === 0 ? (
            <EmptyState onAdd={() => router.push('/place/new' as any)} c={c} />
          ) : groups.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Ionicons name="search" size={40} color={c.faint} />
              <Text className="mt-3 text-center font-sans-bold text-[15px] text-ink">No matches</Text>
              <Text className="font-sans mt-1 text-center text-[13px] text-muted">Try a different search or filter.</Text>
            </View>
          ) : (
            groups.map((g) => {
              const open = isOpen(g.type.key);
              return (
                <View key={g.type.key} className="mb-2.5 overflow-hidden card">
                  <Pressable onPress={() => toggle(g.type.key)} disabled={!!q} className="flex-row items-center gap-2.5 px-3.5 py-3 active:bg-inset">
                    <View className="h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: c.accentSoft }}>
                      <Ionicons name={g.type.icon as any} size={17} color={c.accent} />
                    </View>
                    <Text className="flex-1 font-sans-bold text-[15px] text-ink">{g.type.label}</Text>
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.accentSoft }}>
                      <Text className="text-[12px] font-sans-bold" style={{ color: c.accent }}>{g.rows.length}</Text>
                    </View>
                    {!q ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.faint} /> : null}
                  </Pressable>
                  {open ? (
                    <View className="border-t border-line">
                      <View className="flex-row flex-wrap gap-2.5 p-2.5">
                        {g.rows.map((p) => <Card key={p.id} p={p} isDesktop={isDesktop} center={center} showDist={sort === 'near'} c={c} onPress={() => router.push(`/place/${p.id}` as any)} />)}
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function Card({ p, isDesktop, center, showDist, c, onPress }: {
  p: PlaceRow; isDesktop: boolean; center: { lat: number; lon: number }; showDist: boolean;
  c: ReturnType<typeof useThemeColors>; onPress: () => void;
}) {
  const m = placeTypeMeta(p.place_type);
  const photo = p.photos?.[0];
  const dist = showDist && p.lat != null && p.lng != null ? distanceKm(center, { lat: p.lat, lon: p.lng }) : null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open"
      onPress={onPress}
      className="flex-row items-center gap-3 overflow-hidden rounded-xl bg-bg p-2.5 active:opacity-90"
      style={{ borderWidth: 1, borderColor: c.line, width: isDesktop ? '48.5%' : '100%' }}
    >
      <View className="overflow-hidden rounded-xl" style={{ width: 52, height: 52, backgroundColor: c.accentSoft }}>
        {photo
          ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
          : <View className="flex-1 items-center justify-center"><Ionicons name={m.icon as any} size={22} color={c.accent} /></View>}
      </View>
      <View className="flex-1">
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{p.name}</Text>
        {p.address ? <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>{p.address}</Text> : null}
        <View className="mt-0.5 flex-row items-center gap-2">
          {p.hours ? <Text className="font-sans text-[11px] text-faint" numberOfLines={1}>🕒 {p.hours}</Text> : null}
          {dist != null ? <Text className="text-[11px] font-sans-sb" style={{ color: c.accent }}>{dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.faint} />
    </Pressable>
  );
}

function EmptyState({ onAdd, c }: { onAdd: () => void; c: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="items-center justify-center px-8 py-16">
      <Ionicons name="location-outline" size={48} color={c.faint} />
      <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">No places yet</Text>
      <Text className="font-sans mt-1.5 text-center text-[13px] leading-[19px] text-muted">Be the first to add a handy nearby contact — a hospital, clinic, school, supermarket, salon and more.</Text>
      <Pressable onPress={onAdd} className="mt-5 flex-row items-center gap-1.5 rounded-2xl px-5 py-2.5 active:opacity-80" style={{ backgroundColor: c.accent }}>
        <Ionicons name="add" size={18} color="#fff" /><Text className="font-sans-sb text-[14px] text-white">Add a place</Text>
      </Pressable>
    </View>
  );
}

function SortChip({ label, active, onPress, c }: { label: string; active: boolean; onPress: () => void; c: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={onPress} className="rounded-full px-2.5 py-1" style={{ backgroundColor: active ? c.accent : c.inset }}>
      <Text className="text-[12px] font-sans-sb" style={{ color: active ? '#fff' : c.muted }}>{label}</Text>
    </Pressable>
  );
}
