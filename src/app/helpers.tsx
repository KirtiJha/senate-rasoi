import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MessageIconButton } from '../components/MessageNeighbour';
import { Avatar, Button, Chip, Container, ErrorState, ScreenHeader, Sheet, Stepper } from '../components/ui';
import { useAuth } from '../context/auth';
import { useConfirm } from '../context/confirm';
import { useToast } from '../context/toast';
import {
  BloodOffer, BloodRequest, BloodUrgency, URGENCY_LABELS, canDonateTo, closeRequest, createRequest,
  donorRest, fetchOffers, fetchOpenRequests, offerToDonate, subscribeBlood, withdrawOffer,
} from '../lib/blood';
import { BLOOD_GROUPS, HELPER_SKILLS, RegistryPerson, fetchRegistry, updateHelperProfile } from '../lib/donors';
import { timeAgo } from '../lib/time';
import { useThemeColors } from '../theme';

function openUrl(u: string) { if (Platform.OS === 'web') window.open(u, '_blank'); else Linking.openURL(u); }
function wa(phone: string | null | undefined, msg: string) { const d = (phone ?? '').replace(/\D/g, ''); return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(msg)}`; }

export default function HelpersScreen() {
  const c = useThemeColors();
  const ACCENT = c.accent;
  const toast = useToast();
  const { userId, profile, communityId, refreshProfile } = useAuth();

  const confirm = useConfirm();

  const [people, setPeople] = useState<RegistryPerson[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [bloodFilter, setBloodFilter] = useState<string>('all');

  // Live blood requests, and who has offered on each.
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [offers, setOffers] = useState<Map<string, BloodOffer[]>>(new Map());
  const [showAsk, setShowAsk] = useState(false);

  // opt-in form
  const [bg, setBg] = useState<string | null>(profile?.blood_group ?? null);
  const [donor, setDonor] = useState<boolean>(profile?.donor_available ?? false);
  const [skills, setSkills] = useState<string[]>(profile?.helper_skills ?? []);
  const [lastDonated, setLastDonated] = useState<string>(profile?.donor_last_donated ?? '');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setPeople(await fetchRegistry(communityId));
      setLoadFailed(false);
    } catch (e) {
      console.error('helpers: registry load failed', e);
      setLoadFailed(true);
    }
    try {
      const rs = await fetchOpenRequests(communityId);
      setRequests(rs);
      setOffers(await fetchOffers(rs.map((r) => r.id)));
    } catch { /* the registry is still worth showing without them */ }
  }, [communityId]);

  const retry = useCallback(async () => {
    setReloading(true);
    await load();
    setReloading(false);
  }, [load]);

  useFocusEffect(useCallback(() => {
    load();
    return subscribeBlood(communityId, load);
  }, [load, communityId]));

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await updateHelperProfile(userId, {
        blood_group: bg,
        donor_available: donor,
        helper_skills: skills,
        donor_last_donated: /^\d{4}-\d{2}-\d{2}$/.test(lastDonated) ? lastDonated : null,
      });
      await refreshProfile();
      await load();
      toast.show('Saved — thank you for helping 🙏');
    } catch { toast.show('Could not save'); } finally { setSaving(false); }
  };

  const onOffer = async (r: BloodRequest) => {
    if (!userId) return;
    try {
      await offerToDonate(r.id, userId, null);
      toast.show(`${r.requester?.name ?? 'They'} has been told — thank you 🙏`);
      await load();
    } catch { toast.show('Could not send — try again'); }
  };

  const onWithdrawOffer = async (r: BloodRequest) => {
    if (!userId) return;
    if (!(await confirm({
      title: 'Take back your offer?',
      message: 'They will no longer be counting on you for this.',
      confirmLabel: 'Take it back',
      destructive: true,
    }))) return;
    try { await withdrawOffer(r.id, userId); await load(); }
    catch { toast.show('Could not update'); }
  };

  const onClose = async (r: BloodRequest, status: 'fulfilled' | 'cancelled') => {
    const mine = offers.get(r.id)?.length ?? 0;
    if (!(await confirm({
      title: status === 'fulfilled' ? 'Mark as sorted?' : 'Cancel this request?',
      message: mine > 0
        ? `${mine === 1 ? 'The neighbour who offered' : `All ${mine} neighbours who offered`} will be told.`
        : 'Nobody has offered yet.',
      confirmLabel: status === 'fulfilled' ? 'Got the blood' : 'Cancel request',
      destructive: status === 'cancelled',
    }))) return;
    try { await closeRequest(r.id, status); await load(); toast.show(status === 'fulfilled' ? 'Closed — glad it worked out' : 'Request cancelled'); }
    catch { toast.show('Could not update'); }
  };

  const toggleSkill = (s: string) => setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const donors = people.filter((p) => p.donor_available && p.blood_group && (bloodFilter === 'all' || p.blood_group === bloodFilter));
  const helpers = people.filter((p) => (p.helper_skills?.length ?? 0) > 0);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="heart-outline" title="Blood & emergency help" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* The ask.

              This tile was named "Blood & SOS" and had no SOS in it: a list to
              scroll and numbers to ring, one at a time, at two in the morning.
              Every donor who can actually give to the patient is now reached
              at once — the compatible groups, not just the exact one, so a
              request for AB+ wakes everybody and a request for B− wakes the
              B− and O− donors who can answer it. */}
          <Pressable
            onPress={() => setShowAsk(true)}
            accessibilityRole="button"
            accessibilityLabel="Ask the society for blood"
            className="mb-5 flex-row items-center gap-3 rounded-2xl px-4 py-3.5 active:opacity-90"
            style={{ backgroundColor: '#B3261E' }}
          >
            <Ionicons name="water" size={20} color="#fff" />
            <View className="flex-1">
              <Text className="font-sans-bold text-[15px] text-white">Ask the society for blood</Text>
              <Text className="font-sans text-[12px]" style={{ color: '#FFE3E0' }}>
                Everyone who can give to that group is told straight away
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#FFE3E0" />
          </Pressable>

          {requests.length > 0 ? (
            <View className="mb-5 gap-2.5">
              {requests.map((r) => (
                <RequestCard
                  key={r.id}
                  r={r}
                  offers={offers.get(r.id) ?? []}
                  mine={r.requester_id === userId}
                  myGroup={profile?.blood_group ?? null}
                  iOffered={(offers.get(r.id) ?? []).some((o) => o.donor_id === userId)}
                  c={c}
                  onOffer={() => onOffer(r)}
                  onWithdraw={() => onWithdrawOffer(r)}
                  onClose={(s) => onClose(r, s)}
                />
              ))}
            </View>
          ) : null}

          {/* Opt-in */}
          <View className="rounded-2xl border p-4" style={{ borderColor: ACCENT + '40', backgroundColor: ACCENT + '0C' }}>
            <Text className="font-sans-bold text-[15px] text-ink">Join the registry</Text>
            <Text className="font-sans mb-3 mt-0.5 text-[12px] leading-[18px] text-muted">Opt in so neighbours can reach you fast in an emergency. You're only listed if you choose to be.</Text>

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
              <View className={`h-6 w-10 rounded-full p-0.5`} style={{ backgroundColor: donor ? ACCENT : c.line }}><View className={`h-5 w-5 rounded-full bg-surface ${donor ? 'self-end' : 'self-start'}`} /></View>
            </Pressable>

            {/* Whole blood takes about three months to replace. Without this
                a donor who gave last week sits in the list looking exactly as
                available as one who is ready, and gets called first. */}
            {donor ? (
              <View className="mb-3">
                <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Last donated (optional)</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={lastDonated}
                    onChangeText={setLastDonated}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={c.faint}
                    className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink"
                    style={{ outline: 'none' } as never}
                  />
                  {lastDonated ? (
                    <Pressable onPress={() => setLastDonated('')} hitSlop={8} className="px-2 py-1 active:opacity-60">
                      <Text className="text-[12px] font-sans-sb text-muted">Clear</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text className="font-sans mt-1 text-[11px] text-faint">
                  {donorRest(lastDonated)?.label ?? 'Shown to neighbours as resting until about 90 days have passed.'}
                </Text>
              </View>
            ) : null}

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
              <Chip
                  key={g}
                  label={g === 'all' ? 'All' : g}
                  selected={bloodFilter === g}
                  onPress={() => setBloodFilter(g)}
                />
            ))}
          </ScrollView>
          {loadFailed ? (
            <ErrorState
              compact
              title="Couldn't load the registry"
              message="This list needs a connection. Nobody has been removed — try again."
              onRetry={retry}
              retrying={reloading}
            />
          ) : donors.length === 0 ? (
            <Text className="font-sans px-1 py-3 text-[13px] text-muted">{bloodFilter === 'all' ? 'No donors have opted in yet — be the first.' : `No ${bloodFilter} donors listed yet.`}</Text>
          ) : (
            <View className="gap-2">
              {donors.map((p) => <PersonRow key={p.id} p={p} badge={p.blood_group!} c={c} />)}
            </View>
          )}

          {/* Emergency helpers */}
          {!loadFailed && helpers.length > 0 ? (
            <>
              <View className="mt-6 flex-row items-center gap-2">
                <Ionicons name="medkit" size={16} color={ACCENT} />
                <Text className="font-display-x text-[17px] text-ink">Emergency helpers</Text>
              </View>
              <View className="mt-2 gap-2">
                {helpers.map((p) => (
                  <View key={p.id} className="card p-3.5">
                    <PersonRow p={p} c={c} inline />
                    <View className="mt-2 flex-row flex-wrap gap-1.5">
                      {p.helper_skills.map((s) => <View key={s} className="rounded-full bg-inset px-2 py-0.5"><Text className="font-sans text-[11px] text-muted">{s}</Text></View>)}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text className="font-sans mt-6 text-center text-[11px] leading-[16px] text-faint">In a real emergency, also call official services (112). This registry is a convenience, not a substitute.</Text>
        </Container>
      </ScrollView>

      <AskSheet
        visible={showAsk}
        c={c}
        onClose={() => setShowAsk(false)}
        onSubmit={async (f) => {
          if (!userId || !communityId) return;
          setShowAsk(false);
          try {
            await createRequest({ communityId, requesterId: userId, ...f });
            await load();
            toast.show('Sent to every matching donor');
          } catch { toast.show('Could not send — try again'); }
        }}
      />
    </View>
  );
}

/** One live request: what is needed, who has offered, and the way to answer. */
function RequestCard({
  r, offers, mine, myGroup, iOffered, c, onOffer, onWithdraw, onClose,
}: {
  r: BloodRequest;
  offers: BloodOffer[];
  mine: boolean;
  myGroup: string | null;
  iOffered: boolean;
  c: ReturnType<typeof useThemeColors>;
  onOffer: () => void;
  onWithdraw: () => void;
  onClose: (s: 'fulfilled' | 'cancelled') => void;
}) {
  const urgent = r.urgency === 'now';
  const canGive = canDonateTo(myGroup, r.blood_group);
  const phone = r.requester?.whatsapp ?? r.requester?.phone ?? null;

  return (
    <View className="rounded-2xl border p-3.5" style={{ borderColor: urgent ? '#B3261E55' : c.line, backgroundColor: urgent ? '#B3261E0C' : c.surface }}>
      <View className="flex-row items-center gap-2">
        <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: '#B3261E18' }}>
          <Text className="font-sans-bold text-[13px]" style={{ color: '#B3261E' }}>{r.blood_group}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>
            {r.blood_group} needed{r.units ? ` · ${r.units} ${r.units === 1 ? 'unit' : 'units'}` : ''}
          </Text>
          <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>
            {mine ? 'You asked' : r.requester?.name ?? 'A neighbour'}
            {r.requester?.flat && !mine ? ` · Flat ${r.requester.flat}` : ''} · {timeAgo(r.created_at)}
          </Text>
        </View>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: urgent ? '#B3261E' : c.inset }}>
          <Text className="text-[10px] font-sans-sb" style={{ color: urgent ? '#fff' : c.muted }}>{URGENCY_LABELS[r.urgency]}</Text>
        </View>
      </View>

      {r.hospital ? <Text className="font-sans mt-2 text-[13px] text-ink">🏥 {r.hospital}</Text> : null}
      {r.note ? <Text className="font-sans mt-0.5 text-[12.5px] leading-[18px] text-muted">{r.note}</Text> : null}

      {mine ? (
        <>
          {offers.length ? (
            <View className="mt-2.5 gap-1.5">
              <Text className="text-[11px] font-sans-sb uppercase tracking-wider text-muted">
                {offers.length} {offers.length === 1 ? 'neighbour can help' : 'neighbours can help'}
              </Text>
              {offers.map((o) => {
                const p = o.donor?.whatsapp ?? o.donor?.phone ?? null;
                return (
                  <View key={o.id} className="flex-row items-center gap-2.5 rounded-xl bg-inset px-3 py-2">
                    <Avatar name={o.donor?.name ?? '?'} size={28} />
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans-sb text-[13px] text-ink" numberOfLines={1}>{o.donor?.name ?? 'A neighbour'}</Text>
                      {o.donor?.flat ? <Text className="font-sans text-[11px] text-faint">Flat {o.donor.flat}</Text> : null}
                    </View>
                    {p ? (
                      <>
                        <Pressable accessibilityRole="button" accessibilityLabel="Call" onPress={() => openUrl(`tel:${p}`)} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: c.surface }}>
                          <Ionicons name="call" size={15} color={c.accent} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="Open WhatsApp" onPress={() => openUrl(wa(p, `Hi ${o.donor?.name ?? ''}, about the ${r.blood_group} blood request on Aangan — thank you!`))} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: '#25D36618' }}>
                          <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
                        </Pressable>
                      </>
                    ) : <MessageIconButton userId={o.donor_id} label="Message" />}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="font-sans mt-2 text-[12px] text-muted">No offers yet — everyone who can give has been told.</Text>
          )}
          <View className="mt-2.5 flex-row gap-2">
            <Pressable onPress={() => onClose('fulfilled')} className="flex-1 items-center rounded-xl py-2.5" style={{ backgroundColor: c.accent }}>
              <Text className="text-[12.5px] font-sans-sb" style={{ color: c.onAccent }}>Got the blood</Text>
            </Pressable>
            <Pressable onPress={() => onClose('cancelled')} className="flex-1 items-center rounded-xl py-2.5" style={{ backgroundColor: c.inset }}>
              <Text className="text-[12.5px] font-sans-sb text-muted">No longer needed</Text>
            </Pressable>
          </View>
        </>
      ) : iOffered ? (
        <View className="mt-2.5 flex-row items-center gap-2 rounded-xl bg-inset px-3 py-2.5">
          <Ionicons name="checkmark-circle" size={16} color={c.accent} />
          <Text className="flex-1 font-sans-sb text-[12.5px] text-ink">You have offered — they have your number</Text>
          <Pressable onPress={onWithdraw} hitSlop={6} className="px-2 py-1 active:opacity-60">
            <Text className="text-[12px] font-sans-sb text-muted">Undo</Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-2.5 gap-2">
          {canGive ? (
            <Pressable onPress={onOffer} className="items-center rounded-xl py-2.5 active:opacity-90" style={{ backgroundColor: '#B3261E' }}>
              <Text className="text-[13px] font-sans-sb text-white">I can give — tell them now</Text>
            </Pressable>
          ) : (
            <Text className="font-sans text-[12px] text-muted">
              {myGroup
                ? `Your group (${myGroup}) cannot be given to ${r.blood_group}. Please pass this on to someone who can.`
                : 'Add your blood group above and you will be told the next time it matches.'}
            </Text>
          )}
          {phone ? (
            <Pressable onPress={() => openUrl(`tel:${phone}`)} className="items-center rounded-xl border border-line py-2.5 active:opacity-80">
              <Text className="text-[12.5px] font-sans-sb text-ink">Call {r.requester?.name ?? 'them'}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Asking. Deliberately short: this gets filled in a hospital corridor. */
function AskSheet({
  visible, onClose, onSubmit, c,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (f: { bloodGroup: string; units: number | null; hospital: string | null; note: string | null; urgency: BloodUrgency }) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [group, setGroup] = useState<string | null>(null);
  const [units, setUnits] = useState(1);
  const [hospital, setHospital] = useState('');
  const [note, setNote] = useState('');
  const [urgency, setUrgency] = useState<BloodUrgency>('now');

  const input = 'rounded-xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const lbl = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Ask for blood"
      footer={(
        <Button
          label="Tell every matching donor"
          icon="water"
          fullWidth
          disabled={!group}
          onPress={() => group && onSubmit({
            bloodGroup: group,
            units,
            hospital: hospital.trim() || null,
            note: note.trim() || null,
            urgency,
          })}
        />
      )}
    >
      <Text className="font-sans mb-3 text-[12.5px] leading-[18px] text-muted">
        This reaches every neighbour whose blood can be given to this group — not only the same
        group — as a notification they cannot have switched off.
      </Text>

      <Text className={lbl}>Blood group needed</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {BLOOD_GROUPS.map((g) => {
          const on = group === g;
          return (
            <Pressable key={g} onPress={() => setGroup(g)} className="rounded-xl border px-3.5 py-2"
              style={{ borderColor: on ? '#B3261E' : c.line, backgroundColor: on ? '#B3261E' : c.surface }}>
              <Text className="text-[13.5px] font-sans-bold" style={{ color: on ? '#fff' : c.muted }}>{g}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className={lbl}>How soon</Text>
      <View className="mb-4 flex-row gap-2">
        {(['now', 'today', 'days'] as BloodUrgency[]).map((u) => {
          const on = urgency === u;
          return (
            <Pressable key={u} onPress={() => setUrgency(u)} className="flex-1 items-center rounded-xl border py-2"
              style={{ borderColor: on ? '#B3261E' : c.line, backgroundColor: on ? '#B3261E14' : c.surface }}>
              <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#B3261E' : c.muted }}>{URGENCY_LABELS[u]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className={lbl}>Units</Text>
      <View className="mb-4"><Stepper value={units} min={1} max={20} onChange={setUnits} /></View>

      <Text className={lbl}>Hospital</Text>
      <TextInput value={hospital} onChangeText={setHospital} placeholder="e.g. Manipal, Whitefield"
        placeholderTextColor={c.faint} className={`mb-4 ${input}`} style={{ outline: 'none' } as never} />

      <Text className={lbl}>Anything else</Text>
      <TextInput value={note} onChangeText={setNote} multiline placeholder="Patient name, ward, who to ask for…"
        placeholderTextColor={c.faint} className={`mb-2 ${input}`} style={{ minHeight: 64, outline: 'none' } as never} />
    </Sheet>
  );
}

function PersonRow({ p, badge, c, inline }: { p: RegistryPerson; badge?: string; c: ReturnType<typeof useThemeColors>; inline?: boolean }) {
  const phone = p.whatsapp ?? p.phone;
  return (
    <View className={inline ? 'flex-row items-center gap-2.5' : 'flex-row items-center gap-2.5 card p-3'}>
      <Avatar name={p.name} size={36} />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-sans-bold text-[14px] text-ink">{p.name}</Text>
          {badge ? <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.accent + '18' }}><Text className="text-[11px] font-sans-bold" style={{ color: c.accent }}>{badge}</Text></View> : null}
        </View>
        {/* A donor who gave three weeks ago cannot give again yet. Listing
            them identically to someone ready sends the first call to the one
            person who has to say no. */}
        {(() => {
          const rest = donorRest(p.donor_last_donated);
          return (
            <Text className="font-sans text-[12px]" style={{ color: rest?.resting ? c.highlightInk : c.muted }}>
              {[p.flat ? `Flat ${p.flat}` : null, rest?.resting ? rest.label : null].filter(Boolean).join(' · ') || 'Neighbour'}
            </Text>
          );
        })()}
      </View>
      {phone ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Open WhatsApp" onPress={() => openUrl(wa(phone, 'Hi, reaching out via the Aangan emergency registry.'))} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: '#25D36618' }}><Ionicons name="logo-whatsapp" size={17} color="#25D366" /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Call" onPress={() => openUrl(`tel:${phone}`)} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: c.inset }}><Ionicons name="call" size={16} color={c.muted} /></Pressable>
        </>
      ) : (
        /* Only when there is no number. A blood donor or a first-aider who
           volunteered without one had no contact control at all — they were
           listed as reachable and were not. In an actual emergency a call
           beats a chat, so this does not compete with the two above. */
        <MessageIconButton userId={p.id} label={`Message ${p.name}`} />
      )}
    </View>
  );
}
