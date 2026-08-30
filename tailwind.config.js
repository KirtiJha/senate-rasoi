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
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',

        // The single brand accent (warm coral — appetite + energy).
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-press': 'rgb(var(--accent-press) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        'accent-line': 'rgb(var(--accent-line) / <alpha-value>)',

        // Marigold — the one warm thing in the courtyard. Fills carry INK
        // text, never white; `highlight-ink` is marigold AS text.
        highlight: 'rgb(var(--highlight) / <alpha-value>)',
        'highlight-ink': 'rgb(var(--highlight-ink) / <alpha-value>)',
        'highlight-soft': 'rgb(var(--highlight-soft) / <alpha-value>)',

        warn: 'rgb(var(--warn) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',

        // Fixed semantic colors (same in both schemes).
        veg: '#0F8C4F',
        nonveg: '#8E2318',
        egg: '#D08A0A',
        whatsapp: '#25D366',
        success: 'rgb(var(--success) / <alpha-value>)',
      },
      // Six roles, replacing 27 arbitrary pixel sizes. Line-height ships with
      // the size — it was previously set at only ~15 sites out of 1,396.
      fontSize: {
        display: ['34px', { lineHeight: '38px', letterSpacing: '-0.02em' }],
        title: ['22px', { lineHeight: '27px', letterSpacing: '-0.01em' }],
        heading: ['17px', { lineHeight: '23px' }],
        body: ['15px', { lineHeight: '22px' }],
        label: ['13px', { lineHeight: '17px', letterSpacing: '0.01em' }],
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.06em' }],
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
      borderRadius: {
        niche: '22px 22px 14px 14px',
      },
      boxShadow: {
        card: '0 1px 1px rgba(26,40,32,0.04), 0 2px 6px -2px rgba(26,40,32,0.08)',
        soft: '0 1px 2px rgba(26,40,32,0.05), 0 6px 16px -6px rgba(26,40,32,0.14)',
        sheet: '0 -8px 40px rgba(26,40,32,0.22)',
        fab: '0 8px 20px -6px rgba(14,107,78,0.45)',
      },
    },
  },
  plugins: [],
};
