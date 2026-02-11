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

export interface ColorInfo {
  hex: string;
  rgb: RgbColor;
  hsl: HslColor;
}

const HEX_SHORT_RE = /^#?([a-f\d]{3})$/i;
const HEX_FULL_RE = /^#?([a-f\d]{6})$/i;
const MAX_CACHE_SIZE = 512;
const HEX_RGB_CACHE = new Map<string, RgbColor>();
const RGB_HSL_CACHE = new Map<string, HslColor>();
const HEX_LUMINANCE_CACHE = new Map<string, number>();

function setLimitedCache<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const first = cache.keys().next().value as string | undefined;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
}

function normalizeHex(hex: string): string | null {
  const value = hex.trim();
  const shortMatch = HEX_SHORT_RE.exec(value);
  if (shortMatch) {
    const short = shortMatch[1].toLowerCase();
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`;
  }
  const fullMatch = HEX_FULL_RE.exec(value);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }
  return null;
}

/**
 * Convert HEX color string to RGB object
 */
export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return { r: 0, g: 0, b: 0 };
  }

  const cached = HEX_RGB_CACHE.get(normalized);
  if (cached) {
    return cached;
  }

  const rgb: RgbColor = {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
  setLimitedCache(HEX_RGB_CACHE, normalized, rgb);
  return rgb;
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
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  const cacheKey = `${cr},${cg},${cb}`;
  const cached = RGB_HSL_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const rr = cr / 255;
  const gg = cg / 255;
  const bb = cb / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rr:
        h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
        break;
      case gg:
        h = ((bb - rr) / d + 2) / 6;
        break;
      case bb:
        h = ((rr - gg) / d + 4) / 6;
        break;
    }
  }

  const hsl = {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
  setLimitedCache(RGB_HSL_CACHE, cacheKey, hsl);
  return hsl;
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
// COLOR INFO & FORMATTING
// ============================================

/**
 * Get full color info from HEX
 */
export function getColorInfo(hex: string): ColorInfo {
  const normalized = normalizeHex(hex) ?? hex;
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return { hex: normalized, rgb, hsl };
}

/**
 * Format color for display
 */
export function formatHex(hex: string): string {
  return hex.toUpperCase();
}

export function formatRgb(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function formatHsl(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ============================================
// COLOR MANIPULATION
// ============================================

/**
 * Convert color to grayscale using luminance formula
 */
export function toGrayscale(hex: string): string {
  const gray = getLuminance(hex);
  return rgbToHex(gray, gray, gray);
}

/**
 * Calculate luminance value (0-255) from HEX color
 */
export function getLuminance(hex: string): number {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return 0;
  }

  const cached = HEX_LUMINANCE_CACHE.get(normalized);
  if (cached !== undefined) {
    return cached;
  }

  const rgb = hexToRgb(hex);
  const luminance = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
  setLimitedCache(HEX_LUMINANCE_CACHE, normalized, luminance);
  return luminance;
}

/**
 * Get contrasting text color (black or white) for a background
 */
export function getContrastColor(hex: string): string {
  const luminance = getLuminance(hex) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
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

/**
 * Generate value (lightness) variations of a color
 */
export function generateValueVariations(hex: string, steps: number = 5): string[] {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const variations: string[] = [];
  const minL = 10;
  const maxL = 90;
  const stepSize = (maxL - minL) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const newL = minL + (stepSize * i);
    const newRgb = hslToRgb(hsl.h, hsl.s, newL);
    variations.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }

  return variations;
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
 * Optionally shifts hue for stylistic shadows/highlights
 * Warm yellow hues bias shadows toward magenta/purple to avoid green casts
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

  // Get shortest hue direction (+1 or -1), with optional tie-break preference.
  const getDirection = (
    fromH: number,
    toH: number,
    preferNegativeOnTie: boolean = false
  ) => {
    let diff = toH - fromH;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) === 180) {
      return preferNegativeOnTie ? -1 : 1;
    }
    return diff >= 0 ? 1 : -1;
  };

  const isWarmYellowHue = h >= 35 && h <= 100;
  const isYellowFamilyHue = h >= 25 && h <= 75;
  const isBlueFamilyHue = h >= 190 && h <= 280;
  const YELLOW_HUE_MAX = 60;
  const YELLOW_HUE_MIN = 42;
  const CYAN_HUE_MIN = 185;
  const CYAN_HUE_MAX = 240;
  const shadowTargetHue = isWarmYellowHue ? 300 : 240;
  const shadowDir = getDirection(h, shadowTargetHue, isWarmYellowHue);
  const highlightTargetHue = isBlueFamilyHue ? 190 : 60;
  const highlightDir = getDirection(h, highlightTargetHue);

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

    let newH = (h + hueOffset + 360) % 360;
    // Guardrail: prevent warm yellow shadows from drifting into muddy green.
    if (isWarmYellowHue && lightnessOffset < 0 && newH > 90 && newH < 165) {
      newH = 90;
    }
    // Guardrail: when yellow-family colors are brightened, keep highlight hue in yellow range.
    if (isYellowFamilyHue && lightnessOffset > 0 && useHueShift) {
      if (highlightDir >= 0) {
        newH = Math.min(newH, YELLOW_HUE_MAX);
      } else {
        newH = Math.max(newH, YELLOW_HUE_MIN);
      }
    }
    // Guardrail: when blue-family colors are brightened, stop at cyan (no yellow cast).
    if (isBlueFamilyHue && lightnessOffset > 0 && useHueShift) {
      if (highlightDir <= 0) {
        newH = Math.max(newH, CYAN_HUE_MIN);
      } else {
        newH = Math.min(newH, CYAN_HUE_MAX);
      }
    }
    let newS = s;
    if (lightnessOffset < 0) {
      newS = Math.min(s * (isWarmYellowHue ? 1.02 : 1.1), 100);
    }
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

export type AppLanguage = 'ko' | 'en';

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

/**
 * Generate complementary color
 */
export function getComplementary(hex: string): string {
  return rotateHue(hex, 180);
}

/**
 * Generate analogous colors
 */
export function getAnalogous(hex: string): string[] {
  return [rotateHue(hex, -30), hex, rotateHue(hex, 30)];
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
  /** Two colors this type confuses — shown as dot pair on the button */
  confusedPair: [string, string];
}

export const COLOR_BLINDNESS_TYPES: ColorBlindnessInfo[] = [
  { type: 'none', label: 'Normal', shortLabel: 'Off', description: 'Normal vision', icon: 'eye-outline', confusedPair: ['#34d399', '#60a5fa'] },
  { type: 'protanopia', label: 'Protan', shortLabel: 'P', description: 'Red-weak', icon: 'eye-off-outline', confusedPair: ['#ef4444', '#22c55e'] },
  { type: 'deuteranopia', label: 'Deutan', shortLabel: 'D', description: 'Green-weak', icon: 'eye-off-outline', confusedPair: ['#22c55e', '#ef4444'] },
  { type: 'tritanopia', label: 'Tritan', shortLabel: 'T', description: 'Blue-weak', icon: 'eye-off-outline', confusedPair: ['#3b82f6', '#eab308'] },
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
export function generateColorHarmonies(hex: string, language: AppLanguage = 'ko'): ColorHarmony[] {
  const complementaryDescription =
    language === 'ko' ? '보색 - 정반대 색상' : 'Complementary - opposite on wheel';

  return [
    {
      type: 'complementary',
      name: 'Complementary',
      description: complementaryDescription,
      colors: [
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 180), name: 'Complement', angle: 180 },
      ],
    },
    {
      type: 'analogous',
      name: 'Analogous',
      description: 'Analogous - adjacent colors',
      colors: [
        { hex: rotateHue(hex, -30), name: 'Left', angle: -30 },
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 30), name: 'Right', angle: 30 },
      ],
    },
    {
      type: 'triadic',
      name: 'Triadic',
      description: 'Triadic - 120° spacing',
      colors: [
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 120), name: 'Second', angle: 120 },
        { hex: rotateHue(hex, 240), name: 'Third', angle: 240 },
      ],
    },
    {
      type: 'split-complementary',
      name: 'Split Comp.',
      description: 'Split complementary - around complement',
      colors: [
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 150), name: 'Split 1', angle: 150 },
        { hex: rotateHue(hex, 210), name: 'Split 2', angle: 210 },
      ],
    },
    {
      type: 'tetradic',
      name: 'Tetradic',
      description: 'Tetradic - 90° spacing',
      colors: [
        { hex, name: 'Base', angle: 0 },
        { hex: rotateHue(hex, 90), name: 'Second', angle: 90 },
        { hex: rotateHue(hex, 180), name: 'Third', angle: 180 },
        { hex: rotateHue(hex, 270), name: 'Fourth', angle: 270 },
      ],
    },
  ];
}
