import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Container, RowSkeleton, ScreenHeader, Sheet } from '../components/ui';
import { SportGroupBody } from '../components/SportGroupBody';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { isSupabaseConfigured } from '../lib/supabase';
import { SPORTS, Sport, SportGroupWithMeta, createGroup, fetchGroups, getSport, updateGroup, uploadGroupLogo } from '../lib/sports';
import { useThemeColors } from '../theme';

const COLORS = ['#16A34A', '#2563EB', '#EA580C', '#DC2626', '#9333EA', '#0891B2', '#CA8A04', '#DB2777'];

export default function SportsScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const { userId, communityId } = useAuth();

  const [groups, setGroups] = useState<SportGroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSport, setActiveSport] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try { setGroups(await fetchGroups(communityId, userId)); }
    catch { toast.show('Could not load sports'); }
    finally { setLoading(false); }
  }, [communityId, userId, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // One group per sport — first group wins if duplicates ever exist.
  const groupBySport = useMemo(() => {
    const m = new Map<string, SportGroupWithMeta>();
    for (const g of groups) if (!m.has(g.sport)) m.set(g.sport, g);
    return m;
  }, [groups]);

  const tabs = SPORTS.filter((s) => groupBySport.has(s.key));
  const availableSports = SPORTS.filter((s) => !groupBySport.has(s.key));
  const currentSport = activeSport && groupBySport.has(activeSport) ? activeSport : tabs[0]?.key ?? null;
  const currentGroup = currentSport ? groupBySport.get(currentSport) : undefined;

  const onAdd = () => {
    if (availableSports.length === 0) {
      toast.show('Every sport already has a group — add a new sport in the app to create more');
      return;
    }
    setShowCreate(true);
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="football-outline" iconColor="#16A34A" title="Sports" showBack onAdd={onAdd} addLabel="Add a sport" />

      {/* Sport tabs */}
      {tabs.length > 0 ? (
        <View className="border-b border-line bg-bg px-4 pb-2.5 pt-2.5">
          <Container>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {tabs.map((s) => {
                const on = s.key === currentSport;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setActiveSport(s.key)}
                    className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5 ${on ? '' : 'bg-inset'}`}
                    style={on ? { backgroundColor: (s.color) + '20' } : undefined}
                  >
                    <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
                    <Text className="text-[13px] font-sans-sb" style={{ color: on ? s.color : c.muted }}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Container>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container>
          {loading ? (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={4} /></View>
          ) : !currentGroup ? (
            <View className="items-center py-16">
              <Text style={{ fontSize: 44 }} className="mb-3">🏅</Text>
              <Text className="mb-1.5 font-display text-xl text-ink">No sports groups yet</Text>
              <Text className="mb-5 max-w-xs text-center text-[14px] leading-6 text-muted">
                Start a group for your society's badminton, cricket and more.
              </Text>
              <Button label="Add a sport" icon="add" onPress={onAdd} />
            </View>
          ) : (
            <SportGroupBody
              key={currentGroup.id}
              groupId={currentGroup.id}
              onChanged={load}
              onDeleted={() => { setActiveSport(null); load(); }}
            />
          )}
        </Container>
      </ScrollView>

      <CreateGroupSheet
        visible={showCreate}
        sports={availableSports}
        onClose={() => setShowCreate(false)}
        c={c}
        onCreate={async (form) => {
          if (!communityId || !userId) return;
          const { logoUri, ...groupForm } = form;
          try {
            const g = await createGroup({ communityId, createdBy: userId, ...groupForm });
            if (logoUri) {
              try { await updateGroup(g.id, { logo_url: await uploadGroupLogo(logoUri, g.id) }); }
              catch { toast.show('Logo upload failed — you can add it later'); }
            }
            setShowCreate(false);
            setActiveSport(form.sport);
            toast.show('Group created 🎉');
            await load();
          } catch { toast.show('Could not create — try again'); }
        }}
      />
    </View>
  );
}

function CreateGroupSheet({
  visible, sports, onClose, onCreate, c,
}: {
  visible: boolean;
  sports: Sport[];
  onClose: () => void;
  onCreate: (form: { sport: string; name: string; emoji: string | null; color: string; logoUri: string | null; description: string | null; practiceDays: string | null; practiceTime: string | null; practiceDuration: string | null; practiceLocation: string | null }) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [sport, setSport] = useState(sports[0]?.key ?? SPORTS[0].key);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [days, setDays] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  // Keep the picked sport valid as the available list changes.
  const sportValid = sports.some((s) => s.key === sport);
  const pickedSport = sportValid ? sport : sports[0]?.key ?? sport;

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const lbl = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setLogoUri(result.assets[0].uri);
  };

  const submit = () => {
    if (!name.trim()) return;
    setBusy(true);
    onCreate({
      sport: pickedSport, name, emoji: emoji.trim() || null, color, logoUri,
      description: description || null, practiceDays: days || null, practiceTime: time || null,
      practiceDuration: duration || null, practiceLocation: location || null,
    });
    setBusy(false);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Add a sport" footer={<Button label={busy ? 'Creating…' : 'Create group'} loading={busy} fullWidth disabled={!name.trim()} onPress={submit} />}>
      <Text className={lbl}>Sport</Text>
      <View className="mb-4 flex-row flex-wrap" style={{ gap: 8 }}>
        {sports.map((s) => (
          <Pressable key={s.key} onPress={() => setSport(s.key)} className={`flex-row items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 ${pickedSport === s.key ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}>
            <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
            <Text className="font-sans-sb text-[13px] text-ink">{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className={lbl}>Group / team name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Morning Smashers" placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as any} />

      <Text className={lbl}>Logo (optional)</Text>
      <View className="mb-4 flex-row items-center gap-3">
        <Pressable onPress={pickLogo} className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-inset active:opacity-80">
          {logoUri ? <Image source={{ uri: logoUri }} style={{ width: 64, height: 64 }} contentFit="cover" /> : <Ionicons name="camera-outline" size={22} color={c.faint} />}
        </Pressable>
        <Text className="flex-1 text-[12px] text-muted">Upload a team photo or logo, or just use the emoji badge below.</Text>
        {logoUri ? <Pressable onPress={() => setLogoUri(null)} hitSlop={8}><Ionicons name="close-circle" size={20} color={c.faint} /></Pressable> : null}
      </View>

      <Text className={lbl}>Emoji badge</Text>
      <View className="mb-4 flex-row items-center gap-3">
        <TextInput value={emoji} onChangeText={setEmoji} placeholder={getSport(pickedSport)?.emoji ?? '🏅'} placeholderTextColor={c.faint} maxLength={2} className={input} style={{ width: 64, textAlign: 'center', outline: 'none' } as any} />
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
