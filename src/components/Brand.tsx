import { Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G } from 'react-native-svg';
import { BrandMark } from './BrandMark';

/** Inline wordmark: the Aangan courtyard mark + name. */
export function Wordmark({ size = 20, markOnly = false }: { size?: number; markOnly?: boolean }) {
  const box = size * 1.5;
  return (
    <View className="flex-row items-center gap-2">
      <BrandMark size={box} id="wm-mark" />
      {markOnly ? null : (
        <Text style={{ fontSize: size }} className="font-display text-ink">
          Aangan
        </Text>
      )}
    </View>
  );
}

/** Large centered lockup for the auth / splash screens. */
export function Brandfull() {
  return (
    <View className="items-center">
      <BrandMark size={76} id="bf-mark" />
      <Text style={{ fontSize: 30 }} className="mt-3 font-display-x text-accent">
        Aangan
      </Text>
      <Text className="mt-0.5 text-[10px] font-sans-sb uppercase tracking-[1.5px] text-faint">
        every home · every language · one courtyard
      </Text>
    </View>
  );
}

/** 8 petals of the diversity flower (matches assets/images/aangan_diversity_logo.svg). */
export const LOGO_PETALS = [
  { a: 0, c: '#E8650A', o: 0.92 },
  { a: 45, c: '#D4537E', o: 0.88 },
  { a: 90, c: '#1D9E75', o: 0.9 },
  { a: 135, c: '#534AB7', o: 0.88 },
  { a: 180, c: '#BA7517', o: 0.9 },
  { a: 225, c: '#D85A30', o: 0.88 },
  { a: 270, c: '#185FA5', o: 0.88 },
  { a: 315, c: '#3B6D11', o: 0.88 },
];

/**
 * The eight-petal आँगन emblem — the most distinctive thing the product owns.
 *
 * It lived as a private helper at the bottom of the landing page and appeared
 * once, in the footer. It now leads the phone welcome, so it lives here with
 * the rest of the brand.
 *
 * Deliberately fixed-colour in both themes: it is a logo, and a logo that
 * changes hue with the OS setting stops being a logo.
 */
export function DiversityEmblem({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 236 236" accessibilityLabel="Aangan">
      <Circle cx={118} cy={118} r={116} fill="none" stroke="#D3D1C7" strokeWidth={0.75} opacity={0.6} />
      <G transform="translate(118,118)">
        {LOGO_PETALS.map((p) => (
          <G key={p.a} transform={`rotate(${p.a})`}><Ellipse cx={0} cy={-58} rx={22} ry={58} fill={p.c} opacity={p.o} /></G>
        ))}
        <Circle cx={0} cy={0} r={54} fill="#ffffff" opacity={0.92} />
        <Circle cx={0} cy={0} r={54} fill="none" stroke="#e8e5e0" strokeWidth={1} />
        {LOGO_PETALS.map((p) => (
          <G key={`i${p.a}`} transform={`rotate(${p.a})`}><Ellipse cx={0} cy={-33} rx={13} ry={19} fill={p.c} opacity={0.26} /></G>
        ))}
        <Circle cx={0} cy={0} r={22} fill="#1A1A1A" />
        <Circle cx={0} cy={0} r={14} fill="#E8650A" />
        <Circle cx={0} cy={0} r={6} fill="#ffffff" />
        <Circle cx={0} cy={0} r={2.5} fill="#E8650A" />
        {LOGO_PETALS.map((p) => (
          <G key={`d${p.a}`} transform={`rotate(${p.a})`}><Circle cx={0} cy={-115} r={4} fill={p.c} opacity={0.47} /></G>
        ))}
      </G>
    </Svg>
  );
}
