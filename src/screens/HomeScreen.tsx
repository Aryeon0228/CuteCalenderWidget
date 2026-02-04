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
import { usePremiumStore } from '../store/premiumStore';
import { MockRewardedAd } from '../components/MockRewardedAd';
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

  // SNS Card State
  const [snsCardType, setSnsCardType] = useState<'instagram' | 'twitter'>('instagram');
  const [cardShowHex, setCardShowHex] = useState(true);
  const [cardShowStats, setCardShowStats] = useState(true);
  const [cardShowHistogram, setCardShowHistogram] = useState(true);

  // Ad State
  const [showRewardedAd, setShowRewardedAd] = useState(false);

  // Theme & Store
  const { mode, colors: theme, toggleTheme } = useThemeStore();
  const {
    isPremium,
    canExtract,
    useExtraction,
    watchRewardedAd,
    getRemainingExtractions,
    resetDailyLimits,
  } = usePremiumStore();
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
    // Check daily reset
    resetDailyLimits();

    // Check extraction limit
    if (!canExtract()) {
      Alert.alert(
        'Daily Limit Reached',
        'Watch a short ad to get +5 free extractions!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Watch Ad', onPress: () => setShowRewardedAd(true) },
        ]
      );
      return;
    }

    // Use one extraction
    useExtraction();

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
    if (!currentImageUri) return;

    // Check extraction limit
    resetDailyLimits();
    if (!canExtract()) {
      Alert.alert(
        'Daily Limit Reached',
        'Watch a short ad to get +5 free extractions!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Watch Ad', onPress: () => setShowRewardedAd(true) },
        ]
      );
      return;
    }

    useExtraction();
    await doExtract(currentImageUri, colorCount, extractionMethod);
  };

  const handleRewardEarned = () => {
    watchRewardedAd();
    hapticSuccess();
    Alert.alert('Reward Earned!', '+5 extractions added. You can now continue extracting colors!');
  };

  // ============================================
  // COLOR INTERACTION
  // ============================================

  const handleColorPress = (index: number) => {
    hapticLight();
    // Toggle selection - tap same color to deselect
    if (selectedColorIndex === index) {
      setSelectedColorIndex(null);
    } else {
      setSelectedColorIndex(index);
    }
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
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Game Palette</Text>
          {!isPremium && (
            <TouchableOpacity
              style={[styles.extractionsBadge, { backgroundColor: theme.backgroundTertiary }]}
              onPress={() => setShowRewardedAd(true)}
            >
              <Ionicons name="flash" size={12} color="#f59e0b" />
              <Text style={[styles.extractionsBadgeText, { color: theme.textPrimary }]}>
                {getRemainingExtractions()}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!currentImageUri}
      >
        {/* Image Card */}
        {currentImageUri ? (
          <TouchableOpacity style={styles.imageCard} onPress={showImageSourceOptions}>
            <Image
              source={{ uri: currentImageUri }}
              style={styles.image}
              contentFit="cover"
            />
            <View style={styles.sourceImageBadge}>
              <Text style={styles.sourceImageText}>Source Image</Text>
            </View>
            {/* Re-extract button */}
            <TouchableOpacity
              style={styles.reExtractIconButton}
              onPress={(e) => {
                e.stopPropagation();
                hapticLight();
                handleReExtract();
              }}
              disabled={isExtracting}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
            {isExtracting && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Extracting colors...</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.imageCardEmpty}>
            <Text style={styles.imageCardEmptyTitle}>Select Image</Text>
            <View style={styles.imageSourceButtons}>
              <TouchableOpacity
                style={styles.imageSourceButton}
                onPress={() => {
                  hapticLight();
                  openCamera();
                }}
              >
                <Ionicons name="camera" size={28} color="#6366f1" />
                <Text style={styles.imageSourceButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.imageSourceButton}
                onPress={() => {
                  hapticLight();
                  pickFromGallery();
                }}
              >
                <Ionicons name="images" size={28} color="#6366f1" />
                <Text style={styles.imageSourceButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Style Filters - Icon Grid */}
        <View style={styles.styleFiltersContainer}>
          {STYLE_FILTER_KEYS.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.styleFilterButton,
                {
                  backgroundColor: styleFilter === filter ? theme.accent : theme.backgroundCard,
                  opacity: processedColors.length > 0 ? 1 : 0.4,
                },
              ]}
              onPress={() => setStyleFilter(filter)}
              disabled={processedColors.length === 0}
            >
              <Ionicons
                name={STYLE_PRESETS[filter].icon as any}
                size={20}
                color={styleFilter === filter ? '#fff' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.styleFilterText,
                  { color: styleFilter === filter ? '#fff' : theme.textSecondary },
                ]}
              >
                {STYLE_PRESETS[filter].name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Color Cards - Prominent display */}
        {processedColors.length > 0 ? (
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
        ) : (
          <View style={[styles.colorCardsContainer, styles.colorCardsEmpty]}>
            {[1, 2, 3, 4, 5].map((_, index) => (
              <View key={index} style={styles.colorCard}>
                <View style={[styles.colorSwatch, styles.colorSwatchEmpty]} />
              </View>
            ))}
          </View>
        )}

        {/* Inline Color Detail - Below Palette */}
        {colorInfo && selectedColorIndex !== null && (
          <View style={[styles.inlineColorDetail, { backgroundColor: theme.backgroundCard }]}>
            <View style={styles.inlineColorDetailHeader}>
              <View style={[styles.inlineColorSwatch, { backgroundColor: colorInfo.hex }]} />
              <View style={styles.inlineColorValues}>
                <TouchableOpacity
                  style={[styles.inlineColorValueRow, { backgroundColor: theme.backgroundTertiary }]}
                  onPress={() => copyColor(colorInfo.hex)}
                >
                  <Text style={[styles.inlineColorLabel, { color: theme.textMuted }]}>HEX</Text>
                  <Text style={[styles.inlineColorValue, { color: theme.textPrimary }]}>{colorInfo.hex}</Text>
                  <Ionicons name="copy-outline" size={12} color={theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineColorValueRow, { backgroundColor: theme.backgroundTertiary }]}
                  onPress={() => copyColor(`rgb(${colorInfo.rgb.r}, ${colorInfo.rgb.g}, ${colorInfo.rgb.b})`)}
                >
                  <Text style={[styles.inlineColorLabel, { color: theme.textMuted }]}>RGB</Text>
                  <Text style={[styles.inlineColorValue, { color: theme.textPrimary }]}>{colorInfo.rgb.r}, {colorInfo.rgb.g}, {colorInfo.rgb.b}</Text>
                  <Ionicons name="copy-outline" size={12} color={theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineColorValueRow, { backgroundColor: theme.backgroundTertiary }]}
                  onPress={() => copyColor(`hsl(${colorInfo.hsl.h}, ${colorInfo.hsl.s}%, ${colorInfo.hsl.l}%)`)}
                >
                  <Text style={[styles.inlineColorLabel, { color: theme.textMuted }]}>HSL</Text>
                  <Text style={[styles.inlineColorValue, { color: theme.textPrimary }]}>{colorInfo.hsl.h}°, {colorInfo.hsl.s}%, {colorInfo.hsl.l}%</Text>
                  <Ionicons name="copy-outline" size={12} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Luminosity Histogram - Below color palette */}
        <View style={[styles.histogramCard, { opacity: histogram ? 1 : 0.4 }]}>
          <View style={styles.histogramHeader}>
            <View style={styles.histogramTitleRow}>
              <Ionicons name="analytics-outline" size={14} color="#888" />
              <Text style={styles.histogramTitle}>LUMINOSITY</Text>
            </View>
            {histogram ? (
              <View style={styles.histogramStats}>
                <Text style={styles.histogramStatText}>{histogram.contrast}%</Text>
                <Text style={styles.histogramContrastLabel}>contrast</Text>
              </View>
            ) : (
              <Text style={styles.histogramEmptyText}>No data</Text>
            )}
          </View>

          <View style={styles.histogramBars}>
            {histogram ? (
              histogram.bins.map((value, index) => (
                <View key={index} style={styles.histogramBarWrapper}>
                  <View
                    style={[
                      styles.histogramBar,
                      {
                        height: `${Math.max(value, 2)}%`,
                        backgroundColor: index < 11 ? '#4a4a5a' : index < 21 ? '#6a6a7a' : '#9a9aaa',
                      },
                    ]}
                  />
                </View>
              ))
            ) : (
              Array.from({ length: 32 }).map((_, index) => (
                <View key={index} style={styles.histogramBarWrapper}>
                  <View style={[styles.histogramBar, styles.histogramBarEmpty]} />
                </View>
              ))
            )}
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

          {histogram && (
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
          )}
        </View>

        {/* Extraction Settings Card - Compact */}
        <View style={[styles.extractionCard, { backgroundColor: theme.backgroundCard }]}>
          {/* Algorithm Section */}
          <View style={styles.algorithmSection}>
            <View style={styles.algorithmHeader}>
              <Text style={[styles.algorithmLabel, { color: theme.textSecondary }]}>Algorithm</Text>
              <TouchableOpacity
                style={[
                  styles.valueToggleButton,
                  { backgroundColor: showGrayscale ? theme.accent : theme.borderLight },
                ]}
                onPress={() => setShowGrayscale(!showGrayscale)}
              >
                <Ionicons
                  name="contrast-outline"
                  size={16}
                  color={showGrayscale ? '#fff' : theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <View style={[styles.methodToggle, { backgroundColor: theme.backgroundTertiary }]}>
              <TouchableOpacity
                style={[
                  styles.methodOption,
                  extractionMethod === 'histogram' && { backgroundColor: theme.buttonBg },
                ]}
                onPress={() => handleMethodChange('histogram')}
              >
                <Text
                  style={[
                    styles.methodOptionText,
                    { color: extractionMethod === 'histogram' ? theme.textPrimary : theme.textMuted },
                  ]}
                >
                  Histogram
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodOption,
                  extractionMethod === 'kmeans' && { backgroundColor: theme.buttonBg },
                ]}
                onPress={() => handleMethodChange('kmeans')}
              >
                <Text
                  style={[
                    styles.methodOptionText,
                    { color: extractionMethod === 'kmeans' ? theme.textPrimary : theme.textMuted },
                  ]}
                >
                  K-Means
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.algorithmDesc, { color: theme.textMuted }]}>
              {extractionMethod === 'histogram'
                ? '🎨 Hue histogram - Fast, good for game art with clear color regions'
                : '🔬 K-Means clustering - More accurate, better for photos & gradients'}
            </Text>
          </View>

          {/* Color Count - Inline */}
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>Colors</Text>
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
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.borderLight}
              thumbTintColor={theme.textPrimary}
            />
            <View style={[styles.countBadge, { backgroundColor: theme.backgroundTertiary }]}>
              <Text style={[styles.countBadgeText, { color: theme.textPrimary }]}>{colorCount}</Text>
            </View>
          </View>
        </View>

        {currentImageUri && <View style={{ height: 100 }} />}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.actionButton} onPress={onNavigateToLibrary}>
          <Ionicons name="library-outline" size={22} color={theme.textSecondary} />
          <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>Library</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons name="download-outline" size={22} color="#000" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.exportButton, { backgroundColor: theme.backgroundTertiary }]} onPress={handleExport}>
          <Ionicons name="share-outline" size={22} color={theme.accent} />
          <Text style={[styles.exportButtonText, { color: theme.accent }]}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Color Detail Modal */}
      <Modal
        visible={showColorDetail && colorInfo !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowColorDetail(false)}
      >
        <View style={[styles.colorDetailOverlay, { backgroundColor: theme.modalOverlay }]}>
          <TouchableOpacity
            style={styles.colorDetailBackground}
            onPress={() => setShowColorDetail(false)}
          />
          <View style={[styles.colorDetailContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.colorDetailHandle, { backgroundColor: theme.border }]} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {colorInfo && (
                <>
                  {/* Color Preview + Values Compact */}
                  <View style={styles.colorDetailHeader}>
                    <View
                      style={[styles.colorDetailSwatch, { backgroundColor: colorInfo.hex }]}
                    />
                    <View style={styles.colorDetailValues}>
                      <TouchableOpacity
                        style={[styles.colorValueCompact, { backgroundColor: theme.backgroundTertiary }]}
                        onPress={() => copyColor(colorInfo.hex)}
                      >
                        <Text style={[styles.colorValueCompactLabel, { color: theme.textMuted }]}>HEX</Text>
                        <Text style={[styles.colorValueCompactText, { color: theme.textPrimary }]}>{colorInfo.hex}</Text>
                        <Ionicons name="copy-outline" size={14} color={theme.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.colorValueCompact, { backgroundColor: theme.backgroundTertiary }]}
                        onPress={() => copyColor(`rgb(${colorInfo.rgb.r}, ${colorInfo.rgb.g}, ${colorInfo.rgb.b})`)}
                      >
                        <Text style={[styles.colorValueCompactLabel, { color: theme.textMuted }]}>RGB</Text>
                        <Text style={[styles.colorValueCompactText, { color: theme.textPrimary }]}>
                          {colorInfo.rgb.r}, {colorInfo.rgb.g}, {colorInfo.rgb.b}
                        </Text>
                        <Ionicons name="copy-outline" size={14} color={theme.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.colorValueCompact, { backgroundColor: theme.backgroundTertiary }]}
                        onPress={() => copyColor(`hsl(${colorInfo.hsl.h}, ${colorInfo.hsl.s}%, ${colorInfo.hsl.l}%)`)}
                      >
                        <Text style={[styles.colorValueCompactLabel, { color: theme.textMuted }]}>HSL</Text>
                        <Text style={[styles.colorValueCompactText, { color: theme.textPrimary }]}>
                          {colorInfo.hsl.h}°, {colorInfo.hsl.s}%, {colorInfo.hsl.l}%
                        </Text>
                        <Ionicons name="copy-outline" size={14} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Value Variations */}
                  <View style={[styles.variationsSection, { backgroundColor: theme.backgroundTertiary }]}>
                    <View style={styles.variationsHeader}>
                      <Text style={[styles.variationsSectionTitle, { color: theme.textPrimary }]}>Variations</Text>
                      <View style={[styles.hueShiftToggle, { backgroundColor: theme.backgroundSecondary }]}>
                        <TouchableOpacity
                          style={[
                            styles.hueShiftOption,
                            variationHueShift && { backgroundColor: theme.buttonBg },
                          ]}
                          onPress={() => setVariationHueShift(true)}
                        >
                          <Text
                            style={[
                              styles.hueShiftOptionText,
                              { color: variationHueShift ? theme.textPrimary : theme.textMuted },
                            ]}
                          >
                            Hue Shift
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.hueShiftOption,
                            !variationHueShift && { backgroundColor: theme.buttonBg },
                          ]}
                          onPress={() => setVariationHueShift(false)}
                        >
                          <Text
                            style={[
                              styles.hueShiftOptionText,
                              { color: !variationHueShift ? theme.textPrimary : theme.textMuted },
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
                            <Text style={[styles.variationHex, { color: theme.textMuted }]}>{v.hex}</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>

                  {/* Color Harmony */}
                  <View style={[styles.harmonySection, { backgroundColor: theme.backgroundTertiary }]}>
                    <Text style={[styles.harmonySectionTitle, { color: theme.textPrimary }]}>Harmony</Text>

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
                            { backgroundColor: selectedHarmony === harmony.type ? theme.accent : theme.backgroundSecondary },
                          ]}
                          onPress={() => {
                            hapticLight();
                            setSelectedHarmony(harmony.type);
                          }}
                        >
                          <Text
                            style={[
                              styles.harmonyTypeText,
                              { color: selectedHarmony === harmony.type ? '#fff' : theme.textMuted },
                            ]}
                          >
                            {harmony.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {(() => {
                      const harmonies = generateColorHarmonies(colorInfo.hex);
                      const currentHarmony = harmonies.find(h => h.type === selectedHarmony);
                      if (!currentHarmony) return null;

                      return (
                        <>
                          <Text style={[styles.harmonyDesc, { color: theme.textMuted }]}>
                            {currentHarmony.description}
                            {currentHarmony.colors.length > 1 && ` (${currentHarmony.colors.map(c => c.angle + '°').join(', ')})`}
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
                                <Text style={[styles.harmonyColorHex, { color: theme.textMuted }]}>{color.hex}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      );
                    })()}
                  </View>

                  <View style={{ height: 20 }} />
                </>
              )}
            </ScrollView>
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
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Save Palette</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary, borderColor: theme.border }]}
              value={paletteName}
              onChangeText={setPaletteName}
              placeholder="Auto: Palette YYYY-MM-DD_001"
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.buttonBg }]}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
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
        <View style={[styles.exportModalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <TouchableOpacity
            style={styles.exportModalBackground}
            onPress={() => setShowExportModal(false)}
          />
          <View style={[styles.exportModalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.exportModalHandle, { backgroundColor: theme.border }]} />
            <View style={styles.exportModalHeader}>
              <Text style={[styles.exportModalTitle, { color: theme.textPrimary }]}>Export Palette</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.exportPreviewScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* SNS Card Type Selector */}
              <View style={styles.snsTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.snsTypeButton,
                    { backgroundColor: snsCardType === 'instagram' ? theme.accent : theme.backgroundTertiary },
                  ]}
                  onPress={() => {
                    hapticLight();
                    setSnsCardType('instagram');
                  }}
                >
                  <Ionicons
                    name="logo-instagram"
                    size={18}
                    color={snsCardType === 'instagram' ? '#fff' : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.snsTypeText,
                      { color: snsCardType === 'instagram' ? '#fff' : theme.textSecondary },
                    ]}
                  >
                    Instagram
                  </Text>
                  <Text style={[styles.snsTypeRatio, { color: snsCardType === 'instagram' ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}>1:1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.snsTypeButton,
                    { backgroundColor: snsCardType === 'twitter' ? theme.accent : theme.backgroundTertiary },
                  ]}
                  onPress={() => {
                    hapticLight();
                    setSnsCardType('twitter');
                  }}
                >
                  <Ionicons
                    name="logo-twitter"
                    size={18}
                    color={snsCardType === 'twitter' ? '#fff' : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.snsTypeText,
                      { color: snsCardType === 'twitter' ? '#fff' : theme.textSecondary },
                    ]}
                  >
                    Twitter
                  </Text>
                  <Text style={[styles.snsTypeRatio, { color: snsCardType === 'twitter' ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}>16:9</Text>
                </TouchableOpacity>
              </View>

              {/* Card Options */}
              <View style={styles.cardOptionsRow}>
                <TouchableOpacity
                  style={[styles.cardOptionButton, { backgroundColor: cardShowHex ? theme.accent : theme.backgroundTertiary }]}
                  onPress={() => setCardShowHex(!cardShowHex)}
                >
                  <Text style={[styles.cardOptionText, { color: cardShowHex ? '#fff' : theme.textSecondary }]}>
                    HEX
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardOptionButton, { backgroundColor: cardShowStats ? theme.accent : theme.backgroundTertiary }]}
                  onPress={() => setCardShowStats(!cardShowStats)}
                >
                  <Text style={[styles.cardOptionText, { color: cardShowStats ? '#fff' : theme.textSecondary }]}>
                    Stats
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardOptionButton, { backgroundColor: cardShowHistogram ? theme.accent : theme.backgroundTertiary }]}
                  onPress={() => setCardShowHistogram(!cardShowHistogram)}
                >
                  <Text style={[styles.cardOptionText, { color: cardShowHistogram ? '#fff' : theme.textSecondary }]}>
                    Histogram
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SNS Card Preview */}
              <ViewShot
                ref={paletteCardRef}
                options={{ format: 'png', quality: 1.0 }}
                style={[
                  styles.snsCard,
                  snsCardType === 'instagram' ? styles.snsCardInstagram : styles.snsCardTwitter,
                ]}
              >
                {/* Background gradient using first color */}
                <View
                  style={[
                    styles.snsCardBackground,
                    { backgroundColor: processedColors[0] || '#1a1a24' },
                  ]}
                />
                <View style={styles.snsCardOverlay} />

                {/* Card Content */}
                <View style={[
                  styles.snsCardContent,
                  snsCardType === 'twitter' && styles.snsCardContentTwitter,
                ]}>
                  {/* Image Section */}
                  {currentImageUri && (
                    <View style={[
                      styles.snsCardImageWrapper,
                      snsCardType === 'twitter' && styles.snsCardImageWrapperTwitter,
                    ]}>
                      <Image
                        source={{ uri: currentImageUri }}
                        style={styles.snsCardImage}
                        contentFit="cover"
                      />
                    </View>
                  )}

                  {/* Color Palette Strip */}
                  <View style={[
                    styles.snsCardPalette,
                    snsCardType === 'twitter' && styles.snsCardPaletteTwitter,
                  ]}>
                    {processedColors.map((color, index) => (
                      <View key={index} style={styles.snsCardColorItem}>
                        <View
                          style={[
                            styles.snsCardColorSwatch,
                            snsCardType === 'twitter' && styles.snsCardColorSwatchTwitter,
                            { backgroundColor: color },
                          ]}
                        />
                        {cardShowHex && (
                          <Text style={styles.snsCardColorHex}>{color}</Text>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Mini Histogram */}
                  {cardShowHistogram && histogram && (
                    <View style={[
                      styles.snsCardHistogram,
                      snsCardType === 'twitter' && styles.snsCardHistogramTwitter,
                    ]}>
                      <View style={styles.snsCardHistogramBars}>
                        {histogram.bins.map((value, index) => (
                          <View key={index} style={styles.snsCardHistogramBarWrapper}>
                            <View
                              style={[
                                styles.snsCardHistogramBar,
                                {
                                  height: `${Math.max(value, 3)}%`,
                                  backgroundColor: `rgba(255, 255, 255, ${0.3 + (index / 32) * 0.5})`,
                                },
                              ]}
                            />
                          </View>
                        ))}
                      </View>
                      <View style={styles.snsCardHistogramLabels}>
                        <Text style={styles.snsCardHistogramLabel}>{histogram.darkPercent}% Dark</Text>
                        <Text style={styles.snsCardHistogramLabel}>{histogram.midPercent}% Mid</Text>
                        <Text style={styles.snsCardHistogramLabel}>{histogram.brightPercent}% Bright</Text>
                      </View>
                    </View>
                  )}

                  {/* Stats Section */}
                  {cardShowStats && histogram && (
                    <View style={[
                      styles.snsCardStats,
                      snsCardType === 'twitter' && styles.snsCardStatsTwitter,
                    ]}>
                      <View style={styles.snsCardStatItem}>
                        <Text style={[
                          styles.snsCardStatValue,
                          snsCardType === 'twitter' && styles.snsCardStatValueTwitter,
                        ]}>{histogram.contrast}%</Text>
                        <Text style={[
                          styles.snsCardStatLabel,
                          snsCardType === 'twitter' && styles.snsCardStatLabelTwitter,
                        ]}>Contrast</Text>
                      </View>
                      <View style={styles.snsCardStatDivider} />
                      <View style={styles.snsCardStatItem}>
                        <Text style={[
                          styles.snsCardStatValue,
                          snsCardType === 'twitter' && styles.snsCardStatValueTwitter,
                        ]}>{processedColors.length}</Text>
                        <Text style={[
                          styles.snsCardStatLabel,
                          snsCardType === 'twitter' && styles.snsCardStatLabelTwitter,
                        ]}>Colors</Text>
                      </View>
                      <View style={styles.snsCardStatDivider} />
                      <View style={styles.snsCardStatItem}>
                        <Text style={[
                          styles.snsCardStatValue,
                          snsCardType === 'twitter' && styles.snsCardStatValueTwitter,
                        ]}>{histogram.average}</Text>
                        <Text style={[
                          styles.snsCardStatLabel,
                          snsCardType === 'twitter' && styles.snsCardStatLabelTwitter,
                        ]}>Avg Lum</Text>
                      </View>
                    </View>
                  )}

                  {/* Watermark */}
                  <View style={styles.snsCardWatermark}>
                    <Text style={styles.snsCardWatermarkText}>GamePalette</Text>
                  </View>
                </View>
              </ViewShot>

              {/* Format Selection */}
              <View style={styles.formatSection}>
                <Text style={[styles.formatSectionTitle, { color: theme.textSecondary }]}>Export Format</Text>
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
                        { backgroundColor: exportFormat === format.id ? theme.accent : theme.backgroundTertiary },
                      ]}
                      onPress={() => setExportFormat(format.id as typeof exportFormat)}
                    >
                      <Ionicons
                        name={format.icon as any}
                        size={18}
                        color={exportFormat === format.id ? '#fff' : theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.formatOptionText,
                          { color: exportFormat === format.id ? '#fff' : theme.textSecondary },
                        ]}
                      >
                        {format.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Share Button */}
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
                      Share to {snsCardType === 'instagram' ? 'Instagram' : 'Twitter'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Quick Copy Options */}
              <View style={styles.quickCopySection}>
                <Text style={[styles.quickCopyTitle, { color: theme.textSecondary }]}>Quick Copy</Text>
                <View style={styles.quickCopyButtons}>
                  <TouchableOpacity
                    style={[styles.quickCopyButton, { backgroundColor: theme.backgroundTertiary }]}
                    onPress={() => copyToClipboard('text')}
                  >
                    <Text style={[styles.quickCopyButtonText, { color: theme.textPrimary }]}>HEX</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickCopyButton, { backgroundColor: theme.backgroundTertiary }]}
                    onPress={() => copyToClipboard('json')}
                  >
                    <Text style={[styles.quickCopyButtonText, { color: theme.textPrimary }]}>JSON</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickCopyButton, { backgroundColor: theme.backgroundTertiary }]}
                    onPress={() => copyToClipboard('css')}
                  >
                    <Text style={[styles.quickCopyButtonText, { color: theme.textPrimary }]}>CSS</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rewarded Ad Modal */}
      <MockRewardedAd
        visible={showRewardedAd}
        onClose={() => setShowRewardedAd(false)}
        onRewardEarned={handleRewardEarned}
      />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  extractionsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  extractionsBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
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
  reExtractIconButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCardEmpty: {
    marginHorizontal: 16,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#16161e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageCardEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    marginBottom: 20,
  },
  imageSourceButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  imageSourceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#1e1e2a',
    gap: 8,
  },
  imageSourceButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6366f1',
  },

  // Style Filters - Icon Grid
  styleFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  styleFilterButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1a1a24',
    gap: 4,
  },
  styleFilterButtonActive: {
    backgroundColor: '#6366f1',
  },
  styleFilterText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
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
  colorCardsEmpty: {
    opacity: 0.4,
  },
  colorSwatchEmpty: {
    backgroundColor: '#1a1a24',
    borderStyle: 'dashed',
  },

  // Inline Color Detail
  inlineColorDetail: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  inlineColorDetailHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineColorSwatch: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  inlineColorValues: {
    flex: 1,
    gap: 4,
  },
  inlineColorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  inlineColorLabel: {
    fontSize: 10,
    fontWeight: '600',
    width: 28,
  },
  inlineColorValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
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
  algorithmSection: {
    marginBottom: 12,
  },
  algorithmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  algorithmLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  algorithmDesc: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
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
    maxHeight: '70%',
  },
  colorDetailHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3e3e50',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  colorDetailHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  colorDetailSwatch: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2d2d38',
  },
  colorDetailValues: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
    gap: 6,
  },
  colorValueCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c0c12',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  colorValueCompactLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    width: 28,
  },
  colorValueCompactText: {
    flex: 1,
    fontSize: 12,
    color: '#fff',
    fontFamily: 'monospace',
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
    marginBottom: 8,
  },
  harmonyDesc: {
    fontSize: 11,
    marginBottom: 10,
    textAlign: 'center',
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

  // SNS Card Type Selector
  snsTypeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  snsTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#24242e',
    gap: 8,
  },
  snsTypeButtonActive: {
    backgroundColor: '#6366f1',
  },
  snsTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  snsTypeTextActive: {
    color: '#fff',
  },
  snsTypeRatio: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#1a1a24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Card Options
  cardOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cardOptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#24242e',
  },
  cardOptionButtonActive: {
    backgroundColor: '#4a4a5a',
  },
  cardOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  cardOptionTextActive: {
    color: '#fff',
  },

  // SNS Card
  snsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  snsCardInstagram: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
  },
  snsCardTwitter: {
    width: SCREEN_WIDTH - 40,
    height: (SCREEN_WIDTH - 40) * 9 / 16,
  },
  snsCardBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  snsCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  snsCardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  snsCardContentTwitter: {
    padding: 12,
  },
  snsCardImageWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  snsCardImageWrapperTwitter: {
    flex: 0,
    height: 60,
    marginBottom: 6,
    borderRadius: 8,
  },
  snsCardImage: {
    width: '100%',
    height: '100%',
  },
  snsCardPalette: {
    flexDirection: 'row',
    gap: 8,
  },
  snsCardPaletteTwitter: {
    gap: 6,
  },
  snsCardColorItem: {
    flex: 1,
    alignItems: 'center',
  },
  snsCardColorSwatch: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    marginBottom: 4,
  },
  snsCardColorSwatchTwitter: {
    height: 32,
    borderRadius: 6,
    marginBottom: 2,
  },
  snsCardColorHex: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'monospace',
  },
  snsCardHistogram: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  snsCardHistogramTwitter: {
    padding: 6,
    marginTop: 6,
    borderRadius: 8,
  },
  snsCardHistogramBars: {
    flexDirection: 'row',
    height: 30,
    alignItems: 'flex-end',
    gap: 1,
  },
  snsCardHistogramBarWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  snsCardHistogramBar: {
    width: '100%',
    borderRadius: 1,
    minHeight: 2,
  },
  snsCardHistogramLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  snsCardHistogramLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  snsCardStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  snsCardStatsTwitter: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  snsCardStatItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  snsCardStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  snsCardStatValueTwitter: {
    fontSize: 12,
  },
  snsCardStatLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  snsCardStatLabelTwitter: {
    fontSize: 8,
    marginTop: 1,
  },
  snsCardStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  snsCardWatermark: {
    alignItems: 'center',
    marginTop: 8,
  },
  snsCardWatermarkText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
    letterSpacing: 1,
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
  histogramBarEmpty: {
    height: 8,
    backgroundColor: '#2a2a3a',
  },
  histogramEmptyText: {
    fontSize: 11,
    color: '#555',
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
