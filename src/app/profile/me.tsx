import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, SectionCard } from '../../components/forms';
import { Avatar, Button, Container } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { changePin, deleteAccount, updateResidentInfo } from '../../lib/auth';
import { Community, fetchCommunityById } from '../../lib/communities';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useThemeColors } from '../../theme';

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { profile, communityId, saveProfile, signOut, refreshProfile } = useAuth();

  // Profile edit state
  const [name, setName] = useState(profile?.name ?? '');
  const [flat, setFlat] = useState(profile?.flat ?? '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '');
  const [upi, setUpi] = useState(profile?.upi ?? '');
  const [residentType, setResidentType] = useState<'owner' | 'tenant' | null>(profile?.resident_type ?? null);
  const [profession, setProfession] = useState(profile?.profession ?? '');
  const [vehicleNo, setVehicleNo] = useState(profile?.vehicle_no ?? '');
  const [showInDirectory, setShowInDirectory] = useState(profile?.show_in_directory ?? true);
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
      setWhatsapp(profile.whatsapp ?? '');
      setUpi(profile.upi ?? '');
      setResidentType(profile.resident_type ?? null);
      setProfession(profile.profession ?? '');
      setVehicleNo(profile.vehicle_no ?? '');
      setShowInDirectory(profile.show_in_directory ?? true);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!name.trim()) return toast.show('Name cannot be empty');
    setSavingProfile(true);
    try {
      await saveProfile({ name: name.trim(), flat: flat.trim() || null, whatsapp: whatsapp.trim() || null, upi: upi.trim() || null });
      if (profile) await updateResidentInfo(profile.id, {
        resident_type: residentType,
        profession: profession.trim() || null,
        vehicle_no: vehicleNo.trim() || null,
        show_in_directory: showInDirectory,
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

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Delete your account? This cannot be undone. All your listings and data will be removed.'
      );
      if (!confirmed) return;
      doDelete();
    } else {
      Alert.alert(
        'Delete Account',
        'This cannot be undone. All your listings and data will be permanently removed.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const doDelete = async () => {
    try {
      await deleteAccount();
      await signOut();
    } catch {
      toast.show('Could not delete account — contact support');
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 60, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Container narrow>
          {/* Header */}
          <View className="mb-6 flex-row items-center gap-2">
            <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
              <Ionicons name="chevron-back" size={22} color={c.ink} />
            </Pressable>
            <Text className="font-display-x text-[22px] text-ink">My Profile</Text>
          </View>

          {/* Avatar + Identity */}
          <View className="mb-6 items-center">
            <View className="mb-3">
              <Avatar name={profile?.name ?? 'Me'} size={72} />
            </View>
            <Text className="font-display-x text-[22px] text-ink">{profile?.name ?? '—'}</Text>
            {profile?.flat ? <Text className="text-[13px] text-muted">Flat {profile.flat}</Text> : null}

            {/* Role chip */}
            <View className="mt-2 flex-row flex-wrap justify-center gap-1.5">
              <View className="rounded-full border border-line bg-surface px-3 py-1">
                <Text className="text-[11px] font-sans-sb text-muted">
                  {profile?.roles.includes('admin') ? 'Admin' : 'Member'}
                </Text>
              </View>
            </View>

            {/* Society badge */}
            {community ? (
              <View className="mt-2 flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: '#7C3AED1A', borderWidth: 1, borderColor: '#7C3AED55' }}>
                <Ionicons name="business" size={12} color="#7C3AED" />
                <Text className="text-[12px] font-sans-sb" style={{ color: '#7C3AED' }}>{community.name}</Text>
              </View>
            ) : null}
          </View>

          {/* Edit profile */}
          <SectionCard title="Edit Profile">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Name" required placeholder="Pratibha Priti" value={name} onChangeText={setName} />
              </View>
              <View className="w-28">
                <Field label="Flat" placeholder="A-204" value={flat} onChangeText={setFlat} />
              </View>
            </View>
            <Field label="WhatsApp" placeholder="98765 43210" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
            <Field label="UPI ID" hint="Neighbours pay you directly" autoCapitalize="none" placeholder="priya@ybl" value={upi} onChangeText={setUpi} />

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

            <Pressable
              onPress={() => setShowInDirectory((v) => !v)}
              className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-inset px-4 py-3"
            >
              <Ionicons name={showInDirectory ? 'eye-outline' : 'eye-off-outline'} size={18} color={showInDirectory ? c.accent : c.muted} />
              <View className="flex-1">
                <Text className="font-sans-sb text-[14px] text-ink">Show me in the resident directory</Text>
                <Text className="text-[12px] text-muted">{showInDirectory ? 'Neighbours can find your flat & contact' : 'You are hidden from the directory'}</Text>
              </View>
              <View className={`h-6 w-10 rounded-full p-0.5 ${showInDirectory ? 'bg-accent' : 'bg-line'}`}>
                <View className={`h-5 w-5 rounded-full bg-white ${showInDirectory ? 'self-end' : 'self-start'}`} />
              </View>
            </Pressable>
            <Button label={savingProfile ? 'Saving…' : 'Save Changes'} loading={savingProfile} onPress={handleSaveProfile} fullWidth />
          </SectionCard>

          {/* Change PIN */}
          <SectionCard title="Security">
            {!pinExpanded ? (
              <Pressable
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
              label="Sign Out"
              variant="outline"
              icon="log-out-outline"
              fullWidth
              onPress={signOut}
            />
          </View>

          {/* Danger zone */}
          <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <Text className="mb-1 font-sans-sb text-[13px] text-red-700">Danger Zone</Text>
            <Text className="mb-3 text-[12px] text-red-500">Deleting your account permanently removes all your listings, posts, and data. This cannot be undone.</Text>
            <Pressable
              onPress={handleDeleteAccount}
              className="flex-row items-center justify-center gap-2 rounded-xl border border-red-300 bg-white py-2.5 active:bg-red-50"
            >
              <Ionicons name="trash-outline" size={16} color="#DC2626" />
              <Text className="font-sans-sb text-[13px] text-red-600">Delete my account</Text>
            </Pressable>
          </View>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
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
