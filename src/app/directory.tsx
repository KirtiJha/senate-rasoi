import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { fetchResidents } from '../lib/directory';
import { waLink } from '../lib/dishes';
import { getOrCreateThread } from '../lib/dm';
import { isSupabaseConfigured } from '../lib/supabase';
import { DbProfile } from '../lib/types';
import { useThemeColors } from '../theme';

const DIR_MAX = 1040;
type Filter = 'all' | 'owner' | 'tenant';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

export default function DirectoryScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId, communityId } = useAuth();

  const [residents, setResidents] = useState<DbProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      setResidents(await fetchResidents(communityId));
    } catch { toast.show('Could not load residents'); }
    finally { setLoading(false); }
  }, [communityId, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return residents.filter((r) => {
      if (r.show_in_directory === false) return false; // opted out of the directory
      if (filter !== 'all' && r.resident_type !== filter) return false;
      if (!q) return true;
      return (
        r.name?.toLowerCase().includes(q) ||
        (r.flat ?? '').toLowerCase().includes(q) ||
        (r.profession ?? '').toLowerCase().includes(q) ||
        (r.vehicle_no ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q)
      );
    });
  }, [residents, query, filter]);

  const call = (p: DbProfile) => {
    const digits = (p.phone ?? '').replace(/\D/g, '');
    if (!digits) return toast.show('No phone number on file');
    openUrl(`tel:${digits}`);
  };
  const whatsapp = (p: DbProfile) => {
    const wa = p.whatsapp ?? p.phone;
    if (!wa) return toast.show('No WhatsApp on file');
    openUrl(waLink(wa, `Hi ${p.name?.split(' ')[0] ?? ''}! 👋`));
  };
  const message = async (p: DbProfile) => {
    try {
      const threadId = await getOrCreateThread(p.id);
      router.push(`/messages/${threadId}` as any);
    } catch { toast.show('Could not start chat'); }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Everyone' },
    { key: 'owner', label: 'Owners' },
    { key: 'tenant', label: 'Tenants' },
  ];

  return (
    <View className="flex-1 bg-bg">
      {/* Header + search + filter, aligned to table width */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg pb-3">
        <View className="w-full self-center px-4" style={{ maxWidth: DIR_MAX }}>
          <View className="flex-row items-center gap-2">
            {!isDesktop ? (
              <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
                <Ionicons name="chevron-back" size={22} color={c.ink} />
              </Pressable>
            ) : null}
            <Text className="flex-1 font-display-x text-[22px] text-ink">Residents</Text>
            <Text className="text-[12px] font-sans-md text-faint">{filtered.length} resident{filtered.length === 1 ? '' : 's'}</Text>
          </View>

          <View className="mt-2.5 flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
            <Ionicons name="search-outline" size={18} color={c.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, flat or profession…"
              placeholderTextColor={c.faint}
              className="flex-1 font-sans text-[15px] text-ink"
              style={{ outline: 'none' } as any}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={c.faint} />
              </Pressable>
            ) : null}
          </View>

          <View className="mt-2.5 flex-row gap-2">
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                className={`rounded-full px-3.5 py-1.5 ${filter === f.key ? 'bg-accent' : 'bg-inset'}`}
              >
                <Text className={`text-[12px] font-sans-sb ${filter === f.key ? 'text-on-accent' : 'text-muted'}`}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flex: 1, width: '100%', maxWidth: DIR_MAX, alignSelf: 'center' }}>
        <FlashList
          data={loading ? [] : filtered}
          keyExtractor={(item: DbProfile) => item.id}
          renderItem={({ item }: { item: DbProfile }) => (
            <ResidentRow
              resident={item}
              self={item.id === userId}
              isDesktop={isDesktop}
              c={c}
              onOpen={() => router.push(`/profile/${item.id}` as any)}
              onCall={() => call(item)}
              onWhatsApp={() => whatsapp(item)}
              onMessage={() => message(item)}
            />
          )}
          ListHeaderComponent={
            isDesktop && filtered.length > 0 ? (
              <View className="flex-row items-center gap-3 px-3 pb-2 pt-1">
                <View style={{ width: 40 }} />
                <Text className="flex-1 text-[11px] font-sans-sb uppercase tracking-wider text-faint">Resident</Text>
                <Text style={{ width: 90 }} className="text-[11px] font-sans-sb uppercase tracking-wider text-faint">Flat</Text>
                <Text style={{ width: 90 }} className="text-[11px] font-sans-sb uppercase tracking-wider text-faint">Type</Text>
                <Text style={{ width: 150 }} className="text-[11px] font-sans-sb uppercase tracking-wider text-faint">Profession</Text>
                <View style={{ width: 130 }} />
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: 13, paddingTop: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? null : (
              <View className="items-center py-20">
                <Ionicons name="people-outline" size={40} color={c.faint} />
                <Text className="mt-3 font-display text-xl text-ink mb-1">No residents found</Text>
                <Text className="text-[14px] text-muted text-center max-w-xs">
                  {query || filter !== 'all' ? 'Try a different search or filter.' : 'Residents who join your society appear here.'}
                </Text>
              </View>
            )
          }
        />
      </View>
    </View>
  );
}

