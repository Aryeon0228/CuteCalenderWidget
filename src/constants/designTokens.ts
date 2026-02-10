/**
 * Central design tokens
 * Keep reusable design values here and progressively replace hardcoded values.
 */

export const COLOR_TOKENS = {
  // Brand / Accent
  accentPrimary: '#3b426a',
  accentLight: '#525b88',
  accentInteractive: '#4f7bb8',
  accentMuted: '#606b78',
  accentVariationLightness: '#5b6775',
  accentVariationHueShift: '#4f7bb8',

  // Semantic
  warning: '#f59e0b',
  success: '#34d399',
  danger: '#f87171',
  info: '#60a5fa',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b0',
  textMuted: '#8888a0',
  textSubtle: '#9090a0',
  textFaint: '#9999aa',
  textDim: '#888888',
  textDisabled: '#aaaaaa',
  textGhost: '#444444',

  // Backgrounds
  backgroundApp: '#0a0a10',
  backgroundSurface: '#16161e',
  backgroundSurfaceAlt: '#0c0c12',
  backgroundControl: '#24242e',
  backgroundElevated: '#1e1e2a',
  backgroundLayer: '#1a1a24',
  backgroundActionBar: '#101018',
  backgroundCardAlt: '#1a1a2e',
  backgroundInput: '#000000',

  // Borders
  borderDefault: '#2d2d38',
  borderSoft: '#24242e',
  borderStrong: '#2a2a3a',
  borderSubtle: '#2a2a34',
  borderNeutral: '#3a3a4a',
  borderHandle: '#3e3e50',
} as const;

export const SPACING_TOKENS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS_TOKENS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const FONT_SIZE_TOKENS = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  title: 23,
} as const;

export const SHADOW_TOKENS = {
  accentGlow: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const ALPHA_TOKENS = {
  chipBg: '14',
  chipBorder: '2e',
} as const;

export type ColorToken = keyof typeof COLOR_TOKENS;
export type SpacingToken = keyof typeof SPACING_TOKENS;
export type RadiusToken = keyof typeof RADIUS_TOKENS;
export type FontSizeToken = keyof typeof FONT_SIZE_TOKENS;
