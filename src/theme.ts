import { useThemePreference } from './context/theme';

// Imperative palette for places that can't use NativeWind classNames:
// vector-icon colors, navigation options, gradients, StatusBar.
// Mirrors the CSS variables in src/global.css.

const light = {
  bg: '#F1F3EE',
  surface: '#FFFFFF',
  surface2: '#FAFBF8',
  inset: '#E8EBE4',
  line: '#DDE1D8',
  lineStrong: '#C7CCC0',
  ink: '#141915',
  muted: '#5A6159',
  subtle: '#686F66',
  /** @deprecated 2.45:1 in the old palette. Aliased to `subtle`; codemod pending. */
  faint: '#686F66',
  accent: '#0E6B4E',
  accentPress: '#0A5340',
  accentSoft: '#DCEBE2',
  accentLine: '#B6D3C3',
  onAccent: '#FFFFFF',
  highlight: '#F0A428',
  highlightInk: '#8A5A06',
  highlightSoft: '#FBEBCF',
  warn: '#9A5608',
  danger: '#B3261E',
  dangerSoft: '#FBE6E3',
  info: '#3A4A86',
  shadowCard: '0 1px 1px rgba(26,40,32,0.04), 0 2px 6px -2px rgba(26,40,32,0.08)',
  shadowBar: '0 2px 4px rgba(26,40,32,0.06), 0 14px 32px -12px rgba(26,40,32,0.20)',
  shadowFab: '0 8px 20px -6px rgba(14,107,78,0.45)',
} as const;

const dark = {
  bg: '#101512',
  surface: '#181E1A',
  surface2: '#1F2621',
  inset: '#242C26',
  line: '#2E3830',
  lineStrong: '#3C4941',
  ink: '#EDF1EC',
  muted: '#A0A99F',
  subtle: '#7E887C',
  /** @deprecated aliased to `subtle`; codemod pending. */
  faint: '#7E887C',
  accent: '#3FB98B',
  accentPress: '#2FA278',
  accentSoft: '#14342A',
  accentLine: '#1F5140',
  onAccent: '#08150F',
  highlight: '#F3B03F',
  highlightInk: '#EFB958',
  highlightSoft: '#3A2C10',
  warn: '#E8A03C',
  danger: '#F2685C',
  dangerSoft: '#33110E',
  info: '#8FA4E8',
  shadowCard: 'none',
  shadowBar: 'none',
  shadowFab: 'none',
} as const;

// Fixed (scheme-independent) semantic colors.
export const fixed = {
  veg: '#0F8C4F',
  nonveg: '#8E2318',
  egg: '#D08A0A',
  whatsapp: '#25D366',
  success: '#127A50',
  orange: '#E8650A', // brand secondary highlight (food, warm accents)
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Brand gradients — teal (courtyard) with warm orange highlights.
export const gradients = {
  hero: ['#12805C', '#0E6B4E'] as const, // oxide
  heroDark: ['#0E6B4E', '#0A4F3A'] as const,
  primary: ['#12805C', '#0E6B4E'] as const,
  warm: ['#F08A2C', '#E8650A'] as const, // orange (food / warm accents)
  mint: ['#127A50', '#3FB98B'] as const, // fresh green (veg / success accents)
};

export type ThemeColors = { [K in keyof typeof light]: string } & {
  [K in keyof typeof fixed]: string;
};

export function useThemeColors(): ThemeColors {
  const { resolved } = useThemePreference();
  return { ...(resolved === 'dark' ? dark : light), ...fixed };
}

export function useIsDark() {
  const { resolved } = useThemePreference();
  return resolved === 'dark';
}

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayX: 'BricolageGrotesque_800ExtraBold',
  displaySb: 'BricolageGrotesque_600SemiBold',
  sans: 'HankenGrotesk_400Regular',
  sansMd: 'HankenGrotesk_500Medium',
  sansSb: 'HankenGrotesk_600SemiBold',
  sansBold: 'HankenGrotesk_700Bold',
} as const;

export const layout = {
  maxContent: 1180,
  maxNarrow: 600,
  rail: 240,
} as const;
