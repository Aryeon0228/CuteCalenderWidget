import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActionSheetIOS,
  Platform,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type ViewShot from 'react-native-view-shot';

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
  rgbToHex,
  hslToRgb,
  toGrayscale,
  getLuminance,
  adjustColor,
  generateColorVariations,
  generateColorHarmonies,
  getColorBlindnessTypes,
  HarmonyType,
  simulateColorBlindness,
  ColorBlindnessType,
  type AppLanguage,
  type ColorInfo,
} from '../lib/colorUtils';
import { StyleFilter, STYLE_FILTER_KEYS, STYLE_PRESETS } from '../constants/stylePresets';
import {
  FORMAT_ACCENT_COLORS,
  VARIATION_TOGGLE_COLORS,
  UNIFIED_EMPHASIS,
} from '../constants/uiEmphasis';
import { styles } from './home/HomeScreen.styles';
import HomeHeader from './home/HomeHeader';
import ImageCard from './home/ImageCard';
import ActionBar from './home/ActionBar';
import ColorDetailModal from './home/modals/ColorDetailModal';
import SavePaletteModal from './home/modals/SavePaletteModal';
import ExportModal from './home/modals/ExportModal';
import InfoModal from './home/modals/InfoModal';

// ============================================
// TYPES
// ============================================

interface HomeScreenProps {
  onNavigateToLibrary: () => void;
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
  const [appLanguage, setAppLanguage] = useState<AppLanguage>('ko');

  // Histogram State
  const [histogram, setHistogram] = useState<LuminosityHistogram | null>(null);


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
  const [hasSeenColorTapHint, setHasSeenColorTapHint] = useState(false);

  // Theme & Store
  const { colors: theme } = useThemeStore();
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

  const colorHarmonies = useMemo(
    () => (colorInfo ? generateColorHarmonies(colorInfo.hex, appLanguage) : []),
    [appLanguage, colorInfo]
  );

  const currentHarmony = useMemo(
    () =>
      colorHarmonies.find((harmony) => harmony.type === selectedHarmony) ??
      colorHarmonies[0] ??
      null,
    [colorHarmonies, selectedHarmony]
  );

  const isKorean = appLanguage === 'ko';
  const cvdOptions = useMemo(() => getColorBlindnessTypes(appLanguage), [appLanguage]);
  const cvdChipLabel = useMemo(() => {
    if (colorBlindMode === 'none') return '';
    return cvdOptions.find((option) => option.type === colorBlindMode)?.label ?? '';
  }, [colorBlindMode, cvdOptions]);
  const kmeansAccentColor = '#f43f5e';
  const styleChipColor = STYLE_PRESETS[styleFilter].color;
  const methodChipColor = extractionMethod === 'histogram' ? '#38bdf8' : kmeansAccentColor;
  const countChipColor = '#a78bfa';
  const methodDescriptions: Record<ExtractionMethod, string> = isKorean
    ? {
      histogram: '색/밝기 분포 기반 대표색 추출',
      kmeans: '대표색 K개 추출',
    }
    : {
      histogram: 'Distribution-based dominant colors',
      kmeans: 'K dominant colors extraction',
    };

