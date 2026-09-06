import { Ionicons } from '@expo/vector-icons';
import { useT } from '../context/chromeLang';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth';
import { useNotifications } from '../context/notifications';
import { useThemeColors } from '../theme';
import { Wordmark } from './Brand';
import { SaathiMark } from './SaathiMark';
import { LiveDot } from './ui/Badge';

// Slim brand bar used as the phone header.
export function TopBar({ live = false }: { live?: boolean }) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const { unreadCount, open } = useNotifications();
  const t = useT();
  const { community } = useAuth();

  return (
    <View className="border-b border-line bg-bg" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <Link href="/" asChild>
          <Pressable hitSlop={6} accessibilityLabel="Go to Home" className="active:opacity-70">
            <Wordmark size={20} />
          </Pressable>
        </Link>
        <View className="flex-row items-center gap-2">
          {community ? (
            <View
              className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
              style={{ backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accentLine, maxWidth: 150 }}
            >
              <Ionicons name="business" size={11} color={c.accent} />
              <Text className="text-[11px] font-sans-sb" numberOfLines={1} style={{ color: c.accent }}>{community.name}</Text>
            </View>
          ) : null}
          {live ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-inset px-2.5 py-1">
              <LiveDot color={c.accent} size={6} />
              <Text className="font-sans-sb text-[11px] text-muted">Live</Text>
            </View>
          ) : null}
          {/* Saathi, where the light/dark switch used to be.
              Two of the app's scarcest slots were spent on a preference people
              set once — and which Settings already owns — while the assistant
              was a second floating green circle that sat on top of whatever
              primary action each screen had. This is the trade: theme goes
              back to Settings, Saathi becomes reachable from every tab. */}
          <Link href="/ask" asChild>
            <Pressable
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
              style={{ backgroundColor: c.accentSoft }}
              accessibilityRole="button" accessibilityLabel={t('Ask Saathi')}
            >
              <SaathiMark size={19} />
            </Pressable>
          </Link>
          <Pressable
            onPress={open}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70"
            accessibilityRole="button" accessibilityLabel={t('Notifications')}
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
        </View>
      </View>
    </View>
  );
}
