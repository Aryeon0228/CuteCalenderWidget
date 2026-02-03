import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

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

export const darkTheme: ThemeColors = {
  background: '#0a0a10',
  backgroundSecondary: '#16161e',
  backgroundTertiary: '#0c0c12',
  backgroundCard: '#16161e',

  textPrimary: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#666666',

  border: '#2d2d38',
  borderLight: '#24242e',

  accent: '#6366f1',
  accentLight: '#818cf8',

  buttonBg: '#2d2d38',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
};

export const lightTheme: ThemeColors = {
  background: '#f5f5f8',
  backgroundSecondary: '#ffffff',
  backgroundTertiary: '#eeeef2',
  backgroundCard: '#ffffff',

  textPrimary: '#1a1a2e',
  textSecondary: '#6b6b7b',
  textMuted: '#9999a8',

  border: '#e0e0e8',
  borderLight: '#d4d4dc',

  accent: '#6366f1',
  accentLight: '#818cf8',

  buttonBg: '#e8e8f0',
  modalOverlay: 'rgba(0, 0, 0, 0.4)',
};

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      colors: darkTheme,

      toggleTheme: () => {
        const currentMode = get().mode;
        const newMode = currentMode === 'dark' ? 'light' : 'dark';
        set({
          mode: newMode,
          colors: newMode === 'dark' ? darkTheme : lightTheme,
        });
      },

      setTheme: (mode) => {
        set({
          mode,
          colors: mode === 'dark' ? darkTheme : lightTheme,
        });
      },
    }),
    {
      name: 'gamepalette-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.colors = state.mode === 'dark' ? darkTheme : lightTheme;
        }
      },
    }
  )
);
