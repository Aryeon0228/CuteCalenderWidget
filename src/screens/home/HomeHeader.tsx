import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from './HomeScreen.styles';
import { ThemeColors } from '../../store/themeStore';

interface HomeHeaderProps {
  theme: ThemeColors;
  onShowInfo: () => void;
  onHapticLight: () => void;
}

export default function HomeHeader({
  theme,
  onShowInfo,
  onHapticLight,
}: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.headerLogoMark}>
          <Image
            source={require('../../../assets/pow-header.png')}
            style={styles.headerLogoImage}
            resizeMode="contain"
          />
        </View>
        <View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Pixel Paw</Text>
          <View style={styles.headerSubtitleRow}>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Color Extractor</Text>
            <Text style={styles.headerSubtitlePaw}>🐾</Text>
          </View>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={[
            styles.headerButton,
            { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight, borderWidth: 1 },
          ]}
          onPress={() => {
            onHapticLight();
            onShowInfo();
          }}
        >
          <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
