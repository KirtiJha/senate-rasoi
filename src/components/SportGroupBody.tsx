import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/auth';
import { useConfirm } from '../context/confirm';
import { useToast } from '../context/toast';
import { fetchDirectory, Resident } from '../lib/directory';
import {
  durationLabel, formatDays, formatTime, isValidTime,
  parseDaysLabel, parseDurationLabel, parseTimeLabel,
} from '../lib/schedule';
import {
  GroupMember, SportGroup, Tournament, addMember, addTournament, deleteGroup, deleteTournament,
  fetchGroup, fetchGroupMembers, fetchTournaments, getSport, joinGroup, leaveGroup, removeMember,
  setCaptain, updateGroup, uploadGroupLogo,
} from '../lib/sports';
import { useThemeColors } from '../theme';
import { CourtBookings } from './CourtBookings';
import { WeekdayChips } from './WeekdayChips';
import { Avatar, Button, RowSkeleton, Sheet } from './ui';

/**
 * The full content of one sports group (badge, practice, members, tournaments,
 * join/leave + owner/admin management). Self-fetches by groupId so it can be
 * dropped into the tabbed /sports screen and the /sports/[id] route alike.
 */
export function SportGroupBody({
  groupId, onTitle, onChanged, onDeleted,
}: {
  groupId: string;
  onTitle?: (name: string) => void;
  onChanged?: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const c = useThemeColors();
  const toast = useToast();
  const { userId, communityId, isAdmin } = useAuth();
  const confirm = useConfirm();

  const [group, setGroup] = useState<SportGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddTourney, setShowAddTourney] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [managing, setManaging] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const [g, m, t] = await Promise.all([fetchGroup(groupId), fetchGroupMembers(groupId), fetchTournaments(groupId)]);
      setGroup(g); setMembers(m); setTournaments(t);
      if (g) onTitle?.(g.name);
    } catch { toast.show('Could not load group'); }
    finally { setLoading(false); }
  }, [groupId, toast, onTitle]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const reload = async () => { await load(); onChanged?.(); };

  const isMember = !!userId && members.some((m) => m.user_id === userId);
  const isCaptain = !!userId && members.some((m) => m.user_id === userId && m.is_captain);
  const canManage = !!isAdmin || isCaptain;
  const sport = group ? getSport(group.sport) : undefined;
  const color = group?.color ?? sport?.color ?? '#16A34A';
  const emoji = group?.emoji ?? sport?.emoji ?? '🏅';

  const toggleJoin = async () => {
    if (!userId || !group) return;
    try { if (isMember) await leaveGroup(group.id, userId); else await joinGroup(group.id, userId); await reload(); }
    catch { toast.show('Could not update — try again'); }
  };

  const onRemoveMember = (m: GroupMember) => {
    if (!group) return;
    const run = async () => { try { await removeMember(group.id, m.user_id); await reload(); } catch { toast.show('Could not remove'); } };
    const msg = `Remove ${m.profile?.name ?? 'this member'} from ${group.name}?`;
    confirm({ title: 'Remove member', message: msg, confirmLabel: 'Remove', destructive: true }).then((ok) => { if (ok) run(); });
  };

  const onMakeCaptain = (m: GroupMember) => {
    if (!group) return;
    const run = async () => {
      try { await setCaptain(group.id, m.user_id); await reload(); toast.show(`${m.profile?.name ?? 'Member'} is now captain`); }
      catch { toast.show('Could not update captain'); }
    };
    const msg = `Make ${m.profile?.name ?? 'this member'} the captain of ${group.name}?`;
    confirm({ title: 'Transfer captaincy', message: msg, confirmLabel: 'Make captain' }).then((ok) => { if (ok) run(); });
  };

  const pickLogo = async () => {
    if (!group) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    try {
      await updateGroup(group.id, { logo_url: await uploadGroupLogo(result.assets[0].uri, group.id) });
      await reload();
    } catch { toast.show('Could not upload logo'); }
  };

  const onDeleteGroup = () => {
    if (!group) return;
    const run = async () => { try { await deleteGroup(group.id); toast.show('Group deleted'); onDeleted ? onDeleted() : router.back(); } catch { toast.show('Could not delete'); } };
    const msg = `Delete the "${group.name}" group? This removes all members and tournaments.`;
    confirm({ title: 'Delete group', message: msg, confirmLabel: 'Delete', destructive: true }).then((ok) => { if (ok) run(); });
  };

  if (loading) return <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={4} /></View>;
  if (!group) return <Text className="py-10 text-center text-muted">This group no longer exists.</Text>;

  const schedule = [
    group.practice_days && { icon: 'calendar-outline' as const, text: group.practice_days },
    group.practice_time && { icon: 'time-outline' as const, text: group.practice_time },
    group.practice_duration && { icon: 'hourglass-outline' as const, text: group.practice_duration },
    group.practice_location && { icon: 'location-outline' as const, text: group.practice_location },
  ].filter(Boolean) as { icon: 'calendar-outline'; text: string }[];

  return (
    <>
      {/* Identity */}
      <View className="items-center rounded-3xl border border-line bg-surface px-6 py-6">
        {canManage ? (
          <Pressable onPress={() => setShowEdit(true)} hitSlop={8} className="absolute right-3 top-3 flex-row items-center gap-1 rounded-full bg-inset px-2.5 py-1.5 active:opacity-80">
            <Ionicons name="pencil" size={12} color={c.muted} />
            <Text className="text-[12px] font-sans-sb text-muted">Edit</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={canManage ? pickLogo : undefined} disabled={!canManage} className="h-20 w-20 items-center justify-center overflow-hidden rounded-3xl" style={{ backgroundColor: color + '22' }}>
          {group.logo_url ? (
            <Image source={{ uri: group.logo_url }} style={{ width: 80, height: 80 }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 40 }}>{emoji}</Text>
          )}
          {canManage ? (
            <View className="absolute bottom-0 right-0 h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-accent">
              <Ionicons name="camera" size={11} color={c.onAccent} />
            </View>
          ) : null}
        </Pressable>
        <Text className="mt-3 font-display-x text-[22px] text-ink text-center">{group.name}</Text>
        <View className="mt-1 flex-row items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ backgroundColor: color + '1A' }}>
          <Text style={{ fontSize: 12 }}>{sport?.emoji}</Text>
          <Text className="text-[12px] font-sans-sb" style={{ color }}>{sport?.label ?? group.sport}</Text>
        </View>
        {group.description ? <Text className="mt-3 text-center text-[14px] leading-6 text-muted">{group.description}</Text> : null}
        <View className="mt-4 w-full">
          <Button label={isMember ? 'Leave group' : 'Join group'} fullWidth variant={isMember ? 'outline' : 'primary'} onPress={toggleJoin} />
        </View>
      </View>

      {/* Practice */}
      {schedule.length > 0 ? (
        <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <Text className="mb-2.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Practice</Text>
          <View className="gap-2">
            {schedule.map((s, i) => (
              <View key={i} className="flex-row items-center gap-2.5">
                <Ionicons name={s.icon} size={16} color={c.muted} />
                <Text className="text-[14px] text-ink">{s.text}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Members */}
      <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <View className="mb-2.5 flex-row items-center gap-2">
          <Text className="flex-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Members · {members.length}</Text>
          {canManage ? (
            <>
              <Pressable
                onPress={() => setManaging((v) => !v)}
                hitSlop={6}
                className="flex-row items-center gap-1 rounded-full px-2.5 py-1 active:opacity-80"
                style={{ backgroundColor: managing ? c.accent + '20' : c.inset }}
              >
                <Ionicons name={managing ? 'checkmark' : 'settings-outline'} size={13} color={managing ? c.accent : c.muted} />
                <Text className="text-[12px] font-sans-sb" style={{ color: managing ? c.accent : c.muted }}>
                  {managing ? 'Done' : 'Manage'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowAddMember(true)} hitSlop={6} className="flex-row items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 active:opacity-80">
                <Ionicons name="person-add-outline" size={13} color={c.accent} />
                <Text className="text-[12px] font-sans-sb text-accent">Add</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        {members.length === 0 ? (
          <Text className="py-2 text-[13px] text-muted">No members yet.</Text>
        ) : (
          <View className="gap-2.5">
            {members.map((m) => {
              const isSelf = m.user_id === userId;
              // Admins can remove anyone except themselves; captains can only remove non-captains.
              const showRemove = managing && !isSelf && (!!isAdmin || (!m.is_captain && isCaptain));
              const showMakeCaptain = managing && !m.is_captain && canManage;
              return (
                <View key={m.user_id} className="flex-row items-center gap-3">
                  <Avatar name={m.profile?.name ?? '?'} size={36} />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{m.profile?.name ?? 'Member'}</Text>
                      {m.is_captain ? (
                        <View className="flex-row items-center gap-0.5 rounded-full bg-inset px-1.5 py-0.5">
                          <Text style={{ fontSize: 9 }}>👑</Text>
                          <Text className="text-[9px] font-sans-sb uppercase text-muted">Captain</Text>
                        </View>
                      ) : null}
                    </View>
                    {m.profile?.flat ? <Text className="text-[12px] text-faint">Flat {m.profile.flat}</Text> : null}
                  </View>
                  {showMakeCaptain ? (
                    <Pressable onPress={() => onMakeCaptain(m)} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-full bg-inset active:opacity-70">
                      <Text style={{ fontSize: 15 }}>👑</Text>
                    </Pressable>
                  ) : null}
                  {showRemove ? (
                    <Pressable onPress={() => onRemoveMember(m)} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-full bg-inset active:opacity-70">
                      <Ionicons name="close" size={15} color="#EF4444" />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
        {managing ? (
          <Text className="mt-3 text-center text-[11px] text-faint">
            👑 Transfer captaincy &nbsp;·&nbsp; ✕ Remove from group
          </Text>
        ) : null}
      </View>

      {/* Facility bookings, attendance & cost-split — only for sports that book one */}
      {sport?.booking ? (
        <CourtBookings groupId={group.id} communityId={group.community_id} accent={color} isMember={isMember} facility={sport.booking} />
      ) : null}

      {/* Tournaments */}
      <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">Upcoming tournaments</Text>
          {canManage ? (
            <Pressable onPress={() => setShowAddTourney(true)} hitSlop={6} className="flex-row items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 active:opacity-80">
              <Ionicons name="add" size={14} color={c.accent} />
              <Text className="text-[12px] font-sans-sb text-accent">Add</Text>
            </Pressable>
          ) : null}
        </View>
        {tournaments.length === 0 ? (
          <Text className="py-2 text-[13px] text-muted">No tournaments scheduled.</Text>
        ) : (
          <View className="gap-2.5">
            {tournaments.map((t) => (
              <View key={t.id} className="flex-row items-start gap-3 rounded-xl bg-inset p-3">
                <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: color + '22' }}>
                  <Ionicons name="trophy-outline" size={17} color={color} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-sb text-[14px] text-ink">{t.title}</Text>
                  <Text className="text-[12px] text-muted">{[t.event_date, t.location].filter(Boolean).join(' · ') || 'Date TBA'}</Text>
                  {t.notes ? <Text className="mt-0.5 text-[12px] text-faint">{t.notes}</Text> : null}
                </View>
                {canManage ? (
                  <Pressable onPress={() => confirm({ title: 'Delete tournament', message: `Delete "${t.title}"?`, confirmLabel: 'Delete', destructive: true }).then((ok) => { if (ok) deleteTournament(t.id).then(reload).catch(() => toast.show('Could not delete')); })} hitSlop={6}>
                    <Ionicons name="trash-outline" size={15} color={c.faint} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {canManage ? (
        <Pressable onPress={onDeleteGroup} className="mt-5 items-center py-3">
          <Text className="text-[13px] font-sans-sb text-[#EF4444]">Delete group</Text>
        </Pressable>
      ) : null}

      <EditGroupSheet
        visible={showEdit}
        group={group}
        c={c}
        onClose={() => setShowEdit(false)}
        onSave={async (patch) => {
          try { await updateGroup(group.id, patch); setShowEdit(false); await reload(); }
          catch { toast.show('Could not save'); }
        }}
      />
      <AddMemberSheet
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        communityId={communityId}
        userId={userId}
        isAdmin={!!isAdmin}
        existing={new Set(members.map((m) => m.user_id))}
        c={c}
        onAddMany={async (uids) => {
          try { for (const uid of uids) await addMember(group.id, uid); setShowAddMember(false); await reload(); }
          catch { toast.show('Could not add'); }
        }}
      />
      <AddTournamentSheet
        visible={showAddTourney}
        onClose={() => setShowAddTourney(false)}
        c={c}
        onAdd={async (form) => { try { await addTournament({ groupId: group.id, ...form }); setShowAddTourney(false); await reload(); } catch { toast.show('Could not add'); } }}
      />
    </>
  );
}

function EditGroupSheet({
  visible, group, c, onClose, onSave,
}: {
  visible: boolean; group: SportGroup; c: ReturnType<typeof useThemeColors>;
  onClose: () => void; onSave: (patch: Partial<SportGroup>) => void;
}) {
  const [name, setName] = useState(group.name);
  const [desc, setDesc] = useState(group.description ?? '');
  const [days, setDays] = useState<number[]>(parseDaysLabel(group.practice_days));
  const [time, setTime] = useState(parseTimeLabel(group.practice_time));
  const [duration, setDuration] = useState(parseDurationLabel(group.practice_duration));
  const [location, setLocation] = useState(group.practice_location ?? '');

  useEffect(() => {
    if (!visible) return;
    setName(group.name); setDesc(group.description ?? '');
    setDays(parseDaysLabel(group.practice_days)); setTime(parseTimeLabel(group.practice_time));
    setDuration(parseDurationLabel(group.practice_duration)); setLocation(group.practice_location ?? '');
  }, [visible, group]);

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const lbl = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';
  const durMin = parseInt(duration, 10) || 0;
  const timeOk = !time.trim() || isValidTime(time);
  const valid = !!name.trim() && timeOk;

  const save = () => {
    if (!valid) return;
    onSave({
      name: name.trim(),
      description: desc.trim() || null,
      practice_days: days.length ? formatDays(days) : null,
      practice_time: time.trim() && isValidTime(time) ? formatTime(time) : null,
      practice_duration: durMin > 0 ? durationLabel(durMin) : null,
      practice_location: location.trim() || null,
    } as Partial<SportGroup>);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit group" footer={<Button label="Save changes" fullWidth disabled={!valid} onPress={save} />}>
      <Text className={lbl}>Group / team name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Morning Smashers" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />

      <Text className={lbl}>About</Text>
      <TextInput value={desc} onChangeText={setDesc} placeholder="Who's it for, skill level, etc." placeholderTextColor={c.faint} multiline className={`mb-3 ${input}`} style={{ minHeight: 60, outline: 'none' } as any} />

      <Text className={lbl}>Practice days</Text>
      <View className="mb-3"><WeekdayChips value={days} onChange={setDays} /></View>

      <View className="mb-2 flex-row gap-2">
        <View className="flex-1">
          <Text className={lbl}>Time</Text>
          <TextInput value={time} onChangeText={setTime} placeholder="18:00" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} />
        </View>
        <View className="flex-1">
          <Text className={lbl}>Duration (min)</Text>
          <TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="90" placeholderTextColor={c.faint} className={input} style={{ outline: 'none' } as any} />
        </View>
      </View>
      {!timeOk ? <Text className="mb-2 text-[11px] text-nonveg">Enter time as HH:MM (e.g. 18:00)</Text> : null}

      <Text className={lbl}>Court / ground</Text>
      <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Clubhouse court 1" placeholderTextColor={c.faint} className={`mb-1 ${input}`} style={{ outline: 'none' } as any} />
    </Sheet>
  );
}

function AddMemberSheet({
  visible, onClose, communityId, userId, isAdmin, existing, onAddMany, c,
}: {
  visible: boolean; onClose: () => void; communityId: string | null; userId: string | null; isAdmin: boolean;
  existing: Set<string>; onAddMany: (uids: string[]) => void; c: ReturnType<typeof useThemeColors>;
}) {
  const [people, setPeople] = useState<Resident[]>([]);
  const [q, setQ] = useState('');
  const [block, setBlock] = useState<string | null>(null);
  const [sort, setSort] = useState<'flat' | 'name'>('flat');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !communityId) { return; }
    setPicked(new Set()); setQ(''); setBlock(null);
    fetchDirectory(communityId, userId, isAdmin).then(setPeople).catch(() => {});
  }, [visible, communityId, userId, isAdmin]);

  const blocks = useMemo(() => [...new Set(people.map((p) => p.block).filter(Boolean) as string[])].sort(), [people]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = people.filter((p) => {
      if (block && p.block !== block) return false;
      if (!s) return true;
      return p.name.toLowerCase().includes(s) || `${p.block ?? ''}${p.flat ?? ''}`.toLowerCase().includes(s);
    });
    return rows.sort((a, b) => sort === 'name'
      ? a.name.localeCompare(b.name)
      : `${a.block ?? '~'}${a.flat ?? ''}`.localeCompare(`${b.block ?? '~'}${b.flat ?? ''}`, undefined, { numeric: true }));
  }, [people, q, block, sort]);

  const toggle = (r: Resident) => {
    if (!r.userId) return; // only registered residents can join a group
    setPicked((s) => { const n = new Set(s); n.has(r.userId!) ? n.delete(r.userId!) : n.add(r.userId!); return n; });
  };

  const flatLabel = (r: Resident) => [r.block, r.flat].filter(Boolean).join('-');

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add members"
      footer={<Button label={picked.size ? `Add ${picked.size} selected` : 'Select residents to add'} fullWidth disabled={!picked.size} onPress={() => onAddMany([...picked])} />}
    >
      <View className="mb-3 flex-row items-center gap-2 rounded-2xl border border-line bg-inset px-3 py-2.5">
        <Ionicons name="search-outline" size={17} color={c.faint} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search by name or flat…" placeholderTextColor={c.faint} className="flex-1 text-[15px] text-ink" style={{ outline: 'none' } as any} />
      </View>

      <View className="mb-3 flex-row flex-wrap items-center gap-2">
        <MiniChip label={sort === 'flat' ? 'By flat' : 'By name'} on onPress={() => setSort(sort === 'flat' ? 'name' : 'flat')} c={c} />
        {blocks.length > 1 ? (
          <>
            <View className="mx-0.5 h-4 w-px" style={{ backgroundColor: c.line }} />
            <MiniChip label="All" on={!block} onPress={() => setBlock(null)} c={c} />
            {blocks.map((b) => <MiniChip key={b} label={b} on={block === b} onPress={() => setBlock(block === b ? null : b)} c={c} />)}
          </>
        ) : null}
      </View>

      {filtered.length === 0 ? (
        <Text className="py-6 text-center text-[13px] text-muted">No residents found.</Text>
      ) : (
        <View className="gap-1">
          {filtered.map((r) => {
            const inGroup = !!r.userId && existing.has(r.userId);
            const sel = !!r.userId && picked.has(r.userId);
            const addable = !!r.userId && !inGroup;
            return (
              <Pressable key={r.key} onPress={() => addable && toggle(r)} disabled={!addable} className="flex-row items-center gap-3 rounded-xl px-2 py-2 active:bg-inset" style={{ opacity: addable ? 1 : 0.55 }}>
                <Avatar name={r.name} size={34} />
                <View className="flex-1">
                  <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{r.name}</Text>
                  <Text className="text-[12px] text-faint">{[flatLabel(r) && `Flat ${flatLabel(r)}`, inGroup ? 'Already in group' : (!r.userId ? 'Not on Aangan' : null)].filter(Boolean).join(' · ')}</Text>
                </View>
                {inGroup ? (
                  <Ionicons name="checkmark-circle" size={22} color={c.muted} />
                ) : addable ? (
                  <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? c.accent : c.faint} />
                ) : (
                  <Ionicons name="lock-closed-outline" size={16} color={c.faint} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

function MiniChip({ label, on, onPress, c }: { label: string; on: boolean; onPress: () => void; c: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={onPress} className={`rounded-full border px-3 py-1 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
      <Text className={`text-[12px] font-sans-sb ${on ? 'text-accent' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

function AddTournamentSheet({
  visible, onClose, onAdd, c,
}: {
  visible: boolean; onClose: () => void;
  onAdd: (form: { title: string; eventDate: string | null; location: string | null; notes: string | null }) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const submit = () => { if (title.trim()) onAdd({ title, eventDate: date.trim() || null, location: location.trim() || null, notes: notes.trim() || null }); };

  return (
    <Sheet visible={visible} onClose={onClose} title="Add tournament" footer={<Button label="Add tournament" fullWidth disabled={!title.trim()} onPress={submit} />}>
      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Title</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Society Summer Cup" placeholderTextColor={c.faint} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
      <View className="mb-3 flex-row gap-2">
        <TextInput value={date} onChangeText={setDate} placeholder="Date (2026-07-15)" placeholderTextColor={c.faint} className={`flex-1 ${input}`} style={{ outline: 'none' } as any} />
        <TextInput value={location} onChangeText={setLocation} placeholder="Venue" placeholderTextColor={c.faint} className={`flex-1 ${input}`} style={{ outline: 'none' } as any} />
      </View>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={c.faint} multiline className={input} style={{ minHeight: 56, outline: 'none' } as any} />
    </Sheet>
  );
}
