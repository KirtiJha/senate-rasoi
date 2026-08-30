import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import { haptics } from '../lib/haptics';
import { AView, dur, ease, spring } from '../lib/motion';
import { useThemeColors } from '../theme';
import { Touchable } from './ui';

type Item = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

// Standard 5-item bar, icons only (Feed lives on the Home hub).
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
      style={{ paddingBottom: padBottom, paddingTop: 12, backgroundColor: c.bg, borderTopColor: c.line, borderTopWidth: 1 }}
      className="flex-row items-center justify-around"
    >
      {ITEMS.map((it) => {
        const active = activeFor(it.route);
        return (
          <Touchable
            key={it.route}
            feel="icon"
            haptic={null}
            onPress={() => { if (!active) haptics.select(); router.navigate(it.route as any); }}
            hitSlop={6}
            className="flex-1 items-center pb-1.5"
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={it.label}
          >
            <TabIcon active={active} icon={active ? it.activeIcon : it.icon} color={active ? c.accent : c.muted} />
          </Touchable>
        );
      })}
    </View>
  );
}

/**
 * A single overshoot when a tab becomes active: 1 → 1.18 → 1.
 *
 * The colour change alone reads as a state report; the pop is what makes the
 * bar feel like it responded to you. Inactive tabs also move from `faint`
 * (2.45:1 — a contrast failure on the app's primary navigation) to `muted`.
 */
function TabIcon({
  active, icon, color,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active || reduced) return;
    scale.set(withSequence(
      withTiming(1.18, { duration: dur.instant, easing: ease.emphasized }),
      withSpring(1, spring.press),
    ));
  }, [active, reduced, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AView style={anim}>
      <Ionicons name={icon} size={25} color={color} />
    </AView>
  );
}
