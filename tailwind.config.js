/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
      colors: {
        bg: { primary: '#0A0F1E', secondary: '#111827', card: '#1A2235', hover: '#1F2D45' },
        border: { DEFAULT: '#2D3748', light: '#4A5568' },
        cat: {
          blue:   '#3B82F6',
          green:  '#10B981',
          orange: '#F59E0B',
          red:    '#EF4444',
          purple: '#8B5CF6',
          pink:   '#EC4899',
        },
        text: { primary: '#F1F5F9', secondary: '#94A3B8', muted: '#64748B' },
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        skeleton: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
      },
    },
  },
  plugins: [],
}
