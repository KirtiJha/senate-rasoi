import { Text, TextProps } from 'react-native';

/**
 * Text with a role, not a size.
 *
 * WHY THIS EXISTS
 * Two problems, one cause. React Native does not inherit `fontFamily` across
 * View boundaries, so ~46% of the app's 1,396 `<Text>` elements were rendering
 * in Roboto directly beside Hanken Grotesk — including almost the whole sign-in
 * screen, which is the first thing every resident sees. And 27 distinct font
 * sizes had accumulated (11.5px, 12.5px and 14.5px among them), with four of
 * them competing for the same secondary-text role.
 *
 * Both are discipline problems, and discipline does not survive 60 routes. A
 * role primitive makes the right thing the easy thing: pick what the text IS,
 * and family, size, weight and line-height follow.
 */

const ROLE = {
  /** Once per screen. The greeting, a dish name, a hero number. */
  display: 'font-display-x text-display',
  /** Screen headers, sheet titles. */
  title: 'font-display text-title',
  /** Card titles, the primary line of a list row. */
  heading: 'font-sans-sb text-heading',
  /** Paragraphs, chat, descriptions. */
  body: 'font-sans text-body',
  /** Buttons, chips, tabs, meaningful metadata. */
  label: 'font-sans-sb text-label',
  /** Eyebrows, badges, timestamps. Uppercase by convention. */
  micro: 'font-sans-sb text-micro uppercase',
} as const;

const TONE = {
  ink: 'text-ink',
  muted: 'text-muted',
  subtle: 'text-subtle',
  accent: 'text-accent',
  danger: 'text-danger',
  /** Marigold as text on the ground — not the fill, which carries ink. */
  highlight: 'text-highlight-ink',
  onAccent: 'text-on-accent',
} as const;

export type TxtVariant = keyof typeof ROLE;
export type TxtTone = keyof typeof TONE;

/**
 * The prop is `variant`, not `role`: React Native's TextProps already carries
 * an accessibility `role`, and intersecting the two silently collapsed this to
 * the one value both types share. Keeping them separate leaves the a11y role
 * usable alongside the typographic one.
 */
export function Txt({
  variant = 'body',
  tone = 'ink',
  className = '',
  ...rest
}: TextProps & { variant?: TxtVariant; tone?: TxtTone; className?: string }) {
  return <Text className={`${ROLE[variant]} ${TONE[tone]} ${className}`} {...rest} />;
}
