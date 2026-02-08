import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from './HomeScreen.styles';
import { ThemeColors, ThemeMode } from '../../store/themeStore';

interface HomeHeaderProps {
  theme: ThemeColors;
  mode: ThemeMode;
  onToggleTheme: () => void;
  onShowInfo: () => void;
}

export default function HomeHeader({
  theme,
  mode,
  onToggleTheme,
  onShowInfo,
}: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.headerLogoMark}>
          <Ionicons name="paw" size={20} color="#fff" />
        </View>
        <View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Pixel Paw</Text>
          <View style={styles.headerSubtitleRow}>
            <View style={[styles.headerAccentLine, { backgroundColor: theme.accent }]} />
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Color Extractor</Text>
          </View>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={[
            styles.headerButton,
            { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight, borderWidth: 1 },
          ]}
          onPress={onToggleTheme}
        >
          <Ionicons
            name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.headerButton,
            { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight, borderWidth: 1 },
          ]}
          onPress={onShowInfo}
        >
          <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
