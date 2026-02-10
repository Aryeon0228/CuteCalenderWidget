export const UNIFIED_EMPHASIS = {
  activeButtonBg: '#606b78',
  variationLightnessBg: '#5b6775',
  variationHueShiftBg: '#4f7bb8',
  chipBgAlpha: '14',
  chipBorderAlpha: '2e',
  cvdText: '#f59e0b',
  cvdBg: '#f59e0b14',
  cvdBorder: '#f59e0b2e',
} as const;

export const FORMAT_ACCENT_COLORS: Record<'HEX' | 'RGB' | 'HSL', string> = {
  HEX: UNIFIED_EMPHASIS.activeButtonBg,
  RGB: UNIFIED_EMPHASIS.activeButtonBg,
  HSL: UNIFIED_EMPHASIS.activeButtonBg,
};

export const VARIATION_TOGGLE_COLORS = {
  lightness: UNIFIED_EMPHASIS.variationLightnessBg,
  hueShift: UNIFIED_EMPHASIS.variationHueShiftBg,
} as const;
