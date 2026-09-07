import { Ionicons } from '@expo/vector-icons';
import { useT } from '../context/chromeLang';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import { useUnreadDms } from '../context/unread';
import { haptics } from '../lib/haptics';
import { AView, dur, ease, spring } from '../lib/motion';
import { useThemeColors } from '../theme';
import { CreateSheet } from './CreateSheet';
import { Touchable } from './ui';

type Item = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  /** Centre action — rendered as the app's one FAB, lifted above the bar. */
  fab?: boolean;
  /** Shows the unread-messages dot. */
  unread?: boolean;
};

/**
 * Five destinations, labelled.
 *
 * WHY THIS SET
 * The bar used to be Home · Listings · Post · Search · You, icon-only. Two
 * problems. Feed and Messages — both core surfaces — had no slot at all, so the
 * DM inbox sat about eight tile-rows down the Home scroll and cost four taps
 * plus a scroll to reach. And "pricetags" and "person" outlines are not
 * self-evident to a resident who is not a power user, with no way to learn
 * them; Material 3 treats labels as required at five items.
 *
 * Search leaves the bar because the redesigned Home puts an ask-or-search field
 * in hero position — a resident who needs a plumber is answering a question,
 * not browsing. Listings leaves because its content leads the "Around the
 * aangan" list on Home, and every category remains one tap from there.
 */