  const getFormattedColor = (info: ColorInfo, format: 'HEX' | 'RGB' | 'HSL'): string => {
    switch (format) {
      case 'HEX': return info.hex.toUpperCase();
      case 'RGB': return `RGB(${info.rgb.r}, ${info.rgb.g}, ${info.rgb.b})`;
      case 'HSL': return `HSL(${info.hsl.h}, ${info.hsl.s}%, ${info.hsl.l}%)`;
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
    setHasSeenColorTapHint(true);
    if (showAdvanced) {
      setShowAdvanced(false);
    }
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
      <HomeHeader
        theme={theme}
        onShowInfo={() => setShowInfo(true)}
        onHapticLight={hapticLight}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
      >
        {/* Image Card */}
        <ImageCard
          currentImageUri={currentImageUri}
          showGrayscale={showGrayscale}
          theme={theme}
          isExtracting={isExtracting}
          onImagePress={showImageSourceOptions}
          onToggleGrayscale={() => {
            hapticLight();
            setShowGrayscale((prev) => !prev);
          }}
          onReExtractPress={() => {
            hapticLight();
            handleReExtract();
          }}
          onOpenCamera={() => {
            hapticLight();
            openCamera();
          }}
          onPickFromGallery={() => {
            hapticLight();
            pickFromGallery();
          }}
        />

        {/* ── Settings Summary Bar ── */}
        <View style={[styles.summaryBar, { backgroundColor: theme.backgroundCard }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.summaryChipsScroll}
          >
            <View style={[styles.summaryChip, { backgroundColor: styleChipColor + UNIFIED_EMPHASIS.chipBgAlpha, borderColor: styleChipColor + UNIFIED_EMPHASIS.chipBorderAlpha, borderWidth: 1 }]}>
              <Ionicons name={STYLE_PRESETS[styleFilter].icon as any} size={13} color={styleChipColor} />
              <Text style={[styles.summaryChipText, { color: styleChipColor }]}>{STYLE_PRESETS[styleFilter].name}</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: methodChipColor + UNIFIED_EMPHASIS.chipBgAlpha, borderColor: methodChipColor + UNIFIED_EMPHASIS.chipBorderAlpha, borderWidth: 1 }]}>
              <Ionicons name="flask-outline" size={13} color={methodChipColor} />
              <Text style={[styles.summaryChipText, { color: methodChipColor }]}>
                {extractionMethod === 'histogram' ? 'Histogram' : 'K-Means'}
              </Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: countChipColor + UNIFIED_EMPHASIS.chipBgAlpha, borderColor: countChipColor + UNIFIED_EMPHASIS.chipBorderAlpha, borderWidth: 1 }]}>
              <Ionicons name="color-palette-outline" size={13} color={countChipColor} />
              <Text style={[styles.summaryChipText, { color: countChipColor }]}>{colorCount}</Text>
            </View>
            {colorBlindMode !== 'none' && (
              <View style={[styles.summaryChip, { backgroundColor: UNIFIED_EMPHASIS.cvdBg, borderColor: UNIFIED_EMPHASIS.cvdBorder, borderWidth: 1 }]}>
                <Ionicons name="eye-outline" size={13} color={UNIFIED_EMPHASIS.cvdText} />
                <Text style={[styles.summaryChipText, { color: UNIFIED_EMPHASIS.cvdText }]}>{cvdChipLabel}</Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.summaryEditButton,
              { backgroundColor: showAdvanced ? theme.accent + '22' : theme.backgroundTertiary },
            ]}
            onPress={() => {
              hapticLight();
              setShowAdvanced((prev) => !prev);
            }}
          >
            <Ionicons
              name={showAdvanced ? 'chevron-up-outline' : 'options-outline'}
              size={16}
              color={showAdvanced ? theme.accent : theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Swatch affordance hint */}
        {processedColors.length > 0 && selectedColorIndex === null && !hasSeenColorTapHint && (
          <View style={[styles.swatchHintCard, { backgroundColor: theme.backgroundCard, borderColor: theme.borderLight }]}>
            <View style={[styles.swatchHintIcon, { backgroundColor: theme.accent + '22' }]}>
              <Ionicons name="hand-left-outline" size={15} color={theme.accent} />
            </View>
            <View style={styles.swatchHintTextWrap}>
              <Text style={[styles.swatchHintTitle, { color: theme.textPrimary }]}>
                {isKorean ? '팔레트 색상을 탭해보세요' : 'Tap a palette swatch'}
              </Text>
              <Text style={[styles.swatchHintSubtitle, { color: theme.textMuted }]}>
                {isKorean
                  ? '상세값, Variations, Harmony가 바로 열려요.'
                  : 'Open details, variations, and harmony instantly.'}
              </Text>
            </View>
          </View>
        )}

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
              const hintColors = ['#4f6d8c', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#fb923c', '#a78bfa', '#f87171'];
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

        {/* Inline settings panel (keeps palette visible while editing) */}
        {showAdvanced && (
          <View style={[styles.inlineSettingsPanel, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
            <View style={styles.inlineSettingsHeaderRow}>
              <View>
                <Text style={[styles.inlineSettingsTitle, { color: theme.textPrimary }]}>Setting</Text>
              </View>
              <TouchableOpacity
                style={[styles.inlineSettingsCloseBtn, { backgroundColor: theme.backgroundTertiary }]}
                onPress={() => {
                  hapticLight();
                  setShowAdvanced(false);
                }}
              >
                <Ionicons name="chevron-up" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>
              Style Preset
            </Text>
            <View style={styles.advancedPresetRow}>
              {STYLE_FILTER_KEYS.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.advancedPresetButton,
                    {
                      backgroundColor: styleFilter === filter ? STYLE_PRESETS[filter].color : theme.backgroundTertiary,
                    },
                  ]}
                  onPress={() => {
                    hapticLight();
                    setStyleFilter(filter);
                  }}
                >
                  <View style={styles.advancedPresetInline}>
                    <Ionicons
                      name={STYLE_PRESETS[filter].icon as any}
                      size={14}
                      color={styleFilter === filter ? '#fff' : STYLE_PRESETS[filter].color}
                    />
                    <Text style={[styles.advancedPresetText, { color: styleFilter === filter ? '#fff' : STYLE_PRESETS[filter].color }]}>
                      {STYLE_PRESETS[filter].name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>
              Extraction Method
            </Text>
            <View style={styles.advancedMethodRow}>
              <TouchableOpacity
                style={[
                  styles.advancedMethodButton,
                  { backgroundColor: extractionMethod === 'histogram' ? '#38bdf8' : theme.backgroundTertiary },
                ]}
                onPress={() => {
                  hapticLight();
                  handleMethodChange('histogram');
                }}
              >
                <Text style={[styles.advancedMethodTitle, { color: extractionMethod === 'histogram' ? '#fff' : theme.textPrimary }]}>
                  Histogram
                </Text>
                <Text style={[styles.advancedMethodDesc, { color: extractionMethod === 'histogram' ? 'rgba(255,255,255,0.8)' : theme.textMuted }]}>
                  {methodDescriptions.histogram}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.advancedMethodButton,
                  { backgroundColor: extractionMethod === 'kmeans' ? kmeansAccentColor : theme.backgroundTertiary },
                ]}
                onPress={() => {
                  hapticLight();
                  handleMethodChange('kmeans');
                }}
              >
                <Text style={[styles.advancedMethodTitle, { color: extractionMethod === 'kmeans' ? '#fff' : theme.textPrimary }]}>
                  K-Means
                </Text>
                <Text style={[styles.advancedMethodDesc, { color: extractionMethod === 'kmeans' ? 'rgba(255,255,255,0.8)' : theme.textMuted }]}>
                  {methodDescriptions.kmeans}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>
              Color Count
            </Text>
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

            <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>
              Color Vision
            </Text>
            <View style={styles.advancedCvdGrid}>
              {cvdOptions.map((cvd) => {
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
                    <View style={styles.cvdBarPair}>
                      <View style={[styles.cvdBar, { backgroundColor: cvd.confusedPair[0] }]} />
                      <View style={[styles.cvdBarSlash, { backgroundColor: theme.textMuted }]} />
                      <View style={[styles.cvdBar, { backgroundColor: cvd.confusedPair[1] }]} />
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
                    {isActive && (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={cvd.type === 'none' ? theme.accent : '#f59e0b'}
                        style={styles.cvdCheck}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Empty workspace guide */}
        {!currentImageUri && processedColors.length === 0 && (
          <View style={[styles.emptyGuideCard, { backgroundColor: theme.backgroundCard, borderColor: theme.borderLight }]}>
            <Text style={[styles.emptyGuideTitle, { color: theme.textPrimary }]}>
              {isKorean ? '메인 화면 가이드' : 'Main Screen Guide'}
            </Text>
            <View style={styles.emptyGuideRows}>
              <View style={styles.emptyGuideRow}>
                <Ionicons name="image-outline" size={14} color={theme.accent} />
                <Text style={[styles.emptyGuideText, { color: theme.textMuted }]}>
                  {isKorean ? '카메라/갤러리로 이미지를 추가하세요.' : 'Add artwork from camera or gallery.'}
                </Text>
              </View>
              <View style={styles.emptyGuideRow}>
                <Ionicons name="options-outline" size={14} color={theme.accent} />
                <Text style={[styles.emptyGuideText, { color: theme.textMuted }]}>
                  {isKorean ? '요약 바 우측 버튼으로 설정을 펼칠 수 있어요.' : 'Use the right summary button to expand settings.'}
                </Text>
              </View>
              <View style={styles.emptyGuideRow}>
                <Ionicons name="hand-left-outline" size={14} color={theme.accent} />
                <Text style={[styles.emptyGuideText, { color: theme.textMuted }]}>
                  {isKorean ? '추출된 색상 칩은 탭하면 상세 설명이 열립니다.' : 'Tap extracted swatches to open detailed info.'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Inline Color Detail */}
        {colorInfo && selectedColorIndex !== null && (
          <View style={[styles.inlineColorDetail, { backgroundColor: theme.backgroundCard, borderColor: colorInfo.hex + '60', borderWidth: 1.5 }]}>
            {/* Color Preview + Value + Copy + Channel Bars */}
            {(() => {
              const isLight = getLuminance(colorInfo.hex) > 140;
              const fgColor = isLight ? '#000' : '#fff';
              const fgMuted = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
              const shadowColor = isLight ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
              const trackBg = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.25)';
              const copyBg = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.3)';
              return (
              <View style={[styles.inlineColorPreview, { backgroundColor: colorInfo.hex }]}>
                <View style={styles.previewTopRow}>
                  <Text style={[styles.inlineColorPreviewValue, { color: fgColor }]}>
                    {getFormattedColor(colorInfo, colorFormat)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.inlineColorCopyButton, { backgroundColor: copyBg }]}
                    onPress={() => copyColor(getFormattedColor(colorInfo, colorFormat), colorFormat)}
                  >
                    <Ionicons name="copy-outline" size={16} color={fgColor} />
                    <Text style={[styles.inlineColorCopyText, { color: fgColor }]}>Copy</Text>
                  </TouchableOpacity>
                </View>

                {/* Fixed-height channel section: keep HEX/RGB/HSL card height stable */}
                <View style={styles.previewChannelContainer}>
                  {colorFormat === 'RGB' && (
                    <View style={styles.previewChannelBars}>
                      {[
                        { label: 'R', value: colorInfo.rgb.r, max: 255, color: '#ef4444', display: `${colorInfo.rgb.r}` },
                        { label: 'G', value: colorInfo.rgb.g, max: 255, color: '#22c55e', display: `${colorInfo.rgb.g}` },
                        { label: 'B', value: colorInfo.rgb.b, max: 255, color: '#3b82f6', display: `${colorInfo.rgb.b}` },
                      ].map((ch) => (
                        <View key={ch.label} style={styles.previewChannelRow}>
                          <Text style={[styles.previewChannelLabel, { color: fgMuted, textShadowColor: shadowColor }]}>{ch.label}</Text>
                          <View style={[styles.previewChannelTrack, { backgroundColor: trackBg }]}>
                            <View style={[styles.previewChannelFill, { width: `${(ch.value / ch.max) * 100}%`, backgroundColor: ch.color }]} />
                          </View>
                          <Text style={[styles.previewChannelValue, { color: fgMuted, textShadowColor: shadowColor }]}>{ch.display}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                {colorFormat === 'HSL' && (() => {
                  const { h, s, l } = colorInfo.hsl;
                  const hueRgb = hslToRgb(h, 100, 50);
                  const hueHex = rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b);
                  const satRgb = hslToRgb(h, s, 50);
                  const satHex = rgbToHex(satRgb.r, satRgb.g, satRgb.b);
                  const lightnessGray = Math.round((l / 100) * 255);
                  const boostedGray = lightnessGray < 128
                    ? Math.max(0, lightnessGray - 35)
                    : Math.min(255, lightnessGray + 35);
                  const lightnessHex = rgbToHex(boostedGray, boostedGray, boostedGray);
                  const lightnessBorder = boostedGray >= 180
                    ? 'rgba(0,0,0,0.32)'
                    : 'rgba(255,255,255,0.4)';
                  const hslTrackBg = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)';
                  const hslChannels: Array<{
                    label: string;
                    value: number;
                    max: number;
                    barColor: string;
                    display: string;
                    borderColor?: string;
                  }> = [
                    { label: 'H', value: h, max: 360, barColor: hueHex, display: `${h}°` },
                    { label: 'S', value: s, max: 100, barColor: satHex, display: `${s}%` },
                    { label: 'L', value: l, max: 100, barColor: lightnessHex, display: `${l}%`, borderColor: lightnessBorder },
                  ];
                  return (
                    <View style={styles.previewChannelBars}>
                      {hslChannels.map((ch) => (
                          <View key={ch.label} style={styles.previewChannelRow}>
                            <Text style={[styles.previewChannelLabel, { color: fgMuted, textShadowColor: shadowColor }]}>{ch.label}</Text>
                            <View style={[styles.previewChannelTrack, { backgroundColor: hslTrackBg }]}>
                              <View
                                style={[
                                  styles.previewChannelFill,
                                  {
                                    width: `${(ch.value / ch.max) * 100}%`,
                                    minWidth: ch.value > 0 ? 6 : 0,
                                    backgroundColor: ch.barColor,
                                  },
                                  ch.borderColor && { borderWidth: 1, borderColor: ch.borderColor },
                                ]}
                              />
                            </View>
                            <Text style={[styles.previewChannelValue, { color: fgMuted, textShadowColor: shadowColor }]}>{ch.display}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                  {colorFormat === 'HEX' && <View style={styles.previewChannelBarsPlaceholder} />}
                </View>
              </View>
              );
            })()}

            {/* Format Segment Toggle */}
            <View style={[styles.formatSegment, { backgroundColor: theme.backgroundTertiary }]}>
              {(['HEX', 'RGB', 'HSL'] as const).map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  style={[
                    styles.formatSegmentButton,
                    colorFormat === fmt && { backgroundColor: FORMAT_ACCENT_COLORS[fmt] },
                  ]}
                  onPress={() => {
                    hapticLight();
                    setColorFormat(fmt);
                  }}
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

            {/* Inline Variations */}
            <View style={[styles.inlineVariationsSection, { backgroundColor: theme.backgroundTertiary }]}>
              <View style={styles.variationsHeader}>
                <Text style={[styles.variationsSectionTitle, { color: theme.textPrimary }]}>Variations</Text>
                <View style={[styles.hueShiftToggle, { backgroundColor: theme.backgroundSecondary }]}>
                  <TouchableOpacity
                    style={[
                      styles.hueShiftOption,
                      !variationHueShift && { backgroundColor: VARIATION_TOGGLE_COLORS.lightness },
                    ]}
                    onPress={() => {
                      hapticLight();
                      setVariationHueShift(false);
                    }}
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
                      variationHueShift && { backgroundColor: VARIATION_TOGGLE_COLORS.hueShift },
                    ]}
                    onPress={() => {
                      hapticLight();
                      setVariationHueShift(true);
                    }}
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

            {/* Inline Harmony */}
            {currentHarmony && (
              <View
                style={[
                  styles.harmonySection,
                  {
                    backgroundColor: theme.backgroundTertiary,
                    marginTop: 10,
                    marginBottom: 0,
                    padding: 12,
                  },
                ]}
              >
                <Text style={[styles.harmonySectionTitle, { color: theme.textPrimary }]}>Harmony</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.harmonyTypesScroll}
                >
                  {colorHarmonies.map((harmony) => (
                    <TouchableOpacity
                      key={harmony.type}
                      style={[
                        styles.harmonyTypeButton,
                        {
                          backgroundColor:
                            selectedHarmony === harmony.type
                              ? UNIFIED_EMPHASIS.activeButtonBg
                              : theme.backgroundSecondary,
                        },
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

                <Text style={[styles.harmonyDesc, { color: theme.textMuted }]}>
                  {currentHarmony.description}
                  {currentHarmony.colors.length > 1 &&
                    ` (${currentHarmony.colors.map((color) => color.angle + '°').join(', ')})`}
                </Text>

                <View style={styles.harmonyColorsRow}>
                  {currentHarmony.colors.map((harmonyColor, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.harmonyColorItem}
                      onPress={() => copyColor(harmonyColor.hex.toUpperCase(), harmonyColor.name)}
                    >
                      <View
                        style={[
                          styles.harmonyColorSwatch,
                          { backgroundColor: harmonyColor.hex },
                          harmonyColor.name === 'Base' && styles.harmonyColorSwatchBase,
                        ]}
                      />
                      <Text style={[styles.harmonyColorHex, { color: theme.textMuted }]}>
                        {harmonyColor.hex.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Luminosity Histogram */}
        {histogram && currentImageUri && (
          <View style={[styles.histogramCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
            <View style={styles.histogramHeader}>
              <View style={styles.histogramTitleRow}>
                <Ionicons name="analytics-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.histogramTitle, { color: theme.textMuted }]}>LUMINOSITY</Text>
              </View>
              <View style={styles.histogramStats}>
                <Text style={[styles.histogramStatText, { color: theme.accent }]}>{histogram.contrast}%</Text>
                <Text style={[styles.histogramContrastLabel, { color: theme.textMuted }]}>contrast</Text>
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
              <View style={[styles.histogramStatItem, { backgroundColor: theme.backgroundTertiary, borderColor: theme.borderLight, borderWidth: 1 }]}>
                <Text style={[styles.histogramStatValue, { color: theme.textPrimary }]}>{histogram.darkPercent}%</Text>
                <Text style={[styles.histogramStatLabel, { color: theme.textSecondary }]}>Dark</Text>
              </View>
              <View style={[styles.histogramStatItem, { backgroundColor: theme.backgroundTertiary, borderColor: theme.borderLight, borderWidth: 1 }]}>
                <Text style={[styles.histogramStatValue, { color: theme.textPrimary }]}>{histogram.midPercent}%</Text>
                <Text style={[styles.histogramStatLabel, { color: theme.textSecondary }]}>Mid</Text>
              </View>
              <View style={[styles.histogramStatItem, { backgroundColor: theme.backgroundTertiary, borderColor: theme.borderLight, borderWidth: 1 }]}>
                <Text style={[styles.histogramStatValue, { color: theme.textPrimary }]}>{histogram.brightPercent}%</Text>
                <Text style={[styles.histogramStatLabel, { color: theme.textSecondary }]}>Bright</Text>
              </View>
              <View
                style={[
                  styles.histogramStatItem,
                  styles.histogramStatItemAvg,
                  { backgroundColor: theme.accent + '1a', borderColor: theme.accent + '44', borderWidth: 1 },
                ]}
              >
                <Text style={[styles.histogramStatValueAvg, { color: theme.accent }]}>{histogram.average}</Text>
                <Text style={[styles.histogramStatLabel, { color: theme.textSecondary }]}>Avg</Text>
              </View>
            </View>
          </View>
        )}

        {currentImageUri && <View style={{ height: 100 }} />}
      </ScrollView>

      <ActionBar
        theme={theme}
        onNavigateToLibrary={onNavigateToLibrary}
        onSave={handleSave}
        onExport={handleExport}
        onHapticLight={hapticLight}
      />

      <ColorDetailModal
        visible={showColorDetail && colorInfo !== null}
        theme={theme}
        colorInfo={colorInfo}
        colorFormat={colorFormat}
        onFormatChange={setColorFormat}
        onClose={() => setShowColorDetail(false)}
        getFormattedColor={getFormattedColor}
        copyColor={copyColor}
        variationHueShift={variationHueShift}
        onVariationHueShiftChange={setVariationHueShift}
        selectedHarmony={selectedHarmony}
        onHarmonyChange={setSelectedHarmony}
        language={appLanguage}
        onHapticLight={hapticLight}
      />

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

      <SavePaletteModal
        visible={showSaveModal}
        theme={theme}
        paletteName={paletteName}
        onPaletteNameChange={setPaletteName}
        onClose={() => setShowSaveModal(false)}
        onConfirm={confirmSave}
      />

      <ExportModal
        visible={showExportModal}
        theme={theme}
        snsCardType={snsCardType}
        onSnsCardTypeChange={setSnsCardType}
        cardShowHex={cardShowHex}
        onCardShowHexChange={setCardShowHex}
        cardShowStats={cardShowStats}
        onCardShowStatsChange={setCardShowStats}
        cardShowHistogram={cardShowHistogram}
        onCardShowHistogramChange={setCardShowHistogram}
        paletteCardRef={paletteCardRef}
        processedColors={processedColors}
        currentImageUri={currentImageUri}
        histogram={histogram}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        isExporting={isExporting}
        onExportConfirm={handleExportConfirm}
        onCopyToClipboard={copyToClipboard}
        onClose={() => setShowExportModal(false)}
        onHapticLight={hapticLight}
      />

      <InfoModal
        visible={showInfo}
        theme={theme}
        language={appLanguage}
        onLanguageChange={setAppLanguage}
        onClose={() => setShowInfo(false)}
        onHapticLight={hapticLight}
      />

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
