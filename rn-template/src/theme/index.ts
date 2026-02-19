import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const theme = {
  colors: {
    background: '#050507',
    surface: 'rgba(255,255,255,0.04)',
    surfaceLight: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.06)',
    borderLight: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.5)',
    textDimmed: 'rgba(255,255,255,0.3)',
    primary: ['{{primary1}}', '{{primary2}}'],
    accent1: ['{{accent1a}}', '{{accent1b}}'],
    accent2: ['{{accent2a}}', '{{accent2b}}'],
    accent3: ['{{accent3a}}', '{{accent3b}}'],
    success: '#10b981',
    error: '#f43f5e',
    warning: '#f59e0b',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
    h3: { fontSize: 18, fontWeight: '600' as const },
    body: { fontSize: 14, fontWeight: '400' as const },
    bodyBold: { fontSize: 14, fontWeight: '600' as const },
    caption: { fontSize: 12, fontWeight: '400' as const },
    tiny: { fontSize: 10, fontWeight: '500' as const },
  },
  screen: { width, height },
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '{{primary1}}',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};

export type Theme = typeof theme;
