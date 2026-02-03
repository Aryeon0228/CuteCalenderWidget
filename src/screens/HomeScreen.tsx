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
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { usePaletteStore } from '../store/paletteStore';
import { extractColorsFromImage, ExtractionMethod } from '../lib/colorExtractor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLOR_CARD_SIZE = (SCREEN_WIDTH - 64) / 4 - 8;

interface HomeScreenProps {
  onNavigateToLibrary: () => void;
}

export default function HomeScreen({ onNavigateToLibrary }: HomeScreenProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
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

  const extractColors = async (imageUri: string) => {
    setCurrentImageUri(imageUri);
    await doExtract(imageUri, colorCount, extractionMethod);
  };

  const handleMethodChange = async (method: ExtractionMethod) => {
    setExtractionMethod(method);
  };

  const handleReExtract = async () => {
    if (currentImageUri) {
      await doExtract(currentImageUri, colorCount, extractionMethod);
    }
  };

  const handleColorPress = async (hex: string, index: number) => {
    setSelectedColorIndex(index);
    await Clipboard.setStringAsync(hex);
    Alert.alert('Copied!', `${hex} copied to clipboard`);
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
    setShowExportModal(true);
  };

  const exportAs = async (format: string) => {
    let content = '';
    let filename = 'palette';

    switch (format) {
      case 'json':
        content = JSON.stringify({
          colors: currentColors.map((hex, i) => ({
            index: i,
            hex,
            rgb: hexToRgb(hex),
          })),
          exportedAt: new Date().toISOString(),
        }, null, 2);
        filename = 'palette.json';
        break;
      case 'css':
        content = `:root {\n${currentColors.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n')}\n}`;
        filename = 'palette.css';
        break;
      case 'unity':
        content = `using UnityEngine;\n\n[CreateAssetMenu(fileName = "Palette", menuName = "Colors/Palette")]\npublic class Palette : ScriptableObject\n{\n    public Color[] colors = new Color[] {\n${currentColors.map(hex => {
          const rgb = hexToRgb(hex);
          return `        new Color(${(rgb.r / 255).toFixed(3)}f, ${(rgb.g / 255).toFixed(3)}f, ${(rgb.b / 255).toFixed(3)}f)`;
        }).join(',\n')}\n    };\n}`;
        filename = 'Palette.cs';
        break;
      case 'unreal':
        content = `Name,Color\n${currentColors.map((hex, i) => {
          const rgb = hexToRgb(hex);
          return `Color${i + 1},"(R=${rgb.r},G=${rgb.g},B=${rgb.b},A=255)"`;
        }).join('\n')}`;
        filename = 'palette.csv';
        break;
      default: // png/text
        content = currentColors.join('\n');
        filename = 'palette.txt';
    }

    try {
      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export palette.');
    }
    setShowExportModal(false);
  };

  const copyToClipboard = async (format: string) => {
    let content = '';

    switch (format) {
      case 'json':
        content = JSON.stringify(currentColors);
        break;
      case 'css':
        content = currentColors.map((hex, i) => `--color-${i + 1}: ${hex};`).join('\n');
        break;
      default:
        content = currentColors.join('\n');
    }

    await Clipboard.setStringAsync(content);
    Alert.alert('Copied!', `${format.toUpperCase()} copied to clipboard`);
    setShowExportModal(false);
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Game Palette</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Card */}
        <TouchableOpacity style={styles.imageCard} onPress={pickImage}>
          {currentImageUri ? (
            <>
              <Image source={{ uri: currentImageUri }} style={styles.image} />
              <View style={styles.sourceImageBadge}>
                <Text style={styles.sourceImageText}>Source Image</Text>
              </View>
            </>
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

        {/* Color Cards */}
        {currentColors.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorCardsContainer}
          >
            {currentColors.map((color, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorCard,
                  selectedColorIndex === index && styles.colorCardSelected,
                ]}
                onPress={() => handleColorPress(color, index)}
              >
                <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                <Text style={styles.colorHex}>{color}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Main Extraction Card */}
        <View style={styles.extractionCard}>
          <View style={styles.extractionHeader}>
            <Text style={styles.extractionTitle}>MAIN EXTRACTION</Text>
            <TouchableOpacity>
              <Ionicons name="options-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Method Toggle */}
          <View style={styles.methodToggle}>
            <TouchableOpacity
              style={[
                styles.methodOption,
                extractionMethod === 'histogram' && styles.methodOptionActive,
              ]}
              onPress={() => handleMethodChange('histogram')}
            >
              <Text
                style={[
                  styles.methodOptionText,
                  extractionMethod === 'histogram' && styles.methodOptionTextActive,
                ]}
              >
                Hue Histogram
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodOption,
                extractionMethod === 'kmeans' && styles.methodOptionActive,
              ]}
              onPress={() => handleMethodChange('kmeans')}
            >
              <Text
                style={[
                  styles.methodOptionText,
                  extractionMethod === 'kmeans' && styles.methodOptionTextActive,
                ]}
              >
                K-Means
              </Text>
            </TouchableOpacity>
          </View>

          {/* Color Count Slider */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Color Count</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{colorCount}</Text>
              </View>
            </View>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderMin}>3</Text>
              <Slider
                style={styles.slider}
                minimumValue={3}
                maximumValue={8}
                step={1}
                value={colorCount}
                onValueChange={(value) => setColorCount(Math.round(value))}
                minimumTrackTintColor="#6366f1"
                maximumTrackTintColor="#333"
                thumbTintColor="#fff"
              />
              <Text style={styles.sliderMax}>8</Text>
            </View>
          </View>

          {/* Re-extract Button */}
          <TouchableOpacity
            style={[styles.reExtractButton, !currentImageUri && styles.reExtractButtonDisabled]}
            onPress={handleReExtract}
            disabled={!currentImageUri || isExtracting}
          >
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <Text style={styles.reExtractButtonText}>Re-extract Palette</Text>
          </TouchableOpacity>
        </View>

        {/* Spacer for bottom bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={onNavigateToLibrary}>
          <Ionicons name="library-outline" size={22} color="#888" />
          <Text style={styles.actionButtonText}>Library</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons name="download-outline" size={22} color="#000" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="share-outline" size={22} color="#6366f1" />
          <Text style={styles.exportButtonText}>Export</Text>
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

      {/* Export Modal (Bottom Sheet) */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.exportModalOverlay}>
          <TouchableOpacity
            style={styles.exportModalBackground}
            onPress={() => setShowExportModal(false)}
          />
          <View style={styles.exportModalContent}>
            <View style={styles.exportModalHandle} />
            <View style={styles.exportModalHeader}>
              <Text style={styles.exportModalTitle}>Export Palette</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Export Options */}
            <ExportOption
              icon="image-outline"
              iconColor="#f472b6"
              title="PNG Image"
              subtitle="High-res preview"
              onCopy={() => copyToClipboard('text')}
              onDownload={() => exportAs('text')}
            />
            <ExportOption
              icon="code-slash-outline"
              iconColor="#fbbf24"
              title="JSON Data"
              subtitle="Raw color arrays"
              onCopy={() => copyToClipboard('json')}
              onDownload={() => exportAs('json')}
            />
            <ExportOption
              icon="logo-css3"
              iconColor="#3b82f6"
              title="CSS Variables"
              subtitle=":root variables"
              onCopy={() => copyToClipboard('css')}
              onDownload={() => exportAs('css')}
            />
            <ExportOption
              icon="cube-outline"
              iconColor="#9ca3af"
              title="Unity Asset"
              subtitle=".asset file"
              onCopy={() => copyToClipboard('text')}
              onDownload={() => exportAs('unity')}
            />
            <ExportOption
              icon="game-controller-outline"
              iconColor="#6366f1"
              title="Unreal Engine"
              subtitle="Curve atlas"
              onCopy={() => copyToClipboard('text')}
              onDownload={() => exportAs('unreal')}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Export Option Component
