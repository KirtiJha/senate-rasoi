import { useThemePreference } from './context/theme';

// Imperative palette for places that can't use NativeWind classNames:
// vector-icon colors, navigation options, gradients, StatusBar.
// Mirrors the CSS variables in src/global.css.

const light = {
  bg: '#FBF7F2',
  surface: '#FFFFFF',
  inset: '#F4F0E9',
  ink: '#16171A',
  muted: '#696E76',
  faint: '#9CA1A9',
  line: '#E9E9E8',
  accent: '#FF5A3C',
  accentPress: '#E8431F',
  accentSoft: '#FFE9E3',
  onAccent: '#FFFFFF',
} as const;

const dark = {
  bg: '#0E0F12',
  surface: '#191B1F',
  inset: '#21242A',
  ink: '#F4F5F7',
  muted: '#A5ABB5',
  faint: '#6E747E',
  line: '#292C33',
  accent: '#FF6C50',
  accentPress: '#FF5A3C',
  accentSoft: '#2B1914',
  onAccent: '#FFFFFF',
} as const;

// Fixed (scheme-independent) semantic colors.
export const fixed = {
  veg: '#14A06A',
  nonveg: '#E0322B',
  egg: '#E0A416',
  whatsapp: '#25D366',
  success: '#14A06A',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Warm, appetizing gradients (used on the hero, primary buttons, accents).
export const gradients = {
  hero: ['#FF6A3D', '#FF9E45'] as const, // coral → amber (sunset)
  heroDark: ['#FF5A3C', '#E8851F'] as const,
  primary: ['#FF6A3D', '#FF8A3D'] as const,
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
