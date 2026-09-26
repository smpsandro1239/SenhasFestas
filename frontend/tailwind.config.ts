import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tokens surface/border carry alpha embedded (rgba(255,255,255,0.03)/(0.08)).
        // NEVER apply an opacity modifier to them (e.g. bg-surface/50): Tailwind
        // REPLACES the alpha instead of scaling it, so /50 compiles to 50% white
        // (washed-out beige cards). Use the named levels only:
        //   bg-surface (3%), bg-surface-hover (6%), bg-surface-active (9%)
        //   border-border (8%), border-border-hover (14%)
        // bg-surface-solid/N is safe (solid base scales correctly).
        brand: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          light: '#60a5fa',
          glow: 'rgba(37,99,235,0.18)',
        },
        surface: {
          DEFAULT: 'rgba(255,255,255,0.03)',
          hover: 'rgba(255,255,255,0.06)',
          active: 'rgba(255,255,255,0.09)',
          solid: '#18181b',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          hover: 'rgba(255,255,255,0.14)',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59,130,246,0.15)',
        'glow-sm': '0 0 10px rgba(59,130,246,0.1)',
        'glass': '0 8px 32px rgba(0,0,0,0.4)',
        'elevated': '0 20px 60px rgba(0,0,0,0.5)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59,130,246,0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(59,130,246,0.25)' },
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
