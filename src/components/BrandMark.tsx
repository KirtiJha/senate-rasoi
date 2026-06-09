import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * The Aangan mark — a warm coral tile holding two little homes side by side:
 * a friendly neighbourhood / society. Relatable and unique to the brand.
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
      {/* two homes — a tiny neighbourhood */}
      <Path d="M34 24 L51 45 L51 73 Q51 78 46 78 L23 78 Q18 78 18 73 L18 45 Z" fill="#FFFFFF" />
      <Path d="M68 35 L83 53 L83 73 Q83 78 78 78 L59 78 Q54 78 54 73 L54 53 Z" fill="#FFFFFF" />
      {/* doorways */}
      <Rect x="29" y="62" width="11" height="16" rx="3" fill={`url(#${id})`} />
      <Rect x="63" y="64" width="9" height="14" rx="2.5" fill={`url(#${id})`} />
    </Svg>
  );
}
