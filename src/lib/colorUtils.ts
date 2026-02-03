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
