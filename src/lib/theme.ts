/**
 * GBU One — Design Tokens
 * Light mode is the product default. Components should consume these semantic
 * tokens instead of hard-coding platform colours.
 */

export const colors = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EEF1F6',
  surfaceGlass: 'rgba(255, 255, 255, 0.94)',
  borderGlass: '#E3E7EE',
  borderStrong: '#CBD3DF',
  textPrimary: '#111827',
  textSecondary: '#667085',
  textTertiary: '#98A2B3',
  accent: '#E85B22',
  accentSoft: '#FFF0E8',
  accentGlow: 'rgba(232, 91, 34, 0.16)',
  ivory: '#111827',
  onAccent: '#FFFFFF',
  accentWarmCream: '#FFF7F1',
  accentWarmBrown: '#4A2616',
  success: '#168A5B',
  successSoft: '#E8F7F0',
  warning: '#A96800',
  warningSoft: '#FFF5D9',
  danger: '#C53030',
  dangerSoft: '#FDECEC',
  ringGradient: {
    start: '#D94813',
    mid: '#E85B22',
    end: '#F59A32',
  },
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  card: 20,
  avatar: 18,
  sheet: 28,
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
  xxxl: 40,
} as const;

export const typography = {
  wordmark: { fontFamily: 'Poppins-Bold', fontSize: 28, lineHeight: 32, letterSpacing: -0.28 },
  heroTitle: { fontFamily: 'Poppins-Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  screenTitle: { fontFamily: 'Poppins-Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.25 },
  sectionHeader: { fontFamily: 'Inter-SemiBold', fontSize: 19, lineHeight: 24 },
  subHeader: { fontFamily: 'Inter-Medium', fontSize: 16, lineHeight: 22 },
  body: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: 'Inter-Medium', fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16 },
  captionMedium: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 16 },
} as const;

export const theme = { colors, radius, spacing, typography } as const;
export default theme;
