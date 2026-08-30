import { ReactNode } from 'react';
import { Platform, ViewStyle } from 'react-native';
import { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AView, dur, ease, stagger } from '../../lib/motion';

/**
 * Content arriving: 14px up plus a fade, staggered by position.
 *
 * Reanimated's entering/exiting animations default to ReduceMotion.System, so
 * this is accessibility-correct for free — a reduce-motion user simply sees the
 * content appear.
 *
 * FlashList is deliberately NOT a target. It recycles cells, so an unguarded
 * `entering` replays every time a row is reused and the list strobes while you
 * scroll — the most common way Reanimated makes an app feel worse. Use this on
 * ScrollView sections only.
 *
 * Web is excluded: layout animations on react-native-web are the least mature
 * path, and this app's other surface is a PWA. Native gets the motion; web gets
 * the content instantly, which is the right trade.
 */
export function Rise({
  index = 0,
  delay = 0,
  children,
  className,
  style,
}: {
  index?: number;
  delay?: number;
  children: ReactNode;
  className?: string;
  style?: ViewStyle;
}) {
  if (Platform.OS === 'web') {
    return (
      <AView className={className} style={style}>
        {children}
      </AView>
    );
  }

  return (
    <AView
      className={className}
      style={style}
      entering={FadeInDown.duration(dur.expressive)
        .delay(delay + stagger(index))
        .easing(ease.standard)
        // FadeInDown's default 25px offset is too much for a dense screen;
        // 14 is what makes it read as expensive rather than bouncy.
        .withInitialValues({ transform: [{ translateY: 14 }] })}
      exiting={FadeOut.duration(dur.quick).easing(ease.exit)}
      layout={LinearTransition.duration(dur.standard).easing(ease.standard)}
    >
      {children}
    </AView>
  );
}
