import React from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';

import { styles } from '../HomeScreen.styles';
import { ThemeColors } from '../../../store/themeStore';

interface SavePaletteModalProps {
  visible: boolean;
  theme: ThemeColors;
  paletteName: string;
  onPaletteNameChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SavePaletteModal({
  visible,
  theme,
  paletteName,
  onPaletteNameChange,
  onClose,
  onConfirm,
}: SavePaletteModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Save Palette</Text>
          <TextInput
            style={[
              styles.modalInput,
              { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary, borderColor: theme.border },
            ]}
            value={paletteName}
            onChangeText={onPaletteNameChange}
            placeholder="Auto: Palette YYYY-MM-DD_001"
            placeholderTextColor={theme.textMuted}
            autoFocus
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.buttonBg }]}
              onPress={onClose}
            >
              <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={onConfirm}
            >
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
