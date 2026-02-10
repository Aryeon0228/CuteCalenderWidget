import { create } from 'zustand';
import { COLOR_TOKENS } from '../constants/designTokens';

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  backgroundCard: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  border: string;
  borderLight: string;

  // Accent
  accent: string;
  accentLight: string;

  // UI Elements
  buttonBg: string;
  modalOverlay: string;
}

export const APP_THEME: ThemeColors = {
  background: COLOR_TOKENS.backgroundApp,
  backgroundSecondary: COLOR_TOKENS.backgroundSurface,
  backgroundTertiary: COLOR_TOKENS.backgroundSurfaceAlt,
  backgroundCard: COLOR_TOKENS.backgroundSurface,

  textPrimary: COLOR_TOKENS.textPrimary,
  textSecondary: COLOR_TOKENS.textSecondary,
  textMuted: COLOR_TOKENS.textMuted,

  border: COLOR_TOKENS.borderDefault,
  borderLight: COLOR_TOKENS.borderSoft,

  accent: COLOR_TOKENS.accentPrimary,
  accentLight: COLOR_TOKENS.accentLight,

  buttonBg: COLOR_TOKENS.borderDefault,
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
};

interface ThemeState {
  colors: ThemeColors;
}

export const useThemeStore = create<ThemeState>(() => ({
  colors: APP_THEME,
}));
