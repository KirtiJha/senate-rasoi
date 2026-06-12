import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Brandfull } from '../../components/Brand';
import { Field } from '../../components/forms';
import { Button, Container } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { selfResetPin, signIn, signUp } from '../../lib/auth';
import { Community, fetchCommunities, fetchCommunityById, submitJoinRequest } from '../../lib/communities';
import { DirectoryEntry, PhoneDirectoryMatch, findDirectoryByPhone, findRosterMatch, reconcileDirectoryEntry } from '../../lib/directory';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';

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

  // Forgot PIN flow
  const [showForgotPin, setShowForgotPin] = useState(false);
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
    if (!isSupabaseConfigured) {
      toast.show("Supabase isn't configured yet ⚙️");
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return toast.show('Enter a valid phone number');
    if (!/^\d{6}$/.test(code)) return toast.show('Your code must be exactly 6 digits');

    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(phone, code);
      } else {
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
      toast.show(e instanceof Error ? e.message : 'Something went wrong');
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
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <Container narrow>
          <View className="mb-7 items-center">
            <Brandfull />
            <Text className="mt-3 text-center text-[14px] leading-5 text-muted">
              {mode === 'in'
                ? 'Welcome back to your society hub 🏘️\nSign in with your phone & 6-digit code.'
                : 'Your neighbourhood, all in one place 🏘️\nJoin with your phone & a 6-digit code.'}
            </Text>
          </View>

          {/* mode switch */}
          <View className="mb-5 flex-row rounded-2xl bg-inset p-1">
            {(['in', 'up'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} className={`flex-1 rounded-xl py-2.5 ${mode === m ? 'bg-surface' : ''}`}>
                <Text className={`text-center text-[14px] ${mode === m ? 'font-sans-sb text-ink' : 'font-sans-md text-muted'}`}>
                  {m === 'in' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field label="Phone number" required placeholder="98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Field
            label="6-digit code"
            required
            hint={mode === 'up' ? 'Choose any 6 digits — your secret PIN to sign in.' : undefined}
            placeholder="••••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={code}
            onChangeText={(t: string) => setCode(t.replace(/\D/g, ''))}
          />
          {mode === 'in' ? (
            <Pressable onPress={openForgotPin} hitSlop={8} className="-mt-1 mb-3 self-end active:opacity-60">
              <Text className="text-[12.5px] font-sans-sb text-accent">Forgot PIN?</Text>
            </Pressable>
          ) : null}

          {mode === 'up' ? (
            <>
              {/* Phone → directory match chip */}
              {phoneMatch ? (
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
                      <Text className="text-[12px] text-faint" numberOfLines={1}>
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
                    <Text className="text-[11px] text-faint">That's not me</Text>
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
                    <Text className="text-[12px] text-faint">New society — you'll be the admin</Text>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowPicker(true)}
                  className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5"
                >
                  <Ionicons name="business-outline" size={18} color={selectedCommunity ? c.accent : c.faint} />
                  <View className="flex-1">
                    {selectedCommunity ? (
                      <>
                        <Text className="font-sans-sb text-[14px] text-ink">{selectedCommunity.name}</Text>
                        {selectedCommunity.address ? (
                          <Text className="text-[12px] text-faint" numberOfLines={1}>{selectedCommunity.address}</Text>
                        ) : null}
                      </>
                    ) : (
                      <Text className="text-[14px] text-faint">Select your society…</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.faint} />
                </Pressable>
              )}
              {!newCommunity ? (
                <Pressable onPress={() => router.push('/onboard' as any)} className="mb-4 -mt-1 self-start active:opacity-60">
                  <Text className="text-[12.5px] font-sans-sb text-accent">Don't see your society? Find &amp; onboard it →</Text>
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

          {mode === 'up' ? (
            <Text className="mt-3 text-center text-[12px] leading-[18px] text-faint">
              By creating an account, you agree to Aangan's{' '}
              <Text className="font-sans-sb text-muted" onPress={() => router.push('/legal' as any)}>Terms</Text>
              {' '}&amp;{' '}
              <Text className="font-sans-sb text-muted" onPress={() => router.push('/legal?tab=privacy' as any)}>Privacy Policy</Text>.
            </Text>
          ) : null}

          <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} className="mt-4">
            <Text className="text-center text-[13px] text-muted">
              {mode === 'in' ? 'New here? ' : 'Already have an account? '}
              <Text className="font-sans-sb text-accent">{mode === 'in' ? 'Create an account' : 'Sign in'}</Text>
            </Text>
          </Pressable>
        </Container>
      </ScrollView>

      {/* Society picker modal */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPicker(false)}>
        <View className="flex-1 bg-bg">
          <View className="border-b border-line px-4 pb-3 pt-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-display-x text-[20px] text-ink">Select Society</Text>
              <Pressable onPress={() => setShowPicker(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.muted} />
              </Pressable>
            </View>
            <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
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
                  {comm.address ? <Text className="text-[12px] text-faint" numberOfLines={1}>{comm.address}</Text> : null}
                </View>
                {selectedCommunity?.id === comm.id ? (
                  <Ionicons name="checkmark-circle" size={20} color={c.accent} />
                ) : null}
              </Pressable>
            ))}

            {filteredCommunities.length === 0 && communitySearch.length > 0 ? (
              <Text className="py-6 text-center text-[14px] text-muted">No society found for "{communitySearch}"</Text>
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
              <View className="mt-4 rounded-2xl border border-line bg-surface p-4">
                <Text className="mb-3 font-sans-sb text-[15px] text-ink">Request to Add Society</Text>
                <Field label="Society / Building name" required placeholder="Green Meadows CHS" value={jrSocietyName} onChangeText={setJrSocietyName} />
                <Field label="Address" required placeholder="Sector 12, Andheri West, Mumbai" value={jrSocietyAddress} onChangeText={setJrSocietyAddress} />
                <Text className="mb-3 text-[12px] text-faint">We'll use your name and phone from the sign-up form to contact you.</Text>
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
            <Text className="mt-2 text-[14px] leading-[20px] text-muted">
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
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: '#0008' }}>
          <View style={{ width: '100%', maxWidth: 380, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, padding: 22 }}>
            {resetDone ? (
              <>
                <View className="mb-4 items-center">
                  <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: c.accent + '20' }}>
                    <Ionicons name="checkmark-circle" size={32} color={c.accent} />
                  </View>
                </View>
                <Text className="text-center font-display-x text-[19px] text-ink">PIN reset!</Text>
                <Text className="mt-2 text-center text-[14px] leading-5 text-muted">
                  Your PIN has been updated. Sign in with your new PIN.
                </Text>
                <View className="mt-5">
                  <Button label="Sign in now" fullWidth onPress={() => { setShowForgotPin(false); setMode('in'); }} />
                </View>
              </>
            ) : (
              <>
                <Text className="font-display-x text-[19px] text-ink">Reset PIN</Text>
                <Text className="mt-1.5 mb-4 text-[13px] leading-5 text-muted">
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
                <Field
                  label="New PIN"
                  required
                  placeholder="••••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  value={resetNewPin}
                  onChangeText={(t) => setResetNewPin(t.replace(/\D/g, ''))}
                />
                <Field
                  label="Confirm new PIN"
                  required
                  placeholder="••••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  value={resetConfirmPin}
                  onChangeText={(t) => setResetConfirmPin(t.replace(/\D/g, ''))}
                />
                <Text className="mb-4 text-[11px] leading-4 text-faint">
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
    </KeyboardAvoidingView>
  );
}
