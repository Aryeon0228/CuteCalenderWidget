/**
 * Color Extraction Library for React Native
 * Supports two methods:
 * - K-Means Clustering: Best for photos, gradients
 * - Hue Histogram: Best for game art, clear color regions
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import UPNG from 'upng-js';

// ============================================
// TYPES
// ============================================

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface PixelData {
  rgb: RgbColor;
  hsl: HslColor;
}

interface HueBin {
  hue: number;
  count: number;
  pixels: PixelData[];
}

export type ExtractionMethod = 'histogram' | 'kmeans';

// Luminosity histogram result
export interface LuminosityHistogram {
  bins: number[];           // 32 bins (0-255 mapped to 0-31)
  average: number;          // Average luminosity (0-255)
  contrast: number;         // Contrast percentage (0-100)
  darkPercent: number;      // Percentage of dark pixels
  midPercent: number;       // Percentage of mid-tone pixels
  brightPercent: number;    // Percentage of bright pixels
  minValue: number;         // Minimum luminosity
  maxValue: number;         // Maximum luminosity
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

/**
 * Extract colors from an image
 * @param imageUri - URI of the image
 * @param colorCount - Number of colors to extract (3-8)
 * @param method - 'histogram' or 'kmeans'
 */
export async function extractColorsFromImage(
  imageUri: string,
  colorCount: number = 5,
  method: ExtractionMethod = 'histogram'
): Promise<string[]> {
  try {
    // 1. Resize image for performance (max 100x100)
    const manipulated = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 100, height: 100 } }],
      { format: ImageManipulator.SaveFormat.PNG, base64: true }
    );

    if (!manipulated.base64) {
      throw new Error('Failed to get base64 data');
    }

    // 2. Decode PNG to get pixel data
    const pixels = await decodeImage(manipulated.base64);

    if (pixels.length === 0) {
      return generateFallbackColors(colorCount);
    }

    // 3. Extract colors using selected method
    let dominantColors: RgbColor[];

    if (method === 'kmeans') {
      dominantColors = kMeansClustering(pixels, colorCount);
    } else {
      const pixelData = pixels.map(rgb => ({
        rgb,
        hsl: rgbToHsl(rgb.r, rgb.g, rgb.b)
      }));
      dominantColors = extractColorsFromHueHistogram(pixelData, colorCount);
    }

    // 4. Convert to hex strings
    return dominantColors.map(rgb => rgbToHex(rgb.r, rgb.g, rgb.b));

  } catch (error) {
    console.error('Color extraction error:', error);
    return generateFallbackColors(colorCount);
  }
}

// ============================================
// LUMINOSITY HISTOGRAM ANALYSIS
// ============================================

/**
 * Analyze luminosity distribution of an image
 * @param imageUri - URI of the image
 * @returns Luminosity histogram data
 */
export async function analyzeLuminosityHistogram(
  imageUri: string
): Promise<LuminosityHistogram | null> {
  try {
    // Resize image for performance (max 150x150 for better accuracy)
    const manipulated = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 150, height: 150 } }],
      { format: ImageManipulator.SaveFormat.PNG, base64: true }
    );

    if (!manipulated.base64) {
      return null;
    }

    // Decode PNG to get pixel data
    const pixels = await decodeImageForHistogram(manipulated.base64);

    if (pixels.length === 0) {
      return null;
    }

    // Calculate luminosity for each pixel
    const luminosities = pixels.map(({ r, g, b }) =>
      Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    );

    // Create 32-bin histogram (each bin covers 8 values: 0-7, 8-15, etc.)
    const binCount = 32;
    const bins: number[] = new Array(binCount).fill(0);

    for (const lum of luminosities) {
      const binIndex = Math.min(Math.floor(lum / 8), binCount - 1);
      bins[binIndex]++;
    }

    // Normalize bins to max = 100
    const maxBinCount = Math.max(...bins);
    const normalizedBins = bins.map(count =>
      maxBinCount > 0 ? Math.round((count / maxBinCount) * 100) : 0
    );

    // Calculate statistics
    const totalPixels = luminosities.length;
    const sum = luminosities.reduce((a, b) => a + b, 0);
    const average = Math.round(sum / totalPixels);

    // Sort for percentile calculations
    const sorted = [...luminosities].sort((a, b) => a - b);
    const minValue = sorted[0];
    const maxValue = sorted[sorted.length - 1];

    // Calculate contrast as range / 255 (simplified)
    // Also consider standard deviation for more accurate contrast
    const variance = luminosities.reduce((acc, lum) =>
      acc + Math.pow(lum - average, 2), 0
    ) / totalPixels;
    const stdDev = Math.sqrt(variance);

    // Contrast: combination of range and std deviation
    const rangeContrast = (maxValue - minValue) / 255;
    const stdContrast = stdDev / 128; // Normalize std dev
    const contrast = Math.round(Math.min(100, ((rangeContrast + stdContrast) / 2) * 100));

    // Calculate tone distribution (dark/mid/bright)
    let darkCount = 0;
    let midCount = 0;
    let brightCount = 0;

    for (const lum of luminosities) {
      if (lum < 85) {
        darkCount++;
      } else if (lum < 170) {
        midCount++;
      } else {
        brightCount++;
      }
    }

    const darkPercent = Math.round((darkCount / totalPixels) * 100);
    const midPercent = Math.round((midCount / totalPixels) * 100);
    const brightPercent = Math.round((brightCount / totalPixels) * 100);

    return {
      bins: normalizedBins,
      average,
      contrast,
      darkPercent,
      midPercent,
      brightPercent,
      minValue,
      maxValue,
    };
  } catch (error) {
    console.error('Luminosity histogram error:', error);
    return null;
  }
}