const ITEMS: Item[] = [
  { route: '/', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { route: '/feed', label: 'Feed', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  { route: '__create', label: 'Add', icon: 'add', activeIcon: 'add', fab: true },
  { route: '/messages', label: 'Inbox', icon: 'mail-outline', activeIcon: 'mail', unread: true },
  { route: '/you', label: 'You', icon: 'person-outline', activeIcon: 'person' },
];

/**
 * Persistent phone navigation, rendered at the root so it survives every
 * screen. Floating rather than edge-to-edge: inset from the sides and lifted
 * off the bottom, so the app reads as sitting on the ground rather than
 * running into it.
 */
/**
 * A keyboard is on screen when it takes this much of the viewport. Real
 * phone keyboards are 250–350px tall; nothing else that resizes the visual
 * viewport comes close.
 */
const KEYBOARD_MIN_PX = 140;

/**
 * True while the software keyboard is on screen.
 *
 * NATIVE. Android only ever fires the "did" events, so both platforms use
 * those — the iOS "will" events would desync the two.
 *
 * WEB. There are no events to listen to: react-native-web's Keyboard module
 * is a stub whose `addListener` returns a remover and never fires anything.
 * So on the web build this hook was permanently false and the bar stayed on
 * screen through every keyboard, which is where the drifting comes from. The
 * browser scrolls the page to keep the focused input above the keyboard, and
 * on iOS it does that by panning the visible window around inside a layout
 * viewport that has not changed size. The bar is anchored to the bottom of
 * that layout viewport, so it rides up and down with the pan instead of
 * holding still.
 *
 * visualViewport is the only thing that knows. The keyboard is the difference
 * between the layout viewport and the part of it you can actually see:
 * window.innerHeight does not shrink for a keyboard on iOS, visualViewport
 * does. Browser chrome collapsing shrinks both together, so it never reads as
 * a keyboard. Android Chrome shrinks both as well, and there the shell simply
 * gets shorter and the bar sits above the keyboard on its own.
 */
function useKeyboardVisible() {
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const show = Keyboard.addListener('keyboardDidShow', () => setUp(true));
      const hide = Keyboard.addListener('keyboardDidHide', () => setUp(false));
      return () => { show.remove(); hide.remove(); };
    }

    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    // `scroll` as well as `resize`: iOS pans the visible window without
    // resizing it once the keyboard is already up.
    const read = () => setUp(window.innerHeight - vv.height > KEYBOARD_MIN_PX);
    read();
    vv.addEventListener('resize', read);
    vv.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    return () => {
      vv.removeEventListener('resize', read);
      vv.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  return up;
}

export function BottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const unread = useUnreadDms();
  const keyboardUp = useKeyboardVisible();
  const [createOpen, setCreateOpen] = useState(false);
  const t = useT();

  // Keep the bar out of focused, input-heavy flows only.
  if (pathname.startsWith('/messages/')) return null;
  // And out of the way of the keyboard: under it the bar cannot be tapped,
  // and its presence would make KeyboardAvoider overshoot by its own height.
  if (keyboardUp) return null;

  const isWeb = Platform.OS === 'web';
  // Web threw the safe-area inset away and used a flat 8. In a browser tab
  // that is right — the browser's own toolbar occupies the bottom and the
  // inset reads 0 — but installed to the home screen there is no toolbar,
  // and the bar landed on top of the home indicator. Take whichever is
  // larger and both cases are covered.
  const liftBottom = (isWeb ? Math.max(insets.bottom, 8) : insets.bottom) + 12;

  const activeFor = (route: string) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route);

  return (
    <>
    <View style={{ paddingHorizontal: 12, paddingBottom: liftBottom, backgroundColor: 'transparent' }}>
      <View
        className="flex-row items-stretch justify-around rounded-[28px] border border-line bg-surface"
        style={{ paddingTop: 8, paddingBottom: 6, boxShadow: c.shadowBar } as any}
      >
        {ITEMS.map((it) => {
          const active = activeFor(it.route);

          // No label and no lift: just the circle, centred in its slot and
          // sitting on the same axis as the other four icons. The column
          // stretches to the row height and centres its child, so the circle's
          // middle lands on the icons' middle whatever the label height is.
          if (it.fab) {
            return (
              <View key={it.route} className="flex-1 items-center justify-center">
                <Touchable
                  feel="icon"
                  onPress={() => { haptics.tap(); setCreateOpen(true); }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('Add something')}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: c.accent,
                      boxShadow: c.shadowFab,
                    } as any}
                  >
                    <Ionicons name="add" size={26} color={c.onAccent} />
                  </View>
                </Touchable>
              </View>
            );
          }

          return (
            <View key={it.route} className="flex-1">
              <Touchable
                feel="icon"
                haptic={null}
                onPress={() => {
                  if (!active) haptics.select();
                  router.navigate(it.route as any);
                }}
                hitSlop={6}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={it.unread && unread > 0 ? `${t(it.label)}, ${unread} unread` : t(it.label)}
              >
                <View pointerEvents="none" className="items-center">
                  {/* A 26x3 bar pinned to the item's top edge — the colonnade note. */}
                  <View
                    style={{
                      width: 26,
                      height: 3,
                      borderRadius: 2,
                      marginBottom: 5,
                      backgroundColor: active ? c.accent : 'transparent',
                    }}
                  />
                  <View>
                    <TabIcon
                      active={active}
                      icon={active ? it.activeIcon : it.icon}
                      color={active ? c.accent : c.muted}
                    />
                    {it.unread && unread > 0 ? (
                      <View
                        style={{
                          position: 'absolute', top: -2, right: -3,
                          width: 8, height: 8, borderRadius: 4,
                          backgroundColor: c.highlight,
                          borderWidth: 1.5, borderColor: c.surface,
                        }}
                      />
                    ) : null}
                  </View>
                  <Text
                    className="mt-1 font-sans-sb"
                    style={{ fontSize: 11, lineHeight: 14, color: active ? c.accent : c.muted }}
                    numberOfLines={1}
                  >
                    {t(it.label)}
                  </Text>
                </View>
              </Touchable>
            </View>
          );
        })}
      </View>
    </View>
    {/* The centre button used to go straight to the marketplace composer —
        one of ten things somebody might want to add, and no way out to the
        other nine. It asks now. */}
    <CreateSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

/**
 * A single overshoot when a tab becomes active: 1 → 1.18 → 1.
 *
 * The colour change alone reads as a status report; the pop is what makes the
 * bar feel like it responded to you. Inactive icons also moved off `faint`
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
      <Ionicons name={icon} size={23} color={color} />
    </AView>
  );
}
