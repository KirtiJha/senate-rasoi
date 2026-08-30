import { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';

import { useThemeColors } from '../../theme';
import { Touchable } from './Touchable';

/**
 * One card, three levels.
 *
 * WHY THIS EXISTS
 * There were 158 card surfaces across 81 distinct class strings, drifting
 * between `rounded-2xl` (16), `rounded-3xl` (24), an inline `borderRadius: 24`
 * and an inline `22` — with one screen using two different radii for
 * card-level surfaces. Nothing enforced the difference between "a thing that
 * holds content" and "a box".
 *
 * THE NICHE RADIUS
 * Top corners rounder than bottom — 22 and 14 — so a card reads as a doorway
 * rather than a rounded rectangle. It is one of the two mechanics that make
 * Verandah recognisable, and it is the reason this is a component and not a
 * class string: an asymmetric radius is too easy to get wrong by hand.
 *
 * ELEVATION
 * Light mode lifts cards off the limewash with a green-tinted shadow and no
 * border. Dark mode ships no shadow — it is invisible on #101512 — and carries
 * a 1px line instead. Encoding that here is what stops per-screen classes from
 * getting it wrong in one theme or the other.
 */

type Level = 'rest' | 'elevated' | 'flat';

export function Card({
  level = 'rest',
  padded = true,
  onPress,
  className = '',
  children,
  style,
  ...rest
}: ViewProps & {
  level?: Level;
  /** `false` for cards whose children own their own padding — list groups, media. */
  padded?: boolean;
  onPress?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const c = useThemeColors();

  const radius = { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 };

  // Matches the .card class in global.css exactly. That class cannot carry a
  // box-shadow — the declaration throws in the interop's parser and takes the
  // whole stylesheet with it — so cards separate with a hairline in both
  // schemes, and this component agrees rather than drifting from it.
  const surface =
    level === 'flat'
      ? { backgroundColor: c.inset, borderRadius: 18 }
      : {
          ...radius,
          backgroundColor: level === 'elevated' ? c.surface2 : c.surface,
          borderWidth: 1,
          borderColor: c.line,
        };

  const body = (
    <View style={[surface as any, padded && { padding: 20 }, style]} className={className} {...rest}>
      {children}
    </View>
  );

  if (!onPress) return body;

  return (
    <Touchable feel="card" haptic={null} onPress={onPress}>
      {body}
    </Touchable>
  );
}
