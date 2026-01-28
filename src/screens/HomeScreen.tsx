import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getColors } from 'react-native-image-colors';
import { Ionicons } from '@expo/vector-icons';
import { usePaletteStore } from '../store/paletteStore';
import ColorStrip from '../components/ColorStrip';
import ColorDetailPanel from '../components/ColorDetailPanel';

interface HomeScreenProps {
  onNavigateToLibrary: () => void;
}

export default function HomeScreen({ onNavigateToLibrary }: HomeScreenProps) {
  const [isExtracting, setIsExtracting] = useState(false);

  const {
    currentColors,
    currentImageUri,
    selectedColorIndex,
    colorCount,
    setCurrentColors,
    setCurrentImageUri,
    setSelectedColorIndex,
    setColorCount,
    savePalette,
  } = usePaletteStore();

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await extractColors(result.assets[0].uri);
    }
  };

  const extractColors = async (imageUri: string) => {
    setIsExtracting(true);
    setCurrentImageUri(imageUri);

    try {
      const result = await getColors(imageUri, {
        fallback: '#000000',
        cache: false,
        key: imageUri,
      });

      let extractedColors: string[] = [];

      if (result.platform === 'android') {
        extractedColors = [
          result.dominant,
          result.vibrant,
          result.darkVibrant,
          result.lightVibrant,
          result.darkMuted,
          result.lightMuted,
          result.muted,
          result.average,
        ].filter((c): c is string => !!c);
      } else if (result.platform === 'ios') {
        extractedColors = [
          result.primary,
          result.secondary,
          result.background,
          result.detail,
        ].filter((c): c is string => !!c);
      }

      // Ensure unique colors and limit to colorCount
      const uniqueColors = [...new Set(extractedColors)].slice(0, colorCount);
      setCurrentColors(uniqueColors);
    } catch (error) {
      console.error('Error extracting colors:', error);
      Alert.alert('Error', 'Failed to extract colors from image.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = () => {
    if (currentColors.length === 0) {
      Alert.alert('No Colors', 'Please extract colors from an image first.');
      return;
    }

    Alert.prompt?.(
      'Save Palette',
      'Enter a name for this palette:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (name) => {
            savePalette(name || `Palette ${Date.now()}`);
            Alert.alert('Saved!', 'Palette saved to library.');
          },
        },
      ],
      'plain-text',
      `Palette ${Date.now()}`
    ) || savePalette(`Palette ${Date.now()}`);
  };

  const handleExport = () => {
    if (currentColors.length === 0) {
      Alert.alert('No Colors', 'Please extract colors from an image first.');
      return;
    }

    const exportText = currentColors.join('\n');
    Alert.alert(
      'Export Colors',
      exportText,
      [{ text: 'OK' }]
    );
  };

  const colorCountOptions = [3, 4, 5, 6, 7, 8];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>GamePalette</Text>
        <Text style={styles.subtitle}>Extract colors for game dev</Text>
      </View>

      {/* Color count selector */}
      <View style={styles.colorCountSection}>
        <Text style={styles.sectionLabel}>Color Count</Text>
        <View style={styles.colorCountSelector}>
          {colorCountOptions.map((count) => (
            <TouchableOpacity
              key={count}
              style={[
                styles.countButton,
                colorCount === count && styles.countButtonActive,
              ]}
              onPress={() => setColorCount(count)}
            >
              <Text
                style={[
                  styles.countButtonText,
                  colorCount === count && styles.countButtonTextActive,
                ]}
              >
                {count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image area */}
        <TouchableOpacity style={styles.imageArea} onPress={pickImage}>
          {currentImageUri ? (
            <Image source={{ uri: currentImageUri }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={48} color="#4a4a6a" />
              <Text style={styles.placeholderText}>Tap to select image</Text>
            </View>
          )}
          {isExtracting && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Extracting colors...</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Color strip */}
        {currentColors.length > 0 && (
          <ColorStrip
            colors={currentColors}
            selectedIndex={selectedColorIndex}
            onColorSelect={setSelectedColorIndex}
          />
        )}

        {/* Color detail panel */}
        {selectedColorIndex !== null && currentColors[selectedColorIndex] && (
          <ColorDetailPanel
            color={currentColors[selectedColorIndex]}
            onClose={() => setSelectedColorIndex(null)}
          />
        )}

        {/* Spacer for bottom action bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={onNavigateToLibrary}>
          <Ionicons name="library-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={handleSave}
        >
          <Ionicons name="bookmark-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleExport}>
          <Ionicons name="share-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Export</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  colorCountSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  colorCountSelector: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 4,
  },
  countButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  countButtonActive: {
    backgroundColor: '#3a3a5c',
  },
  countButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  countButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  imageArea: {
    marginHorizontal: 16,
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#4a4a6a',
    marginTop: 12,
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 36,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryAction: {
    backgroundColor: '#4a4a6a',
    marginHorizontal: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});
