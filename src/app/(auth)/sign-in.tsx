import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { DiversityEmblem } from '../../components/Brand';
import { Field } from '../../components/forms';
import { Button, Container, KeyboardAvoider, PinInput, Segmented, useKeyboardInset } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { selfResetPin, signIn, signUp } from '../../lib/auth';
import { Community, fetchCommunities, fetchCommunityById, submitJoinRequest } from '../../lib/communities';
import { DirectoryEntry, PhoneDirectoryMatch, findDirectoryByPhone, findRosterMatch, reconcileDirectoryEntry } from '../../lib/directory';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';

const MODES = [
  { key: 'in', label: 'Sign in' },
  { key: 'up', label: 'Create account' },
] as const;

export default function SignInScreen() {
  const toast = useToast();
  const c = useThemeColors();
  const router = useRouter();
  const { refreshProfile } = useAuth();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [block, setBlock] = useState('');
  const [flat, setFlat] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [upi, setUpi] = useState('');
  const [residentType, setResidentType] = useState<'owner' | 'tenant' | null>(null);
  const [movedIn, setMovedIn] = useState(false);
  const [profession, setProfession] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [reconcile, setReconcile] = useState<DirectoryEntry | null>(null);
  const [phoneMatch, setPhoneMatch] = useState<PhoneDirectoryMatch | null>(null);
  const phoneMatchDismissed = useRef(false);

  // Sign-in failures were reported only through the toast: a message that
  // appears 96px off the bottom for 2.8s and then erases itself. If it is
  // missed — covered by the keyboard, glanced away from, or simply too brief —
  // a wrong PIN and a dropped request are indistinguishable from a button that
  // does nothing. A form error belongs on the form, where it stays until the
  // next attempt.
  const [error, setError] = useState<string | null>(null);

  /** Report a failure both ways: transient toast, persistent inline text. */
  const fail = (msg: string) => {
    setError(msg);
    toast.show(msg);
  };

  // Forgot PIN flow
  const [showForgotPin, setShowForgotPin] = useState(false);
  const pinKb = useKeyboardInset();
  const [resetPhone, setResetPhone] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Society picker
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  // From the onboarding flow: a brand-new society to create (founder = admin).
  const [newCommunity, setNewCommunity] = useState<{ name: string; address: string; lat?: number | null; lon?: number | null; osmPlaceId?: string | null; city?: string | null } | null>(null);
  const params = useLocalSearchParams<{ communityId?: string; onboard?: string }>();
  const [showPicker, setShowPicker] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const [jrSocietyName, setJrSocietyName] = useState('');
  const [jrSocietyAddress, setJrSocietyAddress] = useState('');
  const [jrSubmitting, setJrSubmitting] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchCommunities().then(setCommunities).catch(() => {});
    }
  }, []);

  // Coming from /onboard — preselect an existing society, or queue a new one.
  useEffect(() => {
    if (params.onboard) {
      try { setNewCommunity(JSON.parse(params.onboard)); setMode('up'); } catch { /* ignore */ }
    } else if (params.communityId) {
      setMode('up');
      fetchCommunityById(params.communityId).then((comm) => { if (comm) setSelectedCommunity(comm); }).catch(() => {});
    }
  }, [params.onboard, params.communityId]);

  // Debounced phone → directory lookup (signup mode only, anon-safe RPC)
  useEffect(() => {
    if (mode !== 'up') { setPhoneMatch(null); return; }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setPhoneMatch(null); phoneMatchDismissed.current = false; return; }
    if (phoneMatchDismissed.current) return;
    const timer = setTimeout(async () => {
      const match = await findDirectoryByPhone(phone).catch(() => null);
      if (!phoneMatchDismissed.current) setPhoneMatch(match);
    }, 450);
    return () => clearTimeout(timer);
  }, [phone, mode]);

  const applyPhoneMatch = async () => {
    if (!phoneMatch) return;
    setName(phoneMatch.name);
    setBlock(phoneMatch.block ?? '');
    setFlat(phoneMatch.flat ?? '');
    if (phoneMatch.residentType) setResidentType(phoneMatch.residentType);
    if (phoneMatch.profession) setProfession(phoneMatch.profession);
    if (phoneMatch.vehicleNo) setVehicleNo(phoneMatch.vehicleNo);
    if (!selectedCommunity || selectedCommunity.id !== phoneMatch.communityId) {
      const comm = await fetchCommunityById(phoneMatch.communityId).catch(() => null);
      if (comm) setSelectedCommunity(comm);
    }
    phoneMatchDismissed.current = true;
    setPhoneMatch(null);
  };

  const dismissPhoneMatch = () => {
    phoneMatchDismissed.current = true;
    setPhoneMatch(null);
  };

  // Number already has an account → switch to sign-in (keep the phone they typed).
  const goSignInWithPhone = () => {
    phoneMatchDismissed.current = true;
    setPhoneMatch(null);
    setMode('in');
  };

  const openForgotPin = () => {
    setResetPhone(phone);
    setResetNewPin('');
    setResetConfirmPin('');
    setResetDone(false);
    setShowForgotPin(true);
  };

  const submitReset = async () => {
    if (resetPhone.replace(/\D/g, '').length < 10) { toast.show('Enter a valid phone number'); return; }
    if (!/^\d{6}$/.test(resetNewPin)) { toast.show('New PIN must be exactly 6 digits'); return; }
    if (resetNewPin !== resetConfirmPin) { toast.show('PINs do not match'); return; }
    setResetBusy(true);
    try {
      const ok = await selfResetPin(resetPhone, resetNewPin);
      if (!ok) {
        toast.show('No account found with that number');
      } else {
        setResetDone(true);
        // Pre-fill the sign-in code field with the new PIN for convenience.
        setCode(resetNewPin);
      }
    } catch {
      toast.show('Could not reset — try again');
    } finally {
      setResetBusy(false);
    }
  };

  const filteredCommunities = communities.filter(
    (comm: Community) =>
      comm.name.toLowerCase().includes(communitySearch.toLowerCase()) ||
      (comm.address ?? '').toLowerCase().includes(communitySearch.toLowerCase())
  );

  const submit = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      fail("Supabase isn't configured yet ⚙️");
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return fail('Enter a valid phone number');
    if (!/^\d{6}$/.test(code)) return fail('Your code must be exactly 6 digits');

    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(phone, code);
      } else {
        if (phoneMatch?.alreadyOnboarded) {
          setBusy(false); setMode('in');
          return toast.show('This number already has an account — please sign in.');
        }
        if (!name.trim()) { setBusy(false); return toast.show('Please enter your name'); }
        if (!newCommunity && !selectedCommunity) { setBusy(false); return toast.show('Please select your society'); }
        const profile = await signUp({
          phone, code, name, flat, whatsapp, upi, roles: ['foodie'],
          communityId: newCommunity ? undefined : selectedCommunity!.id,
          newCommunity: newCommunity ?? undefined,
          residentType, profession, vehicleNo,
          block: block.trim() || undefined, movedIn,
        });
        // If a roster entry already exists for this flat under a different number,
        // offer to merge before finishing (keeps the directory free of duplicates).
        if (profile.community_id) {
          const m = await findRosterMatch(profile.community_id, name, block.trim().toUpperCase() || null, flat.trim() || null, phone).catch(() => null);
          if (m) { setReconcile(m); setBusy(false); return; }
        }
      }
      await refreshProfile();
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const finishReconcile = async (action: 'keep' | 'replace' | 'skip') => {
    const entry = reconcile;
    setReconcile(null);
    if (entry && action !== 'skip') {
      try { await reconcileDirectoryEntry(entry.id, action === 'keep'); } catch { /* best-effort */ }
    }
    await refreshProfile();
  };

  const submitJoinReq = async () => {
    if (!jrSocietyName.trim() || !jrSocietyAddress.trim()) {
      return toast.show('Please fill society name and address');
    }
    if (!name.trim() || !phone.trim()) {
      return toast.show('Please fill your name and phone first');
    }
    setJrSubmitting(true);
    try {
      await submitJoinRequest({
        societyName: jrSocietyName,
        societyAddress: jrSocietyAddress,
        requesterName: name,
        requesterPhone: phone,
      });
      setShowJoinRequest(false);
      toast.show("Request submitted! We'll add your society soon 🏘️");
    } catch {
      toast.show('Could not submit — try again');
    } finally {
      setJrSubmitting(false);
    }
  };

  return (
    <KeyboardAvoider>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <Container narrow>
          {/* The old header stacked a full brand lockup, a tagline, an emoji
              and two lines of instructions above the first field — most of a
              phone screen spent before anything could be typed. The emblem
              says which app this is; one line says what to do. */}
          <View className="mb-6 items-center">
            <DiversityEmblem size={64} />
            <Text className="font-display-x mt-3 text-center text-[26px] leading-[32px] text-ink">
              {mode === 'in' ? 'Welcome back' : 'Join your society'}
            </Text>
            <Text className="font-sans-md mt-1.5 max-w-[290px] text-center text-[13.5px] leading-[19px] text-subtle">
              {mode === 'in'
                ? 'Your phone number and the 6-digit code you chose.'
                : 'Pick a 6-digit code — it is how you sign in. No SMS, no OTP.'}
            </Text>
          </View>

          {/* Was a fourth kind of segmented control in this app. Uses the one now. */}
          <View className="mb-6">
            <Segmented items={MODES} value={mode} onChange={setMode} />
          </View>

          <Field label="Phone number" required placeholder="98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <View className="mb-4">
            <Text className="mb-2 text-[13px] font-sans-sb text-ink">
              6-digit code <Text style={{ color: c.danger }}>*</Text>
            </Text>
            <PinInput value={code} onChange={setCode} accessibilityLabel="Six digit code" />
            {mode === 'up' ? (
              <Text className="font-sans mt-2 text-[12px] leading-[17px] text-subtle">
                Choose any six digits. This is your PIN — you will use it to sign in.
              </Text>
            ) : null}
          </View>
          {mode === 'in' ? (
            <Pressable onPress={openForgotPin} hitSlop={8} className="-mt-1 mb-3 self-end active:opacity-60">
              <Text className="text-[12px] font-sans-sb text-accent">Forgot PIN?</Text>
            </Pressable>
          ) : null}

          {mode === 'up' ? (
            <>
              {/* Phone → already-has-an-account nudge */}
              {phoneMatch?.alreadyOnboarded ? (
                <View className="mb-4">
                  <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider" style={{ color: '#B45309' }}>Already on Aangan</Text>
                  <View className="rounded-2xl border px-4 py-3.5" style={{ borderColor: '#CA8A04', backgroundColor: '#CA8A0412' }}>
                    <View className="flex-row items-start gap-3">
                      <Ionicons name="information-circle" size={20} color={c.highlightInk} />
                      <View className="flex-1">
                        <Text className="font-sans-sb text-[14px] text-ink">{phoneMatch.name} already has an account</Text>
                        <Text className="font-sans mt-0.5 text-[12px] text-muted">This number is registered in {phoneMatch.communityName}. Please sign in instead of creating a new account.</Text>
                      </View>
                    </View>
                    <Pressable onPress={goSignInWithPhone} className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 active:opacity-90" style={{ backgroundColor: c.accent }}>
                      <Ionicons name="log-in-outline" size={16} color="#fff" />
                      <Text className="font-sans-sb text-[14px] text-white">Sign in instead</Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={dismissPhoneMatch} hitSlop={8} className="mt-1.5 self-center active:opacity-60">
                    <Text className="font-sans text-[11px] text-faint">That's not me</Text>
                  </Pressable>
                </View>
              ) : phoneMatch ? (
                <View className="mb-4">
                  <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-accent">Found in directory</Text>
                  <Pressable
                    onPress={applyPhoneMatch}
                    className="flex-row items-center gap-3 rounded-2xl border px-4 py-3.5"
                    style={{ borderColor: c.accent, backgroundColor: c.accent + '12' }}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: c.accent + '20' }}>
                      <Ionicons name="person-outline" size={18} color={c.accent} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans-sb text-[14px] text-ink">{phoneMatch.name}</Text>
                      <Text className="font-sans text-[12px] text-faint" numberOfLines={1}>
                        {[
                          phoneMatch.block ? `Block ${phoneMatch.block}` : null,
                          phoneMatch.flat ? `Flat ${phoneMatch.flat}` : null,
                          phoneMatch.communityName,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[12px] font-sans-sb" style={{ color: c.accent }}>Fill details</Text>
                      <Ionicons name="chevron-forward" size={14} color={c.accent} />
                    </View>
                  </Pressable>
                  <Pressable onPress={dismissPhoneMatch} hitSlop={8} className="mt-1.5 self-center active:opacity-60">
                    <Text className="font-sans text-[11px] text-faint">That's not me</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Society */}
              <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Your Society</Text>
              {newCommunity ? (
                <View className="mb-4 flex-row items-center gap-3 rounded-2xl px-4 py-3.5" style={{ borderWidth: 1, borderColor: c.accent, backgroundColor: c.accent + '12' }}>
                  <Ionicons name="sparkles" size={18} color={c.accent} />
                  <View className="flex-1">
                    <Text className="font-sans-sb text-[14px] text-ink">{newCommunity.name}</Text>
                    <Text className="font-sans text-[12px] text-faint">New society — you'll be the admin</Text>
                  </View>
                </View>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Open"
                  onPress={() => setShowPicker(true)}
                  className="mb-4 flex-row items-center gap-3 card px-4 py-3.5"
                >
                  <Ionicons name="business-outline" size={18} color={selectedCommunity ? c.accent : c.faint} />
                  <View className="flex-1">
                    {selectedCommunity ? (
                      <>
                        <Text className="font-sans-sb text-[14px] text-ink">{selectedCommunity.name}</Text>
                        {selectedCommunity.address ? (
                          <Text className="font-sans text-[12px] text-faint" numberOfLines={1}>{selectedCommunity.address}</Text>
                        ) : null}
                      </>
                    ) : (
                      <Text className="font-sans text-[14px] text-faint">Select your society…</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.faint} />
                </Pressable>
              )}
              {!newCommunity ? (
                <Pressable onPress={() => router.push('/onboard' as any)} className="mb-4 -mt-1 self-start active:opacity-60">
                  <Text className="text-[12px] font-sans-sb text-accent">Don't see your society? Find &amp; onboard it →</Text>
                </Pressable>
              ) : null}

              <Field label="Your name" required placeholder="Pratibha Priti" value={name} onChangeText={setName} />
              <View className="flex-row gap-3">
                <View className="w-24">
                  <Field label="Block" autoCapitalize="characters" placeholder="E" value={block} onChangeText={setBlock} />
                </View>
                <View className="flex-1">
                  <Field label="Flat number" placeholder="204" value={flat} onChangeText={setFlat} />
                </View>
              </View>
              <Field label="WhatsApp" hint="For coordination with neighbours" placeholder="98765 43210" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
              <Field label="UPI ID" hint="Optional — so neighbours can pay you" autoCapitalize="none" placeholder="priya@ybl" value={upi} onChangeText={setUpi} />

              <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">I'm a… (optional)</Text>
              <View className="mb-4 flex-row gap-2.5">
                {(['owner', 'tenant'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setResidentType(residentType === t ? null : t)}
                    className={`flex-1 rounded-2xl border-[1.5px] p-3 ${residentType === t ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-sans-sb text-[14px] text-ink">{t === 'owner' ? 'Owner' : 'Tenant'}</Text>
                      <Ionicons name={residentType === t ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={residentType === t ? c.accent : c.faint} />
                    </View>
                  </Pressable>
                ))}
              </View>
              <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Have you moved in?</Text>
              <View className="mb-4 flex-row gap-2.5">
                {([['no', false], ['yes', true]] as const).map(([lbl, v]) => (
                  <Pressable
                    key={lbl}
                    onPress={() => setMovedIn(v)}
                    className={`flex-1 rounded-2xl border-[1.5px] p-3 ${movedIn === v ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-sans-sb text-[14px] text-ink">{lbl === 'yes' ? 'Yes, living here' : 'Not yet'}</Text>
                      <Ionicons name={movedIn === v ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={movedIn === v ? c.accent : c.faint} />
                    </View>
                  </Pressable>
                ))}
              </View>
              <Field label="Profession" hint="Optional — helps neighbours connect" placeholder="e.g. Doctor, CA, Teacher" value={profession} onChangeText={setProfession} />
              <Field label="Vehicle number" hint="Optional — for the resident directory" autoCapitalize="characters" placeholder="MH 12 AB 1234" value={vehicleNo} onChangeText={setVehicleNo} />
            </>
          ) : null}

          <Button
            label={busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
            size="lg"
            fullWidth
            loading={busy}
            onPress={submit}
          />

          {error ? (
            <View
              className="mt-3 flex-row items-start gap-2 rounded-2xl px-3.5 py-3"
              style={{ backgroundColor: c.dangerSoft }}
            >
              <Ionicons name="alert-circle" size={16} color={c.danger} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[13px] leading-[19px] font-sans-md" style={{ color: c.danger }}>
                {error}
              </Text>
            </View>
          ) : null}

          {mode === 'up' ? (
            <Text className="font-sans mt-3 text-center text-[12px] leading-[18px] text-faint">
              By creating an account, you agree to Aangan's{' '}
              <Text className="font-sans-sb text-muted" onPress={() => router.push('/legal' as any)}>Terms</Text>
              {' '}&amp;{' '}
              <Text className="font-sans-sb text-muted" onPress={() => router.push('/legal?tab=privacy' as any)}>Privacy Policy</Text>.
            </Text>
          ) : null}

          <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} className="mt-4">
            <Text className="font-sans text-center text-[13px] text-muted">
              {mode === 'in' ? 'New here? ' : 'Already have an account? '}
              <Text className="font-sans-sb text-accent">{mode === 'in' ? 'Create an account' : 'Sign in'}</Text>
            </Text>
          </Pressable>

          {/* Which bundle is this?
              A closed beta ships two things that look identical on the
              phone: the binary from the Play track and whatever JS update
              has since been applied on top of it. When a tester says
              "it does nothing", the first question is which of those they
              are looking at, and there was no way to answer it from the
              device. Embedded means the update has not applied yet. */}
          <Text className="mt-6 text-center text-[10px] font-sans text-subtle" selectable>
            v{Constants.expoConfig?.version ?? '?'} · {Updates.isEmbeddedLaunch ? 'embedded' : (Updates.updateId ?? 'no-update').slice(0, 8)}
          </Text>
        </Container>
      </ScrollView>

      {/* Society picker modal */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPicker(false)}>
        <View className="flex-1 bg-bg">
          <View className="border-b border-line px-4 pb-3 pt-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-display-x text-[20px] text-ink">Select Society</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setShowPicker(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.muted} />
              </Pressable>
            </View>
            <View className="flex-row items-center gap-2 card px-3 py-2.5">
              <Ionicons name="search-outline" size={16} color={c.faint} />
              <TextInput
                value={communitySearch}
                onChangeText={setCommunitySearch}
                placeholder="Search by name or area…"
                placeholderTextColor={c.faint}
                className="flex-1 font-sans text-[14px] text-ink"
                style={{ outline: 'none' } as any}
                autoFocus
              />
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {filteredCommunities.map((comm: Community) => (
              <Pressable
                key={comm.id}
                onPress={() => { setSelectedCommunity(comm); setShowPicker(false); }}
                className={`mb-2 flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 ${
                  selectedCommunity?.id === comm.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                }`}
              >
                <Ionicons name="business-outline" size={20} color={selectedCommunity?.id === comm.id ? c.accent : c.muted} />
                <View className="flex-1">
                  <Text className="font-sans-sb text-[14px] text-ink">{comm.name}</Text>
                  {comm.address ? <Text className="font-sans text-[12px] text-faint" numberOfLines={1}>{comm.address}</Text> : null}
                </View>
                {selectedCommunity?.id === comm.id ? (
                  <Ionicons name="checkmark-circle" size={20} color={c.accent} />
                ) : null}
              </Pressable>
            ))}

            {filteredCommunities.length === 0 && communitySearch.length > 0 ? (
              <Text className="font-sans py-6 text-center text-[14px] text-muted">No society found for "{communitySearch}"</Text>
            ) : null}

            {/* Request to add society */}
            {!showJoinRequest ? (
              <Pressable
                onPress={() => setShowJoinRequest(true)}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-4"
              >
                <Ionicons name="add-circle-outline" size={18} color={c.muted} />
                <Text className="font-sans-md text-[14px] text-muted">My society isn't listed — request to add it</Text>
              </Pressable>
            ) : (
              <View className="mt-4 card p-4">
                <Text className="mb-3 font-sans-sb text-[15px] text-ink">Request to Add Society</Text>
                <Field label="Society / Building name" required placeholder="Green Meadows CHS" value={jrSocietyName} onChangeText={setJrSocietyName} />
                <Field label="Address" required placeholder="Sector 12, Andheri West, Mumbai" value={jrSocietyAddress} onChangeText={setJrSocietyAddress} />
                <Text className="font-sans mb-3 text-[12px] text-faint">We'll use your name and phone from the sign-up form to contact you.</Text>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button label="Cancel" variant="outline" size="sm" onPress={() => setShowJoinRequest(false)} />
                  </View>
                  <View className="flex-1">
                    <Button label={jrSubmitting ? 'Sending…' : 'Submit Request'} size="sm" loading={jrSubmitting} onPress={submitJoinReq} />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Sign-up reconcile: an entry already exists for this flat with a different number */}
      <Modal visible={!!reconcile} transparent animationType="fade" onRequestClose={() => finishReconcile('skip')}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: '#0008' }}>
          <View style={{ width: '100%', maxWidth: 380, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, padding: 22 }}>
            <Text className="font-display-x text-[19px] text-ink">You're already in the directory</Text>
            <Text className="font-sans mt-2 text-[14px] leading-[20px] text-muted">
              <Text className="font-sans-sb text-ink">{reconcile?.name}</Text>
              {reconcile?.flat ? ` (Flat ${[reconcile?.block, reconcile?.flat].filter(Boolean).join('-')})` : ''} is listed with the number{' '}
              <Text className="font-sans-sb text-ink">{reconcile?.phone ?? '—'}</Text>. You signed up with a different number.
            </Text>
            <View className="mt-5 gap-2">
              <Button label="Keep both numbers" icon="git-merge-outline" fullWidth onPress={() => finishReconcile('keep')} />
              <Button label="Use only my new number" variant="outline" fullWidth onPress={() => finishReconcile('replace')} />
              <Pressable onPress={() => finishReconcile('skip')} className="items-center py-2 active:opacity-70">
                <Text className="font-sans-sb text-[13px] text-muted">That's not me</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {/* Forgot PIN modal */}
      <Modal visible={showForgotPin} transparent animationType="fade" onRequestClose={() => setShowForgotPin(false)}>
        {/* Nested Modals get their own native window on Android, so the
            screen's KeyboardAvoider does not reach in here. */}
        <View className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: '#0008', paddingBottom: pinKb }}>
          <View style={{ width: '100%', maxWidth: 380, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, padding: 22 }}>
            {resetDone ? (
              <>
                <View className="mb-4 items-center">
                  <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: c.accent + '20' }}>
                    <Ionicons name="checkmark-circle" size={32} color={c.accent} />
                  </View>
                </View>
                <Text className="text-center font-display-x text-[19px] text-ink">PIN reset!</Text>
                <Text className="font-sans mt-2 text-center text-[14px] leading-5 text-muted">
                  Your PIN has been updated. Sign in with your new PIN.
                </Text>
                <View className="mt-5">
                  <Button label="Sign in now" fullWidth onPress={() => { setShowForgotPin(false); setMode('in'); }} />
                </View>
              </>
            ) : (
              <>
                <Text className="font-display-x text-[19px] text-ink">Reset PIN</Text>
                <Text className="font-sans mt-1.5 mb-4 text-[13px] leading-5 text-muted">
                  Enter your registered phone and choose a new 6-digit PIN.
                </Text>
                <Field
                  label="Phone number"
                  required
                  placeholder="98765 43210"
                  keyboardType="phone-pad"
                  value={resetPhone}
                  onChangeText={setResetPhone}
                />
                <View className="mb-4">
                  <Text className="mb-2 text-[13px] font-sans-sb text-ink">
                    New PIN <Text style={{ color: c.danger }}>*</Text>
                  </Text>
                  <PinInput value={resetNewPin} onChange={setResetNewPin} accessibilityLabel="New PIN" />
                </View>
                <View className="mb-4">
                  <Text className="mb-2 text-[13px] font-sans-sb text-ink">
                    Confirm new PIN <Text style={{ color: c.danger }}>*</Text>
                  </Text>
                  <PinInput value={resetConfirmPin} onChange={setResetConfirmPin} accessibilityLabel="Confirm new PIN" />
                </View>
                <Text className="font-sans mb-4 text-[11px] leading-4 text-faint">
                  Can't reset? Ask your society admin to set a temporary PIN for you. You can then sign in and change it from your profile.
                </Text>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button label="Cancel" variant="outline" onPress={() => setShowForgotPin(false)} />
                  </View>
                  <View className="flex-1">
                    <Button label={resetBusy ? 'Resetting…' : 'Reset PIN'} loading={resetBusy} onPress={submitReset} />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoider>
  );
}