function ExportOption({
  icon,
  iconColor,
  title,
  subtitle,
  onCopy,
  onDownload,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <View style={styles.exportOption}>
      <View style={[styles.exportOptionIcon, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon as any} size={24} color={iconColor} />
      </View>
      <View style={styles.exportOptionInfo}>
        <Text style={styles.exportOptionTitle}>{title}</Text>
        <Text style={styles.exportOptionSubtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity style={styles.exportActionButton} onPress={onCopy}>
        <Ionicons name="copy-outline" size={20} color="#888" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.exportActionButton} onPress={onDownload}>
        <Ionicons name="download-outline" size={20} color="#888" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  menuButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  imageCard: {
    marginHorizontal: 16,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  sourceImageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sourceImageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
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
  colorCardsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  colorCard: {
    alignItems: 'center',
    marginRight: 12,
  },
  colorCardSelected: {
    transform: [{ scale: 1.05 }],
  },
  colorSwatch: {
    width: COLOR_CARD_SIZE,
    height: COLOR_CARD_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  colorHex: {
    color: '#888',
    fontSize: 11,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  extractionCard: {
    marginHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
  },
  extractionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  extractionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  methodOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  methodOptionActive: {
    backgroundColor: '#3a3a3a',
  },
  methodOptionText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  methodOptionTextActive: {
    color: '#fff',
  },
  sliderSection: {
    marginBottom: 20,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    color: '#fff',
    fontSize: 14,
  },
  countBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderMin: {
    color: '#666',
    fontSize: 12,
    marginRight: 8,
  },
  sliderMax: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
  },
  reExtractButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reExtractButtonDisabled: {
    backgroundColor: '#333',
  },
  reExtractButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 36,
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    gap: 6,
  },
  actionButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 6,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    gap: 6,
  },
  exportButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
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
    backgroundColor: '#000',
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
    backgroundColor: '#333',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#6366f1',
  },
  modalButtonText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: '#fff',
  },
  exportModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  exportModalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  exportModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  exportModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  exportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  exportModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  exportOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  exportOptionInfo: {
    flex: 1,
  },
  exportOptionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  exportOptionSubtitle: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
  },
  exportActionButton: {
    padding: 10,
  },
});
