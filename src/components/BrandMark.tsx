import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The Aangan mark — a teal tile holding a courtyard archway with a warm dot at
 * its heart (आँगन = courtyard). Ported from assets/images/aangan_icon.svg.
 */
export function BrandMark({ size = 40 }: { size?: number; id?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="Aangan">
      <Rect width="512" height="512" rx="112" fill="#0F6E56" />
      {/* glow ring */}
      <Circle cx="256" cy="230" r="168" fill="none" stroke="#ffffff" strokeWidth="6" opacity={0.08} />
      {/* arch — outer halo / orange / inner cutout back to the tile */}
      <Path d="M156 370 L156 240 Q156 130 256 130 Q356 130 356 240 L356 370 Z" fill="#ffffff" opacity={0.12} />
      <Path d="M178 370 L178 248 Q178 152 256 152 Q334 152 334 248 L334 370 Z" fill="#E8650A" opacity={0.92} />
      <Path d="M205 370 L205 260 Q205 178 256 178 Q307 178 307 260 L307 370 Z" fill="#0F6E56" />
      {/* central dot */}
      <Circle cx="256" cy="302" r="36" fill="#FAEEDA" />
      <Circle cx="256" cy="302" r="22" fill="#E8650A" />
      <Circle cx="256" cy="302" r="8" fill="#ffffff" />
      {/* crown dots */}
      <Circle cx="256" cy="135" r="9" fill="#ffffff" opacity={0.55} />
      <Circle cx="214" cy="148" r="6" fill="#ffffff" opacity={0.35} />
      <Circle cx="298" cy="148" r="6" fill="#ffffff" opacity={0.35} />
      <Circle cx="180" cy="176" r="4.5" fill="#ffffff" opacity={0.22} />
      <Circle cx="332" cy="176" r="4.5" fill="#ffffff" opacity={0.22} />
      {/* base step */}
      <Rect x="136" y="364" width="240" height="20" rx="7" fill="#ffffff" opacity={0.45} />
      <Rect x="156" y="382" width="200" height="14" rx="5" fill="#0A4F3A" opacity={0.5} />
      {/* flanking pillars */}
      <Rect x="130" y="290" width="26" height="80" rx="6" fill="#ffffff" opacity={0.12} />
      <Rect x="356" y="290" width="26" height="80" rx="6" fill="#ffffff" opacity={0.12} />
    </Svg>
  );
}
