import React from 'react';
import { View, Text, TouchableOpacity, Modal, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { styles } from '../HomeScreen.styles';
import { ThemeColors } from '../../../store/themeStore';
import { type AppLanguage } from '../../../lib/colorUtils';

interface InfoModalProps {
  visible: boolean;
  theme: ThemeColors;
  language: AppLanguage;
  onLanguageChange: (value: AppLanguage) => void;
  onClose: () => void;
  onHapticLight: () => void;
}

export default function InfoModal({
  visible,
  theme,
  language,
  onLanguageChange,
  onClose,
  onHapticLight,
}: InfoModalProps) {
  const appVersion = Constants.expoConfig?.version ?? '1.1.0';
  const languageLabel = language === 'ko' ? '언어' : 'Language';
  const closeLabel = language === 'ko' ? '닫기' : 'Close';
  const feedbackLabel = language === 'ko' ? '피드백 보내기' : 'Send Feedback';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
        <View style={[styles.infoModalContent, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.infoModalHeader}>
            <View style={[styles.headerLogoMark, { marginBottom: 16 }]}>
              <Image
                source={require('../../../../assets/pow-header.png')}
                style={styles.headerLogoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.infoModalTitle, { color: theme.textPrimary }]}>Pixel Paw</Text>
            <Text style={[styles.infoModalVersion, { color: theme.textMuted }]}>Game Art Color Extractor</Text>
            <Text style={[styles.infoModalVersionNum, { color: theme.textMuted }]}>v{appVersion}</Text>
          </View>

          <TouchableOpacity
            style={[styles.infoModalButton, { backgroundColor: theme.backgroundTertiary }]}
            onPress={() => {
              onHapticLight();
              Linking.openURL('mailto:studio.aryeon@gmail.com?subject=Pixel Paw Feedback');
            }}
          >
            <Ionicons name="mail-outline" size={20} color={theme.accent} />
            <Text style={[styles.infoModalButtonText, { color: theme.textPrimary }]}>
              {feedbackLabel}
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.advancedSectionLabel,
              { color: theme.textMuted, width: '100%', marginTop: 0, marginBottom: 10 },
            ]}
          >
            {languageLabel}
          </Text>
          <View style={[styles.advancedPresetRow, { width: '100%', marginBottom: 20 }]}>
            <TouchableOpacity
              style={[
                styles.advancedPresetButton,
                {
                  backgroundColor: language === 'ko' ? theme.accent : theme.backgroundTertiary,
                },
              ]}
              onPress={() => {
                onHapticLight();
                onLanguageChange('ko');
              }}
            >
              <Text style={[styles.advancedPresetText, { color: language === 'ko' ? '#fff' : theme.textSecondary }]}>
                한국어
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.advancedPresetButton,
                {
                  backgroundColor: language === 'en' ? theme.accent : theme.backgroundTertiary,
                },
              ]}
              onPress={() => {
                onHapticLight();
                onLanguageChange('en');
              }}
            >
              <Text style={[styles.advancedPresetText, { color: language === 'en' ? '#fff' : theme.textSecondary }]}>
                English
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.infoModalFooter, { color: theme.textMuted }]}>
            Made with 🤍 by Studio Aryeon
          </Text>

          <TouchableOpacity
            style={[styles.infoModalCloseButton, { backgroundColor: theme.accent }]}
            onPress={() => {
              onHapticLight();
              onClose();
            }}
          >
            <Text style={styles.infoModalCloseButtonText}>{closeLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
