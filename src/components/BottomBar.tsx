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

/** Element types whose focus raises a software keyboard. */
function isTextField(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'image'].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * True while the software keyboard is on screen.
 *
 * NATIVE. Android only ever fires the "did" events, so both platforms use
 * those — the iOS "will" events would desync the two.
 *
 * WEB. There are no events to listen to: react-native-web's Keyboard module
 * is a stub whose `addListener` returns a remover and never fires anything.
 * So the bar stayed on screen through every keyboard, and because the browser
 * scrolls the page to keep the focused input visible, a bar anchored to the
 * bottom of the document rides up and down with it.
 *
 * TWO SIGNALS, because neither is enough on its own.
 *
 * The measurement — window.innerHeight minus visualViewport.height — is the
 * one everybody reaches for, and it did not work on iOS Safari. It rests on
 * innerHeight holding still while the visible window shrinks, and that is not
 * reliably what WebKit does: whether either number moves, and by how much,
 * depends on the browser, the version, and whether the page auto-zoomed on
 * focus. It is kept because it is the only thing that catches a keyboard
 * raised without a focus we can see, and because it is right on Android.
 *
 * The focus is the signal that actually holds. A software keyboard exists to
 * type into something, so on a touch device a focused text field means a
 * keyboard, whatever the viewport reports. maxTouchPoints gates it, so a
 * narrow desktop window with a real keyboard keeps its bar. focusout fires
 * before the next element takes focus, so that read is deferred a tick —
 * otherwise moving between two fields flashes the bar back on.
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
    const touch = (navigator.maxTouchPoints ?? 0) > 0;

    const read = () => {
      const shrunk = !!vv && window.innerHeight - vv.height > KEYBOARD_MIN_PX;
      const typing = touch && isTextField(document.activeElement);
      setUp(shrunk || typing);
    };
    const readSoon = () => setTimeout(read, 0);

    read();
    document.addEventListener('focusin', read);
    document.addEventListener('focusout', readSoon);
    window.addEventListener('resize', read);
    // `scroll` as well as `resize`: iOS pans the visible window without
    // resizing it once the keyboard is already up.
    vv?.addEventListener('resize', read);
    vv?.addEventListener('scroll', read);
    return () => {
      document.removeEventListener('focusin', read);
      document.removeEventListener('focusout', readSoon);
      window.removeEventListener('resize', read);
      vv?.removeEventListener('resize', read);
      vv?.removeEventListener('scroll', read);
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
