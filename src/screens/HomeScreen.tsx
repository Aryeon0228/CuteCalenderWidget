import React, { useState, useRef, useMemo } from 'react';
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
  SafeAreaView,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
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
  simulateColorBlindness,
  ColorBlindnessType,
  COLOR_BLINDNESS_TYPES,
} from '../lib/colorUtils';
import { StyleFilter, STYLE_PRESETS, STYLE_FILTER_KEYS } from '../constants/stylePresets';

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

  // Color Format State
  const [colorFormat, setColorFormat] = useState<'HEX' | 'RGB' | 'HSL'>('HEX');

  // Filter & Display State
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('original');
  const [showGrayscale, setShowGrayscale] = useState(false);
  const [variationHueShift, setVariationHueShift] = useState(true);
  const [selectedHarmony, setSelectedHarmony] = useState<HarmonyType>('complementary');
  const [colorBlindMode, setColorBlindMode] = useState<ColorBlindnessType>('none');

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

  // Info Modal State
  const [showInfo, setShowInfo] = useState(false);

  // Advanced Settings Sheet State
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Colors WITHOUT CVD (for comparison display)
  const styledColors = useMemo(() =>
    currentColors.map((hex) => {
      if (showGrayscale) {
        return toGrayscale(hex);
      }
      const preset = STYLE_PRESETS[styleFilter];
      return adjustColor(hex, preset.saturation, preset.brightness);
    }),
    [currentColors, showGrayscale, styleFilter]
  );

  // Colors WITH CVD applied (final display)
  const processedColors = useMemo(() =>
    styledColors.map((color) => {
      if (colorBlindMode !== 'none') {
        return simulateColorBlindness(color, colorBlindMode);
      }
      return color;
    }),
    [styledColors, colorBlindMode]
  );

  const colorInfo = useMemo((): ColorInfo | null => {
    if (selectedColorIndex === null || !processedColors[selectedColorIndex]) {
      return null;
    }
    const hex = processedColors[selectedColorIndex];
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return { hex, rgb, hsl };
  }, [processedColors, selectedColorIndex]);

  const getFormattedColor = (info: ColorInfo, format: 'HEX' | 'RGB' | 'HSL'): string => {
    switch (format) {
      case 'HEX': return info.hex.toUpperCase();
      case 'RGB': return `rgb(${info.rgb.r}, ${info.rgb.g}, ${info.rgb.b})`;
      case 'HSL': return `hsl(${info.hsl.h}, ${info.hsl.s}%, ${info.hsl.l}%)`;
    }
  };

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
    if (!currentImageUri) return;
    await doExtract(currentImageUri, colorCount, extractionMethod);
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

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 1800);
  };

  const copyColor = async (value: string, label?: string) => {
    await Clipboard.setStringAsync(value);
    hapticSuccess();
    showToast(`Copied ${label || value}`);
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
    hapticSuccess();
    showToast(`Copied ${format.toUpperCase()}`);
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
          <View style={styles.headerLogoMark}>
            <Ionicons name="paw" size={20} color="#fff" />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Pixel Paw</Text>
            <View style={[styles.headerSubtitleRow]}>
              <View style={[styles.headerAccentLine, { backgroundColor: theme.accent }]} />
              <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Color Extractor</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight, borderWidth: 1 }]}
            onPress={toggleTheme}
          >
            <Ionicons
              name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight, borderWidth: 1 }]}
            onPress={() => setShowInfo(true)}
          >
            <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
      >
        {/* Image Card */}
        {currentImageUri ? (
          <TouchableOpacity style={styles.imageCard} onPress={showImageSourceOptions}>
            <Image
              source={{ uri: currentImageUri }}
              style={[styles.image, showGrayscale && { filter: 'grayscale(1)' }]}
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
          <View style={[styles.imageCardEmpty, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}>
            {/* Decorative color dots */}
            <View style={styles.emptyDecoContainer}>
              <View style={[styles.emptyDecoDot, { backgroundColor: '#f472b6', top: 16, left: 20, width: 8, height: 8 }]} />
              <View style={[styles.emptyDecoDot, { backgroundColor: '#60a5fa', top: 30, right: 30, width: 6, height: 6 }]} />
              <View style={[styles.emptyDecoDot, { backgroundColor: '#fbbf24', bottom: 40, left: 30, width: 10, height: 10 }]} />
              <View style={[styles.emptyDecoDot, { backgroundColor: '#34d399', top: 50, right: 50, width: 7, height: 7 }]} />
              <View style={[styles.emptyDecoDot, { backgroundColor: '#a78bfa', bottom: 24, right: 20, width: 9, height: 9 }]} />
            </View>

            {/* Central content */}
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.accent + '15' }]}>
              <View style={[styles.emptyIconInner, { backgroundColor: theme.accent + '25' }]}>
                <Ionicons name="color-palette-outline" size={32} color={theme.accent} />
              </View>
            </View>
            <Text style={[styles.imageCardEmptyTitle, { color: theme.textPrimary }]}>Add your artwork</Text>
            <Text style={[styles.imageCardEmptySubtitle, { color: theme.textMuted }]}>Extract beautiful color palettes</Text>
            <View style={styles.imageSourceButtons}>
              <TouchableOpacity
                style={[styles.imageSourceButton, { backgroundColor: theme.backgroundTertiary, borderColor: theme.borderLight }]}
                onPress={() => {
                  hapticLight();
                  openCamera();
                }}
              >
                <View style={[styles.imageSourceIconBg, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons name="camera" size={22} color={theme.accent} />
                </View>
                <Text style={[styles.imageSourceButtonText, { color: theme.textPrimary }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageSourceButton, { backgroundColor: theme.backgroundTertiary, borderColor: theme.borderLight }]}
                onPress={() => {
                  hapticLight();
                  pickFromGallery();
                }}
              >
                <View style={[styles.imageSourceIconBg, { backgroundColor: '#f472b6' + '20' }]}>
                  <Ionicons name="images" size={22} color="#f472b6" />
                </View>
                <Text style={[styles.imageSourceButtonText, { color: theme.textPrimary }]}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Settings Summary Bar ── */}
        <View style={[styles.summaryBar, { backgroundColor: theme.backgroundCard }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.summaryChipsScroll}
          >
            <View style={[styles.summaryChip, { backgroundColor: theme.accent + '20' }]}>
              <Ionicons name={STYLE_PRESETS[styleFilter].icon as any} size={13} color={theme.accent} />
              <Text style={[styles.summaryChipText, { color: theme.accent }]}>{STYLE_PRESETS[styleFilter].name}</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: theme.backgroundTertiary }]}>
              <Ionicons name="flask-outline" size={13} color={theme.textSecondary} />
              <Text style={[styles.summaryChipText, { color: theme.textSecondary }]}>
                {extractionMethod === 'histogram' ? 'Histogram' : 'K-Means'}
              </Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: theme.backgroundTertiary }]}>
              <Ionicons name="color-palette-outline" size={13} color={theme.textSecondary} />
              <Text style={[styles.summaryChipText, { color: theme.textSecondary }]}>{colorCount}</Text>
            </View>
            {showGrayscale && (
              <View style={[styles.summaryChip, { backgroundColor: '#f472b6' + '25' }]}>
                <Ionicons name="contrast-outline" size={13} color="#f472b6" />
                <Text style={[styles.summaryChipText, { color: '#f472b6' }]}>Value</Text>
              </View>
            )}
            {colorBlindMode !== 'none' && (
              <View style={[styles.summaryChip, { backgroundColor: '#f59e0b' + '25' }]}>
                <Ionicons name="eye-outline" size={13} color="#f59e0b" />
                <Text style={[styles.summaryChipText, { color: '#f59e0b' }]}>CVD</Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[styles.summaryEditButton, { backgroundColor: theme.backgroundTertiary }]}
            onPress={() => setShowAdvanced(true)}
          >
            <Ionicons name="options-outline" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Color Cards - Palette Swatches */}
        {processedColors.length > 0 ? (
          <View style={styles.colorCardsContainer}>
            {processedColors.map((color, index) => {
              const isSelected = selectedColorIndex === index;
              const originalColor = styledColors[index];
              const isCvdActive = colorBlindMode !== 'none' && originalColor !== color;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorCard,
                    isSelected && styles.colorCardSelected,
                  ]}
                  onPress={() => handleColorPress(index)}
                >
                  <View style={[
                    styles.colorSwatch,
                    { backgroundColor: color, overflow: 'hidden' },
                    isSelected && [styles.colorSwatchSelected, { borderColor: color, shadowColor: color }],
                  ]}>
                    {isCvdActive && (
                      <View style={[styles.cvdSplitOriginal, { backgroundColor: originalColor }]} />
                    )}
                  </View>
                  {isSelected && (
                    <View style={[styles.chipTriangle, { borderBottomColor: color }]} />
                  )}
                  <Text style={[styles.chipRank, { color: isSelected ? theme.textPrimary : theme.textMuted }]}>
                    #{index + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={[styles.colorCardsContainer, styles.colorCardsEmpty]}>
            {Array.from({ length: colorCount }).map((_, index) => {
              const hintColors = ['#6366f1', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#fb923c', '#a78bfa', '#f87171'];
              const hintColor = hintColors[index % hintColors.length];
              return (
                <View key={index} style={styles.colorCard}>
                  <View style={[styles.colorSwatch, styles.colorSwatchEmpty, { borderColor: hintColor + '30', backgroundColor: hintColor + '08' }]}>
                    <Ionicons name="paw" size={16} color={hintColor + '35'} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Inline Color Detail */}
        {colorInfo && selectedColorIndex !== null && (
          <View style={[styles.inlineColorDetail, { backgroundColor: theme.backgroundCard, borderColor: colorInfo.hex + '60', borderWidth: 1.5 }]}>
            {/* Color Preview + Value + Copy */}
            <View style={[styles.inlineColorPreview, { backgroundColor: colorInfo.hex }]}>
              <Text style={[styles.inlineColorPreviewValue, { color: parseInt(colorInfo.hex.replace('#', ''), 16) > 0x888888 ? '#000' : '#fff' }]}>
                {getFormattedColor(colorInfo, colorFormat)}
              </Text>
              <TouchableOpacity
                style={styles.inlineColorCopyButton}
                onPress={() => copyColor(getFormattedColor(colorInfo, colorFormat), colorFormat)}
              >
                <Ionicons name="copy-outline" size={16} color="#fff" />
                <Text style={styles.inlineColorCopyText}>Copy</Text>
              </TouchableOpacity>
            </View>

            {/* Format Segment Toggle */}
            <View style={[styles.formatSegment, { backgroundColor: theme.backgroundTertiary }]}>
              {(['HEX', 'RGB', 'HSL'] as const).map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  style={[
                    styles.formatSegmentButton,
                    colorFormat === fmt && { backgroundColor: theme.accent },
                  ]}
                  onPress={() => setColorFormat(fmt)}
                >
                  <Text style={[
                    styles.formatSegmentText,
                    { color: colorFormat === fmt ? '#fff' : theme.textMuted },
                  ]}>
                    {fmt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Channel Bars (RGB or HSL) */}
            {colorFormat === 'RGB' && (
              <View style={[styles.channelBarsContainer, { backgroundColor: theme.backgroundTertiary }]}>
                {[
                  { label: 'R', value: colorInfo.rgb.r, max: 255, color: '#ef4444' },
                  { label: 'G', value: colorInfo.rgb.g, max: 255, color: '#22c55e' },
                  { label: 'B', value: colorInfo.rgb.b, max: 255, color: '#3b82f6' },
                ].map((ch) => (
                  <View key={ch.label} style={styles.channelRow}>
                    <Text style={[styles.channelLabel, { color: ch.color }]}>{ch.label}</Text>
                    <View style={styles.channelBarTrack}>
                      <View style={[styles.channelBarFill, { width: `${(ch.value / ch.max) * 100}%`, backgroundColor: ch.color }]} />
                    </View>
                    <Text style={[styles.channelValue, { color: theme.textSecondary }]}>{ch.value}</Text>
                  </View>
                ))}
              </View>
            )}
            {colorFormat === 'HSL' && (
              <View style={[styles.channelBarsContainer, { backgroundColor: theme.backgroundTertiary }]}>
                {[
                  { label: 'H', value: colorInfo.hsl.h, max: 360, color: '#f472b6', display: `${colorInfo.hsl.h}°` },
                  { label: 'S', value: colorInfo.hsl.s, max: 100, color: '#a78bfa', display: `${colorInfo.hsl.s}%` },
                  { label: 'L', value: colorInfo.hsl.l, max: 100, color: '#fbbf24', display: `${colorInfo.hsl.l}%` },
                ].map((ch) => (
                  <View key={ch.label} style={styles.channelRow}>
                    <Text style={[styles.channelLabel, { color: ch.color }]}>{ch.label}</Text>
                    <View style={styles.channelBarTrack}>
                      <View style={[styles.channelBarFill, { width: `${(ch.value / ch.max) * 100}%`, backgroundColor: ch.color }]} />
                    </View>
                    <Text style={[styles.channelValue, { color: theme.textSecondary }]}>{ch.display}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Inline Variations */}
            <View style={[styles.inlineVariationsSection, { backgroundColor: theme.backgroundTertiary }]}>
              <View style={styles.variationsHeader}>
                <Text style={[styles.variationsSectionTitle, { color: theme.textPrimary }]}>Variations</Text>
                <View style={[styles.hueShiftToggle, { backgroundColor: theme.backgroundSecondary }]}>
                  <TouchableOpacity
                    style={[
                      styles.hueShiftOption,
                      !variationHueShift && { backgroundColor: theme.accent },
                    ]}
                    onPress={() => setVariationHueShift(false)}
                  >
                    <Text
                      style={[
                        styles.hueShiftOptionText,
                        { color: !variationHueShift ? '#fff' : theme.textMuted },
                      ]}
                    >
                      Lightness
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.hueShiftOption,
                      variationHueShift && { backgroundColor: theme.accent },
                    ]}
                    onPress={() => setVariationHueShift(true)}
                  >
                    <Text
                      style={[
                        styles.hueShiftOptionText,
                        { color: variationHueShift ? '#fff' : theme.textMuted },
                      ]}
                    >
                      Hue Shift
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
          </View>
        )}

        {currentImageUri && <View style={{ height: 100 }} />}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.actionButton} onPress={onNavigateToLibrary}>
          <Ionicons name="library-outline" size={22} color={theme.textSecondary} />
          <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>Library</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="share-outline" size={22} color="#fff" />
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
                  {/* Color Preview + Copy */}
                  <View style={[styles.modalColorPreview, { backgroundColor: colorInfo.hex }]}>
                    <Text style={[styles.modalColorPreviewValue, { color: parseInt(colorInfo.hex.replace('#', ''), 16) > 0x888888 ? '#000' : '#fff' }]}>
                      {getFormattedColor(colorInfo, colorFormat)}
                    </Text>
                    <TouchableOpacity
                      style={styles.modalColorCopyButton}
                      onPress={() => copyColor(getFormattedColor(colorInfo, colorFormat), colorFormat)}
                    >
                      <Ionicons name="copy-outline" size={18} color="#fff" />
                      <Text style={styles.modalColorCopyText}>Copy</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Format Segment Toggle */}
                  <View style={[styles.modalFormatSegment, { backgroundColor: theme.backgroundTertiary }]}>
                    {(['HEX', 'RGB', 'HSL'] as const).map((fmt) => (
                      <TouchableOpacity
                        key={fmt}
                        style={[
                          styles.modalFormatSegmentButton,
                          colorFormat === fmt && { backgroundColor: theme.accent },
                        ]}
                        onPress={() => setColorFormat(fmt)}
                      >
                        <Text style={[
                          styles.modalFormatSegmentText,
                          { color: colorFormat === fmt ? '#fff' : theme.textMuted },
                        ]}>
                          {fmt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Variations */}
                  <View style={[styles.variationsSection, { backgroundColor: theme.backgroundTertiary }]}>
                    <View style={styles.variationsHeader}>
                      <Text style={[styles.variationsSectionTitle, { color: theme.textPrimary }]}>Variations</Text>
                      <View style={[styles.hueShiftToggle, { backgroundColor: theme.backgroundSecondary }]}>
                        <TouchableOpacity
                          style={[
                            styles.hueShiftOption,
                            !variationHueShift && { backgroundColor: theme.accent },
                          ]}
                          onPress={() => setVariationHueShift(false)}
                        >
                          <Text
                            style={[
                              styles.hueShiftOptionText,
                              { color: !variationHueShift ? '#fff' : theme.textMuted },
                            ]}
                          >
                            Lightness
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.hueShiftOption,
                            variationHueShift && { backgroundColor: theme.accent },
                          ]}
                          onPress={() => setVariationHueShift(true)}
                        >
                          <Text
                            style={[
                              styles.hueShiftOptionText,
                              { color: variationHueShift ? '#fff' : theme.textMuted },
                            ]}
                          >
                            Hue
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
          />
          <SafeAreaView style={styles.cameraOverlay}>
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => {
                hapticLight();
                setShowCamera(false);
              }}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            <View style={styles.cameraBottomControls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
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
              {snsCardType === 'twitter' ? (
                <ViewShot
                  ref={paletteCardRef}
                  options={{ format: 'png', quality: 1.0 }}
                  style={[styles.snsCard, styles.snsCardTwitter]}
                >
                  <View style={[styles.snsCardBackground, { backgroundColor: processedColors[0] || '#1a1a24' }]} />
                  <View style={styles.snsCardOverlay} />
                  <View style={[styles.snsCardContent, styles.snsCardContentTwitter]}>
                    {/* Top: Image + Palette side by side */}
                    <View style={styles.twitterUnifiedRow}>
                      {currentImageUri && (
                        <View style={styles.twitterUnifiedImage}>
                          <Image source={{ uri: currentImageUri }} style={styles.snsCardImage} contentFit="cover" />
                        </View>
                      )}
                      <View style={styles.twitterUnifiedPalette}>
                        {processedColors.map((color, index) => (
                          <View key={index} style={styles.twitterUnifiedColorItem}>
                            <View style={[styles.twitterUnifiedColorBar, { backgroundColor: color }]} />
                            {cardShowHex && <Text style={styles.twitterUnifiedColorHex}>{color}</Text>}
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Bottom: Histogram + Stats */}
                    {(cardShowHistogram || cardShowStats) && histogram && (
                      <View style={styles.twitterUnifiedAnalysis}>
                        {cardShowHistogram && (
                          <View style={[styles.twitterUnifiedHistogram, !cardShowStats && { flex: 1 }]}>
                            <View style={styles.twitterUnifiedHistogramBars}>
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
                            <View style={styles.twitterUnifiedHistogramLabels}>
                              <Text style={styles.snsCardHistogramLabel}>{histogram.darkPercent}%D</Text>
                              <Text style={styles.snsCardHistogramLabel}>{histogram.midPercent}%M</Text>
                              <Text style={styles.snsCardHistogramLabel}>{histogram.brightPercent}%B</Text>
                            </View>
                          </View>
                        )}
                        {cardShowStats && (
                          <View style={[styles.twitterUnifiedStats, !cardShowHistogram && { flex: 1, justifyContent: 'center' }]}>
                            <View style={styles.twitterUnifiedStatItem}>
                              <Text style={styles.twitterUnifiedStatValue}>{histogram.contrast}%</Text>
                              <Text style={styles.twitterUnifiedStatLabel}>Contrast</Text>
                            </View>
                            <View style={[styles.snsCardStatDivider, { height: 16 }]} />
                            <View style={styles.twitterUnifiedStatItem}>
                              <Text style={styles.twitterUnifiedStatValue}>{processedColors.length}</Text>
                              <Text style={styles.twitterUnifiedStatLabel}>Colors</Text>
                            </View>
                            <View style={[styles.snsCardStatDivider, { height: 16 }]} />
                            <View style={styles.twitterUnifiedStatItem}>
                              <Text style={styles.twitterUnifiedStatValue}>{histogram.average}</Text>
                              <Text style={styles.twitterUnifiedStatLabel}>Avg Lum</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    <View style={styles.snsCardWatermark}>
                      <Text style={styles.snsCardWatermarkText}>Pixel Paw 🐾</Text>
                    </View>
                  </View>
                </ViewShot>
              ) : (
                /* Instagram Card: Single square card */
                <ViewShot
                  ref={paletteCardRef}
                  options={{ format: 'png', quality: 1.0 }}
                  style={[styles.snsCard, styles.snsCardInstagram]}
                >
                  <View style={[styles.snsCardBackground, { backgroundColor: processedColors[0] || '#1a1a24' }]} />
                  <View style={styles.snsCardOverlay} />
                  <View style={styles.snsCardContent}>
                    {currentImageUri && (
                      <View style={styles.snsCardImageWrapper}>
                        <Image source={{ uri: currentImageUri }} style={styles.snsCardImage} contentFit="cover" />
                      </View>
                    )}
                    <View style={styles.snsCardPalette}>
                      {processedColors.map((color, index) => (
                        <View key={index} style={styles.snsCardColorItem}>
                          <View style={[styles.snsCardColorSwatch, { backgroundColor: color }]} />
                          {cardShowHex && <Text style={styles.snsCardColorHex}>{color}</Text>}
                        </View>
                      ))}
                    </View>
                    {cardShowHistogram && histogram && (
                      <View style={styles.snsCardHistogram}>
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
                    {cardShowStats && histogram && (
                      <View style={styles.snsCardStats}>
                        <View style={styles.snsCardStatItem}>
                          <Text style={styles.snsCardStatValue}>{histogram.contrast}%</Text>
                          <Text style={styles.snsCardStatLabel}>Contrast</Text>
                        </View>
                        <View style={styles.snsCardStatDivider} />
                        <View style={styles.snsCardStatItem}>
                          <Text style={styles.snsCardStatValue}>{processedColors.length}</Text>
                          <Text style={styles.snsCardStatLabel}>Colors</Text>
                        </View>
                        <View style={styles.snsCardStatDivider} />
                        <View style={styles.snsCardStatItem}>
                          <Text style={styles.snsCardStatValue}>{histogram.average}</Text>
                          <Text style={styles.snsCardStatLabel}>Avg Lum</Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.snsCardWatermark}>
                      <Text style={styles.snsCardWatermarkText}>Pixel Paw 🐾</Text>
                    </View>
                  </View>
                </ViewShot>
              )}

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
                      {`Share to ${snsCardType === 'instagram' ? 'Instagram' : 'Twitter'}`}
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

      {/* Advanced Settings Bottom Sheet */}
      <Modal
        visible={showAdvanced}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdvanced(false)}
      >
        <View style={[styles.advancedOverlay, { backgroundColor: theme.modalOverlay }]}>
          <TouchableOpacity
            style={styles.advancedBackground}
            onPress={() => setShowAdvanced(false)}
          />
          <View style={[styles.advancedContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.advancedHandle, { backgroundColor: theme.border }]} />
            <View style={styles.advancedHeader}>
              <Text style={[styles.advancedTitle, { color: theme.textPrimary }]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowAdvanced(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.advancedScroll}>
              {/* Style Preset */}
              <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>Style Preset</Text>
              <View style={styles.advancedPresetRow}>
                {STYLE_FILTER_KEYS.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.advancedPresetButton,
                      {
                        backgroundColor: styleFilter === filter ? theme.accent : theme.backgroundTertiary,
                      },
                    ]}
                    onPress={() => {
                      hapticLight();
                      setStyleFilter(filter);
                    }}
                  >
                    <Ionicons
                      name={STYLE_PRESETS[filter].icon as any}
                      size={18}
                      color={styleFilter === filter ? '#fff' : STYLE_PRESETS[filter].color}
                    />
                    <Text style={[styles.advancedPresetText, { color: styleFilter === filter ? '#fff' : theme.textSecondary }]}>
                      {STYLE_PRESETS[filter].name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Extraction Method */}
              <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>Extraction Method</Text>
              <View style={styles.advancedMethodRow}>
                <TouchableOpacity
                  style={[
                    styles.advancedMethodButton,
                    { backgroundColor: extractionMethod === 'histogram' ? theme.accent : theme.backgroundTertiary },
                  ]}
                  onPress={() => {
                    hapticLight();
                    handleMethodChange('histogram');
                  }}
                >
                  <Text style={[styles.advancedMethodTitle, { color: extractionMethod === 'histogram' ? '#fff' : theme.textPrimary }]}>
                    Histogram
                  </Text>
                  <Text style={[styles.advancedMethodDesc, { color: extractionMethod === 'histogram' ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}>
                    Hue region-based (fast)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.advancedMethodButton,
                    { backgroundColor: extractionMethod === 'kmeans' ? theme.accent : theme.backgroundTertiary },
                  ]}
                  onPress={() => {
                    hapticLight();
                    handleMethodChange('kmeans');
                  }}
                >
                  <Text style={[styles.advancedMethodTitle, { color: extractionMethod === 'kmeans' ? '#fff' : theme.textPrimary }]}>
                    K-Means
                  </Text>
                  <Text style={[styles.advancedMethodDesc, { color: extractionMethod === 'kmeans' ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}>
                    Pixel clustering (accurate)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Color Count */}
              <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>Color Count</Text>
              <View style={[styles.advancedColorCount, { backgroundColor: theme.backgroundTertiary }]}>
                <TouchableOpacity
                  style={[styles.advancedStepperBtn, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => {
                    hapticLight();
                    const newCount = colorCount <= 3 ? 8 : colorCount - 1;
                    setColorCount(newCount);
                    if (currentImageUri) doExtract(currentImageUri, newCount, extractionMethod);
                  }}
                >
                  <Ionicons name="remove" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                <View style={[styles.advancedCountBadge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.advancedCountText}>{colorCount}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.advancedStepperBtn, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => {
                    hapticLight();
                    const newCount = colorCount >= 8 ? 3 : colorCount + 1;
                    setColorCount(newCount);
                    if (currentImageUri) doExtract(currentImageUri, newCount, extractionMethod);
                  }}
                >
                  <Ionicons name="add" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Value Check */}
              <View style={styles.advancedToggleRow}>
                <View>
                  <Text style={[styles.advancedToggleLabel, { color: theme.textPrimary }]}>Value Check</Text>
                  <Text style={[styles.advancedToggleDesc, { color: theme.textMuted }]}>Show grayscale values</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.advancedToggleButton,
                    { backgroundColor: showGrayscale ? '#34d399' : theme.backgroundTertiary },
                  ]}
                  onPress={() => {
                    hapticLight();
                    setShowGrayscale(!showGrayscale);
                  }}
                >
                  <Text style={[styles.advancedToggleButtonText, { color: showGrayscale ? '#fff' : theme.textMuted }]}>
                    {showGrayscale ? 'ON' : 'OFF'}
                  </Text>
                  {showGrayscale && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>
              </View>

              {/* CVD Simulation */}
              <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>Color Vision Simulation</Text>
              <View style={styles.advancedCvdGrid}>
                {COLOR_BLINDNESS_TYPES.map((cvd) => {
                  const isActive = colorBlindMode === cvd.type;
                  return (
                    <TouchableOpacity
                      key={cvd.type}
                      style={[
                        styles.advancedCvdCard,
                        {
                          backgroundColor: isActive
                            ? (cvd.type === 'none' ? theme.accent + '20' : '#f59e0b' + '20')
                            : theme.backgroundTertiary,
                          borderWidth: isActive ? 1.5 : 1,
                          borderColor: isActive
                            ? (cvd.type === 'none' ? theme.accent : '#f59e0b')
                            : theme.backgroundTertiary,
                        },
                      ]}
                      onPress={() => {
                        hapticLight();
                        setColorBlindMode(cvd.type);
                      }}
                    >
                      {/* Confused color pair dots */}
                      <View style={styles.cvdDotPair}>
                        <View style={[styles.cvdDot, { backgroundColor: cvd.confusedPair[0] }]} />
                        <View style={[styles.cvdDotSlash, { backgroundColor: theme.textMuted }]} />
                        <View style={[styles.cvdDot, { backgroundColor: cvd.confusedPair[1] }]} />
                      </View>
                      <Text
                        style={[
                          styles.advancedCvdLabel,
                          {
                            color: isActive
                              ? (cvd.type === 'none' ? theme.accent : '#f59e0b')
                              : theme.textPrimary,
                            fontWeight: isActive ? '700' : '600',
                          },
                        ]}
                      >
                        {cvd.label}
                      </Text>
                      <Text style={[styles.advancedCvdDesc, { color: theme.textMuted }]}>
                        {cvd.description}
                      </Text>
                      {isActive && <Ionicons name="checkmark-circle" size={14} color={cvd.type === 'none' ? theme.accent : '#f59e0b'} style={styles.cvdCheck} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Luminosity Histogram */}
              <Text style={[styles.advancedSectionLabel, { color: theme.textMuted, marginTop: 4 }]}>Luminosity</Text>
              {histogram ? (
                <View style={[styles.histogramCard, { marginHorizontal: 0 }]}>
                  <View style={styles.histogramHeader}>
                    <View style={styles.histogramTitleRow}>
                      <Ionicons name="analytics-outline" size={14} color="#888" />
                      <Text style={styles.histogramTitle}>HISTOGRAM</Text>
                    </View>
                    <View style={styles.histogramStats}>
                      <Text style={styles.histogramStatText}>{histogram.contrast}%</Text>
                      <Text style={styles.histogramContrastLabel}>contrast</Text>
                    </View>
                  </View>

                  <View style={styles.histogramBars}>
                    {histogram.bins.map((value, index) => (
                      <View key={index} style={styles.histogramBarWrapper}>
                        <View
                          style={[
                            styles.histogramBar,
                            {
                              height: `${Math.max(value, 2)}%`,
                              backgroundColor: index < 11 ? '#6a6a80' : index < 21 ? '#8a8aa0' : '#b0b0c8',
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
                </View>
              ) : (
                <View style={[styles.histogramCard, { marginHorizontal: 0, opacity: 0.4 }]}>
                  <View style={styles.histogramHeader}>
                    <View style={styles.histogramTitleRow}>
                      <Ionicons name="analytics-outline" size={14} color="#888" />
                      <Text style={styles.histogramTitle}>HISTOGRAM</Text>
                    </View>
                    <Text style={styles.histogramEmptyText}>Extract an image first</Text>
                  </View>
                </View>
              )}

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Info Modal */}
      <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.infoModalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.infoModalHeader}>
              <View style={[styles.infoModalIcon, { backgroundColor: theme.accent }]}>
                <Ionicons name="color-palette" size={28} color="#fff" />
              </View>
              <Text style={[styles.infoModalTitle, { color: theme.textPrimary }]}>Pixel Paw</Text>
              <Text style={[styles.infoModalVersion, { color: theme.textMuted }]}>Game Art Color Extractor</Text>
              <Text style={[styles.infoModalVersionNum, { color: theme.textMuted }]}>v1.0.0</Text>
            </View>

            <TouchableOpacity
              style={[styles.infoModalButton, { backgroundColor: theme.backgroundTertiary }]}
              onPress={() => {
                Linking.openURL('mailto:studio.aryeon@gmail.com?subject=Pixel Paw Feedback');
              }}
            >
              <Ionicons name="mail-outline" size={20} color={theme.accent} />
              <Text style={[styles.infoModalButtonText, { color: theme.textPrimary }]}>
                피드백 보내기
              </Text>
            </TouchableOpacity>

            <Text style={[styles.infoModalFooter, { color: theme.textMuted }]}>
              Made with 🤍 by Studio Aryeon
            </Text>

            <TouchableOpacity
              style={[styles.infoModalCloseButton, { backgroundColor: theme.accent }]}
              onPress={() => setShowInfo(false)}
            >
              <Text style={styles.infoModalCloseButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Inline Toast */}
      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastContent}>
            <Ionicons name="checkmark-circle" size={16} color="#34d399" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

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
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogoMark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  headerAccentLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
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
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#16161e',
    borderWidth: 1,
    borderColor: '#2a2a3a',
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
    height: 260,
    borderRadius: 20,
    backgroundColor: '#16161e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    overflow: 'hidden',
  },
  emptyDecoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyDecoDot: {
    position: 'absolute',
    borderRadius: 50,
    opacity: 0.5,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCardEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  imageCardEmptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 20,
  },
  imageSourceButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageSourceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#1e1e2a',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  imageSourceIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageSourceButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },

  // Style Filters - Icon Grid
  styleFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  styleFilterButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1a1a24',
    gap: 4,
    borderWidth: 1,
    borderColor: '#24242e',
  },
  styleFilterText: {
    fontSize: 11,
    color: '#a0a0b0',
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // CVD Simulation Row
  cvdRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  cvdLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    marginRight: 6,
  },
  cvdToggleGroup: {
    flex: 1,
    flexDirection: 'row' as const,
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 3,
  },
  cvdOption: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  cvdOptionText: {
    fontSize: 11,
    fontWeight: '600' as const,
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
    minHeight: 48,
    paddingVertical: 2,
  },
  colorCardSelected: {
    transform: [{ scale: 1.08 }],
  },
  colorSwatch: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2d2d38',
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 10,
  },
  cvdSplitOriginal: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '50%',
  },
  chipTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: 4,
  },
  chipRank: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  colorCardsEmpty: {
    opacity: 0.6,
  },
  colorSwatchEmpty: {
    backgroundColor: '#1a1a24',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Settings Row (2-row layout)
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 10,
  },
  settingsColumn: {
    flex: 1,
    gap: 4,
  },
  algorithmToggle: {
    flexDirection: 'row' as const,
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 3,
  },
  algorithmOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  algorithmOptionText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  algorithmDesc: {
    fontSize: 10,
    fontWeight: '500' as const,
    marginLeft: 6,
  },
  valueCheckButton: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 1,
  },
  valueCheckText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  valueCheckSubtext: {
    fontSize: 9,
    fontWeight: '500' as const,
  },
  settingsColorColumn: {
    alignItems: 'center' as const,
    gap: 4,
  },
  settingsColorStepper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  settingsDropdownLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  colorStepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  colorCountBadge: {
    width: 28,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  colorCountBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
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
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    minHeight: 44,
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
  inlineColorPreview: {
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  inlineColorPreviewValue: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  inlineColorCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  inlineColorCopyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  formatSegment: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  formatSegmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  formatSegmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Channel Bars
  channelBarsContainer: {
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelLabel: {
    fontSize: 12,
    fontWeight: '700',
    width: 14,
    textAlign: 'center',
  },
  channelBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  channelBarFill: {
    height: '100%',
    borderRadius: 5,
    opacity: 0.85,
  },
  channelValue: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
    width: 32,
    textAlign: 'right',
  },

  inlineVariationsSection: {
    marginTop: 0,
    borderRadius: 10,
    padding: 12,
  },

  // (Old extraction card styles removed - replaced by settingsRow)

  // Slider - Inline
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    color: '#a0a0b0',
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

  // Action Bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 36,
    backgroundColor: '#101018',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e1e2a',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#16161e',
    gap: 6,
    borderWidth: 1,
    borderColor: '#24242e',
  },
  actionButtonText: {
    color: '#a0a0b0',
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    gap: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#16161e',
    gap: 6,
    borderWidth: 1,
    borderColor: '#24242e',
  },
  exportButtonText: {
    color: '#6366f1',
    fontSize: 13,
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
    color: '#9090a0',
    width: 28,
  },
  colorValueCompactText: {
    flex: 1,
    fontSize: 12,
    color: '#fff',
    fontFamily: 'monospace',
  },
  // Modal Color Preview
  modalColorPreview: {
    height: 100,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalColorPreviewValue: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  modalColorCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modalColorCopyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalFormatSegment: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  modalFormatSegmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalFormatSegmentText: {
    fontSize: 13,
    fontWeight: '700',
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
  hueShiftOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9090a0',
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
    color: '#a0a0b0',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  variationLabel: {
    fontSize: 8,
    color: '#8888a0',
  },
  variationsHint: {
    fontSize: 10,
    color: '#9090a0',
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
  harmonyTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9090a0',
  },
  harmonyDescription: {
    fontSize: 11,
    color: '#a0a0b0',
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
    color: '#a0a0b0',
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
    color: '#8888a0',
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
    color: '#a0a0b0',
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
    color: '#8888a0',
  },
  paletteCardHistogramValue: {
    fontSize: 11,
    color: '#a0a0b0',
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
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#24242e',
    gap: 8,
    minHeight: 48,
  },
  snsTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0a0b0',
  },
  snsTypeRatio: {
    fontSize: 11,
    color: '#8888a0',
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#24242e',
    minHeight: 44,
    justifyContent: 'center',
  },
  cardOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9090a0',
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
    padding: 10,
  },
  snsCardImageWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },

  // Twitter unified card styles
  twitterUnifiedRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  twitterUnifiedImage: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  twitterUnifiedPalette: {
    flex: 3,
    flexDirection: 'row',
    gap: 3,
  },
  twitterUnifiedColorItem: {
    flex: 1,
    alignItems: 'center',
  },
  twitterUnifiedColorBar: {
    width: '100%',
    flex: 1,
    borderRadius: 5,
    marginBottom: 2,
  },
  twitterUnifiedColorHex: {
    fontSize: 6,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'monospace',
  },
  twitterUnifiedAnalysis: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  twitterUnifiedHistogram: {
    flex: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    padding: 5,
  },
  twitterUnifiedHistogramBars: {
    flexDirection: 'row',
    height: 22,
    alignItems: 'flex-end',
    gap: 1,
  },
  twitterUnifiedHistogramLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  twitterUnifiedStats: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  twitterUnifiedStatItem: {
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  twitterUnifiedStatValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  twitterUnifiedStatLabel: {
    fontSize: 6,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 1,
  },
  snsCardImage: {
    width: '100%',
    height: '100%',
  },
  snsCardPalette: {
    flexDirection: 'row',
    gap: 8,
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
  snsCardStatItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  snsCardStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  snsCardStatLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#24242e',
    gap: 6,
    minHeight: 44,
  },
  formatOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a0a0b0',
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
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#24242e',
    minHeight: 44,
  },
  quickCopyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a0a0b0',
  },

  // Histogram - Compact
  histogramCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#16161e',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e1e2a',
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
    color: '#9999aa',
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
    color: '#9999aa',
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
    backgroundColor: '#3a3a4a',
  },
  histogramEmptyText: {
    fontSize: 11,
    color: '#8888a0',
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
    color: '#9090a0',
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
    ...StyleSheet.absoluteFillObject,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraCloseButton: {
    marginTop: 10,
    marginLeft: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBottomControls: {
    alignItems: 'center',
    marginBottom: 30,
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

  // Info Modal
  infoModalContent: {
    width: SCREEN_WIDTH - 60,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  infoModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  infoModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoModalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  infoModalVersion: {
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  infoModalVersionNum: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.6,
  },
  infoModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  infoModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoModalFooter: {
    fontSize: 13,
    marginBottom: 20,
  },
  infoModalCloseButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoModalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Toast
  toastContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 22, 30, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#34d399' + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Settings Summary Bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  summaryChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  summaryChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryEditButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Advanced Settings Sheet
  advancedOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  advancedBackground: {
    flex: 1,
  },
  advancedContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  advancedHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  advancedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  advancedTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  advancedScroll: {
    maxHeight: 500,
  },
  advancedSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 4,
  },
  advancedPresetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  advancedPresetButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  advancedPresetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  advancedMethodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  advancedMethodButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 2,
  },
  advancedMethodTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  advancedMethodDesc: {
    fontSize: 11,
  },
  advancedColorCount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  advancedStepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  advancedCountBadge: {
    width: 44,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  advancedCountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  advancedToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  advancedToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  advancedToggleDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  advancedToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  advancedToggleButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  advancedCvdGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  advancedCvdCard: {
    width: '47%' as any,
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  cvdDotPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  cvdDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cvdDotSlash: {
    width: 1,
    height: 10,
    transform: [{ rotate: '20deg' }],
    opacity: 0.3,
  },
  advancedCvdLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  advancedCvdDesc: {
    fontSize: 10,
  },
  cvdCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
});
