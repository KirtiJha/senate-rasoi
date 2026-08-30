import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Keyboard, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../lib/haptics';
import { AView, spring } from '../lib/motion';
import { useThemeColors } from '../theme';
import { SaathiMark } from './SaathiMark';
import { Touchable } from './ui';

/**
 * Saathi, reachable from anywhere — and movable, because "anywhere" includes
 * on top of whatever you were reading.
 *
 * The assistant was two taps deep from most screens: Home, then the ask bar.
 * That is one too many for the thing you reach for while stuck on some *other*
 * screen, which is exactly when it is wanted.
 *
 * DRAGGABLE, SNAPPING TO AN EDGE. A floating button always covers something,
 * and which something depends on the screen and the person. Letting it be
 * moved costs a gesture and removes the whole argument. It snaps to the
 * nearest side on release rather than staying wherever it was dropped: loose
 * in the middle it stops reading as chrome and starts reading as a thing in
 * the way, and free placement invites a position that is half over the
 * content anyway.
 *
 * The position is remembered per device. Someone who moved it left because
 * they are left-handed did not mean "just this once".
 */

const FAB = 50;
const EDGE = 16;
/** Clear of the floating tab bar: its lift, its height, and a gap. */
const BAR = 12 + 62 + 18;
const STORE_KEY = 'saathi:fab-position';

export function SaathiFab() {
  const router = useRouter();
  const pathname = usePathname();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();

  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Resting place: bottom-right. Offsets move it from there, so 0,0 is always
  // a sane default even if a stored value is nonsense.
  const bottom = insets.bottom + BAR;
  const minX = -(width - FAB - EDGE * 2); // dragged fully left
  const maxY = 0;                          // cannot go below its resting place
  const minY = -(height - insets.top - insets.bottom - BAR - FAB - 24);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const dragging = useSharedValue(0);

  const persist = useCallback((nx: number, ny: number) => {
    AsyncStorage.setItem(STORE_KEY, JSON.stringify({ x: nx, y: ny })).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw) as { x?: number; y?: number };
        // Clamped on read: a position saved on a larger screen, or before a
        // rotation, must not put the button off the edge of this one.
        if (typeof p.x === 'number') x.set(Math.min(0, Math.max(minX, p.x)));
        if (typeof p.y === 'number') y.set(Math.min(maxY, Math.max(minY, p.y)));
      })
      .catch(() => {});
    // Deliberately once, on mount: re-running on every dimension change would
    // yank the button back mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pop = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    pop.set(withDelay(320, withSpring(1, spring.card)));
  }, [reduced, pop]);

  const pan = Gesture.Pan()
    // A press must not become a drag on the slightest wobble, or the button
    // stops being tappable for anyone with unsteady hands.
    .activeOffsetX([-10, 10])
    .activeOffsetY([-10, 10])
    .onStart(() => { dragging.set(withSpring(1, spring.press)); })
    .onChange((e) => {
      x.set(Math.min(0, Math.max(minX, x.get() + e.changeX)));
      y.set(Math.min(maxY, Math.max(minY, y.get() + e.changeY)));
    })
    .onEnd(() => {
      // Snap to whichever side is nearer, keep the height.
      const restX = x.get() < minX / 2 ? minX : 0;
      x.set(withSpring(restX, spring.card));
      dragging.set(withSpring(0, spring.press));
      runOnJS(persist)(restX, y.get());
    });

  const style = useAnimatedStyle(() => ({
    opacity: pop.get(),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: (0.7 + pop.get() * 0.3) * (1 + dragging.get() * 0.08) },
    ],
  }));

  const hidden = keyboardUp || pathname === '/ask' || pathname.startsWith('/messages/');
  if (hidden) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: EDGE, bottom, zIndex: 20 }}
    >
      <GestureDetector gesture={pan}>
        <AView style={style}>
          <Touchable
            feel="icon"
            haptic={null}
            onPress={() => { haptics.tap(); router.push('/ask' as never); }}
            accessibilityRole="button"
            accessibilityLabel="Ask Saathi"
            accessibilityHint="Drag to move this button"
          >
            <View
              pointerEvents="none"
              style={{
                width: FAB,
                height: FAB,
                borderRadius: FAB / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.accent,
                boxShadow: c.shadowFab,
              } as never}
            >
              <SaathiMark size={26} color={c.onAccent} filled />
            </View>
          </Touchable>
        </AView>
      </GestureDetector>
    </View>
  );
}
