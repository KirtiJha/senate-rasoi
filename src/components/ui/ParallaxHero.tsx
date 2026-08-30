import { ReactNode } from 'react';
import { View } from 'react-native';
import {
  Extrapolation, SharedValue, interpolate, useAnimatedStyle,
} from 'react-native-reanimated';

import { AView } from '../../lib/motion';

/**
 * A hero image that reacts to the scroll it sits above.
 *
 * Two behaviours, both driven by the same shared value so neither costs a
 * render:
 *
 *   Scrolling down — the image translates at 0.4x, so it drifts behind the
 *   content rather than sliding out with it. That difference in rate is the
 *   whole effect; the content appears to move over something solid.
 *
 *   Overscrolling up — the image scales past 1 and its container grows, so the
 *   photo stretches into the gap instead of exposing the background. This is
 *   the piece people read as "expensive", and it is four lines.
 *
 * The scroll value comes from the parent so one handler drives the hero, the
 * fading header and anything else on the screen.
 */
export function ParallaxHero({
  scrollY,
  height,
  children,
}: {
  scrollY: SharedValue<number>;
  height: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      transform: [
        // Drift, not slide.
        { translateY: y > 0 ? y * 0.4 : 0 },
        // Rubber-band on overscroll only; never shrink on the way down, which
        // would look like the image is falling away from the header.
        {
          scale: interpolate(y, [-height, 0], [1.6, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <AView style={[{ height, width: '100%' }, style]}>{children}</AView>
    </View>
  );
}
