import React from 'react';
import { View, Text, TouchableOpacity, Modal, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../HomeScreen.styles';
import { ThemeColors } from '../../../store/themeStore';

interface InfoModalProps {
  visible: boolean;
  theme: ThemeColors;
  onClose: () => void;
}

export default function InfoModal({ visible, theme, onClose }: InfoModalProps) {
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
            onPress={onClose}
          >
            <Text style={styles.infoModalCloseButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
