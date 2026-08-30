const reactHooks = require('eslint-plugin-react-hooks');
const tseslint = require('typescript-eslint');

/**
 * Deliberately narrow.
 *
 * This is not a style linter — Prettier-style opinions would flag thousands of
 * existing lines and teach everyone to ignore the output. It enforces the two
 * rules whose violations have actually broken this app:
 *
 *   react-hooks/rules-of-hooks — declaring useSharedValue below an
 *   `if (loading) return` guard changes the hook count between renders and
 *   crashes the screen with "Rendered more hooks than during the previous
 *   render". That shipped on four detail screens at once.
 *
 *   no-restricted-syntax on raw palette classes — a `bg-red-50` has no dark
 *   variant, so a panel built from one stays a bright block on a near-black
 *   ground. 32 of those were removed; this stops the 33rd.
 *
 * Style drift is covered elsewhere: `npm run check:ui` catches className on
 * animated components, which is the other failure this codebase keeps hitting.
 */
module.exports = [
  {
    linterOptions: { reportUnusedDisableDirectives: false },
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'scripts/**', 'supabase/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      // Registered but with no rules enabled: the codebase carries
      // `eslint-disable @typescript-eslint/...` comments, and a disable for an
      // unknown rule is itself an error.
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // Deps are advisory here: this codebase has deliberate omissions with
      // comments explaining them, and making it an error would bury the two
      // rules above in noise.
      'react-hooks/exhaustive-deps': 'off',

      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\b(bg|text|border)-(white|black|red|amber|green|blue|violet|yellow|orange|slate|gray|zinc|emerald|indigo|pink|teal|cyan|purple)-(50|100|200|300|400|500|600|700|800|900)\\b/]",
          message:
            'Raw Tailwind palette classes have no dark variant — a panel built from one stays light on a dark ground. Use a semantic token (bg-surface, danger-soft, highlight-soft, accent-soft).',
        },
      ],
    },
  },
];