// Decode image without sampling (for more accurate histogram)
async function decodeImageForHistogram(base64: string): Promise<RgbColor[]> {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const png = UPNG.decode(bytes.buffer);
    const rgbaData = new Uint8Array(UPNG.toRGBA8(png)[0]);

    // Sample every 2nd pixel for balance between accuracy and performance
    const pixels: RgbColor[] = [];
    for (let i = 0; i < rgbaData.length; i += 8) { // Every 2nd pixel
      const r = rgbaData[i];
      const g = rgbaData[i + 1];
      const b = rgbaData[i + 2];
      const a = rgbaData[i + 3];

      if (a < 128) continue;
      pixels.push({ r, g, b });
    }

    return pixels;
  } catch (error) {
    console.error('Image decode for histogram error:', error);
    return [];
  }
}

// ============================================
// IMAGE DECODING
// ============================================

async function decodeImage(base64: string): Promise<RgbColor[]> {
  try {
    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode PNG
    const png = UPNG.decode(bytes.buffer);
    const rgbaData = new Uint8Array(UPNG.toRGBA8(png)[0]);

    // Extract pixels (sample every 4th pixel for performance)
    const pixels: RgbColor[] = [];
    for (let i = 0; i < rgbaData.length; i += 16) { // Every 4th pixel (4 bytes per pixel * 4)
      const r = rgbaData[i];
      const g = rgbaData[i + 1];
      const b = rgbaData[i + 2];
      const a = rgbaData[i + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      pixels.push({ r, g, b });
    }

    return pixels;
  } catch (error) {
    console.error('Image decode error:', error);
    return [];
  }
}

// ============================================
// K-MEANS CLUSTERING
// ============================================

function kMeansClustering(pixels: RgbColor[], k: number, maxIterations: number = 20): RgbColor[] {
  if (pixels.length === 0) {
    return Array(k).fill({ r: 128, g: 128, b: 128 });
  }

  if (pixels.length < k) {
    return pixels.concat(Array(k - pixels.length).fill(pixels[0] || { r: 128, g: 128, b: 128 }));
  }

  // Initialize centroids using k-means++ algorithm
  const centroids: RgbColor[] = initializeCentroids(pixels, k);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Assign pixels to clusters
    const clusters: RgbColor[][] = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let minDistance = Infinity;
      let closestCentroid = 0;

      for (let i = 0; i < centroids.length; i++) {
        const distance = colorDistance(pixel, centroids[i]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCentroid = i;
        }
      }

      clusters[closestCentroid].push(pixel);
    }

    // Update centroids
    let converged = true;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;

      const newCentroid = averageColor(clusters[i]);
      if (colorDistance(newCentroid, centroids[i]) > 1) {
        converged = false;
      }
      centroids[i] = newCentroid;
    }

    if (converged) break;
  }

  // Sort by luminance (brightness)
  return centroids.sort((a, b) => {
    const lumA = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
    const lumB = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
    return lumB - lumA;
  });
}

