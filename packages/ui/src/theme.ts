// Neon Party Vibes — Theme tokens
export const theme = {
  colors: {
    bgPrimary: '#0F0F0F',
    bgSecondary: '#1A1A2E',
    bgTertiary: '#16213E',
    accentGreen: '#00FF00',
    accentPurple: '#9B00FF',
    highlightPink: '#FF0080',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
  },
  gradients: {
    main: 'linear-gradient(135deg, #0F0F0F 0%, #1A1A2E 50%, #9B00FF 100%)',
    card: 'linear-gradient(145deg, rgba(26,26,46,0.8), rgba(15,15,15,0.9))',
    greenPink: 'linear-gradient(135deg, #00FF00, #FF0080)',
    purplePink: 'linear-gradient(135deg, #9B00FF, #FF0080)',
  },
  glow: {
    green: '0 0 20px rgba(0,255,0,0.3)',
    purple: '0 0 20px rgba(155,0,255,0.3)',
    pink: '0 0 20px rgba(255,0,128,0.3)',
  },
  breakpoints: {
    mobile: '320px',
    tablet: '768px',
    desktop: '1024px',
    tv: '1920px',
  },
} as const;

export type Theme = typeof theme;
