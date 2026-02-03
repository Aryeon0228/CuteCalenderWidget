import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const subtitleFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation sequence
    Animated.sequence([
      // Logo appears
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Title appears
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Subtitle appears
      Animated.timing(subtitleFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Wait a bit
      Animated.delay(800),
    ]).start(() => {
      onFinish();
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Background gradient effect */}
      <View style={styles.gradientOverlay} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logoOuter}>
          <View style={styles.logoInner}>
            <Ionicons name="color-palette" size={48} color="#fff" />
          </View>
        </View>

        {/* Color dots around logo */}
        <View style={styles.colorDots}>
          <View style={[styles.dot, styles.dot1, { backgroundColor: '#FF6B6B' }]} />
          <View style={[styles.dot, styles.dot2, { backgroundColor: '#4ECDC4' }]} />
          <View style={[styles.dot, styles.dot3, { backgroundColor: '#FFE66D' }]} />
          <View style={[styles.dot, styles.dot4, { backgroundColor: '#95E1D3' }]} />
          <View style={[styles.dot, styles.dot5, { backgroundColor: '#F38181' }]} />
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View
        style={[
          styles.textContainer,
          { opacity: textFadeAnim },
        ]}
      >
        <Text style={styles.title}>GamePalette</Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View
        style={[
          styles.subtitleContainer,
          { opacity: subtitleFadeAnim },
        ]}
      >
        <Text style={styles.subtitle}>Extract colors from game art</Text>
      </Animated.View>

      {/* Bottom branding */}
      <View style={styles.bottomBranding}>
        <Text style={styles.brandingText}>Powered by K-Means & Histogram</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  logoContainer: {
    position: 'relative',
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoOuter: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDots: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dot1: {
    top: 10,
    left: '50%',
    marginLeft: -6,
  },
  dot2: {
    top: 30,
    right: 10,
  },
  dot3: {
    bottom: 30,
    right: 15,
  },
  dot4: {
    bottom: 30,
    left: 15,
  },
  dot5: {
    top: 30,
    left: 10,
  },
  textContainer: {
    marginTop: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitleContainer: {
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  bottomBranding: {
    position: 'absolute',
    bottom: 50,
  },
  brandingText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
  },
});
