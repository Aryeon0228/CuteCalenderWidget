import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { usePaletteStore } from '../store/paletteStore';
import { useThemeStore } from '../store/themeStore';
import { extractColorsFromImage, ExtractionMethod } from '../lib/colorExtractor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLOR_CARD_SIZE = (SCREEN_WIDTH - 64) / 4 - 8;

// Style filter presets
type StyleFilter = 'original' | 'hypercasual' | 'stylized' | 'realistic';

interface StylePreset {
  name: string;
  saturation: number;
  brightness: number;
  icon: string;
}

const STYLE_PRESETS: Record<StyleFilter, StylePreset> = {
  original: { name: 'Original', saturation: 1.0, brightness: 1.0, icon: 'ellipse-outline' },
  hypercasual: { name: 'Hyper', saturation: 1.3, brightness: 1.1, icon: 'sparkles-outline' },
  stylized: { name: 'Stylized', saturation: 1.15, brightness: 1.05, icon: 'brush-outline' },
  realistic: { name: 'Realistic', saturation: 0.9, brightness: 0.95, icon: 'camera-outline' },
};

// Color conversion utilities (outside component for hoisting)
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hslToRgb = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
};

const toGrayscale = (hex: string) => {
  const rgb = hexToRgb(hex);
  const gray = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
  return rgbToHex(gray, gray, gray);
};

const adjustColor = (hex: string, satMult: number, brightMult: number) => {
  if (satMult === 1 && brightMult === 1) return hex;

  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const newS = Math.min(100, Math.max(0, s * satMult));
  const newL = Math.min(100, Math.max(0, l * brightMult));

  const newRgb = hslToRgb(h, newS, newL);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
};

