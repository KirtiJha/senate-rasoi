import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { useThemeColors } from '../theme';

/**
 * Saathi's mark: the courtyard bloom, speaking.
 *
 * WHY NOT SHAKING HANDS
 * Two hands is the right idea — साथी means companion — and the wrong shape. At
 * the sizes this actually appears (18px in the nav rail, 24px in a chat
 * header, 26px on a home tile) two interlocking hands collapse into a smudge:
 * too many strokes crossing in too little space, and nothing left that reads
 * as either hands or helper.
 *
 * A speech bubble reads instantly at any size — it is one closed shape with a
 * tail, and everyone already knows what it means. Putting the eight-petal
 * bloom inside it does the rest: this is Aangan, and it talks.
 *
 * The bloom is reduced to five petals here. Eight is right for the brand mark
 * at 128px and turns to mush at 18px, where the gaps between petals fall below
 * a pixel. Fewer, fatter petals keep the flower legible when it is tiny —
 * the mark stays recognisable rather than technically faithful.
 */
export function SaathiMark({
  size = 24,
  color,
  /** Solid bubble with the bloom reversed out — for active nav states. */
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const c = useThemeColors();
  const tint = color ?? c.accent;

  // Bloom on the bubble when filled, bubble-coloured when not.
  const petal = filled ? c.bg : tint;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Saathi">
      {/* Bubble with a tail at the lower left. Drawn as one path so the tail
          joins the body cleanly instead of overlapping it — an overlap shows
          as a seam once there is a fill behind it. */}
      <Path
        d="M13 5.5h22a9.5 9.5 0 0 1 9.5 9.5v12a9.5 9.5 0 0 1-9.5 9.5H20.5l-8.1 6.6a1.2 1.2 0 0 1-2-.93V36.4A9.5 9.5 0 0 1 3.5 27V15A9.5 9.5 0 0 1 13 5.5Z"
        fill={filled ? tint : 'none'}
        stroke={tint}
        strokeWidth={filled ? 0 : 3}
        strokeLinejoin="round"
      />
      <G transform="translate(24,21)">
        {[0, 72, 144, 216, 288].map((a) => (
          <G key={a} transform={`rotate(${a})`}>
            <Ellipse cx={0} cy={-6.4} rx={3.1} ry={6.4} fill={petal} opacity={0.92} />
          </G>
        ))}
        <Circle cx={0} cy={0} r={2.9} fill={filled ? tint : c.bg} />
        <Circle cx={0} cy={0} r={2.9} fill={petal} opacity={filled ? 0 : 0.001} />
      </G>
    </Svg>
  );
}
