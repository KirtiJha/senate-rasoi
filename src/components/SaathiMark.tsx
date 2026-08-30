import Svg, { G, Path, Rect } from 'react-native-svg';

import { useThemeColors } from '../theme';

/**
 * Saathi's mark: two hands meeting.
 *
 * साथी means companion, and the handshake is the honest picture of what this
 * is — a neighbour who does something with you, not a search box.
 *
 * CROPPED AT THE WRIST on purpose. A full handshake needs arms, and arms need
 * room this never has: 18px in the nav rail, 22px in a header, 24px beside
 * every reply. Cuff, hand, grip — three shapes — is what survives at that size.
 * Everything above the wrist is detail nobody can see and strokes that close up
 * the gaps between the fingers.
 *
 * The seam between the two hands is drawn in the background colour rather than
 * left as a gap in the geometry. On a filled mark a gap would show the page
 * through it and read as a crack; a seam reads as one hand in front of the
 * other, which is what a handshake looks like.
 */
export function SaathiMark({
  size = 24,
  color,
  /** Solid rather than outlined — for active nav states. */
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const c = useThemeColors();
  const tint = color ?? c.accent;
  const seam = c.bg;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Saathi">
      {/* Lower-left hand, reaching up and right. The cuff is squarer than the
          hand so the two read as different things at a glance. */}
      <G>
        <Rect x={1.5} y={30} width={12} height={11} rx={3} transform="rotate(-22 7.5 35.5)" fill={tint} />
        <Path
          d="M10.5 33.5 L23 26.5 Q27.5 24 30 28 L31.5 30.5 Q33 33.5 29.5 35.5 L18 42 Q14 44 11.5 40 L9.5 37 Q8 34.5 10.5 33.5 Z"
          fill={tint}
        />
      </G>

      {/* Lower-right hand, mirrored. */}
      <G>
        <Rect x={34.5} y={30} width={12} height={11} rx={3} transform="rotate(22 40.5 35.5)" fill={tint} />
        <Path
          d="M37.5 33.5 L25 26.5 Q20.5 24 18 28 L16.5 30.5 Q15 33.5 18.5 35.5 L30 42 Q34 44 36.5 40 L38.5 37 Q40 34.5 37.5 33.5 Z"
          fill={tint}
          opacity={0.92}
        />
      </G>

      {/* The grip: the near hand closing over the far one, and the seam that
          makes the overlap legible instead of a single blob. */}
      <Path
        d="M18.5 28.5 Q24 25.5 29.5 28.5 L28 34 Q24 36.5 20 34 Z"
        fill={tint}
      />
      <Path
        d="M20.5 27 L28.5 31.5"
        stroke={seam}
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={filled ? 0.9 : 0.75}
      />

      {/* Thumb over the top of the grip — the detail that tips it from
          "two shapes touching" to "a handshake". */}
      <Path
        d="M19 26.5 Q22.5 22.5 26 24.5"
        stroke={tint}
        strokeWidth={4.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
