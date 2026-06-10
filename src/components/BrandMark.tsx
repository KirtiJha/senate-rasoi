import Svg, { Circle, Ellipse, G, Rect } from 'react-native-svg';

// 8 petals of the diversity flower (one colour per neighbour / language).
const PETALS = [
  { a: 0, c: '#E8650A', o: 0.95 },
  { a: 45, c: '#D4537E', o: 0.92 },
  { a: 90, c: '#5DCAA5', o: 0.92 },
  { a: 135, c: '#AFA9EC', o: 0.92 },
  { a: 180, c: '#FAC775', o: 0.92 },
  { a: 225, c: '#F0997B', o: 0.92 },
  { a: 270, c: '#85B7EB', o: 0.92 },
  { a: 315, c: '#97C459', o: 0.92 },
];

/**
 * The Aangan mark — a dark tile holding a multicolour "diversity" flower with a
 * warm dot at its heart. Ported from assets/images/aangan_diversity_icon_dark.svg.
 */
export function BrandMark({ size = 40 }: { size?: number; id?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="Aangan">
      <Rect width="512" height="512" rx="112" fill="#1A1A1A" />
      <G transform="translate(256,256)">
        {PETALS.map((p) => (
          <G key={p.a} transform={`rotate(${p.a})`}>
            <Ellipse cx={0} cy={-90} rx={30} ry={90} fill={p.c} opacity={p.o} />
          </G>
        ))}
        <Circle cx={0} cy={0} r={52} fill="#1A1A1A" />
        {PETALS.map((p) => (
          <G key={`i${p.a}`} transform={`rotate(${p.a})`}>
            <Ellipse cx={0} cy={-30} rx={18} ry={26} fill={p.c} opacity={0.28} />
          </G>
        ))}
        <Circle cx={0} cy={0} r={30} fill="#ffffff" opacity={0.95} />
        <Circle cx={0} cy={0} r={20} fill="#E8650A" />
        <Circle cx={0} cy={0} r={8} fill="#ffffff" />
        <Circle cx={0} cy={0} r={3.5} fill="#E8650A" />
      </G>
    </Svg>
  );
}
