import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { BLOOD_GROUPS, HELPER_SKILLS, RegistryPerson, fetchRegistry, updateHelperProfile } from '../lib/donors';
import { useThemeColors } from '../theme';

const ACCENT = '#DC2626';
function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }
function wa(phone: string | null | undefined, msg: string) { const d = (phone ?? '').replace(/\D/g, ''); return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(msg)}`; }

export default function HelpersScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const { userId, profile, communityId, refreshProfile } = useAuth();

  const [people, setPeople] = useState<RegistryPerson[]>([]);
  const [bloodFilter, setBloodFilter] = useState<string>('all');

  // opt-in form
  const [bg, setBg] = useState<string | null>(profile?.blood_group ?? null);
  const [donor, setDonor] = useState<boolean>(profile?.donor_available ?? false);
  const [skills, setSkills] = useState<string[]>(profile?.helper_skills ?? []);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setPeople(await fetchRegistry(communityId)); } catch { /* keep */ }
  }, [communityId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await updateHelperProfile(userId, { blood_group: bg, donor_available: donor, helper_skills: skills });
      await refreshProfile();
      await load();
      toast.show('Saved — thank you for helping 🙏');
    } catch { toast.show('Could not save'); } finally { setSaving(false); }
  };

  const toggleSkill = (s: string) => setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const donors = people.filter((p) => p.donor_available && p.blood_group && (bloodFilter === 'all' || p.blood_group === bloodFilter));
  const helpers = people.filter((p) => (p.helper_skills?.length ?? 0) > 0);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="heart-outline" iconColor={ACCENT} title="Blood & emergency help" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Opt-in */}
          <View className="rounded-2xl border p-4" style={{ borderColor: ACCENT + '40', backgroundColor: ACCENT + '0C' }}>
            <Text className="font-sans-bold text-[15px] text-ink">Join the registry</Text>
            <Text className="mb-3 mt-0.5 text-[12.5px] leading-[18px] text-muted">Opt in so neighbours can reach you fast in an emergency. You're only listed if you choose to be.</Text>

            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Your blood group</Text>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {BLOOD_GROUPS.map((g) => {
                const on = bg === g;
                return <Pressable key={g} onPress={() => setBg(on ? null : g)} className="rounded-xl border px-3 py-1.5" style={{ borderColor: on ? ACCENT : c.line, backgroundColor: on ? ACCENT : c.surface }}><Text className="text-[13px] font-sans-bold" style={{ color: on ? '#fff' : c.muted }}>{g}</Text></Pressable>;
              })}
            </View>

            <Pressable onPress={() => setDonor((d) => !d)} className="mb-3 flex-row items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
              <Ionicons name={donor ? 'water' : 'water-outline'} size={18} color={donor ? ACCENT : c.muted} />
              <Text className="flex-1 font-sans-sb text-[14px] text-ink">Available to donate blood</Text>
              <View className={`h-6 w-10 rounded-full p-0.5`} style={{ backgroundColor: donor ? ACCENT : c.line }}><View className={`h-5 w-5 rounded-full bg-white ${donor ? 'self-end' : 'self-start'}`} /></View>
            </Pressable>

            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">I can also help with</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {HELPER_SKILLS.map((s) => {
                const on = skills.includes(s);
                return <Pressable key={s} onPress={() => toggleSkill(s)} className="rounded-full border px-3 py-1.5" style={{ borderColor: on ? ACCENT : c.line, backgroundColor: on ? ACCENT + '14' : c.surface }}><Text className="text-[12px] font-sans-sb" style={{ color: on ? ACCENT : c.muted }}>{s}</Text></Pressable>;
              })}
            </View>
            <Button label="Save my details" icon="checkmark" fullWidth loading={saving} onPress={save} />
          </View>

          {/* Donors */}
          <View className="mt-6 flex-row items-center gap-2">
            <Ionicons name="water" size={16} color={ACCENT} />
            <Text className="font-display-x text-[17px] text-ink">Blood donors</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
            {(['all', ...BLOOD_GROUPS]).map((g) => (
              <Pressable key={g} onPress={() => setBloodFilter(g)} className="rounded-full px-3 py-1.5" style={{ backgroundColor: bloodFilter === g ? ACCENT : c.inset }}>
                <Text className="text-[12px] font-sans-bold" style={{ color: bloodFilter === g ? '#fff' : c.muted }}>{g === 'all' ? 'All' : g}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {donors.length === 0 ? (
            <Text className="px-1 py-3 text-[13px] text-muted">{bloodFilter === 'all' ? 'No donors have opted in yet — be the first.' : `No ${bloodFilter} donors listed yet.`}</Text>
          ) : (
            <View className="gap-2">
              {donors.map((p) => <PersonRow key={p.id} p={p} badge={p.blood_group!} c={c} />)}
            </View>
          )}

          {/* Emergency helpers */}
          {helpers.length > 0 ? (
            <>
              <View className="mt-6 flex-row items-center gap-2">
                <Ionicons name="medkit" size={16} color={ACCENT} />
                <Text className="font-display-x text-[17px] text-ink">Emergency helpers</Text>
              </View>
              <View className="mt-2 gap-2">
                {helpers.map((p) => (
                  <View key={p.id} className="rounded-2xl border border-line bg-surface p-3.5">
                    <PersonRow p={p} c={c} inline />
                    <View className="mt-2 flex-row flex-wrap gap-1.5">
                      {p.helper_skills.map((s) => <View key={s} className="rounded-full bg-inset px-2 py-0.5"><Text className="text-[11px] text-muted">{s}</Text></View>)}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text className="mt-6 text-center text-[11px] leading-[16px] text-faint">In a real emergency, also call official services (112). This registry is a convenience, not a substitute.</Text>
        </Container>
      </ScrollView>
    </View>
  );
}

function PersonRow({ p, badge, c, inline }: { p: RegistryPerson; badge?: string; c: ReturnType<typeof useThemeColors>; inline?: boolean }) {
  const phone = p.whatsapp ?? p.phone;
  return (
    <View className={inline ? 'flex-row items-center gap-2.5' : 'flex-row items-center gap-2.5 rounded-2xl border border-line bg-surface p-3'}>
      <Avatar name={p.name} size={36} />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-sans-bold text-[14px] text-ink">{p.name}</Text>
          {badge ? <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ACCENT + '18' }}><Text className="text-[11px] font-sans-bold" style={{ color: ACCENT }}>{badge}</Text></View> : null}
        </View>
        {p.flat ? <Text className="text-[12px] text-muted">Flat {p.flat}</Text> : null}
      </View>
      {phone ? (
        <>
          <Pressable onPress={() => openUrl(wa(phone, 'Hi, reaching out via the Aangan emergency registry.'))} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: '#25D36618' }}><Ionicons name="logo-whatsapp" size={17} color="#25D366" /></Pressable>
          <Pressable onPress={() => openUrl(`tel:${phone}`)} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: c.inset }}><Ionicons name="call" size={16} color={c.muted} /></Pressable>
        </>
      ) : null}
    </View>
  );
}
