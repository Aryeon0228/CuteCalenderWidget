import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../HomeScreen.styles';
import { ThemeColors } from '../../../store/themeStore';
import { ExtractionMethod } from '../../../lib/colorExtractor';
import { ColorBlindnessType, getColorBlindnessTypes, type AppLanguage } from '../../../lib/colorUtils';
import { StyleFilter, STYLE_FILTER_KEYS, STYLE_PRESETS } from '../../../constants/stylePresets';

interface AdvancedSettingsModalProps {
  visible: boolean;
  theme: ThemeColors;
  styleFilter: StyleFilter;
  onStyleFilterChange: (value: StyleFilter) => void;
  extractionMethod: ExtractionMethod;
  onMethodChange: (value: ExtractionMethod) => void;
  language: AppLanguage;
  colorCount: number;
  onColorCountChange: (value: number) => void;
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
  language,
  colorCount,
  onColorCountChange,
  colorBlindMode,
  onColorBlindModeChange,
  onClose,
  onHapticLight,
}: AdvancedSettingsModalProps) {
  const presetIcons: Record<StyleFilter, string> = {
    original: 'ellipse-outline',
    hypercasual: 'sparkles-outline',
    stylized: 'brush-outline',
    realistic: 'eye-outline',
  };
  const methodAccentColors: Record<ExtractionMethod, string> = {
    histogram: '#38bdf8',
    kmeans: '#fb923c',
  };
  const methodDescriptions: Record<ExtractionMethod, string> = {
    histogram: language === 'ko' ? '색조 구간 기반 (빠름)' : 'Hue region-based (fast)',
    kmeans: language === 'ko' ? '픽셀 군집화 (정확)' : 'Pixel clustering (accurate)',
  };
  const colorVisionTitle = language === 'ko' ? '색각 시뮬레이션' : 'Color Vision Simulation';
  const cvdOptions = getColorBlindnessTypes(language);

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
          onPress={() => {
            onHapticLight();
            onClose();
          }}
        />
        <View style={[styles.advancedContent, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={[styles.advancedHandle, { backgroundColor: theme.border }]} />
          <View style={styles.advancedHeader}>
            <Text style={[styles.advancedTitle, { color: theme.textPrimary }]}>Settings</Text>
            <TouchableOpacity
              onPress={() => {
                onHapticLight();
                onClose();
              }}
            >
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
                      backgroundColor: styleFilter === filter ? STYLE_PRESETS[filter].color : theme.backgroundTertiary,
                    },
                  ]}
                  onPress={() => {
                    onHapticLight();
                    onStyleFilterChange(filter);
                  }}
                >
                  <View style={styles.advancedPresetInline}>
                    <Ionicons
                      name={presetIcons[filter] as any}
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

            {/* Extraction Method */}
            <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>Extraction Method</Text>
            <View style={styles.advancedMethodRow}>
              <TouchableOpacity
                style={[
                  styles.advancedMethodButton,
                  { backgroundColor: extractionMethod === 'histogram' ? methodAccentColors.histogram : theme.backgroundTertiary },
                ]}
                onPress={() => {
                  onHapticLight();
                  onMethodChange('histogram');
                }}
              >
                <Text style={[styles.advancedMethodTitle, { color: extractionMethod === 'histogram' ? '#fff' : theme.textPrimary }]}>
                  Histogram
                </Text>
                <Text style={[styles.advancedMethodDesc, { color: extractionMethod === 'histogram' ? 'rgba(255,255,255,0.78)' : theme.textMuted }]}>
                  {methodDescriptions.histogram}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.advancedMethodButton,
                  { backgroundColor: extractionMethod === 'kmeans' ? methodAccentColors.kmeans : theme.backgroundTertiary },
                ]}
                onPress={() => {
                  onHapticLight();
                  onMethodChange('kmeans');
                }}
              >
                <Text style={[styles.advancedMethodTitle, { color: extractionMethod === 'kmeans' ? '#fff' : theme.textPrimary }]}>
                  K-Means
                </Text>
                <Text style={[styles.advancedMethodDesc, { color: extractionMethod === 'kmeans' ? 'rgba(255,255,255,0.78)' : theme.textMuted }]}>
                  {methodDescriptions.kmeans}
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

            {/* CVD Simulation */}
            <Text style={[styles.advancedSectionLabel, { color: theme.textMuted }]}>{colorVisionTitle}</Text>
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
                      onHapticLight();
                      onColorBlindModeChange(cvd.type);
                    }}
                  >
                    {/* Confused color pair bars */}
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

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
