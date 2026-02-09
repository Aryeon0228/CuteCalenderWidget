import { create } from 'zustand';

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
  background: '#0a0a10',
  backgroundSecondary: '#16161e',
  backgroundTertiary: '#0c0c12',
  backgroundCard: '#16161e',

  textPrimary: '#ffffff',
  textSecondary: '#a0a0b0',
  textMuted: '#8888a0',

  border: '#2d2d38',
  borderLight: '#24242e',

  accent: '#6366f1',
  accentLight: '#818cf8',

  buttonBg: '#2d2d38',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
};

interface ThemeState {
  colors: ThemeColors;
}

export const useThemeStore = create<ThemeState>(() => ({
  colors: APP_THEME,
}));
