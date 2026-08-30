import { forwardRef } from 'react';
import { PressableProps } from 'react-native';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '../../lib/haptics';
import { APressable, dur, ease, spring } from '../../lib/motion';

/**
 * The one Pressable the app uses.
 *
 * WHY THIS EXISTS
 * There are ~459 `<Pressable>` in src/ and ~216 `active:` NativeWind classes.
 * `active:` is a CSS state swap: it snaps to the pressed style in zero frames
 * and snaps back in zero frames. That is technically feedback and perceptually
 * nothing — it is the single largest reason the app feels dead under the
 * finger. This gives every one of them a sink and a spring release, in one
 * place, without touching 459 call sites by hand.
 *
 * The scale is inversely proportional to the element's size: a 40px icon
 * scaling to 0.97 is invisible, a full-width card scaling to 0.92 looks broken.
 */

/** How far a surface sinks under the finger, by physical size. */
const SINK = {
  /** Icon buttons, chevrons, small circular controls. */
  icon: 0.88,
  /** Buttons, chips, list rows — the default. */
  control: 0.95,
  /** Full-width cards and tiles. */
  card: 0.975,
} as const;

type Feel = keyof typeof SINK;

type Props = Omit<PressableProps, 'style'> & {
  feel?: Feel;
  /**
   * `null` for pure navigation — opening a card, a back chevron. Firing a buzz
   * on every tap is the fastest way to make an app feel cheap.
   */
  haptic?: keyof typeof haptics | null;
  className?: string;
  style?: PressableProps['style'];
};

export const Touchable = forwardRef<any, Props>(function Touchable(
  { feel = 'control', haptic = 'tap', onPressIn, onPressOut, onPress, style, ...rest },
  ref,
) {
  const pressed = useSharedValue(0);
  const reduced = useReducedMotion();
  const to = SINK[feel];

  // React Compiler is enabled (app.json experiments.reactCompiler), so shared
  // values must be read and written with .get()/.set() — never `.value` in a
  // component body, which the compiler will mis-memoize.
  const anim = useAnimatedStyle(() => {
    const t = pressed.get();
    return {
      transform: [{ scale: 1 - t * (1 - to) }],
      opacity: 1 - t * 0.1,
    };
  });

  // Reduce-motion users keep the opacity dip — feedback survives, geometry
  // doesn't move.
  const reducedAnim = useAnimatedStyle(() => ({ opacity: 1 - pressed.get() * 0.1 }));

  return (
    <APressable
      ref={ref}
      onPressIn={(e) => {
        pressed.set(withTiming(1, { duration: dur.instant, easing: ease.standard }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withSpring(0, spring.press));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
      style={[reduced ? reducedAnim : anim, style as any]}
      {...rest}
    />
  );
});
