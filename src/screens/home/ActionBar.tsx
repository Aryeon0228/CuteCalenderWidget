import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from './HomeScreen.styles';
import { ThemeColors } from '../../store/themeStore';

interface ActionBarProps {
  theme: ThemeColors;
  onNavigateToLibrary: () => void;
  onSave: () => void;
  onExport: () => void;
}

export default function ActionBar({
  theme,
  onNavigateToLibrary,
  onSave,
  onExport,
}: ActionBarProps) {
  return (
    <View style={[styles.actionBar, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.border }]}
    >
      <TouchableOpacity style={styles.actionButton} onPress={onNavigateToLibrary}>
        <Ionicons name="library-outline" size={22} color={theme.textSecondary} />
        <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>Library</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={onSave}>
        <Ionicons name="download-outline" size={20} color="#fff" />
        <Text style={styles.saveButtonText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.exportButton} onPress={onExport}>
        <Ionicons name="share-outline" size={22} color="#fff" />
        <Text style={styles.exportButtonText}>Export</Text>
      </TouchableOpacity>
    </View>
  );
}
