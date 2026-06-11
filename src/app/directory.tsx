import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, RowSkeleton, ScreenHeader, Sheet, useResponsive } from '../components/ui';
import { Field } from '../components/forms';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { Resident, addDirectoryEntry, adminSetDirectoryVisibility, deleteDirectoryEntry, fetchDirectory } from '../lib/directory';
import { waLink } from '../lib/dishes';
import { getOrCreateThread } from '../lib/dm';
import { isSupabaseConfigured } from '../lib/supabase';
import { layout, useThemeColors } from '../theme';

const DIR_MAX = layout.maxContent;
type Filter = 'all' | 'owner' | 'tenant';
type SortKey = 'flat' | 'name';

/** Floor = first digit of the unit number (user's rule). */
const floorOf = (flat: string | null): string | null => {
  const m = /\d/.exec(flat ?? '');
  return m ? m[0] : null;
};
const floorLabel = (f: string) => (f === '0' ? 'Ground' : `Floor ${f}`);
/** "E-004" display from separate block + flat. */
const flatDisplay = (block: string | null, flat: string | null): string =>
  [block, flat].filter(Boolean).join('-');

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}
function appUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'https://aangan.app';
}

export default function DirectoryScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { userId, communityId, isAdmin } = useAuth();

  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [block, setBlock] = useState<string | null>(null);
  const [floor, setFloor] = useState<string | null>(null);
  const [reg, setReg] = useState<'all' | 'done' | 'pending'>('all');
  const [shf, setShf] = useState<'all' | 'no' | 'yes'>('all');
  const [sort, setSort] = useState<SortKey>('flat');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Resident | null>(null);

  // Distinct blocks / floors present (for the filter sheet).
  const { blocks, floors } = useMemo(() => {
    const bs = new Set<string>(); const fs = new Set<string>();
    for (const r of residents) {
      if (r.block) bs.add(r.block);
      const f = floorOf(r.flat); if (f) fs.add(f);
    }
    return {
      blocks: [...bs].sort(),
      floors: [...fs].sort((a, b) => Number(a) - Number(b)),
    };
  }, [residents]);
  const activeFilters = (block ? 1 : 0) + (floor ? 1 : 0) + (reg !== 'all' ? 1 : 0) + (shf !== 'all' ? 1 : 0) + (sort !== 'flat' ? 1 : 0);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      setResidents(await fetchDirectory(communityId, userId, !!isAdmin));
    } catch { toast.show('Could not load residents'); }
    finally { setLoading(false); }
  }, [communityId, userId, isAdmin, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return residents.filter((r) => {
      if (filter !== 'all' && r.resident_type !== filter) return false;
      if (block && r.block !== block) return false;
      if (floor && floorOf(r.flat) !== floor) return false;
      if (reg !== 'all' && r.registration_status !== reg) return false;
      if (shf !== 'all' && (r.shifted ? 'yes' : 'no') !== shf) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        flatDisplay(r.block, r.flat).toLowerCase().includes(q) ||
        (r.profession ?? '').toLowerCase().includes(q) ||
        (r.native ?? '').toLowerCase().includes(q) ||
        (r.vehicle_no ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q)
      );
    });
  }, [residents, query, filter, block, floor, reg, shf]);

  // Sort=name → a single flat list; sort=flat → grouped by block+flat.
  type Group = { key: string; block: string | null; flat: string | null; byName: boolean; rows: Resident[] };
  const groups = useMemo<Group[]>(() => {
    if (sort === 'name') {
      const rows = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      return rows.length ? [{ key: '__byname', block: null, flat: null, byName: true, rows }] : [];
    }
    const out: Group[] = [];
    for (const r of filtered) {
      const key = `${r.block ?? ''}|${r.flat ?? ''}`;
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else out.push({ key, block: r.block, flat: r.flat, byName: false, rows: [r] });
    }
    return out;
  }, [filtered, sort]);

  const call = (r: Resident) => {
    const d = (r.phone ?? '').replace(/\D/g, '');
    if (!d) return toast.show('No phone number on file');
    openUrl(`tel:${d}`);
  };
  const whatsapp = (r: Resident) => {
    const wa = r.whatsapp ?? r.phone;
    if (!wa) return toast.show('No WhatsApp on file');
    openUrl(waLink(wa, `Hi ${r.name.split(' ')[0]}! 👋`));
  };
  const message = async (r: Resident) => {
    if (!r.userId) return;
    try { router.push(`/messages/${await getOrCreateThread(r.userId)}` as any); }
    catch { toast.show('Could not start chat'); }
  };
  const invite = (r: Resident) => {
    const wa = r.phone;
    if (!wa) return toast.show('No phone number to invite');
    openUrl(waLink(wa, `Hi ${r.name.split(' ')[0]}! 🏡 Join our society on Aangan — ${appUrl()}\n\nSee neighbours, order home food, post listings, polls & more.`));
  };

  const remove = (r: Resident) => {
    const run = async () => {
      try {
        if (r.removeKind === 'entry' && r.entryId) await deleteDirectoryEntry(r.entryId);
        else if (r.removeKind === 'hide' && r.userId) await adminSetDirectoryVisibility(r.userId, false);
        toast.show('Removed from directory');
        await load();
      } catch { toast.show('Could not remove'); }
    };
    const msg = r.removeKind === 'hide'
      ? `Hide ${r.name} from the resident directory?`
      : `Remove ${r.name} from the directory?`;
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); }
    else Alert.alert('Remove', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: run }]);
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Everyone' },
    { key: 'owner', label: 'Owners' },
    { key: 'tenant', label: 'Tenants' },
  ];

  // Shared filter controls — rendered in the desktop side panel and the mobile sheet.
  const filterBody = (
    <>
      <FilterGroup label="Sort by">
        <ChipBtn label="Flat" on={sort === 'flat'} onPress={() => setSort('flat')} c={c} />
        <ChipBtn label="Name (A–Z)" on={sort === 'name'} onPress={() => setSort('name')} c={c} />
      </FilterGroup>
      {blocks.length > 1 ? (
        <FilterGroup label="Block">
          <ChipBtn label="All" on={!block} onPress={() => setBlock(null)} c={c} />
          {blocks.map((b) => <ChipBtn key={b} label={b} on={block === b} onPress={() => setBlock(block === b ? null : b)} c={c} />)}
        </FilterGroup>
      ) : null}
      {floors.length > 1 ? (
        <FilterGroup label="Floor">
          <ChipBtn label="All" on={!floor} onPress={() => setFloor(null)} c={c} />
          {floors.map((f) => <ChipBtn key={f} label={f === '0' ? 'G' : f} on={floor === f} onPress={() => setFloor(floor === f ? null : f)} c={c} />)}
        </FilterGroup>
      ) : null}
      <FilterGroup label="Registration">
        {([['all', 'All'], ['done', 'Registered'], ['pending', 'Pending']] as const).map(([k, lbl]) => (
          <ChipBtn key={k} label={lbl} on={reg === k} onPress={() => setReg(k)} c={c} />
        ))}
      </FilterGroup>
      <FilterGroup label="Residence" last>
        {([['all', 'All'], ['no', 'Living here'], ['yes', 'Shifted out']] as const).map(([k, lbl]) => (
          <ChipBtn key={k} label={lbl} on={shf === k} onPress={() => setShf(k)} c={c} />
        ))}
      </FilterGroup>
      {activeFilters > 0 ? (
        <Pressable onPress={() => { setBlock(null); setFloor(null); setReg('all'); setShf('all'); setSort('flat'); }} className="mt-3 self-start">
          <Text className="text-[12px] font-sans-sb text-accent">Clear all</Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="people-outline"
        iconColor="#8B5CF6"
        title="Residents"
        showBack
        onAdd={() => setShowAdd(true)}
        addLabel="Add resident"
        subBar={
          <View>
            <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
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
                <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={c.faint} /></Pressable>
              ) : null}
            </View>
            <View className="mt-2.5 flex-row items-center gap-2">
              {FILTERS.map((f) => (
                <Pressable key={f.key} onPress={() => setFilter(f.key)} className={`rounded-full px-3.5 py-1.5 ${filter === f.key ? 'bg-accent' : 'bg-inset'}`}>
                  <Text className={`text-[12px] font-sans-sb ${filter === f.key ? 'text-on-accent' : 'text-muted'}`}>{f.label}</Text>
                </Pressable>
              ))}
              <View className="flex-1" />
              <Pressable onPress={() => setShowFilters((v) => !v)} className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${activeFilters || showFilters ? 'bg-accent-soft' : 'bg-inset'}`}>
                <Ionicons name="options-outline" size={14} color={activeFilters || showFilters ? c.accent : c.muted} />
                <Text className={`text-[12px] font-sans-sb ${activeFilters || showFilters ? 'text-accent' : 'text-muted'}`}>{activeFilters ? `Filters · ${activeFilters}` : 'Filter & sort'}</Text>
              </Pressable>
            </View>
          </View>
        }
      />

      <View className={isDesktop ? 'flex-1 flex-row' : 'flex-1'}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="w-full self-center" style={{ maxWidth: DIR_MAX }}>
          {loading ? (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={6} /></View>
          ) : groups.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="people-outline" size={40} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink mb-1">No residents found</Text>
              <Text className="text-[14px] text-muted text-center max-w-xs">
                {query || filter !== 'all' ? 'Try a different search or filter.' : 'Add a neighbour with the Add button.'}
              </Text>
            </View>
          ) : (
            groups.map((g) => (
              <View key={g.key} className="mb-5">
                {g.byName ? (
                  <View className="mb-2 flex-row items-center gap-2">
                    <Ionicons name="text-outline" size={14} color={c.muted} />
                    <Text className="font-sans-bold text-[13px] uppercase tracking-wider text-muted">All residents · A–Z</Text>
                    <Text className="text-[12px] text-faint">· {g.rows.length}</Text>
                  </View>
                ) : (
                  <View className="mb-2 flex-row items-center gap-2">
                    <Ionicons name="home-outline" size={14} color={c.muted} />
                    <Text className="font-sans-bold text-[13px] uppercase tracking-wider text-muted">
                      {g.flat ? `Flat ${g.flat}` : 'No flat listed'}
                    </Text>
                    {g.block ? (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#8B5CF620' }}>
                        <Text className="text-[10px] font-sans-sb uppercase" style={{ color: '#8B5CF6' }}>Block {g.block}</Text>
                      </View>
                    ) : null}
                    {g.rows.length > 1 ? <Text className="text-[12px] text-faint">· {g.rows.length} residents</Text> : null}
                  </View>
                )}
                <View className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {g.rows.map((r, i) => (
                    <ResidentRow
                      key={r.key}
                      r={r}
                      first={i === 0}
                      showFlat={sort === 'name'}
                      c={c}
                      onOpen={() => setSelected(r)}
                      onCall={() => call(r)}
                      onWhatsApp={() => whatsapp(r)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Desktop: filter/sort opens as a right-hand panel that shrinks the list. */}
      {isDesktop && showFilters ? (
        <View className="border-l border-line bg-bg" style={{ width: 300 }}>
          <View className="flex-row items-center justify-between border-b border-line px-4 py-3">
            <Text className="font-sans-sb text-[15px] text-ink">Filter & sort</Text>
            <Pressable onPress={() => setShowFilters(false)} hitSlop={8}><Ionicons name="close" size={20} color={c.muted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>{filterBody}</ScrollView>
        </View>
      ) : null}
      </View>

      {/* Mobile: filter/sort as a modal. */}
      {!isDesktop ? (
        <Sheet visible={showFilters} onClose={() => setShowFilters(false)} title="Filter & sort" footer={<Button label="Done" fullWidth onPress={() => setShowFilters(false)} />}>
          {filterBody}
        </Sheet>
      ) : null}

      <AddResidentModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={async (fields) => {
          if (!communityId || !userId) return;
          const d = (fields.phone ?? '').replace(/\D/g, '');
          // Same number in a different flat is allowed (one owner, multiple flats).
          if (d && residents.some((r) => (r.phone ?? '').replace(/\D/g, '') === d && (r.flat ?? '') === (fields.flat ?? '') && (r.block ?? '') === (fields.block ?? ''))) {
            return toast.show('That person is already listed in this flat');
          }
          try {
            await addDirectoryEntry({ communityId, addedBy: userId, ...fields });
            setShowAdd(false);
            toast.show('Resident added ✅');
            await load();
          } catch (e) {
            toast.show(e instanceof Error && e.message === 'duplicate' ? 'That phone is already in the directory' : 'Could not add — try again');
          }
        }}
        c={c}
      />

      <ResidentDetailSheet
        r={selected}
        onClose={() => setSelected(null)}
        c={c}
        onCall={() => selected && call(selected)}
        onWhatsApp={() => selected && whatsapp(selected)}
        onMessage={() => { if (selected) { message(selected); setSelected(null); } }}
        onInvite={() => selected && invite(selected)}
        onProfile={() => { if (selected?.userId) { router.push(`/profile/${selected.userId}` as any); setSelected(null); } }}
        onRemove={() => { if (selected) { remove(selected); setSelected(null); } }}
      />
    </View>
  );
}

function FilterGroup({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View className={last ? '' : 'mb-3'}>
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">{label}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

function ChipBtn({ label, on, onPress, c }: { label: string; on: boolean; onPress: () => void; c: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={onPress} className={`min-w-[44px] items-center rounded-full border px-3.5 py-1.5 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
      <Text className={`text-[13px] font-sans-sb ${on ? 'text-accent' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

function ResidentDetailSheet({
  r, onClose, c, onCall, onWhatsApp, onMessage, onInvite, onProfile, onRemove,
}: {
  r: Resident | null; onClose: () => void; c: ReturnType<typeof useThemeColors>;
  onCall: () => void; onWhatsApp: () => void; onMessage: () => void; onInvite: () => void; onProfile: () => void; onRemove: () => void;
}) {
  const typeColor = r?.resident_type === 'owner' ? '#0D9488' : '#7C3AED';
  return (
    <Sheet visible={!!r} onClose={onClose} title={r?.name ?? 'Resident'}>
      {r ? (
        <View>
          {/* Identity badges */}
          <View className="mb-4 flex-row flex-wrap items-center gap-2">
            {r.flat ? <Badge label={`🏠 Flat ${r.flat}`} c={c} /> : null}
            {r.block ? <Badge label={`Block ${r.block}`} color="#8B5CF6" c={c} /> : null}
            {r.resident_type ? <Badge label={r.resident_type === 'owner' ? 'Owner' : 'Tenant'} color={typeColor} c={c} /> : null}
            <Badge label={r.registration_status === 'done' ? '✓ Registered' : 'Not registered'} color={r.registration_status === 'done' ? '#16A34A' : '#CA8A04'} c={c} />
            <Badge label={r.shifted ? 'Shifted out' : 'Resident'} color={r.shifted ? '#9CA3AF' : '#16A34A'} c={c} />
            {!r.onboarded ? <Badge label="Not on Aangan" c={c} /> : null}
          </View>

          {/* Details */}
          <View className="mb-4 gap-0.5 rounded-2xl border border-line bg-inset px-1">
            <DetailRow icon="call-outline" label="Phone" value={r.phone} c={c} />
            <DetailRow icon="call-outline" label="Alternate" value={r.alt_phone} c={c} />
            <DetailRow icon="mail-outline" label="Email" value={r.email} c={c} />
            <DetailRow icon="location-outline" label="Native" value={r.native} c={c} />
            <DetailRow icon="briefcase-outline" label="Profession" value={r.profession} c={c} />
            <DetailRow icon="car-outline" label="Vehicle" value={r.vehicle_no} c={c} last />
          </View>

          {/* Actions */}
          <View className="flex-row flex-wrap gap-2">
            {r.phone ? <Button label="Call" icon="call" variant="outline" onPress={onCall} /> : null}
            {r.phone ? <Button label="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={onWhatsApp} /> : null}
            {r.onboarded ? <Button label="Message" icon="chatbubble-ellipses-outline" variant="outline" onPress={onMessage} /> : (r.phone ? <Button label="Invite" icon="paper-plane-outline" onPress={onInvite} /> : null)}
            {r.onboarded ? <Button label="View profile" variant="ghost" onPress={onProfile} /> : null}
            {r.removeKind ? <Button label={r.removeKind === 'hide' ? 'Hide from directory' : 'Remove'} icon="trash-outline" variant="danger" onPress={onRemove} /> : null}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

function Badge({ label, color, c }: { label: string; color?: string; c: ReturnType<typeof useThemeColors> }) {
  const col = color ?? c.muted;
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: col + '1A' }}>
      <Text className="text-[11px] font-sans-sb" style={{ color: col }}>{label}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value, c, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null; c: ReturnType<typeof useThemeColors>; last?: boolean }) {
  if (!value) return null;
  return (
    <View className={`flex-row items-center gap-3 px-2.5 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      <Ionicons name={icon} size={16} color={c.faint} />
      <Text className="w-20 text-[12px] font-sans-sb uppercase tracking-wide text-faint">{label}</Text>
      <Text className="flex-1 text-[14px] text-ink" selectable>{value}</Text>
    </View>
  );
}

function ResidentRow({
  r, first, showFlat, c, onOpen, onCall, onWhatsApp,
}: {
  r: Resident; first: boolean; showFlat?: boolean; c: ReturnType<typeof useThemeColors>;
  onOpen: () => void; onCall: () => void; onWhatsApp: () => void;
}) {
  const typeColor = r.resident_type === 'owner' ? '#0D9488' : '#7C3AED';
  const sub = [
    showFlat && r.flat ? `Flat ${[r.block, r.flat].filter(Boolean).join('-')}` : null,
    r.profession, r.native, r.vehicle_no ? `🚗 ${r.vehicle_no}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onOpen}
      className={`flex-row items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-line'} active:bg-inset`}
    >
      <Avatar name={r.name} size={40} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[14.5px] text-ink" numberOfLines={1}>{r.name}</Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          {r.resident_type ? (
            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: typeColor + '20' }}>
              <Text className="text-[9px] font-sans-sb uppercase" style={{ color: typeColor }}>{r.resident_type}</Text>
            </View>
          ) : null}
          {!r.onboarded ? (
            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: '#CA8A0420' }}>
              <Text className="text-[9px] font-sans-sb uppercase" style={{ color: '#A16207' }}>Not on Aangan</Text>
            </View>
          ) : null}
          {r.shifted ? (
            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: '#9CA3AF22' }}>
              <Text className="text-[9px] font-sans-sb uppercase text-muted">Shifted</Text>
            </View>
          ) : null}
          {sub ? <Text className="flex-1 text-[12px] text-muted" numberOfLines={1}>{sub}</Text> : null}
        </View>
      </View>

      {r.phone ? (
        <View className="flex-row items-center gap-1.5">
          <IconBtn icon="call" onPress={onCall} bg={c.inset} color={c.muted} />
          <IconBtn icon="logo-whatsapp" onPress={onWhatsApp} bg="#25D36618" color="#25D366" />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={c.faint} />
      )}
    </Pressable>
  );
}

