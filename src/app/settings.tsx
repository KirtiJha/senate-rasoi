import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { useConfirm } from '../context/confirm';
import { useToast } from '../context/toast';
import { ThemePreference, useThemePreference } from '../context/theme';
import { updateProfile } from '../lib/auth';
import { updateResidentInfo } from '../lib/auth';
import { MUTABLE_CATEGORIES, fetchMutedTypes, setMuted } from '../lib/notificationPrefs';
import { supportMailto } from '../lib/support';
import { SUPPORTED_LANGS, langByCode } from '../lib/translate';
import { useThemeColors } from '../theme';

/**
 * Everything a resident can change about their own experience, in one place.
 *
 * WHY THIS EXISTS
 * There was no settings route in the app at all. About, Terms, Privacy, the
 * Child Safety Standards and the support address were reachable only from the
 * desktop NavRail account menu — which never renders on a phone. So a resident
 * signed in on Android could not reach the privacy policy, and neither could a
 * Play reviewer testing on a phone, which every UGC and child-safety policy
 * assumes they can.
 *
 * The theme control lives here too. The provider has always supported a
 * "System" preference, but the only UI was a two-way toggle in the top bar —
 * once you touched it you could never get back to following the OS.
 */

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const confirm = useConfirm();
  const { signOut, userId, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [savingLang, setSavingLang] = useState<string | null>(null);
  const [muted, setMutedState] = useState<Set<string> | null>(null);
  const [pendingMute, setPendingMute] = useState<string | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const { preference, setPreference } = useThemePreference();

  const version = Constants.expoConfig?.version ?? '—';

  const activeLang = profile?.preferred_lang ?? 'en';
  const inDirectory = profile?.show_in_directory ?? true;

  const toggleDirectory = async () => {
    if (!profile || savingPrivacy) return;
    setSavingPrivacy(true);
    try {
      await updateResidentInfo(profile.id, { show_in_directory: !inDirectory });
      await refreshProfile();
    } catch {
      toast.show('Could not save that — try again');
    } finally {
      setSavingPrivacy(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchMutedTypes(userId)
      .then((s) => { if (alive) setMutedState(s); })
      // A failure here must not blank the switches: an unknown state shown as
      // "on" would tell the resident they are subscribed when they may not be.
      .catch(() => { if (alive) setMutedState(new Set()); });
    return () => { alive = false; };
  }, [userId]);

  const toggleMute = useCallback(async (type: string) => {
    if (!userId || !muted || pendingMute) return;
    const next = !muted.has(type);
    setPendingMute(type);
    // Optimistic: a switch that waits for a round-trip feels broken.
    setMutedState((prev) => {
      const s = new Set(prev ?? []);
      if (next) s.add(type); else s.delete(type);
      return s;
    });
    try {
      await setMuted(userId, type, next);
    } catch {
      setMutedState((prev) => {
        const s = new Set(prev ?? []);
        if (next) s.delete(type); else s.add(type);
        return s;
      });
      toast.show('Could not save that — try again');
    } finally {
      setPendingMute(null);
    }
  }, [userId, muted, pendingMute, toast]);

  const pickLang = async (code: string) => {
    if (!userId || savingLang) return;
    setSavingLang(code);
    try {
      await updateProfile(userId, { preferred_lang: code === 'en' ? null : code });
      await refreshProfile();
    } finally {
      setSavingLang(null);
    }
  };

  const handleSignOut = async () => {
    // Auth is a phone number plus a 6-digit PIN the resident chose themselves.
    // An accidental tap locks them out until they remember it, so this asks
    // first — the same courtesy "Delete my account" already had.
    const ok = await confirm({
      title: 'Sign out?',
      message: "You'll need your phone number and PIN to sign back in.",
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (ok) signOut();
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="settings-outline" title="Settings" showBack />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container>
          {/* ── Appearance ─────────────────────────────────────── */}
          <SectionLabel>Appearance</SectionLabel>
          <View className="mb-6 overflow-hidden card">
            <View className="flex-row gap-1 p-1.5">
              {THEME_OPTIONS.map((opt) => {
                const active = preference === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPreference(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt.label} theme`}
                    className="flex-1 items-center gap-1 rounded-xl py-3 active:opacity-70"
                    style={{ backgroundColor: active ? c.accentSoft : 'transparent' }}
                  >
                    <Ionicons name={opt.icon} size={19} color={active ? c.accent : c.muted} />
                    <Text
                      className="font-sans-sb text-[12px]"
                      style={{ color: active ? c.accent : c.muted }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Notifications ──────────────────────────────────── */}
          <SectionLabel>Notifications</SectionLabel>
          <Card>
            {MUTABLE_CATEGORIES.map((cat, i) => {
              const on = !muted?.has(cat.type);
              return (
                <View key={cat.type}>
                  <Pressable
                    onPress={() => toggleMute(cat.type)}
                    disabled={!muted}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on, disabled: !muted }}
                    accessibilityLabel={cat.label}
                    accessibilityHint={cat.blurb}
                    className="flex-row items-center gap-3 px-4 py-3 active:bg-inset"
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans-md text-[15px] text-ink">{cat.label}</Text>
                      <Text className="mt-0.5 text-[12px] text-subtle" numberOfLines={1}>{cat.blurb}</Text>
                    </View>
                    <Switch
                      value={on}
                      onValueChange={() => toggleMute(cat.type)}
                      disabled={!muted || pendingMute === cat.type}
                      trackColor={{ false: c.line, true: c.accentSoft }}
                      thumbColor={on ? c.accent : c.subtle}
                    />
                  </Pressable>
                  {i < MUTABLE_CATEGORIES.length - 1 ? <Divider /> : null}
                </View>
              );
            })}
          </Card>
          <Text className="mb-6 -mt-3 px-1 text-[12px] leading-5 text-subtle">
            Messages sent to you, orders on your dishes and emergencies always
            come through — these switches only quiet society-wide updates.
          </Text>

          {/* ── Language ───────────────────────────────────────── */}
          <SectionLabel>Language</SectionLabel>
          <Card>
            {SUPPORTED_LANGS.map((l, i) => {
              const active = activeLang === l.code;
              return (
                <View key={l.code}>
                  <Pressable
                    onPress={() => pickLang(l.code)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={l.label}
                    className="flex-row items-center gap-3 px-4 py-3.5 active:bg-inset"
                  >
                    <Text className="flex-1 font-sans-md text-[15px] text-ink">
                      {l.label}
                      {l.label !== l.name ? (
                        <Text className="text-[13px] text-subtle">{'  ' + l.name}</Text>
                      ) : null}
                    </Text>
                    {savingLang === l.code ? (
                      <ActivityIndicator size="small" color={c.accent} />
                    ) : active ? (
                      <Ionicons name="checkmark" size={19} color={c.accent} />
                    ) : null}
                  </Pressable>
                  {i < SUPPORTED_LANGS.length - 1 ? <Divider /> : null}
                </View>
              );
            })}
          </Card>
          <Text className="mb-6 -mt-3 px-1 text-[12px] leading-5 text-subtle">
            Posts, listings and messages written by your neighbours are
            translated as you read them. English needs no translation, so
            leaving it here does nothing at all.
          </Text>

          {/* ── Privacy ────────────────────────────────────────────
              This lived only inside the profile editor, several taps away and
              under a heading nobody reads as "privacy" — while the column it
              controls defaults to TRUE. So a new resident's phone number is
              visible to the whole society before they learn the setting
              exists. Putting it here does not change the default, but it puts
              the choice where someone looking for it would look. */}
          <SectionLabel>Privacy</SectionLabel>
          <Card>
            <Pressable
              onPress={toggleDirectory}
              disabled={!profile || savingPrivacy}
              accessibilityRole="switch"
              accessibilityState={{ checked: inDirectory, disabled: !profile }}
              accessibilityLabel="Show my phone number in the resident directory"
              className="flex-row items-center gap-3 px-4 py-3 active:bg-inset"
            >
              <View className="min-w-0 flex-1">
                <Text className="font-sans-md text-[15px] text-ink">Show my phone number</Text>
                <Text className="mt-0.5 text-[12px] leading-4 text-subtle">
                  {inDirectory
                    ? 'Neighbours can call and WhatsApp you from the directory'
                    : "You stay listed, but your number is hidden"}
                </Text>
              </View>
              <Switch
                value={inDirectory}
                onValueChange={toggleDirectory}
                disabled={!profile || savingPrivacy}
                trackColor={{ false: c.line, true: c.accentSoft }}
                thumbColor={inDirectory ? c.accent : c.subtle}
              />
            </Pressable>
            <Divider />
            <Row icon="ban-outline" label="Blocked residents" c={c} onPress={() => router.push('/profile/blocked' as any)} />
          </Card>

          {/* ── Your account ───────────────────────────────────── */}
          <SectionLabel>Your account</SectionLabel>
          <Card>
            <Row icon="person-outline" label="Edit profile" c={c} onPress={() => router.push('/profile/me' as any)} />
          </Card>

          {/* ── About ──────────────────────────────────────────── */}
          <SectionLabel>About Aangan</SectionLabel>
          <Card>
            <Row icon="information-circle-outline" label="About" c={c} onPress={() => router.push('/about' as any)} />
            <Divider />
            <Row icon="document-text-outline" label="Terms & Privacy Policy" c={c} onPress={() => router.push('/legal' as any)} />
            <Divider />
            <Row icon="shield-checkmark-outline" label="Child safety standards" c={c} onPress={() => router.push('/child-safety' as any)} />
            <Divider />
            <Row icon="mail-outline" label="Contact support" c={c} onPress={() => openUrl(supportMailto())} />
          </Card>

          {/* ── Sign out / delete ──────────────────────────────── */}
          <Card>
            <Row icon="log-out-outline" label="Sign out" c={c} danger onPress={handleSignOut} />
            <Divider />
            <Row icon="trash-outline" label="Delete my account" c={c} danger onPress={() => router.push('/profile/me' as any)} />
          </Card>

          <Text className="font-sans mt-2 text-center text-[12px] text-faint">Aangan v{version}</Text>
        </Container>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 ml-1 text-[11px] font-sans-sb uppercase tracking-wider text-muted">{children}</Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View className="mb-6 overflow-hidden card">{children}</View>;
}

function Divider() {
  return <View className="ml-[52px] h-px bg-line" />;
}

function Row({
  icon, label, onPress, danger, c,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  c: ReturnType<typeof useThemeColors>;
}) {
  const tint = danger ? c.nonveg : c.muted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-inset"
    >
      <Ionicons name={icon} size={19} color={tint} />
      <Text className="flex-1 font-sans-md text-[15px]" style={{ color: danger ? c.nonveg : c.ink }}>
        {label}
      </Text>
      {!danger ? <Ionicons name="chevron-forward" size={17} color={c.faint} /> : null}
    </Pressable>
  );
}
