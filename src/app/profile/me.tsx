import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, SectionCard } from '../../components/forms';
import { Avatar, Button, Container, KeyboardAvoider, ScreenHeader } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useConfirm } from '../../context/confirm';
import { changePin, deleteAccount, updateResidentInfo } from '../../lib/auth';
import { Community, fetchCommunityById } from '../../lib/communities';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { profile, communityId, saveProfile, signOut, refreshProfile } = useAuth();

  // Profile edit state
  const [name, setName] = useState(profile?.name ?? '');
  const [flat, setFlat] = useState(profile?.flat ?? '');
  const [block, setBlock] = useState(profile?.block ?? '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '');
  const [upi, setUpi] = useState(profile?.upi ?? '');
  const [altPhone, setAltPhone] = useState(profile?.alt_phone ?? '');
  const [residentType, setResidentType] = useState<'owner' | 'tenant' | null>(profile?.resident_type ?? null);
  const [profession, setProfession] = useState(profile?.profession ?? '');
  const [vehicleNo, setVehicleNo] = useState(profile?.vehicle_no ?? '');
  const [showInDirectory, setShowInDirectory] = useState(profile?.show_in_directory ?? true);
  const [movedIn, setMovedIn] = useState(profile?.moved_in ?? false);
  const [savingProfile, setSavingProfile] = useState(false);

  // PIN change state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [pinExpanded, setPinExpanded] = useState(false);

  // Community
  const [community, setCommunity] = useState<Community | null>(null);

  useEffect(() => {
    if (communityId && isSupabaseConfigured) {
      fetchCommunityById(communityId).then(setCommunity).catch(() => {});
    }
  }, [communityId]);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setFlat(profile.flat ?? '');
      setBlock(profile.block ?? '');
      setWhatsapp(profile.whatsapp ?? '');
      setUpi(profile.upi ?? '');
      setResidentType(profile.resident_type ?? null);
      setProfession(profile.profession ?? '');
      setVehicleNo(profile.vehicle_no ?? '');
      setShowInDirectory(profile.show_in_directory ?? true);
      setAltPhone(profile.alt_phone ?? '');
      setMovedIn(profile.moved_in ?? false);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!name.trim()) return toast.show('Name cannot be empty');
    setSavingProfile(true);
    try {
      // The flat number is the identity, so it is stored bare: digits only and
      // no leading zeros, matching what 0107 normalised the table to. Letting a
      // block letter back into this field is what made 209 and E-209 two homes.
      const flatNumber = flat.replace(/[^0-9]/g, '').replace(/^0+/, '');
      await saveProfile({
        name: name.trim(),
        flat: flatNumber || null,
        block: block.trim().toUpperCase() || null,
        whatsapp: whatsapp.trim() || null,
        upi: upi.trim() || null,
      });
      if (profile) await updateResidentInfo(profile.id, {
        resident_type: residentType,
        profession: profession.trim() || null,
        vehicle_no: vehicleNo.trim() || null,
        show_in_directory: showInDirectory,
        moved_in: movedIn,
        alt_phone: altPhone.trim() || null,
      });
      await refreshProfile();
      toast.show('Profile updated ✅');
    } catch {
      toast.show('Could not save — try again');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePin = async () => {
    if (!/^\d{6}$/.test(newPin)) return toast.show('New PIN must be exactly 6 digits');
    if (newPin !== confirmPin) return toast.show('PINs do not match');
    setSavingPin(true);
    try {
      await changePin(newPin);
      setNewPin('');
      setConfirmPin('');
      setPinExpanded(false);
      toast.show('PIN updated successfully 🔐');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not update PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: 'Delete account',
      message: 'This cannot be undone. All your listings and data will be permanently removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) doDelete();
  };

  const doDelete = async () => {
    try {
      await deleteAccount();
      await signOut();
    } catch {
      toast.show('Could not delete account — contact support');
    }
  };

  const isAdminRole = !!profile?.roles.includes('admin');

  return (
    <KeyboardAvoider>
      <ScreenHeader icon="person-circle-outline" title="My Profile" showBack />
      <ScrollView
        // Fills the space the KeyboardAvoider gives it. Without this the
        // scroller sizes to its own content and overflows its parent, which
        // renders the form oversized instead of scrollable.
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 60, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Container>
          {/* Who you are — the same row shape as the You screen. */}
          <View className="mb-6 flex-row items-center">
            <Avatar name={profile?.name ?? 'Me'} size={60} />
            <View className="min-w-0 flex-1" style={{ marginLeft: 14 }}>
              <Text className="font-display-x text-[23px] leading-[28px] text-ink" numberOfLines={1}>
                {profile?.name ?? '—'}
              </Text>
              <View className="mt-1 flex-row items-center gap-2">
                <View
                  className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                  style={{ backgroundColor: isAdminRole ? c.accentSoft : c.inset }}
                >
                  {isAdminRole ? <Ionicons name="shield-checkmark" size={11} color={c.accent} /> : null}
                  <Text
                    className="text-[11px] font-sans-sb"
                    style={{ color: isAdminRole ? c.accent : c.muted }}
                  >
                    {isAdminRole ? 'Admin' : 'Member'}
                  </Text>
                </View>
                {profile?.flat ? (
                  <Text className="text-[13px] font-sans-md text-subtle" numberOfLines={1}>
                    Flat {profile.block ? `${profile.block}-${profile.flat}` : profile.flat}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Edit profile */}
          <SectionCard title="Edit Profile">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Name" required placeholder="Pratibha Priti" value={name} onChangeText={setName} />
              </View>
              <View className="w-24">
                <Field
                  label="Flat no."
                  placeholder="204"
                  keyboardType="number-pad"
                  value={flat}
                  onChangeText={(t) => setFlat(t.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>
            <Field
              label="Block / tower"
              hint="Optional — flat numbers are unique here, so this is just a label"
              autoCapitalize="characters"
              maxLength={4}
              placeholder="A"
              value={block}
              onChangeText={setBlock}
            />
            <Field label="WhatsApp" placeholder="98765 43210" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
            <Field label="UPI ID" hint="Neighbours pay you directly" autoCapitalize="none" placeholder="priya@ybl" value={upi} onChangeText={setUpi} />
            <Field
              label="Alternate phone"
              hint="Shown in the resident directory alongside your main number"
              keyboardType="phone-pad"
              placeholder="98765 43210"
              value={altPhone}
              onChangeText={setAltPhone}
            />

            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">I'm a…</Text>
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
            <Field label="Profession" hint="Shown in the resident directory" placeholder="e.g. Doctor, CA, Teacher" value={profession} onChangeText={setProfession} />
            <Field label="Vehicle number" hint="Optional — shown in the directory" autoCapitalize="characters" placeholder="MH 12 AB 1234" value={vehicleNo} onChangeText={setVehicleNo} />

            <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-inset px-4 py-3">
              <Ionicons name={showInDirectory ? 'call-outline' : 'eye-off-outline'} size={18} color={showInDirectory ? c.accent : c.muted} />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-sb text-[14px] text-ink">Show my phone number in the directory</Text>
                <Text className="font-sans text-[12px] text-muted">{showInDirectory ? 'Neighbours can call & WhatsApp you' : "You're still listed — but your number is hidden"}</Text>
              </View>
              <Switch
                value={showInDirectory}
                onValueChange={() => setShowInDirectory((v) => !v)}
                trackColor={{ false: c.line, true: c.accentSoft }}
                thumbColor={showInDirectory ? c.accent : c.subtle}
              />
            </View>

            <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-inset px-4 py-3">
              <Ionicons name={movedIn ? 'home' : 'home-outline'} size={18} color={movedIn ? c.accent : c.muted} />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-sb text-[14px] text-ink">I've moved into the society</Text>
                <Text className="font-sans text-[12px] text-muted">{movedIn ? 'Shown as living here' : 'Shown as not moved in yet'}</Text>
              </View>
              <Switch
                value={movedIn}
                onValueChange={() => setMovedIn((v) => !v)}
                trackColor={{ false: c.line, true: c.accentSoft }}
                thumbColor={movedIn ? c.accent : c.subtle}
              />
            </View>

            <Button label={savingProfile ? 'Saving…' : 'Save Changes'} loading={savingProfile} onPress={handleSaveProfile} fullWidth />
          </SectionCard>

          {/* Change PIN */}
          <SectionCard title="Security">
            {!pinExpanded ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Open"
                onPress={() => setPinExpanded(true)}
                className="flex-row items-center gap-3 rounded-xl border border-line bg-inset px-4 py-3"
              >
                <Ionicons name="key-outline" size={18} color={c.muted} />
                <Text className="flex-1 text-[14px] font-sans-md text-ink">Change sign-in PIN</Text>
                <Ionicons name="chevron-forward" size={16} color={c.faint} />
              </Pressable>
            ) : (
              <>
                <Field
                  label="New 6-digit PIN"
                  required
                  placeholder="••••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  value={newPin}
                  onChangeText={(t) => setNewPin(t.replace(/\D/g, ''))}
                />
                <Field
                  label="Confirm new PIN"
                  required
                  placeholder="••••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  value={confirmPin}
                  onChangeText={(t) => setConfirmPin(t.replace(/\D/g, ''))}
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button label="Cancel" variant="outline" size="sm" onPress={() => { setPinExpanded(false); setNewPin(''); setConfirmPin(''); }} />
                  </View>
                  <View className="flex-1">
                    <Button label={savingPin ? 'Updating…' : 'Update PIN'} size="sm" loading={savingPin} onPress={handleChangePin} />
                  </View>
                </View>
              </>
            )}
          </SectionCard>

          {/* Account info */}
          <SectionCard title="Account">
            <View className="gap-3">
              <InfoRow icon="call-outline" label="Phone" value={profile?.phone ?? '—'} c={c} />
              <InfoRow icon="business-outline" label="Society" value={community?.name ?? 'Not set'} c={c} />
              <InfoRow icon="calendar-outline" label="Member since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} c={c} />
            </View>
          </SectionCard>

          {/* Actions */}
          <View className="mb-4 gap-3">
            <Button
              label="Blocked members"
              variant="outline"
              icon="ban-outline"
              fullWidth
              onPress={() => router.push('/profile/blocked' as any)}
            />
            <Button
              label="Sign Out"
              variant="outline"
              icon="log-out-outline"
              fullWidth
              onPress={signOut}
            />
          </View>

          {/* Danger zone */}
          <View className="rounded-2xl border border-danger/30 bg-danger-soft p-4">
            <Text className="mb-1 font-sans-sb text-[13px] text-danger">Danger Zone</Text>
            <Text className="font-sans mb-3 text-[12px] text-danger">Deleting your account permanently removes all your listings, posts, and data. This cannot be undone.</Text>
            <Pressable
              onPress={handleDeleteAccount}
              className="flex-row items-center justify-center gap-2 rounded-xl border border-danger/30 bg-surface py-2.5 active:bg-danger-soft"
            >
              <Ionicons name="trash-outline" size={16} color={c.danger} />
              <Text className="font-sans-sb text-[13px] text-danger">Delete my account</Text>
            </Pressable>
          </View>
        </Container>
      </ScrollView>
    </KeyboardAvoider>
  );
}

function InfoRow({ icon, label, value, c }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; c: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-8 w-8 items-center justify-center rounded-xl bg-inset">
        <Ionicons name={icon} size={15} color={c.muted} />
      </View>
      <View className="flex-1">
        <Text className="text-[11px] font-sans-md text-faint">{label}</Text>
        <Text className="text-[13px] font-sans-md text-ink">{value}</Text>
      </View>
    </View>
  );
}
