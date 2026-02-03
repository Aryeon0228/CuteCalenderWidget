import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  Share,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePaletteStore, SavedPalette } from '../store/paletteStore';
import { useThemeStore } from '../store/themeStore';

interface LibraryScreenProps {
  onNavigateBack: () => void;
}

export default function LibraryScreen({ onNavigateBack }: LibraryScreenProps) {
  const { savedPalettes, deletePalette, loadPalette } = usePaletteStore();
  const { colors: theme } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    card: { backgroundColor: theme.backgroundSecondary },
    text: { color: theme.textPrimary },
    textSecondary: { color: theme.textSecondary },
    border: { borderColor: theme.border },
  };
  const [menuPalette, setMenuPalette] = useState<SavedPalette | null>(null);
  const [exportPalette, setExportPalette] = useState<SavedPalette | null>(null);

  // Filter palettes based on search
  const filteredPalettes = useMemo(() => {
    if (!searchQuery.trim()) return savedPalettes;
    const query = searchQuery.toLowerCase();
    return savedPalettes.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.colors.some((c) => c.toLowerCase().includes(query))
    );
  }, [savedPalettes, searchQuery]);

  const handleLoadPalette = (palette: SavedPalette) => {
    loadPalette(palette);
    onNavigateBack();
  };

  const handleDeletePalette = (palette: SavedPalette) => {
    setMenuPalette(null);
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
    });
  };

  // Export functions
  const exportAsJSON = (palette: SavedPalette) => {
    const json = JSON.stringify(
      {
        name: palette.name,
        colors: palette.colors,
        createdAt: new Date(palette.createdAt).toISOString(),
      },
      null,
      2
    );
    Clipboard.setString(json);
    Alert.alert('Copied!', 'JSON copied to clipboard');
    setExportPalette(null);
  };

  const exportAsCSS = (palette: SavedPalette) => {
    const css = `:root {\n${palette.colors
      .map((c, i) => `  --color-${i + 1}: ${c};`)
      .join('\n')}\n}`;
    Clipboard.setString(css);
    Alert.alert('Copied!', 'CSS variables copied to clipboard');
    setExportPalette(null);
  };

  const exportAsHEX = (palette: SavedPalette) => {
    const hex = palette.colors.join('\n');
    Clipboard.setString(hex);
    Alert.alert('Copied!', 'HEX values copied to clipboard');
    setExportPalette(null);
  };

  const sharePalette = async (palette: SavedPalette) => {
    try {
      await Share.share({
        message: `${palette.name}\n\nColors:\n${palette.colors.join('\n')}\n\nCreated with GamePalette`,
      });
    } catch (error) {
      console.error(error);
    }
    setExportPalette(null);
  };

  const renderPaletteCard = ({ item }: { item: SavedPalette }) => (
    <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
      {/* Header with thumbnail and menu */}
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={styles.cardTouchable}
          onPress={() => handleLoadPalette(item)}
          activeOpacity={0.8}
        >
          <View style={[styles.thumbnail, { backgroundColor: theme.backgroundTertiary }]}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.thumbnailImage} />
            ) : (
              <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
                <Ionicons name="color-palette" size={20} color={theme.textMuted} />
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuPalette(item)}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Color swatches */}
      <TouchableOpacity
        style={styles.colorSwatches}
        onPress={() => handleLoadPalette(item)}
        activeOpacity={0.8}
      >
        {item.colors.slice(0, 5).map((color, index) => (
          <View
            key={`${item.id}-${index}`}
            style={[styles.colorSwatch, { backgroundColor: color }]}
          />
        ))}
      </TouchableOpacity>

      {/* Info section */}
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.paletteLabel, { color: theme.textMuted }]}>PALETTE</Text>
        </View>

        {/* Tags */}
        <View style={styles.tagsRow}>
          <View style={[styles.tag, { backgroundColor: theme.borderLight }]}>
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>HEX</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: theme.borderLight }]}>
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>{item.colors.length} colors</Text>
          </View>
          <Text style={[styles.dateText, { color: theme.textMuted }]}>{formatDate(item.createdAt)}</Text>
        </View>

        {/* Export button */}
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: theme.buttonBg }]}
          onPress={() => setExportPalette(item)}
        >
          <Ionicons name="share-outline" size={14} color={theme.textPrimary} />
          <Text style={[styles.exportButtonText, { color: theme.textPrimary }]}>Export</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.backgroundSecondary }]} onPress={onNavigateBack}>
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>GamePalette</Text>
        <View style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={28} color={theme.textSecondary} />
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundSecondary }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search palettes, colors..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Palettes</Text>
        <Text style={styles.sectionCount}>{filteredPalettes.length} items</Text>
      </View>

      {/* Content */}
      {savedPalettes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="color-palette-outline" size={48} color="#444" />
          </View>
          <Text style={styles.emptyTitle}>No saved palettes</Text>
          <Text style={styles.emptySubtitle}>
            Extract colors from an image and save them to see them here
          </Text>
        </View>
      ) : filteredPalettes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color="#444" />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPalettes}
          renderItem={renderPaletteCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Context menu modal */}
      <Modal
        visible={menuPalette !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPalette(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuPalette(null)}
        >
          <View style={styles.menuModal}>
            <Text style={styles.menuTitle}>{menuPalette?.name}</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (menuPalette) handleLoadPalette(menuPalette);
                setMenuPalette(null);
              }}
            >
              <Ionicons name="open-outline" size={20} color="#fff" />
              <Text style={styles.menuItemText}>Open</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (menuPalette) setExportPalette(menuPalette);
                setMenuPalette(null);
              }}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.menuItemText}>Export</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => menuPalette && handleDeletePalette(menuPalette)}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Export modal */}
      <Modal
        visible={exportPalette !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setExportPalette(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setExportPalette(null)}
        >
          <View style={styles.exportModal}>
            <View style={styles.exportHandle} />
            <Text style={styles.exportTitle}>Export Palette</Text>

            <View style={styles.exportOptions}>
              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => exportPalette && exportAsHEX(exportPalette)}
              >
                <View style={[styles.exportIcon, { backgroundColor: '#333' }]}>
                  <Text style={styles.exportIconText}>#</Text>
                </View>
                <Text style={styles.exportOptionText}>HEX</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => exportPalette && exportAsJSON(exportPalette)}
              >
                <View style={[styles.exportIcon, { backgroundColor: '#2d5a27' }]}>
                  <Ionicons name="code-slash" size={20} color="#fff" />
                </View>
                <Text style={styles.exportOptionText}>JSON</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => exportPalette && exportAsCSS(exportPalette)}
              >
                <View style={[styles.exportIcon, { backgroundColor: '#264de4' }]}>
                  <Text style={styles.exportIconText}>CSS</Text>
                </View>
                <Text style={styles.exportOptionText}>CSS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => exportPalette && sharePalette(exportPalette)}
              >
                <View style={[styles.exportIcon, { backgroundColor: '#555' }]}>
                  <Ionicons name="share-social" size={20} color="#fff" />
                </View>
                <Text style={styles.exportOptionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16161e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    padding: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  sectionCount: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#16161e',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTouchable: {
    flex: 1,
  },
  thumbnail: {
    height: 140,
    backgroundColor: '#0c0c12',
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
    backgroundColor: '#0c0c12',
  },
  menuButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatches: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  colorSwatch: {
    flex: 1,
    height: 32,
    borderRadius: 6,
  },
  cardInfo: {
    padding: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  paletteLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.5,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#24242e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    color: '#555',
    marginLeft: 'auto',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d38',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16161e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  menuModal: {
    backgroundColor: '#16161e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#24242e',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  menuItemText: {
    fontSize: 16,
    color: '#fff',
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#24242e',
    marginTop: 8,
    paddingTop: 20,
  },
  menuItemTextDanger: {
    color: '#ff4444',
  },
  exportModal: {
    backgroundColor: '#16161e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  exportHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3e3e50',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  exportOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  exportOption: {
    alignItems: 'center',
    gap: 8,
  },
  exportIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  exportOptionText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
});
