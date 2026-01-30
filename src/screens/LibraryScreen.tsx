import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePaletteStore, SavedPalette } from '../store/paletteStore';

interface LibraryScreenProps {
  onNavigateBack: () => void;
}

export default function LibraryScreen({ onNavigateBack }: LibraryScreenProps) {
  const { savedPalettes, deletePalette, loadPalette } = usePaletteStore();

  const handleLoadPalette = (palette: SavedPalette) => {
    loadPalette(palette);
    onNavigateBack();
  };

  const handleDeletePalette = (palette: SavedPalette) => {
    Alert.alert(
      'Delete Palette',
      `Are you sure you want to delete "${palette.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePalette(palette.id),
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderPaletteCard = ({ item }: { item: SavedPalette }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleLoadPalette(item)}
      onLongPress={() => handleDeletePalette(item)}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnail}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="color-palette-outline" size={24} color="#4a4a6a" />
          </View>
        )}
      </View>

      {/* Color dots */}
      <View style={styles.colorDots}>
        {item.colors.slice(0, 5).map((color, index) => (
          <View
            key={`${item.id}-${index}`}
            style={[styles.colorDot, { backgroundColor: color }]}
          />
        ))}
        {item.colors.length > 5 && (
          <View style={styles.moreDots}>
            <Text style={styles.moreDotsText}>+{item.colors.length - 5}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
      </View>

      {/* Delete button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeletePalette(item)}
      >
        <Ionicons name="trash-outline" size={16} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onNavigateBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Library</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {savedPalettes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="library-outline" size={64} color="#3a3a5c" />
          <Text style={styles.emptyTitle}>No saved palettes</Text>
          <Text style={styles.emptySubtitle}>
            Extract colors from an image and save them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedPalettes}
          renderItem={renderPaletteCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  grid: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  thumbnail: {
    height: 100,
    backgroundColor: '#0d0d1a',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDots: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 8,
    gap: 6,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  moreDots: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3a3a5c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreDotsText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '600',
  },
  cardInfo: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  cardDate: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
