import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../HomeScreen.styles';
import { ThemeColors } from '../../../store/themeStore';
import { ExtractionMethod } from '../../../lib/colorExtractor';
import { ColorBlindnessType, COLOR_BLINDNESS_TYPES } from '../../../lib/colorUtils';
import { StyleFilter, STYLE_FILTER_KEYS, STYLE_PRESETS } from '../../../constants/stylePresets';

interface AdvancedSettingsModalProps {
  visible: boolean;
  theme: ThemeColors;
  styleFilter: StyleFilter;
  onStyleFilterChange: (value: StyleFilter) => void;
  extractionMethod: ExtractionMethod;
  onMethodChange: (value: ExtractionMethod) => void;
  colorCount: number;
  onColorCountChange: (value: number) => void;
  showGrayscale: boolean;
  onShowGrayscaleChange: (value: boolean) => void;
  colorBlindMode: ColorBlindnessType;
  onColorBlindModeChange: (value: ColorBlindnessType) => void;
  onClose: () => void;
  onHapticLight: () => void;
}

export default function AdvancedSettingsModal({
  visible,
  theme,
  styleFilter,
  onStyleFilterChange,
  extractionMethod,
  onMethodChange,
  colorCount,
  onColorCountChange,
  showGrayscale,
  onShowGrayscaleChange,
  colorBlindMode,
  onColorBlindModeChange,
  onClose,
  onHapticLight,
}: AdvancedSettingsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.advancedOverlay, { backgroundColor: theme.modalOverlay }]}>
        <TouchableOpacity
          style={styles.advancedBackground}
          onPress={onClose}
        />
        <View style={[styles.advancedContent, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={[styles.advancedHandle, { backgroundColor: theme.border }]} />
          <View style={styles.advancedHeader}>
            <Text style={[styles.advancedTitle, { color: theme.textPrimary }]}>Settings</Text>
            <TouchableOpacity onPress={onClose}>
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
                    onHapticLight();
                    onStyleFilterChange(filter);
                  }}
                >
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
                  onHapticLight();
                  onMethodChange('histogram');
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
                  onHapticLight();
                  onMethodChange('kmeans');
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
            <View style={[styles.advancedColorCount, { backgroundColor: theme.backgroundTertiary }]}
            >
              <TouchableOpacity
                style={[styles.advancedStepperBtn, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => {
                  onHapticLight();
                  const newCount = colorCount <= 3 ? 8 : colorCount - 1;
                  onColorCountChange(newCount);
                }}
              >
                <Ionicons name="remove" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.advancedCountBadge, { backgroundColor: theme.accent }]}
              >
                <Text style={styles.advancedCountText}>{colorCount}</Text>
              </View>
              <TouchableOpacity
                style={[styles.advancedStepperBtn, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => {
                  onHapticLight();
                  const newCount = colorCount >= 8 ? 3 : colorCount + 1;
                  onColorCountChange(newCount);
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
                  onHapticLight();
                  onShowGrayscaleChange(!showGrayscale);
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
                      onHapticLight();
                      onColorBlindModeChange(cvd.type);
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

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
