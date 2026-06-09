import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../theme';

type Item = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

// Standard 5-item bar (Feed lives on the Home hub).
const ITEMS: Item[] = [
  { route: '/', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { route: '/listings', label: 'Listings', icon: 'pricetags-outline', activeIcon: 'pricetags' },
  { route: '/post', label: 'Post', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { route: '/search', label: 'Search', icon: 'search-outline', activeIcon: 'search' },
  { route: '/you', label: 'You', icon: 'person-outline', activeIcon: 'person' },
];

/** Persistent phone bottom navigation — rendered at the root so it stays visible
 *  across every screen (tabs and community pages alike). */
export function BottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();

  // Keep the bar out of focused, input-heavy flows.
  if (pathname.startsWith('/messages/')) return null;

  const isWeb = Platform.OS === 'web';
  const padBottom = isWeb ? Math.max(insets.bottom + 8, 16) : insets.bottom;

  const activeFor = (route: string) => (route === '/' ? pathname === '/' : pathname.startsWith(route));

  return (
    <View
      style={{ paddingBottom: padBottom, paddingTop: 8, backgroundColor: c.bg, borderTopColor: c.line, borderTopWidth: 1 }}
      className="flex-row items-start justify-around"
    >
      {ITEMS.map((it) => {
        const active = activeFor(it.route);
        const color = active ? c.accent : c.faint;
        return (
          <Pressable key={it.route} onPress={() => router.navigate(it.route as any)} hitSlop={4} className="flex-1 items-center">
            <Ionicons name={active ? it.activeIcon : it.icon} size={24} color={color} />
            <Text style={{ color, fontSize: 11, fontFamily: 'HankenGrotesk_600SemiBold', marginTop: 2 }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
