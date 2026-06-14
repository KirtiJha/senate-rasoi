import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Container, ScreenHeader, useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { IMAGE_CACHE_PROPS } from '../lib/image';
import { PLACE_TYPES, PlaceRow, fetchPlaces, placeTypeMeta, subscribePlaces } from '../lib/places';
import { isSupabaseConfigured } from '../lib/supabase';
import { useThemeColors } from '../theme';

const ACCENT = '#0D9488';

export default function PlacesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { communityId } = useAuth();
  const [items, setItems] = useState<PlaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null); // null = All

  const load = useCallback(() => {
    if (!communityId || !isSupabaseConfigured) { setLoading(false); return; }
    fetchPlaces({}, communityId).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [communityId]);

  useFocusEffect(useCallback(() => {
    load();
    return communityId ? subscribePlaces(communityId, load) : undefined;
  }, [load, communityId]));

  // Type chips: only those with at least one entry (plus All).
  const presentTypes = useMemo(() => {
    const set = new Set(items.map((p) => p.place_type));
    return PLACE_TYPES.filter((t) => set.has(t.key));
  }, [items]);

  const shown = useMemo(() => (filter ? items.filter((p) => p.place_type === filter) : items), [items, filter]);

  // Group the (filtered) list by type for section headers.
  const groups = useMemo(() => {
    const byType = new Map<string, PlaceRow[]>();
    for (const p of shown) {
      if (!byType.has(p.place_type)) byType.set(p.place_type, []);
      byType.get(p.place_type)!.push(p);
    }
    return PLACE_TYPES.filter((t) => byType.has(t.key)).map((t) => ({ type: t, rows: byType.get(t.key)! }));
  }, [shown]);

  const Card = ({ p }: { p: PlaceRow }) => {
    const m = placeTypeMeta(p.place_type);
    const photo = p.photos?.[0];
    return (
      <Pressable
        onPress={() => router.push(`/place/${p.id}` as any)}
        className="flex-row items-center gap-3 overflow-hidden rounded-2xl bg-surface p-2.5 active:opacity-90"
        style={{ borderWidth: 1, borderColor: c.line, width: isDesktop ? '48.5%' : '100%' }}
      >
        <View className="overflow-hidden rounded-xl" style={{ width: 56, height: 56, backgroundColor: m.color + '18' }}>
          {photo
            ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
            : <View className="flex-1 items-center justify-center"><Ionicons name={m.icon as any} size={24} color={m.color} /></View>}
        </View>
        <View className="flex-1">
          <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{p.name}</Text>
          {p.address ? <Text className="text-[12px] text-muted" numberOfLines={1}>{p.address}</Text> : null}
          <View className="mt-0.5 flex-row items-center gap-2">
            {p.hours ? <Text className="text-[11px] text-faint" numberOfLines={1}>🕒 {p.hours}</Text> : null}
            {p.lat != null ? <Ionicons name="location" size={11} color={m.color} /> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.faint} />
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="location-outline"
        iconColor={ACCENT}
        title="Nearby"
        onAdd={() => router.push('/place/new' as any)}
        addLabel="Add place"
      />
      {/* Filter chips */}
      {presentTypes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }} className="border-b border-line">
          <Chip label="All" active={filter === null} color={ACCENT} onPress={() => setFilter(null)} />
          {presentTypes.map((t) => (
            <Chip key={t.key} label={t.label} icon={t.icon} active={filter === t.key} color={t.color} onPress={() => setFilter(t.key)} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container>
          {loading ? (
            <View className="items-center justify-center py-20"><ActivityIndicator color={c.muted} /></View>
          ) : items.length === 0 ? (
            <View className="items-center justify-center px-8 py-16">
              <Ionicons name="location-outline" size={48} color={c.faint} />
              <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">No places yet</Text>
              <Text className="mt-1.5 text-center text-[13px] leading-[19px] text-muted">Be the first to add a handy nearby contact — a hospital, clinic, school, supermarket, salon and more.</Text>
              <Pressable onPress={() => router.push('/place/new' as any)} className="mt-5 flex-row items-center gap-1.5 rounded-2xl px-5 py-2.5 active:opacity-80" style={{ backgroundColor: ACCENT }}>
                <Ionicons name="add" size={18} color="#fff" /><Text className="font-sans-sb text-[14px] text-white">Add a place</Text>
              </Pressable>
            </View>
          ) : (
            groups.map((g) => (
              <View key={g.type.key} className="mb-5">
                <View className="mb-2.5 flex-row items-center gap-1.5">
                  <Ionicons name={g.type.icon as any} size={15} color={g.type.color} />
                  <Text className="text-[12px] font-sans-sb uppercase tracking-wider text-muted">{g.type.label}</Text>
                  <Text className="text-[12px] text-faint">· {g.rows.length}</Text>
                </View>
                <View className="flex-row flex-wrap gap-2.5">
                  {g.rows.map((p) => <Card key={p.id} p={p} />)}
                </View>
              </View>
            ))
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function Chip({ label, icon, active, color, onPress }: { label: string; icon?: string; active: boolean; color: string; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1 rounded-full border px-3.5 py-1.5" style={{ borderColor: active ? color : c.line, backgroundColor: active ? color : c.surface }}>
      {icon ? <Ionicons name={icon as any} size={12} color={active ? '#fff' : c.muted} /> : null}
      <Text className="text-[12px] font-sans-sb" style={{ color: active ? '#fff' : c.muted }}>{label}</Text>
    </Pressable>
  );
}
