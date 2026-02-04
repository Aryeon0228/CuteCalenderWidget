import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';

import { usePaletteStore } from '../store/paletteStore';
import { useThemeStore } from '../store/themeStore';
import {
  extractColorsFromImage,
  ExtractionMethod,
  analyzeLuminosityHistogram,
  LuminosityHistogram,
} from '../lib/colorExtractor';
import {
  hexToRgb,
  rgbToHsl,
  toGrayscale,
  adjustColor,
  generateColorVariations,
  generateColorHarmonies,
  HarmonyType,
} from '../lib/colorUtils';
import { StyleFilter, STYLE_PRESETS, STYLE_FILTER_KEYS } from '../constants/stylePresets';
import { ColorChannelBar } from '../components/ColorChannelBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TYPES
// ============================================

interface HomeScreenProps {
  onNavigateToLibrary: () => void;
}

interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function HomeScreen({ onNavigateToLibrary }: HomeScreenProps) {
  // UI State
  const [isExtracting, setIsExtracting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showColorDetail, setShowColorDetail] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [paletteName, setPaletteName] = useState('');

  // Camera
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Filter & Display State
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('original');
  const [showGrayscale, setShowGrayscale] = useState(false);
  const [variationHueShift, setVariationHueShift] = useState(true);
  const [selectedHarmony, setSelectedHarmony] = useState<HarmonyType>('complementary');

  // Histogram State
  const [histogram, setHistogram] = useState<LuminosityHistogram | null>(null);
  const [showHistogram, setShowHistogram] = useState(true);

  // Export State
  const [exportFormat, setExportFormat] = useState<'png' | 'json' | 'css'>('png');
  const [isExporting, setIsExporting] = useState(false);
  const paletteCardRef = useRef<ViewShot>(null);

  // Theme & Store
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

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const processedColors = currentColors.map((hex) => {
    if (showGrayscale) {
      return toGrayscale(hex);
    }
    const preset = STYLE_PRESETS[styleFilter];
    return adjustColor(hex, preset.saturation, preset.brightness);
  });

  const getSelectedColorInfo = (): ColorInfo | null => {
    if (selectedColorIndex === null || !processedColors[selectedColorIndex]) {
      return null;
    }
    const hex = processedColors[selectedColorIndex];
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return { hex, rgb, hsl };
  };

  const colorInfo = getSelectedColorInfo();

  // ============================================
  // HAPTIC FEEDBACK
  // ============================================

  const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const hapticMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  // ============================================
  // IMAGE HANDLING
  // ============================================

  const showImageSourceOptions = () => {
    hapticLight();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openCamera();
          else if (buttonIndex === 2) pickFromGallery();
        }
      );
    } else {
      Alert.alert(
        'Select Image',
        'Choose image source',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: openCamera },
          { text: 'Choose from Library', onPress: pickFromGallery },
        ]
      );
    }
  };

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow camera access.');
        return;
      }
    }
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      hapticMedium();
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        setShowCamera(false);
        if (photo?.uri) {
          await extractColors(photo.uri);
          hapticSuccess();
        }
      } catch (error) {
        console.error('Camera error:', error);
        Alert.alert('Error', 'Failed to take photo.');
      }
    }
  };

  const pickFromGallery = async () => {
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
      hapticSuccess();
    }
  };

  // ============================================
  // COLOR EXTRACTION
  // ============================================

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
    // Run histogram analysis in background (non-blocking)
    analyzeHistogram(imageUri);
  };

  const analyzeHistogram = async (imageUri: string) => {
    try {
      const histogramData = await analyzeLuminosityHistogram(imageUri);
      setHistogram(histogramData);
    } catch (error) {
      console.error('Histogram analysis error:', error);
      setHistogram(null);
    }
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

  // ============================================
  // COLOR INTERACTION
  // ============================================

  const handleColorPress = (index: number) => {
    setSelectedColorIndex(index);
    setShowColorDetail(true);
  };

  const copyColor = async (value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied!', `${value} copied to clipboard`);
  };

  // ============================================
  // SAVE & EXPORT
  // ============================================

  const handleSave = () => {
    if (processedColors.length === 0) {
      Alert.alert('No Colors', 'Please extract colors from an image first.');
      return;
    }
    // Set empty string to use auto-generated name
    setPaletteName('');
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    const originalColors = currentColors;
    setCurrentColors(processedColors);
    // Pass empty string for auto-generated name, or user's custom name
    savePalette(paletteName.trim());
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

  const exportAsPng = async () => {
    if (!paletteCardRef.current) return;

    setIsExporting(true);
    try {
      const uri = await paletteCardRef.current.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Palette',
        });
      }
    } catch (error) {
      console.error('PNG export error:', error);
      Alert.alert('Error', 'Failed to export as PNG.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsText = async (format: string) => {
    let content = '';
    let filename = 'palette';
    const colors = processedColors;

    switch (format) {
      case 'json':
        content = JSON.stringify(
          {
            name: paletteName || 'Untitled Palette',
            colors: colors.map((hex, i) => ({
              index: i,
              hex,
              rgb: hexToRgb(hex),
              hsl: (() => {
                const rgb = hexToRgb(hex);
                return rgbToHsl(rgb.r, rgb.g, rgb.b);
              })(),
            })),
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        );
        filename = 'palette.json';
        break;
      case 'css':
        content = `:root {\n${colors
          .map((hex, i) => `  --color-${i + 1}: ${hex};`)
          .join('\n')}\n}`;
        filename = 'palette.css';
        break;
      default:
        content = colors.join('\n');
        filename = 'palette.txt';
    }

    setIsExporting(true);
    try {
      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export palette.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportConfirm = async () => {
    if (exportFormat === 'png') {
      await exportAsPng();
    } else {
      await exportAsText(exportFormat);
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

  // ============================================
  // RENDER
  // ============================================

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Game Palette</Text>
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
        <TouchableOpacity style={styles.imageCard} onPress={showImageSourceOptions}>
          {currentImageUri ? (
            <>
              <Image
                source={{ uri: currentImageUri }}
                style={[styles.image, showGrayscale && { filter: 'grayscale(1)' }]}
                contentFit="cover"
              />
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

        {/* Style Filters - Compact row */}
        {processedColors.length > 0 && (
          <View style={styles.styleFiltersContainer}>
            {STYLE_FILTER_KEYS.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.styleFilterButton,
                  styleFilter === filter && styles.styleFilterButtonActive,
                ]}
                onPress={() => setStyleFilter(filter)}
              >
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

        {/* Color Cards - Prominent display */}
        {processedColors.length > 0 && (
          <View style={styles.colorCardsContainer}>
            {processedColors.map((color, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorCard,
                  selectedColorIndex === index && styles.colorCardSelected,
                ]}
                onPress={() => handleColorPress(index)}
              >
                <View style={[styles.colorSwatch, { backgroundColor: color }]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Luminosity Histogram - Below color palette */}
        {histogram && currentImageUri && (
          <TouchableOpacity
            style={styles.histogramCard}
            onPress={() => setShowHistogram(!showHistogram)}
            activeOpacity={0.8}
          >
            <View style={styles.histogramHeader}>
              <View style={styles.histogramTitleRow}>
                <Ionicons name="analytics-outline" size={14} color="#888" />
                <Text style={styles.histogramTitle}>LUMINOSITY</Text>
              </View>
              <View style={styles.histogramStats}>
                <Text style={styles.histogramStatText}>
                  {histogram.contrast}%
                </Text>
                <Text style={styles.histogramContrastLabel}>contrast</Text>
                <Ionicons
                  name={showHistogram ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#666"
                />
              </View>
            </View>

            {showHistogram && (
              <>
                <View style={styles.histogramBars}>
                  {histogram.bins.map((value, index) => (
                    <View key={index} style={styles.histogramBarWrapper}>
                      <View
                        style={[
                          styles.histogramBar,
                          {
                            height: `${Math.max(value, 2)}%`,
                            backgroundColor:
                              index < 11 ? '#4a4a5a' : index < 21 ? '#6a6a7a' : '#9a9aaa',
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.histogramScale}>
                  <View style={styles.histogramGradient}>
                    {Array.from({ length: 16 }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.histogramGradientStep,
                          { backgroundColor: `rgb(${i * 17}, ${i * 17}, ${i * 17})` },
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.histogramStatsRow}>
                  <View style={styles.histogramStatItem}>
                    <Text style={styles.histogramStatValue}>{histogram.darkPercent}%</Text>
                    <Text style={styles.histogramStatLabel}>Dark</Text>
                  </View>
                  <View style={styles.histogramStatItem}>
                    <Text style={styles.histogramStatValue}>{histogram.midPercent}%</Text>
                    <Text style={styles.histogramStatLabel}>Mid</Text>
                  </View>
                  <View style={styles.histogramStatItem}>
                    <Text style={styles.histogramStatValue}>{histogram.brightPercent}%</Text>
                    <Text style={styles.histogramStatLabel}>Bright</Text>
                  </View>
                  <View style={[styles.histogramStatItem, styles.histogramStatItemAvg]}>
                    <Text style={styles.histogramStatValueAvg}>{histogram.average}</Text>
                    <Text style={styles.histogramStatLabel}>Avg</Text>
                  </View>
                </View>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Extraction Settings Card - Compact */}
        <View style={styles.extractionCard}>
          {/* Top Row: Title + Method Toggle + Value Check */}
          <View style={styles.extractionTopRow}>
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
                  Histogram
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
            </TouchableOpacity>
          </View>

          {/* Color Count - Inline */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Colors</Text>
            <Slider
              style={styles.sliderInline}
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
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{colorCount}</Text>
            </View>
          </View>

          {/* Re-extract Button */}
          <TouchableOpacity
            style={[
              styles.reExtractButton,
              !currentImageUri && styles.reExtractButtonDisabled,
            ]}
            onPress={handleReExtract}
            disabled={!currentImageUri || isExtracting}
          >
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={styles.reExtractButtonText}>Re-extract</Text>
          </TouchableOpacity>
        </View>

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
                    <TouchableOpacity
                      style={styles.colorValueCopy}
                      onPress={() => copyColor(colorInfo.hex)}
                    >
                      <Ionicons name="copy-outline" size={18} color="#888" />
                    </TouchableOpacity>
                  </View>

                  {/* RGB with bars */}
                  <View style={styles.colorChannelSection}>
                    <View style={styles.channelHeader}>
                      <Text style={styles.colorValueLabel}>RGB</Text>
                      <TouchableOpacity
                        onPress={() =>
                          copyColor(
                            `rgb(${colorInfo.rgb.r}, ${colorInfo.rgb.g}, ${colorInfo.rgb.b})`
                          )
                        }
                      >
                        <Ionicons name="copy-outline" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                    <ColorChannelBar
                      label="R"
                      value={colorInfo.rgb.r}
                      max={255}
                      color="#ef4444"
                    />
                    <ColorChannelBar
                      label="G"
                      value={colorInfo.rgb.g}
                      max={255}
                      color="#22c55e"
                    />
                    <ColorChannelBar
                      label="B"
                      value={colorInfo.rgb.b}
                      max={255}
                      color="#3b82f6"
                    />
                  </View>

                  {/* HSL with bars */}
                  <View style={styles.colorChannelSection}>
                    <View style={styles.channelHeader}>
                      <Text style={styles.colorValueLabel}>HSL</Text>
                      <TouchableOpacity
                        onPress={() =>
                          copyColor(
                            `hsl(${colorInfo.hsl.h}, ${colorInfo.hsl.s}%, ${colorInfo.hsl.l}%)`
                          )
                        }
                      >
                        <Ionicons name="copy-outline" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                    <ColorChannelBar
                      label="H"
                      value={colorInfo.hsl.h}
                      max={360}
                      color={colorInfo.hex}
                      isHue
                    />
                    <ColorChannelBar
                      label="S"
                      value={colorInfo.hsl.s}
                      max={100}
                      color="#a855f7"
                    />
                    <ColorChannelBar
                      label="L"
                      value={colorInfo.hsl.l}
                      max={100}
                      color="#888"
                    />
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
                        <Text
                          style={[
                            styles.hueShiftOptionText,
                            variationHueShift && styles.hueShiftOptionTextActive,
                          ]}
                        >
                          Hue Shift
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.hueShiftOption,
                          !variationHueShift && styles.hueShiftOptionActive,
                        ]}
                        onPress={() => setVariationHueShift(false)}
                      >
                        <Text
                          style={[
                            styles.hueShiftOptionText,
                            !variationHueShift && styles.hueShiftOptionTextActive,
                          ]}
                        >
                          OFF
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.variationStrip}>
                    {generateColorVariations(colorInfo.hex, variationHueShift).map(
                      (v, i) => (
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
                      )
                    )}
                  </View>

                  <Text style={styles.variationsHint}>
                    {variationHueShift
                      ? 'Shadows → Blue, Highlights → Yellow'
                      : 'Pure lightness changes only'}
                  </Text>
                </View>

                {/* Color Harmony */}
                <View style={styles.harmonySection}>
                  <Text style={styles.harmonySectionTitle}>Color Harmony</Text>

                  {/* Harmony Type Selector */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.harmonyTypesScroll}
                  >
                    {generateColorHarmonies(colorInfo.hex).map((harmony) => (
                      <TouchableOpacity
                        key={harmony.type}
                        style={[
                          styles.harmonyTypeButton,
                          selectedHarmony === harmony.type && styles.harmonyTypeButtonActive,
                        ]}
                        onPress={() => {
                          hapticLight();
                          setSelectedHarmony(harmony.type);
                        }}
                      >
                        <Text
                          style={[
                            styles.harmonyTypeText,
                            selectedHarmony === harmony.type && styles.harmonyTypeTextActive,
                          ]}
                        >
                          {harmony.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Selected Harmony Colors */}
                  {(() => {
                    const harmonies = generateColorHarmonies(colorInfo.hex);
                    const currentHarmony = harmonies.find(h => h.type === selectedHarmony);
                    if (!currentHarmony) return null;

                    return (
                      <>
                        <Text style={styles.harmonyDescription}>
                          {currentHarmony.description}
                        </Text>
                        <View style={styles.harmonyColorsRow}>
                          {currentHarmony.colors.map((color, i) => (
                            <TouchableOpacity
                              key={i}
                              style={styles.harmonyColorItem}
                              onPress={() => copyColor(color.hex)}
                            >
                              <View
                                style={[
                                  styles.harmonyColorSwatch,
                                  { backgroundColor: color.hex },
                                  color.name === 'Base' && styles.harmonyColorSwatchBase,
                                ]}
                              />
                              <Text style={styles.harmonyColorHex}>{color.hex}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Grayscale Preview */}
                <View style={styles.grayscaleSection}>
                  <Text style={styles.grayscaleSectionTitle}>Value Check</Text>
                  <View style={styles.grayscaleRow}>
                    <View style={[styles.grayscaleSwatch, { backgroundColor: colorInfo.hex }]} />
                    <Ionicons name="arrow-forward" size={16} color="#666" />
                    <View
                      style={[
                        styles.grayscaleSwatch,
                        { backgroundColor: toGrayscale(colorInfo.hex) },
                      ]}
                    />
                    <Text style={styles.grayscaleValue}>
                      {Math.round(
                        0.299 * colorInfo.rgb.r +
                          0.587 * colorInfo.rgb.g +
                          0.114 * colorInfo.rgb.b
                      )}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          >
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.cameraCloseButton}
                onPress={() => {
                  hapticLight();
                  setShowCamera(false);
                }}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>

              <View style={styles.cameraControls}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={takePicture}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
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
              placeholder="Auto: Palette YYYY-MM-DD_001"
              placeholderTextColor="#555"
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
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Save
                </Text>
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

            <ScrollView
              style={styles.exportPreviewScroll}
              showsVerticalScrollIndicator={false}
            >
              <ViewShot
                ref={paletteCardRef}
                options={{ format: 'png', quality: 1.0 }}
                style={styles.paletteCard}
              >
                {currentImageUri && (
                  <Image
                    source={{ uri: currentImageUri }}
                    style={styles.paletteCardImage}
                    contentFit="cover"
                  />
                )}

                <View style={styles.paletteCardSwatches}>
                  {processedColors.map((color, index) => (
                    <View
                      key={index}
                      style={[styles.paletteCardSwatch, { backgroundColor: color }]}
                    />
                  ))}
                </View>

                <Text style={styles.paletteCardName}>
                  {paletteName || 'Untitled Palette'}
                </Text>
                <Text style={styles.paletteCardLabel}>PALETTE</Text>

                <View style={styles.paletteCardColors}>
                  {processedColors.map((hex, index) => {
                    const rgb = hexToRgb(hex);
                    return (
                      <View key={index} style={styles.paletteCardColorRow}>
                        <View
                          style={[styles.paletteCardColorDot, { backgroundColor: hex }]}
                        />
                        <View style={styles.paletteCardColorInfo}>
                          <Text style={styles.paletteCardHex}>{hex}</Text>
                          <Text style={styles.paletteCardRgb}>
                            RGB({rgb.r}, {rgb.g}, {rgb.b})
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <Text style={styles.paletteCardWatermark}>GamePalette</Text>

                {histogram && (
                  <View style={styles.paletteCardHistogram}>
                    <View style={styles.paletteCardHistogramRow}>
                      <Text style={styles.paletteCardHistogramLabel}>Contrast</Text>
                      <Text style={styles.paletteCardHistogramValue}>
                        {histogram.contrast}%
                      </Text>
                    </View>
                    <View style={styles.paletteCardHistogramRow}>
                      <Text style={styles.paletteCardHistogramLabel}>
                        Dark / Mid / Bright
                      </Text>
                      <Text style={styles.paletteCardHistogramValue}>
                        {histogram.darkPercent}% / {histogram.midPercent}% /{' '}
                        {histogram.brightPercent}%
                      </Text>
                    </View>
                    <View style={styles.paletteCardHistogramRow}>
                      <Text style={styles.paletteCardHistogramLabel}>Avg Luminosity</Text>
                      <Text style={styles.paletteCardHistogramValue}>
                        {histogram.average}
                      </Text>
                    </View>
                  </View>
                )}
              </ViewShot>

              {/* Format Selection */}
              <View style={styles.formatSection}>
                <Text style={styles.formatSectionTitle}>Export Format</Text>
                <View style={styles.formatOptions}>
                  {[
                    { id: 'png', label: 'PNG', icon: 'image-outline' },
                    { id: 'json', label: 'JSON', icon: 'code-slash-outline' },
                    { id: 'css', label: 'CSS', icon: 'logo-css3' },
                  ].map((format) => (
                    <TouchableOpacity
                      key={format.id}
                      style={[
                        styles.formatOption,
                        exportFormat === format.id && styles.formatOptionActive,
                      ]}
                      onPress={() => setExportFormat(format.id as typeof exportFormat)}
                    >
                      <Ionicons
                        name={format.icon as any}
                        size={18}
                        color={exportFormat === format.id ? '#fff' : '#888'}
                      />
                      <Text
                        style={[
                          styles.formatOptionText,
                          exportFormat === format.id && styles.formatOptionTextActive,
                        ]}
                      >
                        {format.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Export Button */}
              <TouchableOpacity
                style={styles.exportConfirmButton}
                onPress={handleExportConfirm}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={20} color="#fff" />
                    <Text style={styles.exportConfirmButtonText}>
                      Export as {exportFormat.toUpperCase()}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Quick Copy Options */}
              <View style={styles.quickCopySection}>
                <Text style={styles.quickCopyTitle}>Quick Copy</Text>
                <View style={styles.quickCopyButtons}>
                  <TouchableOpacity
                    style={styles.quickCopyButton}
                    onPress={() => copyToClipboard('text')}
                  >
                    <Text style={styles.quickCopyButtonText}>HEX</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickCopyButton}
                    onPress={() => copyToClipboard('json')}
                  >
                    <Text style={styles.quickCopyButtonText}>JSON</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickCopyButton}
                    onPress={() => copyToClipboard('css')}
                  >
                    <Text style={styles.quickCopyButtonText}>CSS</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

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
  headerButton: {
    padding: 8,
    backgroundColor: '#16161e',
    borderRadius: 12,
  },
  content: {
    flex: 1,
  },

  // Image Card
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

  // Style Filters - Compact pills
  styleFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  styleFilterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1a1a24',
  },
  styleFilterButtonActive: {
    backgroundColor: '#6366f1',
  },
  styleFilterText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  styleFilterTextActive: {
    color: '#fff',
  },

  // Color Cards
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
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2d2d38',
  },

  // Extraction Card - Compact
  extractionCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#16161e',
    borderRadius: 14,
    padding: 14,
  },
  extractionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  valueToggleButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#24242e',
  },
  valueToggleButtonActive: {
    backgroundColor: '#6366f1',
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#0c0c12',
    borderRadius: 10,
    padding: 3,
  },
  methodOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  methodOptionActive: {
    backgroundColor: '#2a2a3a',
  },
  methodOptionText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  methodOptionTextActive: {
    color: '#fff',
  },

  // Slider - Inline
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 10,
  },
  sliderInline: {
    flex: 1,
    height: 32,
  },
  countBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Re-extract Button - Compact
  reExtractButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reExtractButtonDisabled: {
    backgroundColor: '#2d2d38',
  },
  reExtractButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Action Bar
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

  // Color Channel Section
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

  // Value Variations
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

  // Grayscale Section
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

  // Color Harmony
  harmonySection: {
    backgroundColor: '#0c0c12',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  harmonySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  harmonyTypesScroll: {
    marginBottom: 12,
  },
  harmonyTypeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#16161e',
    marginRight: 8,
  },
  harmonyTypeButtonActive: {
    backgroundColor: '#6366f1',
  },
  harmonyTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  harmonyTypeTextActive: {
    color: '#fff',
  },
  harmonyDescription: {
    fontSize: 11,
    color: '#888',
    marginBottom: 12,
    textAlign: 'center',
  },
  harmonyColorsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  harmonyColorItem: {
    alignItems: 'center',
  },
  harmonyColorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#2d2d38',
  },
  harmonyColorSwatchBase: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  harmonyColorHex: {
    fontSize: 9,
    color: '#888',
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
  exportPreviewScroll: {
    maxHeight: 500,
  },

  // Palette Card for export
  paletteCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  paletteCardImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
  },
  paletteCardSwatches: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  paletteCardSwatch: {
    flex: 1,
    height: 40,
    borderRadius: 8,
  },
  paletteCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  paletteCardLabel: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 1,
    marginBottom: 12,
  },
  paletteCardColors: {
    gap: 8,
  },
  paletteCardColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paletteCardColorDot: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  paletteCardColorInfo: {
    flex: 1,
  },
  paletteCardHex: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'monospace',
  },
  paletteCardRgb: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },
  paletteCardWatermark: {
    textAlign: 'center',
    fontSize: 10,
    color: '#444',
    marginTop: 12,
  },
  paletteCardHistogram: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a34',
  },
  paletteCardHistogramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paletteCardHistogramLabel: {
    fontSize: 11,
    color: '#666',
  },
  paletteCardHistogramValue: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },

  // Format Selection
  formatSection: {
    marginBottom: 16,
  },
  formatSectionTitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  formatOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#24242e',
    gap: 6,
  },
  formatOptionActive: {
    backgroundColor: '#6366f1',
  },
  formatOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  formatOptionTextActive: {
    color: '#fff',
  },
  exportConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  exportConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  quickCopySection: {
    marginBottom: 8,
  },
  quickCopyTitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 10,
  },
  quickCopyButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickCopyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#24242e',
  },
  quickCopyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },

  // Histogram - Compact
  histogramCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#16161e',
    borderRadius: 14,
    padding: 12,
  },
  histogramHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  histogramTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  histogramTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.5,
  },
  histogramStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  histogramStatText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '700',
  },
  histogramContrastLabel: {
    fontSize: 10,
    color: '#666',
    marginRight: 6,
  },
  histogramBars: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'flex-end',
    marginTop: 10,
    gap: 1,
  },
  histogramBarWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  histogramBar: {
    width: '100%',
    borderRadius: 1,
    minHeight: 2,
  },
  histogramScale: {
    marginTop: 6,
  },
  histogramGradient: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  histogramGradientStep: {
    flex: 1,
  },
  histogramStatsRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  histogramStatItem: {
    flex: 1,
    backgroundColor: '#0c0c12',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  histogramStatItemAvg: {
    backgroundColor: '#1a1a2e',
  },
  histogramStatLabel: {
    fontSize: 9,
    color: '#555',
    marginTop: 2,
  },
  histogramStatValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  histogramStatValueAvg: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '700',
  },

  // Camera
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraControls: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
});