const shiftHue = (hex: string, shift: number) => {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Shift hue and wrap around
  const newH = (h + shift + 360) % 360;

  const newRgb = hslToRgb(newH, s, l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
};

// Generate color variations (Shadow/Highlight with optional hue shift)
interface ColorVariation {
  hex: string;
  label: string;
  fullLabel: string;
  hsl: { h: number; s: number; l: number };
}

const generateColorVariations = (hex: string, useHueShift: boolean): ColorVariation[] => {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Calculate optimal hue shift amount based on saturation
  const saturationFactor = Math.min(s / 100, 1);
  const baseHueShift = useHueShift ? Math.round(15 * saturationFactor) : 0;

  // Get shortest direction to Blue (240°) for shadows, Yellow (60°) for highlights
  const getDirection = (fromH: number, toH: number) => {
    let diff = toH - fromH;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff >= 0 ? 1 : -1;
  };

  const shadowDir = getDirection(h, 240);  // toward Blue
  const highlightDir = getDirection(h, 60); // toward Yellow

  // Create variation with proportional lightness distribution
  const createVar = (lightnessOffset: number, hueOffset: number): { hex: string; hsl: { h: number; s: number; l: number } } => {
    const MIN_L = 5, MAX_L = 95, MAX_OFFSET = 30, SPACE_USAGE = 0.5;

    let newL: number;
    if (lightnessOffset < 0) {
      const availableSpace = l - MIN_L;
      const ratio = Math.abs(lightnessOffset) / MAX_OFFSET;
      newL = l - (availableSpace * ratio * SPACE_USAGE);
    } else if (lightnessOffset > 0) {
      const availableSpace = MAX_L - l;
      const ratio = lightnessOffset / MAX_OFFSET;
      newL = l + (availableSpace * ratio * SPACE_USAGE);
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
};

interface HomeScreenProps {
  onNavigateToLibrary: () => void;
}

export default function HomeScreen({ onNavigateToLibrary }: HomeScreenProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showColorDetail, setShowColorDetail] = useState(false);
  const [paletteName, setPaletteName] = useState('');
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('original');
  const [showGrayscale, setShowGrayscale] = useState(false);
  const [variationHueShift, setVariationHueShift] = useState(true); // For Value Variations

  const { mode, colors: theme, toggleTheme } = useThemeStore();

  const {
    currentColors,
    currentImageUri,
    selectedColorIndex,
    colorCount,
    extractionMethod,
    setCurrentColors,
    setCurrentImageUri,
    setSelectedColorIndex,
    setColorCount,
    setExtractionMethod,
    savePalette,
  } = usePaletteStore();

  // Apply style filter to colors
  const processedColors = currentColors.map((hex) => {
    if (showGrayscale) {
      return toGrayscale(hex);
    }
    const preset = STYLE_PRESETS[styleFilter];
    return adjustColor(hex, preset.saturation, preset.brightness);
  });

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await extractColors(result.assets[0].uri);
    }
  };

  const doExtract = async (
    imageUri: string,
    count: number,
    method: ExtractionMethod
  ) => {
    setIsExtracting(true);
    try {
      const colors = await extractColorsFromImage(imageUri, count, method);
      setCurrentColors(colors);
    } catch (error) {
      console.error('Error extracting colors:', error);
      Alert.alert('Error', 'Failed to extract colors from image.');
    } finally {
      setIsExtracting(false);
    }
  };

  const extractColors = async (imageUri: string) => {
    setCurrentImageUri(imageUri);
    await doExtract(imageUri, colorCount, extractionMethod);
  };

  const handleMethodChange = async (method: ExtractionMethod) => {
    setExtractionMethod(method);
    if (currentImageUri) {
      await doExtract(currentImageUri, colorCount, method);
    }
  };

  const handleReExtract = async () => {
    if (currentImageUri) {
      await doExtract(currentImageUri, colorCount, extractionMethod);
    }
  };

  const handleColorPress = async (hex: string, index: number) => {
    setSelectedColorIndex(index);
    setShowColorDetail(true);
  };

  const copyColor = async (value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied!', `${value} copied to clipboard`);
  };

  const handleSave = () => {
    if (processedColors.length === 0) {
      Alert.alert('No Colors', 'Please extract colors from an image first.');
      return;
    }
    setPaletteName(`Palette ${new Date().toLocaleDateString()}`);
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    // Save the processed colors (with filters applied)
    const originalColors = currentColors;
    setCurrentColors(processedColors);
    savePalette(paletteName || `Palette ${Date.now()}`);
    setCurrentColors(originalColors);
    setShowSaveModal(false);
    setPaletteName('');
    Alert.alert('Saved!', 'Palette saved to library.');
  };

  const handleExport = () => {
    if (processedColors.length === 0) {
      Alert.alert('No Colors', 'Please extract colors from an image first.');
      return;
    }
    setShowExportModal(true);
  };

  const exportAs = async (format: string) => {
    let content = '';
    let filename = 'palette';
    const colors = processedColors;

    switch (format) {
      case 'json':
        content = JSON.stringify({
          colors: colors.map((hex, i) => ({
            index: i,
            hex,
            rgb: hexToRgb(hex),
          })),
          exportedAt: new Date().toISOString(),
        }, null, 2);
        filename = 'palette.json';
        break;
      case 'css':
        content = `:root {\n${colors.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n')}\n}`;
        filename = 'palette.css';
        break;
      case 'unity':
        content = `using UnityEngine;\n\n[CreateAssetMenu(fileName = "Palette", menuName = "Colors/Palette")]\npublic class Palette : ScriptableObject\n{\n    public Color[] colors = new Color[] {\n${colors.map(hex => {
          const rgb = hexToRgb(hex);
          return `        new Color(${(rgb.r / 255).toFixed(3)}f, ${(rgb.g / 255).toFixed(3)}f, ${(rgb.b / 255).toFixed(3)}f)`;
        }).join(',\n')}\n    };\n}`;
        filename = 'Palette.cs';
        break;
      case 'unreal':
        content = `Name,Color\n${colors.map((hex, i) => {
          const rgb = hexToRgb(hex);
          return `Color${i + 1},"(R=${rgb.r},G=${rgb.g},B=${rgb.b},A=255)"`;
        }).join('\n')}`;
        filename = 'palette.csv';
        break;
      default: // png/text
        content = colors.join('\n');
        filename = 'palette.txt';
    }

    try {
      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export palette.');
    }
    setShowExportModal(false);
  };

  const copyToClipboard = async (format: string) => {
    let content = '';
    const colors = processedColors;

    switch (format) {
      case 'json':
        content = JSON.stringify(colors);
        break;
      case 'css':
        content = colors.map((hex, i) => `--color-${i + 1}: ${hex};`).join('\n');
        break;
      default:
        content = colors.join('\n');
    }

    await Clipboard.setStringAsync(content);
    Alert.alert('Copied!', `${format.toUpperCase()} copied to clipboard`);
    setShowExportModal(false);
  };

  // Get color info for detail panel
  const getSelectedColorInfo = () => {
    if (selectedColorIndex === null || !processedColors[selectedColorIndex]) return null;
    const hex = processedColors[selectedColorIndex];
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return { hex, rgb, hsl };
  };

  const colorInfo = getSelectedColorInfo();

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    header: { backgroundColor: theme.background },
    title: { color: theme.textPrimary },
    card: { backgroundColor: theme.backgroundSecondary },
    text: { color: theme.textPrimary },
    textSecondary: { color: theme.textSecondary },
    border: { borderColor: theme.border },
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, dynamicStyles.title]}>Game Palette</Text>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: theme.backgroundSecondary }]}
          onPress={toggleTheme}
        >
          <Ionicons
            name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
            size={22}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Card */}
        <TouchableOpacity style={styles.imageCard} onPress={pickImage}>
          {currentImageUri ? (
            <>
              <Image
                source={{ uri: currentImageUri }}
                style={styles.image}
              />
              {showGrayscale && <View style={styles.grayscaleOverlay} />}
              <View style={styles.sourceImageBadge}>
                <Text style={styles.sourceImageText}>
                  {showGrayscale ? 'Value Check' : 'Source Image'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={48} color="#4a4a6a" />
              <Text style={styles.placeholderText}>Tap to select image</Text>
            </View>
          )}
          {isExtracting && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Extracting colors...</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Style Filters */}
        {processedColors.length > 0 && (
          <View style={styles.styleFiltersContainer}>
            {(Object.keys(STYLE_PRESETS) as StyleFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.styleFilterButton,
                  styleFilter === filter && styles.styleFilterButtonActive,
                ]}
                onPress={() => setStyleFilter(filter)}
              >
                <Ionicons
                  name={STYLE_PRESETS[filter].icon as any}
                  size={16}
                  color={styleFilter === filter ? '#fff' : '#666'}
                />
                <Text
                  style={[
                    styles.styleFilterText,
                    styleFilter === filter && styles.styleFilterTextActive,
                  ]}
                >
                  {STYLE_PRESETS[filter].name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Color Cards */}
        {processedColors.length > 0 && (
          <View style={styles.colorCardsContainer}>
            {processedColors.map((color, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorCard,
                  selectedColorIndex === index && styles.colorCardSelected,
                ]}
                onPress={() => handleColorPress(color, index)}
              >
                <View style={[styles.colorSwatch, { backgroundColor: color }]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Main Extraction Card */}
        <View style={styles.extractionCard}>
          <View style={styles.extractionHeader}>
            <Text style={styles.extractionTitle}>MAIN EXTRACTION</Text>
            <TouchableOpacity
              style={[
                styles.valueToggleButton,
                showGrayscale && styles.valueToggleButtonActive,
              ]}
              onPress={() => setShowGrayscale(!showGrayscale)}
            >
              <Ionicons
                name="contrast-outline"
                size={14}
                color={showGrayscale ? '#fff' : '#888'}
              />
              <Text style={[
                styles.valueToggleText,
                showGrayscale && styles.valueToggleTextActive,
              ]}>Value</Text>
            </TouchableOpacity>
          </View>

          {/* Method Toggle */}
          <View style={styles.methodToggle}>
            <TouchableOpacity
              style={[
                styles.methodOption,
                extractionMethod === 'histogram' && styles.methodOptionActive,
              ]}
              onPress={() => handleMethodChange('histogram')}
            >
              <Text
                style={[
                  styles.methodOptionText,
                  extractionMethod === 'histogram' && styles.methodOptionTextActive,
                ]}
              >
                Hue Histogram
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodOption,
                extractionMethod === 'kmeans' && styles.methodOptionActive,
              ]}
              onPress={() => handleMethodChange('kmeans')}
            >
              <Text
                style={[
                  styles.methodOptionText,
                  extractionMethod === 'kmeans' && styles.methodOptionTextActive,
                ]}
              >
                K-Means
              </Text>
            </TouchableOpacity>
          </View>

          {/* Method Description */}
          <Text style={styles.methodDescription}>
            {extractionMethod === 'histogram'
              ? '색상 분포 기반으로 주요 색조를 추출합니다. 빠르고 안정적.'
              : '클러스터링으로 대표 색상을 계산합니다. 정확하지만 느림.'}
          </Text>

          {/* Color Count Slider */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Color Count</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{colorCount}</Text>
              </View>
            </View>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderMin}>3</Text>
              <Slider
                style={styles.slider}
                minimumValue={3}
                maximumValue={8}
                step={1}
                value={colorCount}
                onValueChange={(value) => setColorCount(Math.round(value))}
                onSlidingComplete={(value) => {
                  const newCount = Math.round(value);
                  setColorCount(newCount);
                  if (currentImageUri) {
                    doExtract(currentImageUri, newCount, extractionMethod);
                  }
                }}
                minimumTrackTintColor="#6366f1"
                maximumTrackTintColor="#3a3a4a"
                thumbTintColor="#fff"
              />
              <Text style={styles.sliderMax}>8</Text>
            </View>
          </View>

          {/* Re-extract Button */}
          <TouchableOpacity
            style={[styles.reExtractButton, !currentImageUri && styles.reExtractButtonDisabled]}
            onPress={handleReExtract}
            disabled={!currentImageUri || isExtracting}
          >
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <Text style={styles.reExtractButtonText}>Re-extract Palette</Text>
          </TouchableOpacity>
        </View>

        {/* Spacer for bottom bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={onNavigateToLibrary}>
          <Ionicons name="library-outline" size={22} color="#888" />
          <Text style={styles.actionButtonText}>Library</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons name="download-outline" size={22} color="#000" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="share-outline" size={22} color="#6366f1" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Color Detail Modal */}
      <Modal
        visible={showColorDetail && colorInfo !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowColorDetail(false)}
      >
        <View style={styles.colorDetailOverlay}>
          <TouchableOpacity
            style={styles.colorDetailBackground}
            onPress={() => setShowColorDetail(false)}
          />
          <View style={styles.colorDetailContent}>
            <View style={styles.colorDetailHandle} />

            {colorInfo && (
              <>
                {/* Color Preview */}
                <View style={styles.colorDetailPreview}>
                  <View
                    style={[styles.colorDetailSwatch, { backgroundColor: colorInfo.hex }]}
                  />
                  <View style={styles.colorDetailInfo}>
                    <Text style={styles.colorDetailTitle}>Color Details</Text>
                    <Text style={styles.colorDetailIndex}>
                      Color {(selectedColorIndex ?? 0) + 1} of {processedColors.length}
                    </Text>
                  </View>
                </View>

                {/* Color Values with Visual Bars */}
                <View style={styles.colorValueSection}>
                  {/* HEX */}
                  <View style={styles.colorValueRow}>
                    <Text style={styles.colorValueLabel}>HEX</Text>
                    <Text style={styles.colorValueText}>{colorInfo.hex}</Text>
                    <TouchableOpacity style={styles.colorValueCopy} onPress={() => copyColor(colorInfo.hex)}>
                      <Ionicons name="copy-outline" size={18} color="#888" />
                    </TouchableOpacity>
                  </View>

                  {/* RGB with bars */}
                  <View style={styles.colorChannelSection}>
                    <View style={styles.channelHeader}>
                      <Text style={styles.colorValueLabel}>RGB</Text>
                      <TouchableOpacity onPress={() => copyColor(`rgb(${colorInfo.rgb.r}, ${colorInfo.rgb.g}, ${colorInfo.rgb.b})`)}>
                        <Ionicons name="copy-outline" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                    <ColorChannelBar label="R" value={colorInfo.rgb.r} max={255} color="#ef4444" />
                    <ColorChannelBar label="G" value={colorInfo.rgb.g} max={255} color="#22c55e" />
                    <ColorChannelBar label="B" value={colorInfo.rgb.b} max={255} color="#3b82f6" />
                  </View>

                  {/* HSL with bars */}
                  <View style={styles.colorChannelSection}>
                    <View style={styles.channelHeader}>
                      <Text style={styles.colorValueLabel}>HSL</Text>
                      <TouchableOpacity onPress={() => copyColor(`hsl(${colorInfo.hsl.h}, ${colorInfo.hsl.s}%, ${colorInfo.hsl.l}%)`)}>
                        <Ionicons name="copy-outline" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                    <ColorChannelBar label="H" value={colorInfo.hsl.h} max={360} color={colorInfo.hex} isHue />
                    <ColorChannelBar label="S" value={colorInfo.hsl.s} max={100} color="#a855f7" />
                    <ColorChannelBar label="L" value={colorInfo.hsl.l} max={100} color="#888" />
                  </View>
                </View>

                {/* Value Variations */}
                <View style={styles.variationsSection}>
                  <View style={styles.variationsHeader}>
                    <Text style={styles.variationsSectionTitle}>Value Variations</Text>
                    <View style={styles.hueShiftToggle}>
                      <TouchableOpacity
                        style={[
                          styles.hueShiftOption,
                          variationHueShift && styles.hueShiftOptionActive,
                        ]}
                        onPress={() => setVariationHueShift(true)}
                      >
                        <Text style={[
                          styles.hueShiftOptionText,
                          variationHueShift && styles.hueShiftOptionTextActive,
                        ]}>Hue Shift</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.hueShiftOption,
                          !variationHueShift && styles.hueShiftOptionActive,
                        ]}
                        onPress={() => setVariationHueShift(false)}
                      >
                        <Text style={[
                          styles.hueShiftOptionText,
                          !variationHueShift && styles.hueShiftOptionTextActive,
                        ]}>OFF</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Color strip */}
                  <View style={styles.variationStrip}>
                    {generateColorVariations(colorInfo.hex, variationHueShift).map((v, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.variationCell,
                          v.label === 'Base' && styles.variationCellBase,
                        ]}
                        onPress={() => copyColor(v.hex)}
                      >
                        <View style={[styles.variationColor, { backgroundColor: v.hex }]} />
                        <Text style={styles.variationHex}>{v.hex}</Text>
                        <Text style={styles.variationLabel}>L:{v.hsl.l}%</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.variationsHint}>
                    {variationHueShift
                      ? 'Shadows → Blue, Highlights → Yellow'
                      : 'Pure lightness changes only'}
                  </Text>
                </View>

                {/* Grayscale Preview */}
                <View style={styles.grayscaleSection}>
                  <Text style={styles.grayscaleSectionTitle}>Value Check</Text>
                  <View style={styles.grayscaleRow}>
                    <View style={[styles.grayscaleSwatch, { backgroundColor: colorInfo.hex }]} />
                    <Ionicons name="arrow-forward" size={16} color="#666" />
                    <View style={[styles.grayscaleSwatch, { backgroundColor: toGrayscale(colorInfo.hex) }]} />
                    <Text style={styles.grayscaleValue}>
                      {Math.round(0.299 * colorInfo.rgb.r + 0.587 * colorInfo.rgb.g + 0.114 * colorInfo.rgb.b)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Save Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Palette</Text>
            <TextInput
              style={styles.modalInput}
              value={paletteName}
              onChangeText={setPaletteName}
              placeholder="Enter palette name"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmSave}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export Modal (Bottom Sheet) */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.exportModalOverlay}>
          <TouchableOpacity
            style={styles.exportModalBackground}
            onPress={() => setShowExportModal(false)}
          />
          <View style={styles.exportModalContent}>
            <View style={styles.exportModalHandle} />
            <View style={styles.exportModalHeader}>
              <Text style={styles.exportModalTitle}>Export Palette</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Export Options */}
            <ExportOption
              icon="image-outline"
              iconColor="#f472b6"
              title="PNG Image"
              subtitle="High-res preview"
              onCopy={() => copyToClipboard('text')}
              onDownload={() => exportAs('text')}
            />
            <ExportOption
              icon="code-slash-outline"
              iconColor="#fbbf24"
              title="JSON Data"
              subtitle="Raw color arrays"
              onCopy={() => copyToClipboard('json')}
              onDownload={() => exportAs('json')}
            />
            <ExportOption
              icon="logo-css3"
              iconColor="#3b82f6"
              title="CSS Variables"
              subtitle=":root variables"
              onCopy={() => copyToClipboard('css')}
              onDownload={() => exportAs('css')}
            />
            <ExportOption
              icon="cube-outline"
              iconColor="#9ca3af"
              title="Unity Asset"
              subtitle=".asset file"
              onCopy={() => copyToClipboard('text')}
              onDownload={() => exportAs('unity')}
            />
            <ExportOption
              icon="game-controller-outline"
              iconColor="#6366f1"
              title="Unreal Engine"
              subtitle="Curve atlas"
              onCopy={() => copyToClipboard('text')}
              onDownload={() => exportAs('unreal')}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Color Channel Bar Component
function ColorChannelBar({
  label,
  value,
  max,
  color,
  isHue,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  isHue?: boolean;
}) {
  const percentage = (value / max) * 100;

  return (
    <View style={styles.channelRow}>
      <Text style={styles.channelLabel}>{label}</Text>
      <View style={styles.channelBarContainer}>
        {isHue ? (
          <View style={styles.hueGradientBar}>
            <View style={[styles.channelBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
          </View>
        ) : (
          <View style={styles.channelBarBg}>
            <View style={[styles.channelBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
          </View>
        )}
      </View>
      <Text style={styles.channelValue}>{value}</Text>
    </View>
  );
}

// Export Option Component
function ExportOption({
  icon,
  iconColor,
  title,
  subtitle,
  onCopy,
  onDownload,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <View style={styles.exportOption}>
      <View style={[styles.exportOptionIcon, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon as any} size={24} color={iconColor} />
      </View>
      <View style={styles.exportOptionInfo}>
        <Text style={styles.exportOptionTitle}>{title}</Text>
        <Text style={styles.exportOptionSubtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity style={styles.exportActionButton} onPress={onCopy}>
        <Ionicons name="copy-outline" size={20} color="#888" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.exportActionButton} onPress={onDownload}>
        <Ionicons name="download-outline" size={20} color="#888" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a10',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    backgroundColor: '#16161e',
    borderRadius: 12,
  },
  content: {
    flex: 1,
  },
  imageCard: {
    marginHorizontal: 16,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#16161e',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  grayscaleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#808080',
    opacity: 0.9,
  },
  sourceImageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sourceImageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#4a4a6a',
    marginTop: 12,
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
  },
  styleFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 6,
  },
  styleFilterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#16161e',
    gap: 4,
  },
  styleFilterButtonActive: {
    backgroundColor: '#6366f1',
  },
  styleFilterText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  styleFilterTextActive: {
    color: '#fff',
  },
  colorCardsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  colorCard: {
    flex: 1,
    alignItems: 'center',
  },
  colorCardSelected: {
    transform: [{ scale: 1.05 }],
  },
  colorSwatch: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2d2d38',
  },
  extractionCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#16161e',
    borderRadius: 16,
    padding: 20,
  },
  extractionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  extractionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  valueToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#24242e',
    gap: 4,
  },
  valueToggleButtonActive: {
    backgroundColor: '#6366f1',
  },
  valueToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
  },
  valueToggleTextActive: {
    color: '#fff',
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#24242e',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  methodDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  methodOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  methodOptionActive: {
    backgroundColor: '#34344a',
  },
  methodOptionText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  methodOptionTextActive: {
    color: '#fff',
  },
  sliderSection: {
    marginBottom: 20,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    color: '#fff',
    fontSize: 14,
  },
  countBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderMin: {
    color: '#666',
    fontSize: 12,
    marginRight: 8,
  },
  sliderMax: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
  },
  reExtractButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reExtractButtonDisabled: {
    backgroundColor: '#2d2d38',
  },
  reExtractButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 36,
    backgroundColor: '#101018',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#16161e',
    gap: 6,
  },
  actionButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 6,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#16161e',
    gap: 6,
  },
  exportButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  // Color Detail Modal
  colorDetailOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  colorDetailBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  colorDetailContent: {
    backgroundColor: '#16161e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  colorDetailHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3e3e50',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  colorDetailPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  colorDetailSwatch: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2d2d38',
  },
  colorDetailInfo: {
    marginLeft: 16,
  },
  colorDetailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  colorDetailIndex: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  colorValueSection: {
    backgroundColor: '#0c0c12',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  colorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#16161e',
  },
  colorValueLabel: {
    width: 48,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  colorValueText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
  },
  colorValueCopy: {
    padding: 8,
  },
  // Value Variations styles
  variationsSection: {
    backgroundColor: '#0c0c12',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  variationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  variationsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  hueShiftToggle: {
    flexDirection: 'row',
    backgroundColor: '#16161e',
    borderRadius: 8,
    padding: 2,
  },
  hueShiftOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  hueShiftOptionActive: {
    backgroundColor: '#6366f1',
  },
  hueShiftOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  hueShiftOptionTextActive: {
    color: '#fff',
  },
  variationStrip: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  variationCell: {
    flex: 1,
    alignItems: 'center',
  },
  variationCellBase: {
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 4,
  },
  variationColor: {
    width: '100%',
    height: 48,
  },
  variationHex: {
    fontSize: 8,
    color: '#888',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  variationLabel: {
    fontSize: 8,
    color: '#555',
  },
  variationsHint: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  grayscaleSection: {
    backgroundColor: '#0c0c12',
    borderRadius: 12,
    padding: 16,
  },
  grayscaleSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  grayscaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  grayscaleSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d2d38',
  },
  grayscaleValue: {
    fontSize: 14,
    color: '#888',
    marginLeft: 'auto',
    fontFamily: 'monospace',
  },
  // Color Channel styles
  colorChannelSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#16161e',
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelLabel: {
    width: 20,
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  channelBarContainer: {
    flex: 1,
    marginHorizontal: 10,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  channelBarBg: {
    flex: 1,
    backgroundColor: '#24242e',
    borderRadius: 4,
    overflow: 'hidden',
  },
  hueGradientBar: {
    flex: 1,
    backgroundColor: '#24242e',
    borderRadius: 4,
    overflow: 'hidden',
  },
  channelBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  channelValue: {
    width: 36,
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  // Save Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#16161e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2d2d38',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#6366f1',
  },
  modalButtonText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: '#fff',
  },
  // Export Modal
  exportModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  exportModalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  exportModalContent: {
    backgroundColor: '#16161e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  exportModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3e3e50',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  exportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  exportModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#24242e',
  },
  exportOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  exportOptionInfo: {
    flex: 1,
  },
  exportOptionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  exportOptionSubtitle: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
  },
  exportActionButton: {
    padding: 10,
  },
});
