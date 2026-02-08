import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Grayscale } from 'react-native-color-matrix-image-filters';

import { styles } from './HomeScreen.styles';
import { ThemeColors } from '../../store/themeStore';

interface ImageCardProps {
  currentImageUri: string | null;
  showGrayscale: boolean;
  theme: ThemeColors;
  isExtracting: boolean;
  onImagePress: () => void;
  onToggleGrayscale: () => void;
  onReExtractPress: () => void;
  onOpenCamera: () => void;
  onPickFromGallery: () => void;
}

export default function ImageCard({
  currentImageUri,
  showGrayscale,
  theme,
  isExtracting,
  onImagePress,
  onToggleGrayscale,
  onReExtractPress,
  onOpenCamera,
  onPickFromGallery,
}: ImageCardProps) {
  if (currentImageUri) {
    const imageElement = (
      <Image
        source={{ uri: currentImageUri }}
        style={styles.image}
        contentFit="cover"
      />
    );

    return (
      <TouchableOpacity style={styles.imageCard} onPress={onImagePress}>
        <View style={{ width: '100%', height: '100%' }}>
          {showGrayscale ? (
            <Grayscale style={{ width: '100%', height: '100%' }}>
              {imageElement}
            </Grayscale>
          ) : (
            imageElement
          )}
        </View>
        <View style={styles.sourceImageBadge}>
          <Text style={styles.sourceImageText}>Source Image</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.valueOverlayButton,
            {
              backgroundColor: showGrayscale ? '#34d399' + 'CC' : 'rgba(0, 0, 0, 0.6)',
            },
          ]}
          onPress={(e) => {
            e.stopPropagation();
            onToggleGrayscale();
          }}
        >
          <Ionicons name="contrast-outline" size={14} color="#fff" />
          <Text style={styles.valueOverlayButtonText}>
            {showGrayscale ? 'VALUE ON' : 'VALUE'}
          </Text>
        </TouchableOpacity>
        {/* Re-extract button */}
        <TouchableOpacity
          style={styles.reExtractIconButton}
          onPress={(e) => {
            e.stopPropagation();
            onReExtractPress();
          }}
          disabled={isExtracting}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
        </TouchableOpacity>
        {isExtracting && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Extracting colors...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.imageCardEmpty, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}
    >
      {/* Decorative color dots */}
      <View style={styles.emptyDecoContainer}>
        <View style={[styles.emptyDecoDot, { backgroundColor: '#f472b6', top: 16, left: 20, width: 8, height: 8 }]} />
        <View style={[styles.emptyDecoDot, { backgroundColor: '#60a5fa', top: 30, right: 30, width: 6, height: 6 }]} />
        <View style={[styles.emptyDecoDot, { backgroundColor: '#fbbf24', bottom: 40, left: 30, width: 10, height: 10 }]} />
        <View style={[styles.emptyDecoDot, { backgroundColor: '#34d399', top: 50, right: 50, width: 7, height: 7 }]} />
        <View style={[styles.emptyDecoDot, { backgroundColor: '#a78bfa', bottom: 24, right: 20, width: 9, height: 9 }]} />
      </View>

      {/* Central content */}
      <View style={[styles.emptyIconCircle, { backgroundColor: theme.accent + '15' }]}>
        <View style={[styles.emptyIconInner, { backgroundColor: theme.accent + '25' }]}>
          <Ionicons name="color-palette-outline" size={32} color={theme.accent} />
        </View>
      </View>
      <Text style={[styles.imageCardEmptyTitle, { color: theme.textPrimary }]}>Add your artwork</Text>
      <Text style={[styles.imageCardEmptySubtitle, { color: theme.textMuted }]}>Extract beautiful color palettes</Text>
      <View style={styles.imageSourceButtons}>
        <TouchableOpacity
          style={[styles.imageSourceButton, { backgroundColor: theme.backgroundTertiary, borderColor: theme.borderLight }]}
          onPress={onOpenCamera}
        >
          <View style={[styles.imageSourceIconBg, { backgroundColor: theme.accent + '20' }]}>
            <Ionicons name="camera" size={22} color={theme.accent} />
          </View>
          <Text style={[styles.imageSourceButtonText, { color: theme.textPrimary }]}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.imageSourceButton, { backgroundColor: theme.backgroundTertiary, borderColor: theme.borderLight }]}
          onPress={onPickFromGallery}
        >
          <View style={[styles.imageSourceIconBg, { backgroundColor: '#f472b6' + '20' }]}>
            <Ionicons name="images" size={22} color="#f472b6" />
          </View>
          <Text style={[styles.imageSourceButtonText, { color: theme.textPrimary }]}>Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
