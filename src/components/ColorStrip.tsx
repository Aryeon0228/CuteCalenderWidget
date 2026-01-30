import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

interface ColorStripProps {
  colors: string[];
  onColorSelect?: (index: number) => void;
  selectedIndex?: number | null;
}

export default function ColorStrip({ colors, onColorSelect, selectedIndex }: ColorStripProps) {
  if (colors.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.strip}>
        {colors.map((color, index) => (
          <TouchableOpacity
            key={`${color}-${index}`}
            style={[
              styles.colorSegment,
              { backgroundColor: color },
              selectedIndex === index && styles.selectedSegment,
            ]}
            onPress={() => onColorSelect?.(index)}
            activeOpacity={0.8}
          >
            {selectedIndex === index && (
              <View style={styles.selectionIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  strip: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  colorSegment: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 4,
  },
  selectedSegment: {
    transform: [{ scaleY: 1.1 }],
    zIndex: 1,
  },
  selectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
});
