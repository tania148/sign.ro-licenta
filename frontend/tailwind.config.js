/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        principal: ['Outfit', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      colors: {
        primar: {
          50:  'var(--primar-50)',
          100: 'var(--primar-100)',
          200: 'var(--primar-200)',
          400: 'var(--primar-400)',
          500: 'var(--primar-500)',
          600: 'var(--primar-600)',
          700: 'var(--primar-700)',
          900: 'var(--primar-900)',
        },
        accent: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        fundal: '#f5f3ee',
        suprafata: '#ffffff',
        text: {
          principal: '#0f172a',
          secundar: '#475569',
          tertiar: '#94a3b8',
        },
      },
      keyframes: {
        aparitie: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        aparitie: 'aparitie 0.3s ease',
      },
    },
  },
  plugins: [],
}
