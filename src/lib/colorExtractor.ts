/**
 * Native color extraction using react-native-image-colors
 * Provides high-quality color extraction using platform-native algorithms
 * - iOS: Uses UIImage color analysis
 * - Android: Uses Palette API (Material Design)
 */

import { getColors, IOSImageColors, AndroidImageColors } from 'react-native-image-colors';
import { Platform } from 'react-native';

/**
 * Extract colors from an image using native color extraction
 * @param imageUri - URI of the image to analyze
 * @param colorCount - Number of colors to extract (3-8)
 * @returns Array of hex color strings
 */
export async function extractColorsFromImage(
  imageUri: string,
  colorCount: number = 5
): Promise<string[]> {
  try {
    const result = await getColors(imageUri, {
      fallback: '#4ECDC4',
      cache: true,
      key: imageUri,
    });

    let extractedColors: string[] = [];

    if (result.platform === 'android') {
      extractedColors = extractAndroidColors(result);
    } else if (result.platform === 'ios') {
      extractedColors = extractIOSColors(result);
    } else {
      // Web fallback
      extractedColors = generateFallbackColors(colorCount);
    }

    // Ensure we have exactly colorCount colors
    return adjustColorCount(extractedColors, colorCount);
  } catch (error) {
    console.error('Native color extraction error:', error);
    return generateFallbackColors(colorCount);
  }
}

/**
 * Extract colors from Android Palette API result
 */
function extractAndroidColors(result: AndroidImageColors): string[] {
  const colors: string[] = [];

  // Priority order for Android Palette colors
  const colorKeys: (keyof AndroidImageColors)[] = [
    'vibrant',
    'dominant',
    'darkVibrant',
    'lightVibrant',
    'muted',
    'darkMuted',
    'lightMuted',
    'average',
  ];

  for (const key of colorKeys) {
    const color = result[key];
    if (color && typeof color === 'string' && color !== '#000000') {
      // Avoid duplicates
      if (!colors.includes(color.toUpperCase())) {
        colors.push(color.toUpperCase());
      }
    }
  }

  return colors;
}

/**
 * Extract colors from iOS UIImage result
 */
function extractIOSColors(result: IOSImageColors): string[] {
  const colors: string[] = [];

  // iOS returns: background, primary, secondary, detail
  const colorKeys: (keyof IOSImageColors)[] = [
    'primary',
    'secondary',
    'background',
    'detail',
  ];

  for (const key of colorKeys) {
    const color = result[key];
    if (color && typeof color === 'string' && color !== '#000000') {
      if (!colors.includes(color.toUpperCase())) {
        colors.push(color.toUpperCase());
      }
    }
  }

  return colors;
}

/**
 * Adjust color array to match requested count
 */
function adjustColorCount(colors: string[], targetCount: number): string[] {
  if (colors.length === 0) {
    return generateFallbackColors(targetCount);
  }

  if (colors.length >= targetCount) {
    return colors.slice(0, targetCount);
  }

  // Generate additional colors by creating variations
  const result = [...colors];
  let variationIndex = 0;

  while (result.length < targetCount) {
    const baseColor = colors[variationIndex % colors.length];
    const variation = createColorVariation(baseColor, result.length);

    if (!result.includes(variation)) {
      result.push(variation);
    } else {
      // If variation already exists, use fallback
      const fallback = generateFallbackColors(targetCount);
      result.push(fallback[result.length % fallback.length]);
    }

    variationIndex++;
  }

  return result;
}

/**
 * Create a color variation by adjusting lightness
 */
function createColorVariation(hexColor: string, index: number): string {
  const rgb = hexToRgb(hexColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Alternate between lighter and darker variations
  const lightnessShift = (index % 2 === 0) ? 15 : -15;
  const newLightness = Math.max(10, Math.min(90, hsl.l + lightnessShift));

  const newRgb = hslToRgb(hsl.h, hsl.s, newLightness);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Generate fallback colors (game-dev friendly palette)
 */
function generateFallbackColors(count: number): string[] {
  const palette = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  ];
  return palette.slice(0, count);
}

// ============ Color Utility Functions ============

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
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

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
