import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { T } from '../components/T';
import { Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { IMAGE_CACHE_PROPS } from '../lib/image';
import { ListingType, PropertyRow, fetchProperties, propertySubtitle, subscribeProperties } from '../lib/properties';
import { useThemeColors } from '../theme';

const ACCENT = '#7C3AED';
type Filter = 'all' | ListingType;

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  available: { label: 'Available', bg: '#16A34A22', fg: '#16A34A' },
  sold: { label: 'Sold', bg: '#9CA3AF22', fg: '#6B7280' },
  rented: { label: 'Rented', bg: '#9CA3AF22', fg: '#6B7280' },
};

export default function PropertiesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { userId, communityId } = useAuth();

  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [mine, setMine] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fetchProperties({ type: filter, availableOnly: mine ? false : availableOnly, mine: mine && userId ? userId : undefined }));
    } catch { /* keep previous */ }
    finally { setLoading(false); }
  }, [filter, availableOnly, mine, userId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    return subscribeProperties(communityId, load);
  }, [load, communityId]));

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="key-outline"
        iconColor={ACCENT}
        title="Flats for sale & rent"
        showBack
        onAdd={() => router.push('/property/new' as any)}
        addLabel="Post"
        subBar={
          <View className="flex-row items-center gap-2">
            {([['all', 'All'], ['sale', 'For sale'], ['rent', 'For rent']] as [Filter, string][]).map(([f, label]) => (
              <Chip key={f} active={filter === f} label={label} onPress={() => setFilter(f)} accent={ACCENT} c={c} />
            ))}
            <View style={{ width: 1, height: 18, backgroundColor: c.line, marginHorizontal: 2 }} />
            <Chip active={mine} label="Mine" icon="person-outline" onPress={() => setMine((m) => !m)} accent={ACCENT} c={c} />
            {!mine ? (
              <Chip active={availableOnly} label="Available" onPress={() => setAvailableOnly((v) => !v)} accent={ACCENT} c={c} />
            ) : null}
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
                <Ionicons name="home-outline" size={26} color={ACCENT} />
              </View>
              <Text className="font-sans-bold text-[15px] text-ink">{mine ? "You haven't posted a flat" : 'No flats listed yet'}</Text>
              <Text className="mt-1 max-w-[280px] text-center text-[13px] text-muted">
                {mine ? 'Post your flat for sale or rent — neighbours can ask details and recommend buyers.' : 'Be the first to list your flat for sale or rent in your society.'}
              </Text>
              <Pressable onPress={() => router.push('/property/new' as any)} className="mt-5 flex-row items-center gap-2 rounded-2xl px-5 py-3 active:opacity-90" style={{ backgroundColor: ACCENT }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="font-sans-bold text-[14px] text-white">Post your flat</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              {rows.map((p) => (
                <PropertyCard key={p.id} p={p} onPress={() => router.push(`/property/${p.id}` as any)} c={c} />
              ))}
            </View>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function Chip({ active, label, icon, onPress, accent, c }: { active: boolean; label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; accent: string; c: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1 rounded-full px-3 py-1.5" style={{ backgroundColor: active ? accent : c.inset }}>
      {icon ? <Ionicons name={icon} size={12} color={active ? '#fff' : c.muted} /> : null}
      <Text className="text-[12px] font-sans-sb" style={{ color: active ? '#fff' : c.muted }}>{label}</Text>
    </Pressable>
  );
}

function PropertyCard({ p, onPress, c }: { p: PropertyRow; onPress: () => void; c: ReturnType<typeof useThemeColors> }) {
  const status = STATUS_META[p.status] ?? STATUS_META.available;
  const sub = propertySubtitle(p);
  const isRent = p.listing_type === 'rent';
  return (
    <Pressable onPress={onPress} className="flex-row overflow-hidden rounded-2xl border border-line bg-surface active:opacity-90">
      <View style={{ width: 108, height: 108, backgroundColor: c.inset }} className="items-center justify-center">
        {p.photos[0] ? (
          <Image source={{ uri: p.photos[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} />
        ) : (
          <Ionicons name="home-outline" size={28} color={c.faint} />
        )}
      </View>
      <View className="flex-1 p-3">
        <View className="flex-row items-center gap-1.5">
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ACCENT + '18' }}>
            <Text className="text-[10px] font-sans-sb" style={{ color: ACCENT }}>{isRent ? 'For rent' : 'For sale'}</Text>
          </View>
          {p.status !== 'available' ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: status.bg }}>
              <Text className="text-[10px] font-sans-sb" style={{ color: status.fg }}>{status.label}</Text>
            </View>
          ) : null}
        </View>
        <T source="property" id={p.id} field="title" text={p.title} showToggle={false} className="mt-1 font-sans-bold text-[14px] text-ink" numberOfLines={1} />
        {sub ? <Text className="text-[12px] text-muted" numberOfLines={1}>{sub}</Text> : null}
        <View className="mt-auto flex-row items-center gap-1 pt-1.5">
          <Ionicons name="pricetag-outline" size={12} color={c.faint} />
          <Text className="text-[11.5px] font-sans-sb text-muted">Contact owner for price</Text>
        </View>
      </View>
    </Pressable>
  );
}
