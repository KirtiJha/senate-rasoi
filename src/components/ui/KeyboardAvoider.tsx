import { ReactNode, useEffect, useState } from 'react';
import { Keyboard, Platform, ViewStyle } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

import { useThemeColors } from '../../theme';

/**
 * Keeps whatever is at the bottom of a screen above the keyboard.
 *
 * WHY THIS EXISTS
 * Fifteen screens used `KeyboardAvoidingView` with
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. On Android an
 * undefined behavior makes that component do nothing at all — it worked only
 * because the Android window used to resize itself under the keyboard.
 *
 * Expo SDK 54+ turns edge-to-edge on by default, and an edge-to-edge window
 * does NOT resize. So on Android the keyboard now simply covers the bottom of
 * the screen: on Ask Aangan it covers the very input you just tapped, and on
 * the composer screens it covers the send button.
 *
 * This reads the keyboard's real height from Reanimated and pads by it on the
 * UI thread, so the content lifts in step with the keyboard's own animation
 * instead of jumping a frame late. Reanimated has been autolinked since the
 * first commit, so this ships over the air — `react-native-keyboard-controller`
 * would have meant a new native build.
 *
 * Padding rather than translate: translating moves the content up but leaves
 * its hit area behind on Android, which is a subtler version of the bug we are
 * fixing. Padding changes layout, so touches follow.
 */
export function KeyboardAvoider({
  children,
  style,
  /**
   * Fills its parent on the page background — what every full screen wants,
   * and what the fifteen call sites spelled as `className="flex-1 bg-bg"`.
   * Turn it off for a bottom sheet, which must size to its content and let
   * the scrim behind it show through.
   */
  fill = true,
}: {
  children: ReactNode;
  style?: ViewStyle;
  fill?: boolean;
}) {
  const c = useThemeColors();
  const keyboard = useAnimatedKeyboard();

  const lift = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.get(),
  }));

  return (
    <Animated.View style={[fill && { flex: 1, backgroundColor: c.bg }, style, lift]}>
      {children}
    </Animated.View>
  );
}

/**
 * The keyboard's height, from the JS Keyboard API rather than Reanimated.
 *
 * WHY A SECOND MECHANISM EXISTS. `useAnimatedKeyboard` above reads the window
 * insets of the root view, and an RN `Modal` on Android is a separate native
 * window — so inside a Modal it reports nothing and the content never lifts.
 * Every bottom sheet in this app is a Modal, which is why they were all still
 * broken after the fifteen full screens were fixed.
 *
 * `Keyboard.addListener` does fire inside a Modal. The cost is that it arrives
 * a frame or two late, so the lift is a small jump rather than a glide — worth
 * it where the alternative is a submit button nobody can reach.
 */
export function useKeyboardInset(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // `Will` events exist only on iOS and fire before the animation, which is
    // smoother; Android has to use the `Did` pair.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return height;
}
