import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemePreference } from '../context/theme';
import { useThemeColors } from '../theme';
import { Wordmark } from './Brand';
import { LiveDot } from './ui/Badge';

// Slim brand bar used as the phone header.
export function TopBar({ live = false }: { live?: boolean }) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const { resolved, toggle } = useThemePreference();
  const isDark = resolved === 'dark';

  return (
    <View className="border-b border-line bg-bg" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <Link href="/" asChild>
          <Pressable hitSlop={6} accessibilityLabel="Go to Home" className="active:opacity-70">
            <Wordmark size={20} />
          </Pressable>
        </Link>
        <View className="flex-row items-center gap-2">
          {live ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-inset px-2.5 py-1">
              <LiveDot color={c.accent} size={6} />
              <Text className="font-sans-sb text-[11px] text-muted">Live</Text>
            </View>
          ) : null}
          <Pressable
            onPress={toggle}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70"
            accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={17} color={isDark ? c.accent : c.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
