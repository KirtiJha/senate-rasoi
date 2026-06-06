/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables in src/global.css.
        // They flip automatically with the system light/dark scheme, so
        // components just use `bg-bg`, `text-ink`, etc. (no dark: needed).
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        inset: 'rgb(var(--inset) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',

        // The single brand accent (warm coral — appetite + energy).
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-press': 'rgb(var(--accent-press) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',

        // Fixed semantic colors (same in both schemes).
        veg: '#14A06A',
        nonveg: '#E0322B',
        egg: '#E0A416',
        whatsapp: '#25D366',
        success: '#14A06A',
      },
      fontFamily: {
        // Bricolage Grotesque — characterful modern display.
        display: ['BricolageGrotesque_700Bold'],
        'display-x': ['BricolageGrotesque_800ExtraBold'],
        'display-sb': ['BricolageGrotesque_600SemiBold'],
        // Hanken Grotesk — clean, friendly UI sans.
        sans: ['HankenGrotesk_400Regular'],
        'sans-md': ['HankenGrotesk_500Medium'],
        'sans-sb': ['HankenGrotesk_600SemiBold'],
        'sans-bold': ['HankenGrotesk_700Bold'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,12,14,0.04), 0 14px 30px -18px rgba(10,12,14,0.30)',
        soft: '0 2px 12px -6px rgba(10,12,14,0.18)',
        sheet: '0 -12px 48px rgba(0,0,0,0.28)',
        fab: '0 10px 26px -8px rgba(255,90,60,0.6)',
      },
    },
  },
  plugins: [],
};
