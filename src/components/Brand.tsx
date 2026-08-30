import { Text, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
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

/** Mix a hex colour toward white (t > 0) or black (t < 0). */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = (shift: number) => {
    const v = (n >> shift) & 0xff;
    return Math.round(v + (to - v) * k);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/**
 * The eight-petal आँगन emblem — the most distinctive thing the product owns.
 *
 * It lived as a private helper at the bottom of the landing page and appeared
 * once, in the footer. It now leads the phone welcome, so it lives here with
 * the rest of the brand.
 *
 * VOLUME — every petal was a flat fill, which reads as a sticker as soon as it
 * moves. Each now carries a gradient along its own length: lit near the tip,
 * its own colour through the middle, and deepened at the base where it meets
 * its neighbours, so the flower has a near and a far side. The hub is domed the
 * same way, with a real specular dot rather than a flat white circle.
 *
 * The shading is baked into the petals, so it turns with them — which is
 * correct for the body of an object. What must NOT turn with them is the
 * highlight from the room: see `EmblemGloss`.
 *
 * Deliberately fixed-colour in both themes: it is a logo, and a logo that
 * changes hue with the OS setting stops being a logo.
 */
export function DiversityEmblem({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 236 236" accessibilityLabel="Aangan">
      <Defs>
        {LOGO_PETALS.map((p) => (
          <LinearGradient key={`g${p.a}`} id={`petal${p.a}`} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={shade(p.c, 0.34)} />
            <Stop offset="0.42" stopColor={p.c} />
            <Stop offset="1" stopColor={shade(p.c, -0.3)} />
          </LinearGradient>
        ))}
        <RadialGradient id="hub" cx="0.36" cy="0.3" r="0.78">
          <Stop offset="0" stopColor="#4A4A4A" />
          <Stop offset="0.55" stopColor="#1A1A1A" />
          <Stop offset="1" stopColor="#000000" />
        </RadialGradient>
        <RadialGradient id="core" cx="0.35" cy="0.28" r="0.8">
          <Stop offset="0" stopColor="#FFB067" />
          <Stop offset="0.5" stopColor="#E8650A" />
          <Stop offset="1" stopColor="#B44A05" />
        </RadialGradient>
        <RadialGradient id="dish" cx="0.5" cy="0.42" r="0.62">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.75" stopColor="#F6F4F0" />
          <Stop offset="1" stopColor="#E2DED6" />
        </RadialGradient>
      </Defs>

      <Circle cx={118} cy={118} r={116} fill="none" stroke="#D3D1C7" strokeWidth={0.75} opacity={0.6} />
      <G transform="translate(118,118)">
        {/* Contact shadow where each petal meets the hub — without it the
            petals look laid on top of the disc rather than growing out of it. */}
        {LOGO_PETALS.map((p) => (
          <G key={`s${p.a}`} transform={`rotate(${p.a})`}>
            <Ellipse cx={0} cy={-56} rx={23.5} ry={59} fill="#000" opacity={0.13} />
          </G>
        ))}
        {LOGO_PETALS.map((p) => (
          <G key={p.a} transform={`rotate(${p.a})`}>
            <Ellipse cx={0} cy={-58} rx={22} ry={58} fill={`url(#petal${p.a})`} opacity={p.o} />
          </G>
        ))}

        <Circle cx={0} cy={0} r={54} fill="url(#dish)" opacity={0.94} />
        <Circle cx={0} cy={0} r={54} fill="none" stroke="#e8e5e0" strokeWidth={1} />
        {LOGO_PETALS.map((p) => (
          <G key={`i${p.a}`} transform={`rotate(${p.a})`}>
            <Ellipse cx={0} cy={-33} rx={13} ry={19} fill={p.c} opacity={0.26} />
          </G>
        ))}

        {/* The hub, domed rather than stamped. */}
        <Circle cx={0} cy={1.5} r={22} fill="#000" opacity={0.18} />
        <Circle cx={0} cy={0} r={22} fill="url(#hub)" />
        <Circle cx={0} cy={0} r={14} fill="url(#core)" />
        <Circle cx={0} cy={0} r={6} fill="#ffffff" />
        <Circle cx={0} cy={0} r={2.5} fill="#E8650A" />
        <Circle cx={-4.4} cy={-4.8} r={2.6} fill="#fff" opacity={0.55} />

        {LOGO_PETALS.map((p) => (
          <G key={`d${p.a}`} transform={`rotate(${p.a})`}>
            <Circle cx={0} cy={-115} r={4} fill={p.c} opacity={0.47} />
          </G>
        ))}
      </G>
    </Svg>
  );
}

/**
 * The light in the room, as a layer that does NOT rotate.
 *
 * This is the whole trick. If the highlight is painted into the emblem it
 * turns with it, and the eye reads a flat picture of a lit object being spun.
 * Kept still while the emblem turns underneath, the petals pass through the
 * light one after another — which is what a real object does, and what makes
 * the same SVG suddenly look like it has a surface.
 *
 * CLIPPED, and this matters. The first version painted its gradients across
 * the full viewBox: the emblem's petals only reach r≈116 and leave the corners
 * empty, so the highlight spilled past the object onto bare background and
 * read as a patch of smoke hanging at the top-left rather than as light on a
 * surface. Light needs something to land on. Clipping to just inside the petal
 * tips keeps it on the flower.
 *
 * Kept faint for the same reason — a specular that competes with the artwork
 * stops looking like light and starts looking like a smudge on the lens.
 *
 * Purely decorative and always on top, so it never takes a touch.
 */
export function EmblemGloss({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 236 236" pointerEvents="none">
      <Defs>
        <ClipPath id="body">
          <Circle cx={118} cy={118} r={112} />
        </ClipPath>
        <RadialGradient id="spec" cx="0.34" cy="0.26" r="0.5">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.26} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.06} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="occl" cx="0.72" cy="0.8" r="0.58">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G clipPath="url(#body)">
        <Circle cx={118} cy={118} r={112} fill="url(#occl)" />
        <Circle cx={118} cy={118} r={112} fill="url(#spec)" />
      </G>
    </Svg>
  );
}
