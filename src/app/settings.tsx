import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { useConfirm } from '../context/confirm';
import { ThemePreference, useThemePreference } from '../context/theme';
import { supportMailto } from '../lib/support';
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
  const { signOut } = useAuth();
  const { preference, setPreference } = useThemePreference();

  const version = Constants.expoConfig?.version ?? '—';

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
      <ScreenHeader icon="settings-outline" title="Settings" showBack hideSociety />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container>
          {/* ── Appearance ─────────────────────────────────────── */}
          <SectionLabel>Appearance</SectionLabel>
          <View className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
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

          {/* ── Your account ───────────────────────────────────── */}
          <SectionLabel>Your account</SectionLabel>
          <Card>
            <Row icon="person-outline" label="Edit profile" c={c} onPress={() => router.push('/profile/me' as any)} />
            <Divider />
            <Row icon="ban-outline" label="Blocked residents" c={c} onPress={() => router.push('/profile/blocked' as any)} />
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
    <Text className="mb-2 ml-1 text-[11px] font-sans-sb uppercase tracking-wider text-faint">{children}</Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">{children}</View>;
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
