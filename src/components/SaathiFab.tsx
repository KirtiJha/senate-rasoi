import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../lib/haptics';
import { AView, spring } from '../lib/motion';
import { useThemeColors } from '../theme';
import { SaathiMark } from './SaathiMark';
import { Touchable } from './ui';

/**
 * Saathi, reachable from anywhere.
 *
 * The assistant was previously two taps deep from most screens — Home, then
 * the ask bar — which is one tap too many for the thing you reach for when
 * you are stuck on some *other* screen. That is exactly when you want it: on
 * the listings page, wondering if anyone does tuitions.
 *
 * WHERE IT SITS, AND WHAT IT AVOIDS
 * Above the floating tab bar, right-aligned, clear of the centre "+" so the
 * two never read as a pair of equal actions — posting is deliberate, asking is
 * casual.
 *
 * It hides in the places a floating button is wrong rather than merely
 * unhelpful: on Saathi itself (a button that goes where you already are),
 * behind the keyboard (where it would cover the input it is floating over),
 * and in the message thread, which is a focused two-person conversation and
 * not somewhere to bolt a third party onto the screen.
 */
export function SaathiFab() {
  const router = useRouter();
  const pathname = usePathname();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Enters after the screen has settled, so it arrives as an offer rather than
  // competing with whatever the resident actually opened.
  const pop = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    pop.set(withDelay(320, withSpring(1, spring.card)));
  }, [reduced, pop]);
  const enter = useAnimatedStyle(() => ({
    opacity: pop.get(),
    transform: [{ scale: 0.7 + pop.get() * 0.3 }],
  }));

  const hidden =
    keyboardUp
    || pathname === '/ask'
    || pathname.startsWith('/messages/');
  if (hidden) return null;

  // Clears the tab bar: its own lift, plus the bar's height.
  const bottom = insets.bottom + 12 + 62;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: 16, bottom, zIndex: 20 }}
    >
      <AView style={enter}>
        <Touchable
          feel="icon"
          haptic={null}
          onPress={() => { haptics.tap(); router.push('/ask' as never); }}
          accessibilityRole="button"
          accessibilityLabel="Ask Saathi"
        >
          <View
            pointerEvents="none"
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
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
    </View>
  );
}
