import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemePreference } from '../context/theme';
import { Wordmark } from './Brand';
import { useAuth } from '../context/auth';
import { layout, useThemeColors } from '../theme';

type Item = { href: '/' | '/post' | '/you'; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap };

const ITEMS: Item[] = [
  { href: '/', label: 'Discover', icon: 'compass-outline', activeIcon: 'compass' },
  { href: '/you', label: 'You', icon: 'person-outline', activeIcon: 'person' },
];

// Desktop / wide-tablet left navigation rail.
export function NavRail() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const { isChef, isAdmin } = useAuth();
  const { resolved, toggle } = useThemePreference();
  const isDark = resolved === 'dark';

  return (
    <View
      className="border-r border-line bg-bg"
      style={{ width: layout.rail, paddingTop: insets.top + 18, paddingHorizontal: 14, paddingBottom: 18 }}
    >
      <View className="mb-6 px-2">
        <Wordmark size={20} />
      </View>

      {ITEMS.map((it) => {
        const active = it.href === '/' ? path === '/' : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} asChild>
            <Pressable
              className={`mb-1 flex-row items-center gap-3 rounded-2xl px-3 py-2.5 ${
                active ? 'bg-inset' : 'active:bg-inset'
              }`}
            >
              <Ionicons
                name={active ? it.activeIcon : it.icon}
                size={21}
                color={active ? c.accent : c.muted}
              />
              <Text className={`text-[15px] ${active ? 'font-sans-bold text-ink' : 'font-sans-md text-muted'}`}>
                {it.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}

      {isChef ? (
        <Link href="/post" asChild>
          <Pressable className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 active:bg-accent-press">
            <Ionicons name="add" size={20} color={c.onAccent} />
            <Text className="font-sans-sb text-[15px] text-on-accent">Post a dish</Text>
          </Pressable>
        </Link>
      ) : null}

      {isAdmin ? (
        <Link href="/admin" asChild>
          <Pressable
            className={`mt-1 flex-row items-center gap-3 rounded-2xl px-3 py-2.5 ${
              path === '/admin' ? 'bg-inset' : 'active:bg-inset'
            }`}
          >
            <Ionicons
              name={path === '/admin' ? 'shield-checkmark' : 'shield-checkmark-outline'}
              size={21}
              color={path === '/admin' ? c.accent : c.muted}
            />
            <Text className={`text-[15px] ${path === '/admin' ? 'font-sans-bold text-ink' : 'font-sans-md text-muted'}`}>
              Admin
            </Text>
          </Pressable>
        </Link>
      ) : null}

      <View className="flex-1" />

      {/* Theme toggle */}
      <Pressable
        onPress={toggle}
        className="mb-3 flex-row items-center gap-2.5 rounded-2xl px-3 py-2.5 active:bg-inset"
        accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={c.muted} />
        <Text className="font-sans-md text-[13px] text-muted">{isDark ? 'Light mode' : 'Dark mode'}</Text>
      </Pressable>

      <Text className="px-2 text-[11px] text-faint">Senate Society · home kitchens</Text>
    </View>
  );
}
