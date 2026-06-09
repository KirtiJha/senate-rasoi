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
  primary?: boolean;
};

// 5 items so the create (+) action sits dead-centre.
const ITEMS: Item[] = [
  { route: '/', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { route: '/listings', label: 'Listings', icon: 'pricetags-outline', activeIcon: 'pricetags' },
  { route: '/post', label: 'Post', icon: 'add', activeIcon: 'add', primary: true },
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
  const padBottom = Math.max(insets.bottom + (isWeb ? 6 : 2), isWeb ? 14 : 6);

  const activeFor = (route: string) => (route === '/' ? pathname === '/' : pathname.startsWith(route));

  return (
    <View
      style={{ paddingBottom: padBottom, paddingTop: 7, backgroundColor: c.bg, borderTopColor: c.line, borderTopWidth: 1 }}
      className="flex-row items-center justify-around px-1.5"
    >
      {ITEMS.map((it) => {
        const active = activeFor(it.route);
        if (it.primary) {
          return (
            <Pressable key={it.route} onPress={() => router.navigate(it.route as any)} className="items-center px-2" accessibilityLabel="New post">
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl bg-accent active:bg-accent-press"
                style={{ marginTop: -14, shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 }}
              >
                <Ionicons name="add" size={28} color={c.onAccent} />
              </View>
            </Pressable>
          );
        }
        return (
          <Pressable key={it.route} onPress={() => router.navigate(it.route as any)} hitSlop={4} className="flex-1 items-center py-0.5">
            <Ionicons name={active ? it.activeIcon : it.icon} size={23} color={active ? c.accent : c.faint} />
            <Text className="mt-0.5 text-[11px] font-sans-sb" style={{ color: active ? c.accent : c.faint }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
