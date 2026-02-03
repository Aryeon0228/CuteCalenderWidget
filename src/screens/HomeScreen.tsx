import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { usePaletteStore } from '../store/paletteStore';
import ColorStrip from '../components/ColorStrip';
import ColorDetailPanel from '../components/ColorDetailPanel';
import { extractColorsFromImage, ExtractionMethod } from '../lib/colorExtractor';

interface HomeScreenProps {
  onNavigateToLibrary: () => void;
}

export default function HomeScreen({ onNavigateToLibrary }: HomeScreenProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [paletteName, setPaletteName] = useState('');

  const {
    currentColors,
    currentImageUri,
    selectedColorIndex,
    colorCount,
    extractionMethod,
    setCurrentColors,
    setCurrentImageUri,
    setSelectedColorIndex,
    setColorCount,
    setExtractionMethod,
    savePalette,
  } = usePaletteStore();

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await extractColors(result.assets[0].uri);
    }
  };

  // Core extraction function - takes explicit values to avoid stale closures
  const doExtract = async (
    imageUri: string,
    count: number,
    method: ExtractionMethod
  ) => {
    setIsExtracting(true);
    try {
      const colors = await extractColorsFromImage(imageUri, count, method);
      setCurrentColors(colors);
    } catch (error) {
      console.error('Error extracting colors:', error);
      Alert.alert('Error', 'Failed to extract colors from image.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Called when picking a new image
  const extractColors = async (imageUri: string) => {
    setCurrentImageUri(imageUri);
    await doExtract(imageUri, colorCount, extractionMethod);
  };

  // Handle color count change - directly call with new value
  const handleColorCountChange = async (count: number) => {
    setColorCount(count);
    if (currentImageUri) {
      await doExtract(currentImageUri, count, extractionMethod);
    }
  };

  // Handle extraction method change - directly call with new value
  const handleMethodChange = async (method: ExtractionMethod) => {
    setExtractionMethod(method);
    if (currentImageUri) {
      await doExtract(currentImageUri, colorCount, method);
    }
  };

  const handleSave = () => {
    if (currentColors.length === 0) {
      Alert.alert('No Colors', 'Please extract colors from an image first.');
      return;
    }
    setPaletteName(`Palette ${new Date().toLocaleDateString()}`);
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    savePalette(paletteName || `Palette ${Date.now()}`);
    setShowSaveModal(false);
    setPaletteName('');
    Alert.alert('Saved!', 'Palette saved to library.');
  };

  const handleExport = () => {
    if (currentColors.length === 0) {
      Alert.alert('No Colors', 'Please extract colors from an image first.');
      return;
    }

    const hexColors = currentColors.map(c => c.toUpperCase()).join('\n');

    Alert.alert(
      'Export Colors',
      'Choose export format:',
      [
        {
          text: 'Copy to Clipboard',
          onPress: async () => {
            await Clipboard.setStringAsync(hexColors);
            Alert.alert('Copied!', 'Colors copied to clipboard.');
          },
        },
        {
          text: 'Share as File',
          onPress: async () => {
            try {
              const fileUri = FileSystem.cacheDirectory + 'palette.txt';
              await FileSystem.writeAsStringAsync(fileUri, hexColors);

              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
              } else {
                Alert.alert('Error', 'Sharing is not available on this device.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to share palette.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
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
              onPress={() => handleColorCountChange(count)}
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

      {/* Extraction method selector */}
      <View style={styles.colorCountSection}>
        <Text style={styles.sectionLabel}>Extraction Method</Text>
        <View style={styles.methodSelector}>
          <TouchableOpacity
            style={[
              styles.methodButton,
              extractionMethod === 'histogram' && styles.methodButtonActive,
            ]}
            onPress={() => handleMethodChange('histogram')}
          >
            <Ionicons
              name="bar-chart-outline"
              size={16}
              color={extractionMethod === 'histogram' ? '#fff' : '#666'}
            />
            <Text
              style={[
                styles.methodButtonText,
                extractionMethod === 'histogram' && styles.methodButtonTextActive,
              ]}
            >
              Histogram
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.methodButton,
              extractionMethod === 'kmeans' && styles.methodButtonActive,
            ]}
            onPress={() => handleMethodChange('kmeans')}
          >
            <Ionicons
              name="git-network-outline"
              size={16}
              color={extractionMethod === 'kmeans' ? '#fff' : '#666'}
            />
            <Text
              style={[
                styles.methodButtonText,
                extractionMethod === 'kmeans' && styles.methodButtonTextActive,
              ]}
            >
              K-Means
            </Text>
          </TouchableOpacity>
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

      {/* Save Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Palette</Text>
            <TextInput
              style={styles.modalInput}
              value={paletteName}
              onChangeText={setPaletteName}
              placeholder="Enter palette name"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmSave}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  methodSelector: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  methodButtonActive: {
    backgroundColor: '#3a3a5c',
  },
  methodButtonText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  methodButtonTextActive: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#0d0d1a',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#3a3a5c',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#4a6a4a',
  },
  modalButtonText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: '#fff',
  },
});
