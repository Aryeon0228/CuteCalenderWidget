import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import ViewShot from 'react-native-view-shot';

import { styles } from '../HomeScreen.styles';
import { ThemeColors } from '../../../store/themeStore';
import { LuminosityHistogram } from '../../../lib/colorExtractor';

interface ExportModalProps {
  visible: boolean;
  theme: ThemeColors;
  snsCardType: 'instagram' | 'twitter';
  onSnsCardTypeChange: (value: 'instagram' | 'twitter') => void;
  cardShowHex: boolean;
  onCardShowHexChange: (value: boolean) => void;
  cardShowStats: boolean;
  onCardShowStatsChange: (value: boolean) => void;
  cardShowHistogram: boolean;
  onCardShowHistogramChange: (value: boolean) => void;
  paletteCardRef: React.RefObject<ViewShot | null>;
  processedColors: string[];
  currentImageUri: string | null;
  histogram: LuminosityHistogram | null;
  exportFormat: 'png' | 'json' | 'css';
  onExportFormatChange: (value: 'png' | 'json' | 'css') => void;
  isExporting: boolean;
  onExportConfirm: () => void;
  onCopyToClipboard: (format: string) => void;
  onClose: () => void;
  onHapticLight: () => void;
}

export default function ExportModal({
  visible,
  theme,
  snsCardType,
  onSnsCardTypeChange,
  cardShowHex,
  onCardShowHexChange,
  cardShowStats,
  onCardShowStatsChange,
  cardShowHistogram,
  onCardShowHistogramChange,
  paletteCardRef,
  processedColors,
  currentImageUri,
  histogram,
  exportFormat,
  onExportFormatChange,
  isExporting,
  onExportConfirm,
  onCopyToClipboard,
  onClose,
  onHapticLight,
}: ExportModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.exportModalOverlay, { backgroundColor: theme.modalOverlay }]}
      >
        <TouchableOpacity
          style={styles.exportModalBackground}
          onPress={onClose}
        />
        <View style={[styles.exportModalContent, { backgroundColor: theme.backgroundSecondary }]}
        >
          <View style={[styles.exportModalHandle, { backgroundColor: theme.border }]} />
          <View style={styles.exportModalHeader}>
            <Text style={[styles.exportModalTitle, { color: theme.textPrimary }]}>Export Palette</Text>
            <TouchableOpacity onPress={onClose}>
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
                  onHapticLight();
                  onSnsCardTypeChange('instagram');
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
                <Text style={[styles.snsTypeRatio, { color: snsCardType === 'instagram' ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}
                >
                  1:1
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.snsTypeButton,
                  { backgroundColor: snsCardType === 'twitter' ? theme.accent : theme.backgroundTertiary },
                ]}
                onPress={() => {
                  onHapticLight();
                  onSnsCardTypeChange('twitter');
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
                <Text style={[styles.snsTypeRatio, { color: snsCardType === 'twitter' ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}
                >
                  16:9
                </Text>
              </TouchableOpacity>
            </View>

            {/* Card Options */}
            <View style={styles.cardOptionsRow}>
              <TouchableOpacity
                style={[styles.cardOptionButton, { backgroundColor: cardShowHex ? theme.accent : theme.backgroundTertiary }]}
                onPress={() => onCardShowHexChange(!cardShowHex)}
              >
                <Text style={[styles.cardOptionText, { color: cardShowHex ? '#fff' : theme.textSecondary }]}>
                  HEX
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardOptionButton, { backgroundColor: cardShowStats ? theme.accent : theme.backgroundTertiary }]}
                onPress={() => onCardShowStatsChange(!cardShowStats)}
              >
                <Text style={[styles.cardOptionText, { color: cardShowStats ? '#fff' : theme.textSecondary }]}>
                  Stats
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardOptionButton, { backgroundColor: cardShowHistogram ? theme.accent : theme.backgroundTertiary }]}
                onPress={() => onCardShowHistogramChange(!cardShowHistogram)}
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
                    onPress={() => onExportFormatChange(format.id as 'png' | 'json' | 'css')}
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
              onPress={onExportConfirm}
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
                  onPress={() => onCopyToClipboard('text')}
                >
                  <Text style={[styles.quickCopyButtonText, { color: theme.textPrimary }]}>HEX</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickCopyButton, { backgroundColor: theme.backgroundTertiary }]}
                  onPress={() => onCopyToClipboard('json')}
                >
                  <Text style={[styles.quickCopyButtonText, { color: theme.textPrimary }]}>JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickCopyButton, { backgroundColor: theme.backgroundTertiary }]}
                  onPress={() => onCopyToClipboard('css')}
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
  );
}
