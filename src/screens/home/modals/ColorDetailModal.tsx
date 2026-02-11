import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../HomeScreen.styles';
import { ThemeColors } from '../../../store/themeStore';
import {
  FORMAT_ACCENT_COLORS,
  VARIATION_TOGGLE_COLORS,
  UNIFIED_EMPHASIS,
} from '../../../constants/uiEmphasis';
import {
  generateColorVariations,
  generateColorHarmonies,
  getLuminance,
  type AppLanguage,
  type ColorInfo,
  type HarmonyType,
} from '../../../lib/colorUtils';

interface ColorDetailModalProps {
  visible: boolean;
  theme: ThemeColors;
  colorInfo: ColorInfo | null;
  colorFormat: 'HEX' | 'RGB' | 'HSL';
  onFormatChange: (format: 'HEX' | 'RGB' | 'HSL') => void;
  onClose: () => void;
  getFormattedColor: (info: ColorInfo, format: 'HEX' | 'RGB' | 'HSL') => string;
  copyColor: (value: string, label?: string) => void;
  variationHueShift: boolean;
  onVariationHueShiftChange: (value: boolean) => void;
  selectedHarmony: HarmonyType;
  onHarmonyChange: (value: HarmonyType) => void;
  language: AppLanguage;
  onHapticLight: () => void;
}

export default function ColorDetailModal({
  visible,
  theme,
  colorInfo,
  colorFormat,
  onFormatChange,
  onClose,
  getFormattedColor,
  copyColor,
  variationHueShift,
  onVariationHueShiftChange,
  selectedHarmony,
  onHarmonyChange,
  language,
  onHapticLight,
}: ColorDetailModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.colorDetailOverlay, { backgroundColor: theme.modalOverlay }]}>
        <TouchableOpacity
          style={styles.colorDetailBackground}
          onPress={onClose}
        />
        <View style={[styles.colorDetailContent, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={[styles.colorDetailHandle, { backgroundColor: theme.border }]} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {colorInfo && (
              <>
                {/* Color Preview + Copy */}
                <View style={[styles.modalColorPreview, { backgroundColor: colorInfo.hex }]}
                >
                  <Text
                    style={[
                      styles.modalColorPreviewValue,
                      { color: getLuminance(colorInfo.hex) > 140 ? '#000' : '#fff' },
                    ]}
                  >
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
                <View style={[styles.modalFormatSegment, { backgroundColor: theme.backgroundTertiary }]}
                >
                  {(['HEX', 'RGB', 'HSL'] as const).map((fmt) => (
                    <TouchableOpacity
                      key={fmt}
                      style={[
                        styles.modalFormatSegmentButton,
                        colorFormat === fmt && { backgroundColor: FORMAT_ACCENT_COLORS[fmt] },
                      ]}
                      onPress={() => onFormatChange(fmt)}
                    >
                      <Text
                        style={[
                          styles.modalFormatSegmentText,
                          { color: colorFormat === fmt ? '#fff' : theme.textMuted },
                        ]}
                      >
                        {fmt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Variations */}
                <View style={[styles.variationsSection, { backgroundColor: theme.backgroundTertiary }]}>
                  <View style={styles.variationsHeader}>
                    <Text style={[styles.variationsSectionTitle, { color: theme.textPrimary }]}>Variations</Text>
                    <View style={[styles.hueShiftToggle, { backgroundColor: theme.backgroundSecondary }]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.hueShiftOption,
                          !variationHueShift && { backgroundColor: VARIATION_TOGGLE_COLORS.lightness },
                        ]}
                        onPress={() => onVariationHueShiftChange(false)}
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
                        onPress={() => onVariationHueShiftChange(true)}
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
                        <Text style={[styles.variationHex, { color: theme.textMuted }]}>{v.hex}</Text>
                      </TouchableOpacity>
                    ))}
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
                    {generateColorHarmonies(colorInfo.hex, language).map((harmony) => (
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
                          onHapticLight();
                          onHarmonyChange(harmony.type);
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
                    const harmonies = generateColorHarmonies(colorInfo.hex, language);
                    const currentHarmony = harmonies.find((h) => h.type === selectedHarmony);
                    if (!currentHarmony) return null;

                    return (
                      <>
                        <Text style={[styles.harmonyDesc, { color: theme.textMuted }]}>
                          {currentHarmony.description}
                          {currentHarmony.colors.length > 1 &&
                            ` (${currentHarmony.colors.map((c) => c.angle + '°').join(', ')})`}
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
  );
}
