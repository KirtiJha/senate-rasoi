import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, RowSkeleton, ScreenHeader, Sheet } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  SPORTS, SportGroupWithMeta, createGroup, fetchGroups, getSport, joinGroup, leaveGroup,
} from '../lib/sports';
import { useThemeColors } from '../theme';

const COLORS = ['#16A34A', '#2563EB', '#EA580C', '#DC2626', '#9333EA', '#0891B2', '#CA8A04', '#DB2777'];

export default function SportsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const toast = useToast();
  const { userId, communityId, isAdmin } = useAuth();

  const [groups, setGroups] = useState<SportGroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try { setGroups(await fetchGroups(communityId, userId)); }
    catch { toast.show('Could not load sports'); }
    finally { setLoading(false); }
  }, [communityId, userId, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleJoin = async (g: SportGroupWithMeta) => {
    if (!userId) return;
    try {
      if (g.is_member) await leaveGroup(g.id, userId);
      else await joinGroup(g.id, userId);
      setGroups((prev) => prev.map((x) => x.id === g.id ? { ...x, is_member: !x.is_member, member_count: x.member_count + (x.is_member ? -1 : 1) } : x));
    } catch { toast.show('Could not update — try again'); }
  };

  // Group the groups by sport, keeping every catalogue sport visible.
  const sections = useMemo(() =>
    SPORTS.map((s) => ({ sport: s, items: groups.filter((g) => g.sport === s.key) })),
  [groups]);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="football-outline" iconColor="#16A34A" title="Sports" showBack onAdd={() => setShowCreate(true)} addLabel="New group" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {loading ? (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={4} /></View>
          ) : (
            sections.map(({ sport, items }) => (
              <View key={sport.key} className="mb-6">
                <View className="mb-2 flex-row items-center gap-2">
                  <Text style={{ fontSize: 18 }}>{sport.emoji}</Text>
                  <Text className="font-display-x text-[18px] text-ink">{sport.label}</Text>
                  <Text className="text-[12px] text-faint">· {items.length} group{items.length === 1 ? '' : 's'}</Text>
                </View>
                {items.length === 0 ? (
                  <Pressable onPress={() => setShowCreate(true)} className="rounded-2xl border border-dashed border-line bg-surface px-4 py-5 active:bg-inset">
                    <Text className="text-center text-[13px] text-muted">No {sport.label.toLowerCase()} groups yet — tap to start one</Text>
                  </Pressable>
                ) : (
                  <View className="gap-2.5">
                    {items.map((g) => (
                      <GroupCard key={g.id} group={g} c={c} onOpen={() => router.push(`/sports/${g.id}` as any)} onToggle={() => toggleJoin(g)} />
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </Container>
      </ScrollView>

      <CreateGroupSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        c={c}
        onCreate={async (form) => {
          if (!communityId || !userId) return;
          try {
            const g = await createGroup({ communityId, createdBy: userId, ...form });
            setShowCreate(false);
            toast.show('Group created 🎉');
            await load();
            router.push(`/sports/${g.id}` as any);
          } catch { toast.show('Could not create — try again'); }
        }}
      />
    </View>
  );
}

function GroupCard({ group, c, onOpen, onToggle }: { group: SportGroupWithMeta; c: ReturnType<typeof useThemeColors>; onOpen: () => void; onToggle: () => void }) {
  const sport = getSport(group.sport);
  const color = group.color ?? sport?.color ?? '#16A34A';
  const emoji = group.emoji ?? sport?.emoji ?? '🏅';
  const schedule = [group.practice_days, group.practice_time].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onOpen} className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 active:opacity-90">
      <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: color + '22' }}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[15px] text-ink" numberOfLines={1}>{group.name}</Text>
        <Text className="text-[12px] text-muted" numberOfLines={1}>
          {group.member_count} member{group.member_count === 1 ? '' : 's'}{schedule ? ` · ${schedule}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onToggle}
        hitSlop={6}
        className={`rounded-full px-3 py-1.5 ${group.is_member ? 'bg-inset' : 'bg-accent'}`}
      >
        <Text className={`text-[12px] font-sans-sb ${group.is_member ? 'text-muted' : 'text-on-accent'}`}>{group.is_member ? 'Joined' : 'Join'}</Text>
      </Pressable>
    </Pressable>
  );
}

function CreateGroupSheet({
  visible, onClose, onCreate, c,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (form: { sport: string; name: string; emoji: string | null; color: string; description: string | null; practiceDays: string | null; practiceTime: string | null; practiceDuration: string | null; practiceLocation: string | null }) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [sport, setSport] = useState(SPORTS[0].key);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [days, setDays] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const lbl = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  const submit = () => {
    if (!name.trim()) return;
    setBusy(true);
    onCreate({
      sport, name, emoji: emoji.trim() || null, color,
      description: description || null, practiceDays: days || null, practiceTime: time || null,
      practiceDuration: duration || null, practiceLocation: location || null,
    });
    setBusy(false);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New sports group" footer={<Button label={busy ? 'Creating…' : 'Create group'} loading={busy} fullWidth disabled={!name.trim()} onPress={submit} />}>
      <Text className={lbl}>Sport</Text>
      <View className="mb-4 flex-row flex-wrap" style={{ gap: 8 }}>
        {SPORTS.map((s) => (
          <Pressable key={s.key} onPress={() => setSport(s.key)} className={`flex-row items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 ${sport === s.key ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
            <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
            <Text className="font-sans-sb text-[13px] text-ink">{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className={lbl}>Group / team name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Morning Smashers" placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as any} />

      <Text className={lbl}>Badge</Text>
      <View className="mb-4 flex-row items-center gap-3">
        <TextInput value={emoji} onChangeText={setEmoji} placeholder={getSport(sport)?.emoji ?? '🏅'} placeholderTextColor={c.faint} maxLength={2} className={input} style={{ width: 64, textAlign: 'center', outline: 'none' } as any} />
        <View className="flex-1 flex-row flex-wrap" style={{ gap: 8 }}>
          {COLORS.map((col) => (
            <Pressable key={col} onPress={() => setColor(col)} style={{ backgroundColor: col, borderWidth: color === col ? 3 : 0, borderColor: c.ink }} className="h-7 w-7 rounded-full" />
          ))}
        </View>
      </View>

      <Text className={lbl}>Practice schedule</Text>
      <View className="mb-2 flex-row gap-2">
        <TextInput value={days} onChangeText={setDays} placeholder="Days (Mon, Wed)" placeholderTextColor={c.faint} className={`flex-1 ${input}`} style={{ outline: 'none' } as any} />
        <TextInput value={time} onChangeText={setTime} placeholder="Time (6 AM)" placeholderTextColor={c.faint} className={`flex-1 ${input}`} style={{ outline: 'none' } as any} />
      </View>
      <View className="mb-4 flex-row gap-2">
        <TextInput value={duration} onChangeText={setDuration} placeholder="Duration (90 min)" placeholderTextColor={c.faint} className={`flex-1 ${input}`} style={{ outline: 'none' } as any} />
        <TextInput value={location} onChangeText={setLocation} placeholder="Court / ground" placeholderTextColor={c.faint} className={`flex-1 ${input}`} style={{ outline: 'none' } as any} />
      </View>

      <Text className={lbl}>About (optional)</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Who's it for, skill level, etc." placeholderTextColor={c.faint} multiline className={input} style={{ minHeight: 64, outline: 'none' } as any} />
    </Sheet>
  );
}
