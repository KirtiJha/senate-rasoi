import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      setResidents(await fetchDirectory(communityId, userId, !!isAdmin));
    } catch { toast.show('Could not load residents'); }
    finally { setLoading(false); }
  }, [communityId, userId, isAdmin, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return residents.filter((r) => {
      if (filter !== 'all' && r.resident_type !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.flat ?? '').toLowerCase().includes(q) ||
        (r.profession ?? '').toLowerCase().includes(q) ||
        (r.vehicle_no ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q)
      );
    });
  }, [residents, query, filter]);

  // Group by flat (residents are already flat-sorted).
  const groups = useMemo(() => {
    const out: { flat: string | null; rows: Resident[] }[] = [];
    for (const r of filtered) {
      const last = out[out.length - 1];
      if (last && last.flat === (r.flat ?? null)) last.rows.push(r);
      else out.push({ flat: r.flat ?? null, rows: [r] });
    }
    return out;
  }, [filtered]);

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
            <View className="mt-2.5 flex-row gap-2">
              {FILTERS.map((f) => (
                <Pressable key={f.key} onPress={() => setFilter(f.key)} className={`rounded-full px-3.5 py-1.5 ${filter === f.key ? 'bg-accent' : 'bg-inset'}`}>
                  <Text className={`text-[12px] font-sans-sb ${filter === f.key ? 'text-on-accent' : 'text-muted'}`}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              <View key={g.flat ?? '__none'} className="mb-5">
                <View className="mb-2 flex-row items-center gap-2">
                  <Ionicons name="home-outline" size={14} color={c.muted} />
                  <Text className="font-sans-bold text-[13px] uppercase tracking-wider text-muted">
                    {g.flat ? `Flat ${g.flat}` : 'No flat listed'}
                  </Text>
                  {g.rows.length > 1 ? <Text className="text-[12px] text-faint">· {g.rows.length} residents</Text> : null}
                </View>
                <View className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {g.rows.map((r, i) => (
                    <ResidentRow
                      key={r.key}
                      r={r}
                      first={i === 0}
                      c={c}
                      onOpen={() => r.userId && router.push(`/profile/${r.userId}` as any)}
                      onCall={() => call(r)}
                      onWhatsApp={() => whatsapp(r)}
                      onMessage={() => message(r)}
                      onInvite={() => invite(r)}
                      onRemove={() => remove(r)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AddResidentModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={async (fields) => {
          if (!communityId || !userId) return;
          const d = (fields.phone ?? '').replace(/\D/g, '');
          if (d && residents.some((r) => (r.phone ?? '').replace(/\D/g, '') === d)) {
            return toast.show('That person is already in the directory');
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
    </View>
  );
}

function ResidentRow({
  r, first, c, onOpen, onCall, onWhatsApp, onMessage, onInvite, onRemove,
}: {
  r: Resident; first: boolean; c: ReturnType<typeof useThemeColors>;
  onOpen: () => void; onCall: () => void; onWhatsApp: () => void; onMessage: () => void; onInvite: () => void; onRemove: () => void;
}) {
  const typeColor = r.resident_type === 'owner' ? '#0D9488' : '#7C3AED';
  const sub = [r.profession, r.vehicle_no ? `🚗 ${r.vehicle_no}` : null].filter(Boolean).join('  ·  ');

  return (
    <Pressable
      onPress={r.onboarded ? onOpen : undefined}
      className={`flex-row items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-line'} ${r.onboarded ? 'active:bg-inset' : ''}`}
    >
      <Avatar name={r.name} size={40} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row items-center gap-1.5 flex-wrap">
          <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{r.name}</Text>
          {r.resident_type ? (
            <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: typeColor + '20' }}>
              <Text className="text-[9px] font-sans-sb uppercase" style={{ color: typeColor }}>{r.resident_type}</Text>
            </View>
          ) : null}
          {!r.onboarded ? (
            <View className="rounded-full bg-inset px-1.5 py-0.5">
              <Text className="text-[9px] font-sans-sb uppercase text-faint">Not on Aangan</Text>
            </View>
          ) : null}
        </View>
        {sub ? <Text className="text-[12px] text-muted" numberOfLines={1}>{sub}</Text> : null}
      </View>

      <View className="flex-row items-center gap-1.5">
        {r.phone ? <IconBtn icon="call" onPress={onCall} bg={c.inset} color={c.muted} /> : null}
        {r.phone ? <IconBtn icon="logo-whatsapp" onPress={onWhatsApp} bg="#25D36618" color="#25D366" /> : null}
        {r.onboarded ? (
          <IconBtn icon="chatbubble-ellipses-outline" onPress={onMessage} bg={c.inset} color={c.muted} />
        ) : (
          <Pressable onPress={onInvite} className="flex-row items-center gap-1 rounded-full bg-accent-soft px-2.5 py-2 active:opacity-80">
            <Ionicons name="paper-plane-outline" size={13} color={c.accent} />
            <Text className="text-[11px] font-sans-sb text-accent">Invite</Text>
          </Pressable>
        )}
        {r.removeKind ? <IconBtn icon="trash-outline" onPress={onRemove} bg={c.inset} color="#EF4444" /> : null}
      </View>
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
  onAdd: (f: { name: string; flat: string | null; phone: string | null; resident_type: 'owner' | 'tenant' | null; profession: string | null; vehicle_no: string | null }) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'owner' | 'tenant' | null>(null);
  const [profession, setProfession] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    setBusy(true);
    onAdd({ name, flat: flat || null, phone: phone || null, resident_type: type, profession: profession || null, vehicle_no: vehicle || null });
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
      <View className="flex-row gap-3">
        <View className="flex-1"><Field label="Name" required placeholder="Pratibha Priti" value={name} onChangeText={setName} /></View>
        <View className="w-28"><Field label="Flat" placeholder="A-204" value={flat} onChangeText={setFlat} /></View>
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
    </Sheet>
  );
}
