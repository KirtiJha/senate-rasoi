import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { fetchDirectory } from '../lib/directory';
import {
  GroupMember, SportGroup, Tournament, addMember, addTournament, deleteGroup, deleteTournament,
  fetchGroup, fetchGroupMembers, fetchTournaments, getSport, joinGroup, leaveGroup, removeMember,
  updateGroup, uploadGroupLogo,
} from '../lib/sports';
import { useThemeColors } from '../theme';
import { CourtBookings } from './CourtBookings';
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

  const [group, setGroup] = useState<SportGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddTourney, setShowAddTourney] = useState(false);

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
  const canManage = !!isAdmin || (!!group && !!userId && group.created_by === userId);
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
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); }
    else Alert.alert('Remove', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: run }]);
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
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); }
    else Alert.alert('Delete group', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: run }]);
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
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">Members · {members.length}</Text>
          {canManage ? (
            <Pressable onPress={() => setShowAddMember(true)} hitSlop={6} className="flex-row items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 active:opacity-80">
              <Ionicons name="person-add-outline" size={13} color={c.accent} />
              <Text className="text-[12px] font-sans-sb text-accent">Add</Text>
            </Pressable>
          ) : null}
        </View>
        {members.length === 0 ? (
          <Text className="py-2 text-[13px] text-muted">No members yet.</Text>
        ) : (
          <View className="gap-2.5">
            {members.map((m) => (
              <View key={m.user_id} className="flex-row items-center gap-3">
                <Avatar name={m.profile?.name ?? '?'} size={36} />
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{m.profile?.name ?? 'Member'}</Text>
                    {m.is_captain ? <View className="rounded-full bg-inset px-1.5 py-0.5"><Text className="text-[9px] font-sans-sb uppercase text-muted">Captain</Text></View> : null}
                  </View>
                  {m.profile?.flat ? <Text className="text-[12px] text-faint">Flat {m.profile.flat}</Text> : null}
                </View>
                {canManage && !m.is_captain ? (
                  <Pressable onPress={() => onRemoveMember(m)} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-full bg-inset active:opacity-70">
                    <Ionicons name="close" size={15} color="#EF4444" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Court bookings, attendance & cost-split */}
      <CourtBookings groupId={group.id} communityId={group.community_id} accent={color} isMember={isMember} />

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
                  <Pressable onPress={async () => { try { await deleteTournament(t.id); await reload(); } catch { toast.show('Could not delete'); } }} hitSlop={6}>
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

      <AddMemberSheet
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        communityId={communityId}
        userId={userId}
        isAdmin={!!isAdmin}
        existing={new Set(members.map((m) => m.user_id))}
        c={c}
        onAdd={async (uid) => { try { await addMember(group.id, uid); setShowAddMember(false); await reload(); } catch { toast.show('Could not add'); } }}
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

function AddMemberSheet({
  visible, onClose, communityId, userId, isAdmin, existing, onAdd, c,
}: {
  visible: boolean; onClose: () => void; communityId: string | null; userId: string | null; isAdmin: boolean;
  existing: Set<string>; onAdd: (uid: string) => void; c: ReturnType<typeof useThemeColors>;
}) {
  const [people, setPeople] = useState<{ id: string; name: string; flat: string | null }[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible || !communityId) return;
    fetchDirectory(communityId, userId, isAdmin)
      .then((rs) => setPeople(rs.filter((r) => r.userId && !existing.has(r.userId)).map((r) => ({ id: r.userId!, name: r.name, flat: r.flat }))))
      .catch(() => {});
  }, [visible, communityId, userId, isAdmin, existing]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? people.filter((p) => p.name.toLowerCase().includes(s) || (p.flat ?? '').toLowerCase().includes(s)) : people;
  }, [people, q]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Add member">
      <View className="mb-3 flex-row items-center gap-2 rounded-2xl border border-line bg-inset px-3 py-2.5">
        <Ionicons name="search-outline" size={17} color={c.faint} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search residents…" placeholderTextColor={c.faint} className="flex-1 text-[15px] text-ink" style={{ outline: 'none' } as any} />
      </View>
      {filtered.length === 0 ? (
        <Text className="py-6 text-center text-[13px] text-muted">No one to add.</Text>
      ) : (
        <View className="gap-1">
          {filtered.map((p) => (
            <Pressable key={p.id} onPress={() => onAdd(p.id)} className="flex-row items-center gap-3 rounded-xl px-2 py-2 active:bg-inset">
              <Avatar name={p.name} size={34} />
              <View className="flex-1">
                <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{p.name}</Text>
                {p.flat ? <Text className="text-[12px] text-faint">Flat {p.flat}</Text> : null}
              </View>
              <Ionicons name="add-circle" size={22} color={c.accent} />
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
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
