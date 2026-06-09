import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * The Aangan mark — a warm coral tile holding a white "courtyard": a rounded
 * frame of homes around an open central space (आँगन = courtyard) with a small
 * gathering point at its heart. Geometric, friendly, and unique to the brand.
 */
export function BrandMark({ size = 40, id = 'aangan-mark' }: { size?: number; id?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Aangan">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF7A57" />
          <Stop offset="1" stopColor="#F5492B" />
        </LinearGradient>
      </Defs>
      {/* tile */}
      <Rect x="0" y="0" width="100" height="100" rx="30" fill={`url(#${id})`} />
      {/* the ring of homes */}
      <Rect x="26" y="26" width="48" height="48" rx="15" fill="#FFFFFF" />
      {/* the open courtyard (cut back to the tile colour) */}
      <Rect x="38" y="38" width="24" height="24" rx="8" fill={`url(#${id})`} />
      {/* the gathering point */}
      <Circle cx="50" cy="50" r="4.4" fill="#FFFFFF" />
    </Svg>
  );
}