function TypeBadge({ type }: { type: 'owner' | 'tenant' | null }) {
  if (!type) return null;
  const owner = type === 'owner';
  const color = owner ? '#0D9488' : '#7C3AED';
  return (
    <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: color + '20' }}>
      <Text className="text-[10px] font-sans-sb uppercase" style={{ color }}>{owner ? 'Owner' : 'Tenant'}</Text>
    </View>
  );
}

function ContactBtns({ self, onCall, onWhatsApp, onMessage, c }: {
  self: boolean;
  onCall: () => void; onWhatsApp: () => void; onMessage: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Pressable onPress={onCall} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70">
        <Ionicons name="call" size={16} color={c.muted} />
      </Pressable>
      <Pressable onPress={onWhatsApp} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: '#25D36618' }}>
        <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
      </Pressable>
      {!self ? (
        <Pressable onPress={onMessage} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70">
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={c.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ResidentRow({
  resident, self, isDesktop, c, onOpen, onCall, onWhatsApp, onMessage,
}: {
  resident: DbProfile;
  self: boolean;
  isDesktop: boolean;
  c: ReturnType<typeof useThemeColors>;
  onOpen: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onMessage: () => void;
}) {
  const name = resident.name || 'Resident';

  if (isDesktop) {
    return (
      <Pressable onPress={onOpen} className="flex-row items-center gap-3 border-b border-line px-3 py-3 active:bg-inset">
        <Avatar name={name} size={34} />
        <View className="flex-1" style={{ minWidth: 0 }}>
          <View className="flex-row items-center gap-1.5">
            <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{name}</Text>
            {self ? <Text className="text-[11px] text-faint">(you)</Text> : null}
          </View>
          <Text className="text-[12px] text-faint" numberOfLines={1}>
            {resident.phone ?? ''}{resident.vehicle_no ? `${resident.phone ? '  ·  ' : ''}🚗 ${resident.vehicle_no}` : ''}
          </Text>
        </View>
        <Text style={{ width: 90 }} className="text-[13px] font-sans-md text-muted" numberOfLines={1}>{resident.flat ?? '—'}</Text>
        <View style={{ width: 90 }}><TypeBadge type={resident.resident_type} /></View>
        <Text style={{ width: 150 }} className="text-[13px] font-sans-md text-muted" numberOfLines={1}>{resident.profession ?? '—'}</Text>
        <View style={{ width: 130 }} className="items-end">
          <ContactBtns self={self} onCall={onCall} onWhatsApp={onWhatsApp} onMessage={onMessage} c={c} />
        </View>
      </Pressable>
    );
  }

  // Mobile card
  return (
    <Pressable onPress={onOpen} className="mb-3 rounded-2xl border border-line bg-surface p-3.5 active:opacity-90">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} size={44} />
        <View className="flex-1" style={{ minWidth: 0 }}>
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="font-sans-bold text-[15px] text-ink" numberOfLines={1}>{name}</Text>
            <TypeBadge type={resident.resident_type} />
            {self ? <Text className="text-[11px] text-faint">(you)</Text> : null}
          </View>
          <Text className="text-[12px] text-muted" numberOfLines={1}>
            {resident.flat ? `Flat ${resident.flat}` : 'Flat —'}
            {resident.profession ? ` · ${resident.profession}` : ''}
            {resident.vehicle_no ? ` · 🚗 ${resident.vehicle_no}` : ''}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-end gap-1.5 border-t border-line pt-3">
        <ContactBtns self={self} onCall={onCall} onWhatsApp={onWhatsApp} onMessage={onMessage} c={c} />
      </View>
    </Pressable>
  );
}
