import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '../context/auth';
import { SUPPORTED_LANGS, langByCode } from '../lib/translate';
import { useThemeColors } from '../theme';
import { Sheet } from './ui';

/**
 * The language picker sheet — used from the chrome (TopBar / NavRail) and at
 * sign-up. By default it reads/writes the signed-in member's `preferred_lang`;
 * pass `value` + `onPick` to drive it from local state instead (e.g. pre-auth).
 */
export function LanguageSheet({
  visible, onClose, value, onPick,
}: {
  visible: boolean;
  onClose: () => void;
  value?: string;
  onPick?: (code: string) => void;
}) {
  const c = useThemeColors();
  const { profile, saveProfile } = useAuth();
  const current = value ?? profile?.preferred_lang ?? 'en';

  const pick = async (code: string) => {
    onClose();
    if (onPick) { onPick(code); return; }
    if (code === current) return;
    try { await saveProfile({ preferred_lang: code }); } catch { /* best-effort */ }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Choose your language">
      <Text className="mb-3 text-[13px] leading-[19px] text-muted">
        Posts, home food, listings and more will appear in your language. (App menus stay in English for now.)
      </Text>
      <View className="gap-1.5">
        {SUPPORTED_LANGS.map((l) => {
          const active = l.code === current;
          return (
            <Pressable
              key={l.code}
              onPress={() => pick(l.code)}
              className="flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:opacity-80"
              style={{ borderColor: active ? c.accent : c.line, backgroundColor: active ? c.accent + '12' : c.surface }}
            >
              <Text className="flex-1 font-sans-sb text-[15px] text-ink">
                {l.label}
                {l.label !== l.name ? <Text className="font-sans text-[12px] text-faint">{`   ·   ${l.name}`}</Text> : null}
              </Text>
              <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={active ? c.accent : c.faint} />
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/** The short label for a language code (e.g. 'kn' → 'ಕನ್ನಡ'), for trigger buttons. */
export function langLabel(code: string | null | undefined): string {
  return langByCode(code)?.label ?? 'English';
}
