import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtractionMethod } from '../lib/colorExtractor';

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
  extractionMethod: ExtractionMethod;

  // Library
  savedPalettes: SavedPalette[];

  // Actions
  setCurrentColors: (colors: string[]) => void;
  setCurrentImageUri: (uri: string | null) => void;
  setSelectedColorIndex: (index: number | null) => void;
  setColorCount: (count: number) => void;
  setExtractionMethod: (method: ExtractionMethod) => void;

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
      extractionMethod: 'histogram',
      savedPalettes: [],

      // Actions
      setCurrentColors: (colors) => set({ currentColors: colors, selectedColorIndex: null }),

      setCurrentImageUri: (uri) => set({ currentImageUri: uri }),

      setSelectedColorIndex: (index) => set({ selectedColorIndex: index }),

      setColorCount: (count) => set({ colorCount: count }),

      setExtractionMethod: (method) => set({ extractionMethod: method }),

      savePalette: (name) => {
        const { currentColors, currentImageUri, savedPalettes } = get();
        if (currentColors.length === 0) return;

        // Generate unique name with date and sequence number
        let finalName = name;
        if (!name || name.trim() === '') {
          const today = new Date();
          const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
          const baseName = `Palette ${dateStr}`;

          // Count existing palettes with same date prefix
          const sameDatePalettes = savedPalettes.filter(p =>
            p.name.startsWith(baseName)
          );

          // Find the next sequence number
          let maxNum = 0;
          for (const p of sameDatePalettes) {
            const match = p.name.match(/_(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          }

          const nextNum = maxNum + 1;
          finalName = `${baseName}_${String(nextNum).padStart(3, '0')}`;
        }

        const newPalette: SavedPalette = {
          id: Date.now().toString(),
          name: finalName,
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
        extractionMethod: state.extractionMethod,
      }),
    }
  )
);
