import Svg, { Circle, Path } from 'react-native-svg';

import { useThemeColors } from '../theme';

/**
 * Saathi's mark: two neighbours, one slightly behind the other.
 *
 * साथी means companion, and that is what this draws — not a tool, not a
 * sparkle, not a search box. Two people, one a step behind and lighter, which
 * is the whole idea: somebody alongside you rather than in front of you.
 *
 * WHY THIS SHAPE AND NOT A HANDSHAKE
 * A handshake is the obvious picture and the wrong geometry. It needs
 * interlocking fingers, and at the sizes this actually appears — 18px in the
 * nav rail, 22px in a header, 24px beside every reply — the gaps between
 * fingers fall below a pixel and it collapses into a blob. Two heads and two
 * shoulders are four primitives with clear space between them, and they stay
 * legible all the way down.
 *
 * Built from circles and arcs on purpose. Freehand path data is guesswork
 * without a render in front of you; primitives come out exactly as specified.
 */
export function SaathiMark({
  size = 24,
  color,
  /** Both figures at full strength — for active nav states. */
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const c = useThemeColors();
  const tint = color ?? c.accent;
  // The companion sits back. Fading rather than outlining keeps it one colour,
  // which matters when this is drawn in white on the accent.
  const behind = filled ? 0.75 : 0.55;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Saathi">
      <Circle cx={17} cy={17} r={6.5} fill={tint} />
      <Path d="M6 41 a11 11 0 0 1 22 0 Z" fill={tint} />
      <Circle cx={33} cy={20} r={5.5} fill={tint} opacity={behind} />
      <Path d="M24 41 a9.5 9.5 0 0 1 19 0 Z" fill={tint} opacity={behind} />
    </Svg>
  );
}
