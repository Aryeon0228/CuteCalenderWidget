/**
 * Style Filter Presets for Color Adjustments
 * Used to apply different visual styles to extracted palettes
 */

export type StyleFilter = 'original' | 'hypercasual' | 'stylized' | 'realistic';

export interface StylePreset {
  name: string;
  saturation: number;
  brightness: number;
  icon: string;
  color: string;
}

export const STYLE_PRESETS: Record<StyleFilter, StylePreset> = {
  original: {
    name: 'Original',
    saturation: 1.0,
    brightness: 1.0,
    icon: 'paw-outline',
    color: '#a0a0b0',
  },
  hypercasual: {
    name: 'Hyper',
    saturation: 1.3,
    brightness: 1.1,
    icon: 'sparkles-outline',
    color: '#fbbf24',
  },
  stylized: {
    name: 'Stylized',
    saturation: 1.15,
    brightness: 1.05,
    icon: 'brush-outline',
    color: '#c084fc',
  },
  realistic: {
    name: 'Realistic',
    saturation: 0.9,
    brightness: 0.95,
    icon: 'eye-outline',
    color: '#34d399',
  },
};

export const STYLE_FILTER_KEYS = Object.keys(STYLE_PRESETS) as StyleFilter[];
