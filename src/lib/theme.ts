/**
 * GBU One — Design Tokens
 * Source of truth: docs/UI_SPEC.md
 */

export const colors = {
  bg: '#0B0B0C',
  surface: '#161618',
  surfaceGlass: 'rgba(255, 255, 255, 0.08)',
  borderGlass: 'rgba(255, 255, 255, 0.12)',
  textPrimary: '#F5F5F4',
  textSecondary: '#A8A29E',
  accent: '#FF6A2B',
  accentGlow: 'rgba(255, 106, 43, 0.25)',
  ivory: '#F8F8F6',
  accentWarmCream: '#D9CFC3',
  accentWarmBrown: '#2A1F18',
  success: '#3DD68C',
  warning: '#F5B83D',
  danger: '#FF5C5C',
  ringGradient: {
    start: '#E04F14',
    mid: '#FC6C1E',
    end: '#FC9B22',
  },
} as const;

export const radius = {
  sm: 8,
  md: 12,
  card: 24,
  avatar: 18,
  sheet: 32,
  chip: 999,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  wordmark: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
  },
  heroTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  screenTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.25,
  },
  sectionHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    lineHeight: 24,
  },
  subHeader: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  captionMedium: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export const theme = {
  colors,
  radius,
  spacing,
  typography,
} as const;

export default theme;
