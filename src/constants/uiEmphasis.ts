import { ALPHA_TOKENS, COLOR_TOKENS } from './designTokens';

export const UNIFIED_EMPHASIS = {
  activeButtonBg: COLOR_TOKENS.accentMuted,
  variationLightnessBg: COLOR_TOKENS.accentVariationLightness,
  variationHueShiftBg: COLOR_TOKENS.accentVariationHueShift,
  chipBgAlpha: ALPHA_TOKENS.chipBg,
  chipBorderAlpha: ALPHA_TOKENS.chipBorder,
  cvdText: COLOR_TOKENS.warning,
  cvdBg: `${COLOR_TOKENS.warning}${ALPHA_TOKENS.chipBg}`,
  cvdBorder: `${COLOR_TOKENS.warning}${ALPHA_TOKENS.chipBorder}`,
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
