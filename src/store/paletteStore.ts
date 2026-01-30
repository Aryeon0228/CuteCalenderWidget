import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
  imageUri: string | null;
  createdAt: number;
}

interface PaletteState {
  // Current extraction state
  currentColors: string[];
  currentImageUri: string | null;
  selectedColorIndex: number | null;
  colorCount: number;

  // Library
  savedPalettes: SavedPalette[];

  // Actions
  setCurrentColors: (colors: string[]) => void;
  setCurrentImageUri: (uri: string | null) => void;
  setSelectedColorIndex: (index: number | null) => void;
  setColorCount: (count: number) => void;

  savePalette: (name: string) => void;
  deletePalette: (id: string) => void;
  loadPalette: (palette: SavedPalette) => void;
  clearCurrent: () => void;
}

export const usePaletteStore = create<PaletteState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentColors: [],
      currentImageUri: null,
      selectedColorIndex: null,
      colorCount: 5,
      savedPalettes: [],

      // Actions
      setCurrentColors: (colors) => set({ currentColors: colors, selectedColorIndex: null }),

      setCurrentImageUri: (uri) => set({ currentImageUri: uri }),

      setSelectedColorIndex: (index) => set({ selectedColorIndex: index }),

      setColorCount: (count) => set({ colorCount: count }),

      savePalette: (name) => {
        const { currentColors, currentImageUri, savedPalettes } = get();
        if (currentColors.length === 0) return;

        const newPalette: SavedPalette = {
          id: Date.now().toString(),
          name: name || `Palette ${savedPalettes.length + 1}`,
          colors: [...currentColors],
          imageUri: currentImageUri,
          createdAt: Date.now(),
        };

        set({ savedPalettes: [newPalette, ...savedPalettes] });
      },

      deletePalette: (id) => {
        const { savedPalettes } = get();
        set({ savedPalettes: savedPalettes.filter(p => p.id !== id) });
      },

      loadPalette: (palette) => {
        set({
          currentColors: [...palette.colors],
          currentImageUri: palette.imageUri,
          selectedColorIndex: null,
        });
      },

      clearCurrent: () => {
        set({
          currentColors: [],
          currentImageUri: null,
          selectedColorIndex: null,
        });
      },
    }),
    {
      name: 'gamepalette-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedPalettes: state.savedPalettes,
        colorCount: state.colorCount,
      }),
    }
  )
);
