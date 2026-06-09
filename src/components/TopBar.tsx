import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../context/notifications';
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
  const { unreadCount, open } = useNotifications();

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
            onPress={open}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={18} color={c.muted} />
            {unreadCount > 0 ? (
              <View
                className="absolute items-center justify-center rounded-full"
                style={{ top: 2, right: 1, minWidth: 15, height: 15, paddingHorizontal: 3, backgroundColor: c.accent }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'HankenGrotesk_700Bold' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
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
