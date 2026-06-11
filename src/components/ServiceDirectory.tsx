import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { waLink } from '../lib/dishes';
import { fetchListings } from '../lib/listings';
import { ServiceCategory } from '../lib/services';
import { isSupabaseConfigured } from '../lib/supabase';
import { ListingRow } from '../lib/types';
import { layout, useThemeColors } from '../theme';
import { Avatar, Button, RowSkeleton, ScreenHeader, Sheet } from './ui';

type SortKey = 'trade' | 'name';
const tradeOf = (l: ListingRow) => (l.attributes?.trade as string) || 'Other';
const phoneOf = (l: ListingRow) => (l.referral_phone || l.contact_phone || '').replace(/\D/g, '');

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

/**
 * The Service Directory rendered as a contact list (not a card grid) — far
 * better for a phone full of plumbers/electricians: grouped by trade, filterable
 * + sortable, with one-tap Call / WhatsApp on every row.
 */
export function ServiceDirectory({ cat }: { cat: ServiceCategory }) {
  const c = useThemeColors();
  const router = useRouter();
  const toast = useToast();
  const { communityId } = useAuth();

  const [rows, setRows] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [trade, setTrade] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('trade');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try { setRows(await fetchListings(cat.key, communityId, 0, 500)); }
    catch { toast.show('Could not load contacts'); }
    finally { setLoading(false); }
  }, [cat.key, communityId, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const trades = useMemo(() => [...new Set(rows.map(tradeOf))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((l) => {
      if (trade && tradeOf(l) !== trade) return false;
      if (!q) return true;
      return (
        (l.referral_name || l.title).toLowerCase().includes(q) ||
        tradeOf(l).toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q) ||
        phoneOf(l).includes(q)
      );
    });
  }, [rows, query, trade]);

  const groups = useMemo(() => {
    const byName = (a: ListingRow, b: ListingRow) => (a.referral_name || a.title).localeCompare(b.referral_name || b.title);
    if (sort === 'name' || trade) {
      return filtered.length ? [{ trade: trade ?? '__all', rows: [...filtered].sort(byName) }] : [];
    }
    const map = new Map<string, ListingRow[]>();
    for (const l of filtered) { const t = tradeOf(l); if (!map.has(t)) map.set(t, []); map.get(t)!.push(l); }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([t, rs]) => ({ trade: t, rows: rs.sort(byName) }));
  }, [filtered, sort, trade]);

  const activeFilters = (trade ? 1 : 0) + (sort !== 'trade' ? 1 : 0);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon={cat.icon as any}
        iconColor={cat.color}
        title={cat.label}
        showBack
        onAdd={() => router.push({ pathname: '/post', params: { category: cat.key } } as any)}
        addLabel={`Add to ${cat.label}`}
        subBar={
          <View>
            <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
              <Ionicons name="search-outline" size={18} color={c.faint} />
              <TextInput
                value={query} onChangeText={setQuery}
                placeholder="Search a service, name or number…"
                placeholderTextColor={c.faint}
                className="flex-1 font-sans text-[15px] text-ink"
                style={{ outline: 'none' } as any}
              />
              {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={c.faint} /></Pressable> : null}
            </View>
            <View className="mt-2.5 flex-row items-center justify-between">
              <Text className="text-[12px] font-sans-md text-muted">{filtered.length} contact{filtered.length === 1 ? '' : 's'}{trade ? ` · ${trade}` : ''}</Text>
              <Pressable onPress={() => setShowFilters(true)} className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${activeFilters ? 'bg-accent-soft' : 'bg-inset'}`}>
                <Ionicons name="options-outline" size={14} color={activeFilters ? c.accent : c.muted} />
                <Text className={`text-[12px] font-sans-sb ${activeFilters ? 'text-accent' : 'text-muted'}`}>{activeFilters ? `Filters · ${activeFilters}` : 'Filter & sort'}</Text>
              </Pressable>
            </View>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="w-full self-center" style={{ maxWidth: layout.maxContent }}>
          {loading ? (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={6} /></View>
          ) : groups.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="construct-outline" size={40} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink mb-1">No contacts found</Text>
              <Text className="text-[14px] text-muted text-center max-w-xs">{query || trade ? 'Try a different search or filter.' : 'Tap + to add a trusted service contact.'}</Text>
            </View>
          ) : (
            groups.map((g) => (
              <View key={g.trade} className="mb-5">
                {g.trade !== '__all' ? (
                  <View className="mb-2 flex-row items-center gap-2">
                    <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <Text className="font-sans-bold text-[13px] uppercase tracking-wider text-muted">{g.trade}</Text>
                    <Text className="text-[12px] text-faint">· {g.rows.length}</Text>
                  </View>
                ) : null}
                <View className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {g.rows.map((l, i) => (
                    <ContactRow key={l.id} l={l} first={i === 0} c={c}
                      onOpen={() => router.push(`/listing/${l.id}` as any)} />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Sheet visible={showFilters} onClose={() => setShowFilters(false)} title="Filter & sort">
        <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Sort by</Text>
        <View className="mb-4 flex-row gap-2">
          {([['trade', 'Category'], ['name', 'Name (A–Z)']] as const).map(([k, lbl]) => (
            <Pressable key={k} onPress={() => setSort(k)} className={`flex-1 items-center rounded-xl border py-2.5 ${sort === k ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
              <Text className={`text-[13px] font-sans-sb ${sort === k ? 'text-accent' : 'text-muted'}`}>{lbl}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Category</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          <Pressable onPress={() => setTrade(null)} className={`rounded-full border px-3.5 py-1.5 ${!trade ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
            <Text className={`text-[13px] font-sans-sb ${!trade ? 'text-accent' : 'text-muted'}`}>All</Text>
          </Pressable>
          {trades.map((t) => (
            <Pressable key={t} onPress={() => setTrade(t)} className={`rounded-full border px-3.5 py-1.5 ${trade === t ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
              <Text className={`text-[13px] font-sans-sb ${trade === t ? 'text-accent' : 'text-muted'}`}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row gap-2">
          <Button label="Clear" variant="outline" fullWidth onPress={() => { setTrade(null); setSort('trade'); }} />
          <Button label="Done" fullWidth onPress={() => setShowFilters(false)} />
        </View>
      </Sheet>
    </View>
  );
}

function ContactRow({
  l, first, c, onOpen,
}: {
  l: ListingRow; first: boolean; c: ReturnType<typeof useThemeColors>; onOpen: () => void;
}) {
  const name = l.referral_name || l.title;
  const phone = phoneOf(l);
  const note = l.description || (l.attributes?.area as string) || '';
  return (
    <Pressable onPress={onOpen} className={`flex-row items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-line'} active:bg-inset`}>
      <Avatar name={name} size={40} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{name}</Text>
        {note ? <Text className="text-[12px] text-muted" numberOfLines={1}>{note}</Text> : null}
      </View>
      {phone ? (
        <View className="flex-row items-center gap-1.5">
          <Pressable onPress={() => openUrl(`tel:${phone}`)} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" style={{ backgroundColor: c.inset }}>
            <Ionicons name="call" size={16} color={c.muted} />
          </Pressable>
          <Pressable onPress={() => openUrl(waLink(phone, `Hi ${name.split(' ')[0]}! 👋 (via our society directory)`))} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" style={{ backgroundColor: '#25D36618' }}>
            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
          </Pressable>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={c.faint} />
      )}
    </Pressable>
  );
}
