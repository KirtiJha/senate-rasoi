import { cssInterop } from 'nativewind';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion } from 'react-native-reanimated';

/**
 * The single source of truth for motion in Aangan.
 *
 * `src/theme.ts` owns colour; this owns time.
 *
 * PRINCIPLE — motion is a status report, not decoration. Every animation
 * answers exactly one of: "did it hear me?" (press), "where did this come
 * from?" (entrance and navigation), "what changed?" (state). An animation that
 * answers none of them gets deleted.
 *
 * COROLLARY — the closer to the finger, the faster. Press feedback has to land
 * within a frame or two of the touch to read as physical; navigation can take
 * its time because the user's attention is already moving.
 *
 * Reanimated has been an autolinked dependency since the first commit, so all
 * of this ships over the air. No new native build.
 */

/** Duration scale, in milliseconds. */
export const dur = {
  /** Press-down. Must land inside a frame or two of the touch. */
  instant: 90,
  /** Chip toggles, icon swaps, things leaving. */
  quick: 160,
  /** The default: card entrances, crossfades, toasts. */
  standard: 240,
  /** The thing the user is looking at: hero, sheet, first item of a list. */
  expressive: 420,
  /** Non-interactive loops — skeleton shimmer, live dot. */
  ambient: 700,
} as const;

/**
 * Easing. Never `Easing.ease` or `linear` for UI — linear is for loops only.
 */
export const ease = {
  /** Decelerate-heavy. Anything entering or settling. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** A snap without overshoot. Sheets, hero content. */
  emphasized: Easing.bezier(0.05, 0.7, 0.1, 1),
  /** Accelerate. Anything leaving — it doesn't need to be read. */
  exit: Easing.bezier(0.3, 0, 1, 1),
  linear: Easing.linear,
} as const;

/**
 * Springs. Use a spring when the user's finger caused it, a duration when the
 * system did. Fingers expect physics.
 */
export const spring = {
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  card: { damping: 18, stiffness: 220, mass: 0.9 },
  sheet: { damping: 26, stiffness: 260, mass: 1.0 },
} as const;

/**
 * Stagger step. 45ms reads as "these arrived together, in order"; above 60 it
 * reads as slow, below 30 as simultaneous. Capped so item 40 isn't two seconds
 * late.
 */
export const STAGGER_STEP = 45;
export const STAGGER_CAP = 8;
export const stagger = (index: number, step = STAGGER_STEP) =>
  Math.min(index, STAGGER_CAP) * step;

export { ReduceMotion };

/**
 * NativeWind-aware animated primitives.
 *
 * react-native-css-interop has no built-in knowledge of Reanimated, so a bare
 * `<Animated.View className="bg-surface">` renders SILENTLY UNSTYLED on native
 * — the same failure shape as the dark-mode bug, where correct-looking code had
 * its styles dropped on the floor. Registering here, once, is what prevents it.
 *
 * Import these instead of Reanimated's `Animated.*` anywhere a className is
 * involved.
 */
/*
 * These are FRESH animated components, not aliases.
 *
 * `export const AView = Animated.View` followed by `cssInterop(AView, …)`
 * registers the interop on Animated.View ITSELF — the same object the whole
 * app imports — so every Animated.View everywhere silently starts routing its
 * style through NativeWind, including ones that only ever pass a plain style
 * array. Building separate components leaves Animated.View untouched for
 * style-only use and confines the interop to the ones that want a className.
 */
export const AView = Animated.createAnimatedComponent(View);
export const AText = Animated.createAnimatedComponent(Text);
export const AScrollView = Animated.createAnimatedComponent(ScrollView);
export const APressable = Animated.createAnimatedComponent(Pressable);

cssInterop(AView, { className: 'style' });
cssInterop(AText, { className: 'style' });
cssInterop(AScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });
cssInterop(APressable, { className: 'style' });
