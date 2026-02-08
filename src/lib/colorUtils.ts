/**
 * Color Utility Functions
 * Conversion and manipulation utilities for color values
 */

// ============================================
// COLOR CONVERSION
// ============================================

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert HEX color string to RGB object
 */
export function hexToRgb(hex: string): RgbColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB values to HEX string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

/**
 * Convert RGB to HSL color space
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to RGB color space
 */
export function hslToRgb(h: number, s: number, l: number): RgbColor {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

// ============================================
// COLOR MANIPULATION
// ============================================

/**
 * Convert color to grayscale using luminance formula
 */
export function toGrayscale(hex: string): string {
  const rgb = hexToRgb(hex);
  const gray = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
  return rgbToHex(gray, gray, gray);
}

/**
 * Calculate luminance value (0-255) from HEX color
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
}

/**
 * Adjust color saturation and brightness
 */
export function adjustColor(
  hex: string,
  satMult: number,
  brightMult: number
): string {
  if (satMult === 1 && brightMult === 1) return hex;

  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const newS = Math.min(100, Math.max(0, s * satMult));
  const newL = Math.min(100, Math.max(0, l * brightMult));

  const newRgb = hslToRgb(h, newS, newL);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Shift hue by given degrees (wraps around 360)
 */
export function shiftHue(hex: string, shift: number): string {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newH = (h + shift + 360) % 360;
  const newRgb = hslToRgb(newH, s, l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

// ============================================
// COLOR VARIATIONS
// ============================================

export interface ColorVariation {
  hex: string;
  label: string;
  fullLabel: string;
  hsl: HslColor;
}

/**
 * Generate shadow/highlight variations of a color
 * Optionally shifts hue toward blue for shadows and yellow for highlights
 */
export function generateColorVariations(
  hex: string,
  useHueShift: boolean
): ColorVariation[] {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Calculate optimal hue shift amount based on saturation
  const saturationFactor = Math.min(s / 100, 1);
  const baseHueShift = useHueShift ? Math.round(15 * saturationFactor) : 0;

  // Get shortest direction to Blue (240) for shadows, Yellow (60) for highlights
  const getDirection = (fromH: number, toH: number) => {
    let diff = toH - fromH;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff >= 0 ? 1 : -1;
  };

  const shadowDir = getDirection(h, 240);
  const highlightDir = getDirection(h, 60);

  // Create variation with proportional lightness distribution
  const createVar = (
    lightnessOffset: number,
    hueOffset: number
  ): { hex: string; hsl: HslColor } => {
    const MIN_L = 5,
      MAX_L = 95,
      MAX_OFFSET = 30,
      SPACE_USAGE = 0.5;

    let newL: number;
    if (lightnessOffset < 0) {
      const availableSpace = l - MIN_L;
      const ratio = Math.abs(lightnessOffset) / MAX_OFFSET;
      newL = l - availableSpace * ratio * SPACE_USAGE;
    } else if (lightnessOffset > 0) {
      const availableSpace = MAX_L - l;
      const ratio = lightnessOffset / MAX_OFFSET;
      newL = l + availableSpace * ratio * SPACE_USAGE;
    } else {
      newL = l;
    }
    newL = Math.min(Math.max(newL, MIN_L), MAX_L);

    const newH = (h + hueOffset + 360) % 360;
    let newS = s;
    if (lightnessOffset < 0) newS = Math.min(s * 1.1, 100);
    else if (lightnessOffset > 0) newS = s * 0.9;

    const newRgb = hslToRgb(newH, newS, newL);
    return {
      hex: rgbToHex(newRgb.r, newRgb.g, newRgb.b),
      hsl: { h: Math.round(newH), s: Math.round(newS), l: Math.round(newL) },
    };
  };

  const shadow2 = createVar(-30, useHueShift ? shadowDir * baseHueShift * 1.5 : 0);
  const shadow1 = createVar(-15, useHueShift ? shadowDir * baseHueShift * 0.75 : 0);
  const highlight1 = createVar(15, useHueShift ? highlightDir * baseHueShift * 0.75 : 0);
  const highlight2 = createVar(30, useHueShift ? highlightDir * baseHueShift * 1.5 : 0);

  return [
    { ...shadow2, label: 'S2', fullLabel: 'Shadow 2' },
    { ...shadow1, label: 'S1', fullLabel: 'Shadow 1' },
    { hex, label: 'Base', fullLabel: 'Base', hsl: { h, s, l } },
    { ...highlight1, label: 'L1', fullLabel: 'Light 1' },
    { ...highlight2, label: 'L2', fullLabel: 'Light 2' },
  ];
}

// ============================================
// COLOR HARMONY
// ============================================

export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic';

export interface HarmonyColor {
  hex: string;
  name: string;
  angle: number;
}

export interface ColorHarmony {
  type: HarmonyType;
  name: string;
  description: string;
  colors: HarmonyColor[];
}

/**
 * Generate color at a specific hue rotation from base color
 */
function rotateHue(hex: string, degrees: number): string {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newH = (h + degrees + 360) % 360;
  const newRgb = hslToRgb(newH, s, l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

// ============================================
// COLOR BLINDNESS SIMULATION
// ============================================

export type ColorBlindnessType = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface ColorBlindnessInfo {
  type: ColorBlindnessType;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

export const COLOR_BLINDNESS_TYPES: ColorBlindnessInfo[] = [
  { type: 'none', label: 'Normal', shortLabel: 'Off', description: 'Normal vision', icon: 'eye-outline' },
  { type: 'protanopia', label: 'Protan', shortLabel: 'P', description: 'Red-blind', icon: 'eye-off-outline' },
  { type: 'deuteranopia', label: 'Deutan', shortLabel: 'D', description: 'Green-blind', icon: 'eye-off-outline' },
  { type: 'tritanopia', label: 'Tritan', shortLabel: 'T', description: 'Blue-blind', icon: 'eye-off-outline' },
];

// sRGB gamma correction
function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  c = Math.max(0, Math.min(1, c));
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

// Viénot et al. (1999) simulation matrices for dichromacy
// Applied in linearized sRGB space
const CVD_MATRICES: Record<string, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
};

/**
 * Simulate how a color appears to someone with color vision deficiency
 * Uses Viénot et al. (1999) simulation matrices in linearized sRGB
 */
export function simulateColorBlindness(hex: string, type: ColorBlindnessType): string {
  if (type === 'none') return hex;

  const rgb = hexToRgb(hex);
  const matrix = CVD_MATRICES[type];
  if (!matrix) return hex;

  // Convert to linear RGB
  const lr = srgbToLinear(rgb.r);
  const lg = srgbToLinear(rgb.g);
  const lb = srgbToLinear(rgb.b);

  // Apply CVD matrix
  const sr = matrix[0][0] * lr + matrix[0][1] * lg + matrix[0][2] * lb;
  const sg = matrix[1][0] * lr + matrix[1][1] * lg + matrix[1][2] * lb;
  const sb = matrix[2][0] * lr + matrix[2][1] * lg + matrix[2][2] * lb;

  // Convert back to sRGB
  return rgbToHex(linearToSrgb(sr), linearToSrgb(sg), linearToSrgb(sb));
}

// ============================================
// COLOR HARMONY
// ============================================

/**
 * Generate all color harmonies for a given base color
 */
export function generateColorHarmonies(hex: string): ColorHarmony[] {
  const rgb = hexToRgb(hex);
  const { h } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  return [
    {
      type: 'complementary',
      name: 'Complementary',
      description: '보색 - 정반대 색상',
      colors: [
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 180), name: 'Complement', angle: 180 },
      ],
    },
    {
      type: 'analogous',
      name: 'Analogous',
      description: '유사색 - 인접한 색상',
      colors: [
        { hex: rotateHue(hex, -30), name: 'Left', angle: -30 },
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 30), name: 'Right', angle: 30 },
      ],
    },
    {
      type: 'triadic',
      name: 'Triadic',
      description: '삼각배색 - 120° 간격',
      colors: [
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 120), name: 'Second', angle: 120 },
        { hex: rotateHue(hex, 240), name: 'Third', angle: 240 },
      ],
    },
    {
      type: 'split-complementary',
      name: 'Split Comp.',
      description: '분열보색 - 보색 양옆',
      colors: [
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 150), name: 'Split 1', angle: 150 },
        { hex: rotateHue(hex, 210), name: 'Split 2', angle: 210 },
      ],
    },
    {
      type: 'tetradic',
      name: 'Tetradic',
      description: '사각배색 - 90° 간격',
      colors: [
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 90), name: 'Second', angle: 90 },
        { hex: rotateHue(hex, 180), name: 'Third', angle: 180 },
        { hex: rotateHue(hex, 270), name: 'Fourth', angle: 270 },
      ],
    },
  ];
}