function initializeCentroids(pixels: RgbColor[], k: number): RgbColor[] {
  const centroids: RgbColor[] = [];

  // Choose first centroid randomly
  centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);

  // Choose remaining centroids with probability proportional to distance (k-means++)
  while (centroids.length < k) {
    const distances: number[] = pixels.map(pixel => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = colorDistance(pixel, centroid);
        if (dist < minDist) minDist = dist;
      }
      return minDist;
    });

    const totalDistance = distances.reduce((a, b) => a + b, 0);
    if (totalDistance === 0) {
      centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
      continue;
    }

    let random = Math.random() * totalDistance;
    for (let i = 0; i < pixels.length; i++) {
      random -= distances[i];
      if (random <= 0) {
        centroids.push(pixels[i]);
        break;
      }
    }
  }

  return centroids;
}

function colorDistance(c1: RgbColor, c2: RgbColor): number {
  // Weighted Euclidean distance for perceptual similarity
  const rmean = (c1.r + c2.r) / 2;
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;

  return Math.sqrt(
    (2 + rmean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rmean) / 256) * db * db
  );
}

function averageColor(colors: RgbColor[]): RgbColor {
  if (colors.length === 0) {
    return { r: 128, g: 128, b: 128 };
  }

  const sum = colors.reduce(
    (acc, color) => ({
      r: acc.r + color.r,
      g: acc.g + color.g,
      b: acc.b + color.b,
    }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(sum.r / colors.length),
    g: Math.round(sum.g / colors.length),
    b: Math.round(sum.b / colors.length),
  };
}

// ============================================
// HUE HISTOGRAM METHOD
// ============================================

function extractColorsFromHueHistogram(pixels: PixelData[], colorCount: number): RgbColor[] {
  if (pixels.length === 0) {
    return Array(colorCount).fill({ r: 128, g: 128, b: 128 });
  }

  // Separate chromatic and achromatic pixels
  const chromaticPixels: PixelData[] = [];
  const achromaticPixels: PixelData[] = [];

  for (const pixel of pixels) {
    if (pixel.hsl.s < 25 || pixel.hsl.l < 10 || pixel.hsl.l > 90) {
      achromaticPixels.push(pixel);
    } else {
      chromaticPixels.push(pixel);
    }
  }

  // Build Hue histogram (36 bins, each covering 10 degrees)
  const binCount = 36;
  const binSize = 360 / binCount;
  const histogram: HueBin[] = Array.from({ length: binCount }, (_, i) => ({
    hue: i * binSize + binSize / 2,
    count: 0,
    pixels: []
  }));

  for (const pixel of chromaticPixels) {
    const binIndex = Math.floor(pixel.hsl.h / binSize) % binCount;
    histogram[binIndex].count++;
    histogram[binIndex].pixels.push(pixel);
  }

  // Smooth histogram to reduce noise
  const smoothedCounts = smoothHistogram(histogram.map(b => b.count));

  // Find peaks in the histogram
  const peaks = findPeaks(smoothedCounts, histogram);

  // Calculate score for each peak
  const peaksWithScore = peaks.map(peak => {
    const avgSat = peak.pixels.length > 0
      ? peak.pixels.reduce((sum, p) => sum + p.hsl.s, 0) / peak.pixels.length
      : 0;
    const avgLightness = peak.pixels.length > 0
      ? peak.pixels.reduce((sum, p) => sum + p.hsl.l, 0) / peak.pixels.length
      : 50;

    const lightnessScore = avgLightness >= 20 && avgLightness <= 80
      ? 1.0
      : 0.5 + 0.5 * (1 - Math.abs(avgLightness - 50) / 50);

    const satNormalized = avgSat / 100;
    const score = Math.sqrt(peak.count) * (satNormalized * satNormalized) * lightnessScore * 100;

    return {
      ...peak,
      avgSaturation: avgSat,
      avgLightness,
      score: Math.max(score, peak.count * 0.01)
    };
  });

  peaksWithScore.sort((a, b) => b.score - a.score);

  const totalChromatic = chromaticPixels.length;
  const minThreshold = totalChromatic * 0.005;

  type ScoredBin = HueBin & { avgSaturation: number; avgLightness: number; score: number };
  const selectedBins: ScoredBin[] = [];
  const usedHues: number[] = [];

  // First pass: select peaks with hue distance check
  for (const peak of peaksWithScore) {
    if (peak.count >= minThreshold && selectedBins.length < colorCount) {
      let tooClose = false;
      for (const usedHue of usedHues) {
        const hueDiff = Math.min(
          Math.abs(peak.hue - usedHue),
          360 - Math.abs(peak.hue - usedHue)
        );
        if (hueDiff < 25) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        selectedBins.push(peak);
        usedHues.push(peak.hue);
      }
    }
  }

  // Second pass: fill with relaxed hue distance
  for (const peak of peaksWithScore) {
    if (selectedBins.length >= colorCount) break;
    if (selectedBins.includes(peak)) continue;

    let tooClose = false;
    for (const usedHue of usedHues) {
      const hueDiff = Math.min(
        Math.abs(peak.hue - usedHue),
        360 - Math.abs(peak.hue - usedHue)
      );
      if (hueDiff < 15) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose && peak.pixels.length > 0) {
      selectedBins.push(peak);
      usedHues.push(peak.hue);
    }
  }

  // Convert to representative colors
  const colors: RgbColor[] = selectedBins.map(bin => getRepresentativeColor(bin.pixels));

  // Fill remaining slots
  while (colors.length < colorCount) {
    const remainingPeaks = peaksWithScore.filter(p => !selectedBins.includes(p) && p.pixels.length > 0);
    if (remainingPeaks.length > 0) {
      const nextPeak = remainingPeaks[0];
      colors.push(getRepresentativeColor(nextPeak.pixels));
      selectedBins.push(nextPeak);
    } else {
      break;
    }
  }

  // Add achromatic colors if needed
  if (colors.length < colorCount && achromaticPixels.length > 0) {
    const sortedAchromatic = [...achromaticPixels].sort((a, b) => b.hsl.l - a.hsl.l);
    const slotsNeeded = colorCount - colors.length;
    const groupSize = Math.ceil(sortedAchromatic.length / slotsNeeded);

    for (let i = 0; i < slotsNeeded && colors.length < colorCount; i++) {
      const start = i * groupSize;
      const end = Math.min(start + groupSize, sortedAchromatic.length);
      const group = sortedAchromatic.slice(start, end);
      if (group.length > 0) {
        colors.push(getRepresentativeColor(group));
      }
    }
  }

  // Sort by luminance
  return colors.slice(0, colorCount).sort((a, b) => {
    const lumA = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
    const lumB = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
    return lumB - lumA;
  });
}

function smoothHistogram(counts: number[]): number[] {
  const smoothed: number[] = [];
  const windowSize = 3;

  for (let i = 0; i < counts.length; i++) {
    let sum = 0;
    let count = 0;

    for (let j = -windowSize; j <= windowSize; j++) {
      const idx = (i + j + counts.length) % counts.length;
      sum += counts[idx];
      count++;
    }

    smoothed.push(sum / count);
  }

  return smoothed;
}

function findPeaks(smoothedCounts: number[], histogram: HueBin[]): HueBin[] {
  const peaks: HueBin[] = [];
  const n = smoothedCounts.length;

  for (let i = 0; i < n; i++) {
    const prev = smoothedCounts[(i - 1 + n) % n];
    const curr = smoothedCounts[i];
    const next = smoothedCounts[(i + 1) % n];

    if (curr >= prev && curr >= next && curr > 0) {
      const peakBin: HueBin = {
        hue: histogram[i].hue,
        count: histogram[i].count,
        pixels: [...histogram[i].pixels]
      };

      const prevIdx = (i - 1 + n) % n;
      const nextIdx = (i + 1) % n;

      if (smoothedCounts[prevIdx] > smoothedCounts[i] * 0.5) {
        peakBin.count += histogram[prevIdx].count;
        peakBin.pixels.push(...histogram[prevIdx].pixels);
      }
      if (smoothedCounts[nextIdx] > smoothedCounts[i] * 0.5) {
        peakBin.count += histogram[nextIdx].count;
        peakBin.pixels.push(...histogram[nextIdx].pixels);
      }

      peaks.push(peakBin);
    }
  }

  return peaks;
}

function getRepresentativeColor(pixels: PixelData[]): RgbColor {
  if (pixels.length === 0) {
    return { r: 128, g: 128, b: 128 };
  }

  let totalWeight = 0;
  let sumR = 0, sumG = 0, sumB = 0;

  for (const pixel of pixels) {
    const satNormalized = pixel.hsl.s / 100;
    const weight = 1 + (satNormalized * satNormalized * 100);
    totalWeight += weight;
    sumR += pixel.rgb.r * weight;
    sumG += pixel.rgb.g * weight;
    sumB += pixel.rgb.b * weight;
  }

  return {
    r: Math.round(sumR / totalWeight),
    g: Math.round(sumG / totalWeight),
    b: Math.round(sumB / totalWeight)
  };
}

// ============================================
// COLOR UTILITIES
// ============================================

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): HslColor {
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

function generateFallbackColors(count: number): string[] {
  const palette = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  ];
  return palette.slice(0, count);
}
