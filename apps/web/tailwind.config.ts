import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        jb: {
          'bg-primary': '#0F0F0F',
          'bg-secondary': '#1A1A2E',
          'bg-tertiary': '#16213E',
          'accent-green': '#00FF00',
          'accent-purple': '#9B00FF',
          'highlight-pink': '#FF0080',
          'text-primary': '#F5F5F5',
          'text-secondary': '#B0B0B0',
        },
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #0F0F0F 0%, #1A1A2E 50%, #9B00FF 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(26,26,46,0.8), rgba(15,15,15,0.9))',
        'gradient-green-pink': 'linear-gradient(135deg, #00FF00, #FF0080)',
        'gradient-purple-pink': 'linear-gradient(135deg, #9B00FF, #FF0080)',
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0,255,0,0.3)',
        'glow-purple': '0 0 20px rgba(155,0,255,0.3)',
        'glow-pink': '0 0 20px rgba(255,0,128,0.3)',
        'glow-green-lg': '0 0 40px rgba(0,255,0,0.4)',
        'glow-purple-lg': '0 0 40px rgba(155,0,255,0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'Montserrat', 'system-ui', 'sans-serif'],
      },
      screens: {
        mobile: '320px',
        tablet: '768px',
        desktop: '1024px',
        tv: '1920px',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'neon-flicker': 'neonFlicker 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0,255,0,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0,255,0,0.6)' },
        },
        neonFlicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
          '25%, 75%': { opacity: '0.9' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
