import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic surfaces (driven by CSS variables)
        background: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        foreground: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-fg) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--accent-fg) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',

        // Brand kept for backward compatibility but remapped to neutral fintech
        primary: {
          50: '#f0f7ef',
          100: '#e0efdb',
          200: '#c4dfbb',
          300: '#a1c796',
          400: '#7ba770',
          500: '#54874e',
          600: '#316745',
          700: '#24513a',
          800: '#193f2e',
          900: '#123326',
        },
        secondary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        danger: {
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'sans-serif'],
        display: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-body)', 'sans-serif'],
      },
      // Keep secondary text readable instead of shrinking it to 10-12px.
      fontSize: {
        xs: ['1rem', { lineHeight: '1.5' }],
        sm: ['1.0625rem', { lineHeight: '1.55' }],
        base: ['1.125rem', { lineHeight: '1.6' }],
      },
      fontWeight: {
        medium: '700',
        semibold: '700',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        soft: '0 10px 40px -10px rgb(15 23 42 / 0.12)',
        'soft-dark': '0 10px 40px -10px rgb(0 0 0 / 0.5)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

export default config
