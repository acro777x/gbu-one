/**
 * GBU One — Design Tokens
 * Light mode is the product default. Components should consume these semantic
 * tokens instead of hard-coding platform colours.
 */

// --- Dark palette ---
export const darkColors = {
  bg: '#0B0B0C',
  surface: '#161618',
  surfaceAlt: '#1C1C20',
  surfaceRaised: '#1E1E22',
  surfaceMuted: '#141416',
  surfaceGlass: 'rgba(255, 255, 255, 0.08)',
  borderGlass: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.20)',
  textPrimary: '#F5F5F4',
  textSecondary: '#A8A29E',
  textTertiary: 'rgba(255, 255, 255, 0.35)',
  accent: '#FF6A2B',
  accentSoft: 'rgba(255, 106, 43, 0.14)',
  accentGlow: 'rgba(255, 106, 43, 0.25)',
  ivory: '#F8F8F6',
  onAccent: '#FFFFFF',
  accentWarmCream: '#D9CFC3',
  accentWarmBrown: '#2A1F18',
  success: '#3DD68C',
  successSoft: 'rgba(61, 214, 140, 0.14)',
  warning: '#F5B83D',
  warningSoft: 'rgba(245, 184, 61, 0.14)',
  danger: '#FF5C5C',
  dangerSoft: 'rgba(255, 92, 92, 0.14)',
  inputBg: '#0F0F11',
  cardBg: 'rgba(20, 20, 23, 0.82)',
  tabBarBg: 'rgba(22, 22, 24, 0.82)',
  shimmer: 'rgba(255, 255, 255, 0.08)',
  skeletonBg: '#1C1C20',
  avatarBg: '#202024',
  divider: 'rgba(255, 255, 255, 0.08)',
  logoNumeralFill: '#F8F8F6',
  statusBarStyle: 'light-content' as const,
  ringGradient: {
    start: '#E04F14',
    mid: '#FC6C1E',
    end: '#FC9B22',
  },
} as const;

// --- Light palette (Product Default) ---
export const lightColors = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#E5E9F0',
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
  inputBg: '#EEF1F6',
  cardBg: 'rgba(255, 255, 255, 0.94)',
  tabBarBg: 'rgba(255, 255, 255, 0.92)',
  shimmer: 'rgba(0, 0, 0, 0.06)',
  skeletonBg: '#E5E9F0',
  avatarBg: '#E2E8F0',
  divider: '#E3E7EE',
  logoNumeralFill: '#111827',
  statusBarStyle: 'dark-content' as const,
  ringGradient: {
    start: '#D94813',
    mid: '#E85B22',
    end: '#F59A32',
  },
} as const;

export type ColorSet = typeof lightColors;

// Default export uses lightColors per product specification
export const colors = lightColors;

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