function IconBtn({ icon, onPress, bg, color }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; bg: string; color: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" style={{ backgroundColor: bg }}>
      <Ionicons name={icon} size={16} color={color} />
    </Pressable>
  );
}

function AddResidentModal({
  visible, onClose, onAdd, c,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (f: { name: string; block: string | null; flat: string | null; phone: string | null; resident_type: 'owner' | 'tenant' | null; profession: string | null; vehicle_no: string | null; native: string | null; alt_phone: string | null; email: string | null; registration_status: 'pending' | 'done'; shifted: boolean }) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState<'pending' | 'done'>('pending');
  const [shifted, setShifted] = useState(false);
  const [block, setBlock] = useState('');
  const [flat, setFlat] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'owner' | 'tenant' | null>(null);
  const [profession, setProfession] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [native, setNative] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    setBusy(true);
    onAdd({ name, block: block || null, flat: flat || null, phone: phone || null, resident_type: type, profession: profession || null, vehicle_no: vehicle || null, native: native || null, alt_phone: altPhone || null, email: email || null, registration_status: registration, shifted });
    setBusy(false);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add a resident"
      footer={<Button label={busy ? 'Adding…' : 'Add resident'} loading={busy} fullWidth disabled={!name.trim()} onPress={submit} />}
    >
      <Text className="mb-4 text-[13px] text-muted">Add a neighbour to the directory. If they're not on Aangan yet, you can invite them after.</Text>
      <Field label="Name" required placeholder="Pratibha Priti" value={name} onChangeText={setName} />
      <View className="flex-row gap-3">
        <View className="w-24"><Field label="Block" autoCapitalize="characters" placeholder="E" value={block} onChangeText={setBlock} /></View>
        <View className="flex-1"><Field label="Flat number" placeholder="204" value={flat} onChangeText={setFlat} /></View>
      </View>
      <Field label="Phone" hint="For contact & invite" keyboardType="phone-pad" placeholder="98765 43210" value={phone} onChangeText={setPhone} />
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Owner / Tenant (optional)</Text>
      <View className="mb-4 flex-row gap-2.5">
        {(['owner', 'tenant'] as const).map((t) => (
          <Pressable key={t} onPress={() => setType(type === t ? null : t)} className={`flex-1 rounded-2xl border-[1.5px] p-3 ${type === t ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
            <Text className="font-sans-sb text-[14px] text-ink">{t === 'owner' ? 'Owner' : 'Tenant'}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Profession" placeholder="e.g. Doctor, Teacher" value={profession} onChangeText={setProfession} />
      <Field label="Vehicle number" autoCapitalize="characters" placeholder="MH 12 AB 1234" value={vehicle} onChangeText={setVehicle} />
      <Field label="Native" placeholder="e.g. Lucknow, UP" value={native} onChangeText={setNative} />
      <View className="flex-row gap-3">
        <View className="flex-1"><Field label="Alternate phone" keyboardType="phone-pad" placeholder="98765 43210" value={altPhone} onChangeText={setAltPhone} /></View>
      </View>
      <Field label="Email" keyboardType="email-address" autoCapitalize="none" placeholder="name@email.com" value={email} onChangeText={setEmail} />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Registration</Text>
          <View className="flex-row gap-2">
            {(['done', 'pending'] as const).map((s) => (
              <Pressable key={s} onPress={() => setRegistration(s)} className={`flex-1 items-center rounded-xl border py-2 ${registration === s ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
                <Text className={`text-[13px] font-sans-sb ${registration === s ? 'text-accent' : 'text-muted'}`}>{s === 'done' ? 'Done' : 'Pending'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View className="flex-1">
          <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Shifted out</Text>
          <View className="flex-row gap-2">
            {([['no', false], ['yes', true]] as const).map(([lbl, v]) => (
              <Pressable key={lbl} onPress={() => setShifted(v)} className={`flex-1 items-center rounded-xl border py-2 ${shifted === v ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
                <Text className={`text-[13px] font-sans-sb ${shifted === v ? 'text-accent' : 'text-muted'}`}>{lbl === 'yes' ? 'Yes' : 'No'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Sheet>
  );
}
