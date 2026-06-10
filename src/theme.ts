import { useThemePreference } from './context/theme';

// Imperative palette for places that can't use NativeWind classNames:
// vector-icon colors, navigation options, gradients, StatusBar.
// Mirrors the CSS variables in src/global.css.

const light = {
  bg: '#FBF8F3',
  surface: '#FFFFFF',
  inset: '#F1F3EF',
  ink: '#16171A',
  muted: '#696E76',
  faint: '#9CA1A9',
  line: '#E7E9E6',
  accent: '#0F6E56',
  accentPress: '#0B5341',
  accentSoft: '#E1F5EE',
  onAccent: '#FFFFFF',
} as const;

const dark = {
  bg: '#0D0F0E',
  surface: '#181B1A',
  inset: '#212523',
  ink: '#F4F5F7',
  muted: '#A5ABB5',
  faint: '#6E747E',
  line: '#293330',
  accent: '#22A37D',
  accentPress: '#0F6E56',
  accentSoft: '#12302A',
  onAccent: '#FFFFFF',
} as const;

// Fixed (scheme-independent) semantic colors.
export const fixed = {
  veg: '#14A06A',
  nonveg: '#E0322B',
  egg: '#E0A416',
  whatsapp: '#25D366',
  success: '#14A06A',
  orange: '#E8650A', // brand secondary highlight (food, warm accents)
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Brand gradients — teal (courtyard) with warm orange highlights.
export const gradients = {
  hero: ['#15936F', '#0F6E56'] as const, // teal
  heroDark: ['#0F6E56', '#0A4F3A'] as const,
  primary: ['#15936F', '#0F6E56'] as const,
  warm: ['#F08A2C', '#E8650A'] as const, // orange (food / warm accents)
  mint: ['#16A06A', '#3FBE86'] as const, // fresh green (veg / success accents)
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
