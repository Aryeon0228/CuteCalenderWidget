import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

// Floating particle component
function FloatingParticle({ delay, startX, size, duration }: {
  delay: number;
  startX: number;
  size: number;
  duration: number;
}) {
  const translateY = useRef(new Animated.Value(height + 50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: duration - 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: duration - 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: startX,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const subtitleFadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    // Main animation sequence
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

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Generate particles
  const particles = [
    { delay: 0, startX: width * 0.1, size: 8, duration: 3000 },
    { delay: 200, startX: width * 0.3, size: 12, duration: 3500 },
    { delay: 400, startX: width * 0.5, size: 6, duration: 2800 },
    { delay: 100, startX: width * 0.7, size: 10, duration: 3200 },
    { delay: 300, startX: width * 0.85, size: 8, duration: 3000 },
    { delay: 500, startX: width * 0.2, size: 14, duration: 3800 },
    { delay: 600, startX: width * 0.6, size: 6, duration: 2600 },
    { delay: 150, startX: width * 0.4, size: 10, duration: 3400 },
    { delay: 450, startX: width * 0.9, size: 8, duration: 3100 },
    { delay: 250, startX: width * 0.15, size: 12, duration: 3300 },
  ];

  return (
    <View style={styles.container}>
      {/* Floating particles */}
      {particles.map((p, i) => (
        <FloatingParticle key={i} {...p} />
      ))}

      {/* Glow effect behind logo */}
      <Animated.View
        style={[
          styles.glowOuter,
          {
            opacity: glowAnim,
            transform: [{ rotate: spin }],
          },
        ]}
      />

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
            {/* Replace this icon with your custom Image */}
            <Ionicons name="color-palette" size={48} color="#fff" />
          </View>
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
        <Text style={styles.brandingText}>Studio Aryeon with Claude</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a10',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  glowOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
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
    backgroundColor: '#16161e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d38',
    // Subtle shadow
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#8888aa',
    fontWeight: '500',
  },
  bottomBranding: {
    position: 'absolute',
    bottom: 50,
  },
  brandingText: {
    fontSize: 12,
    color: '#4a4a5a',
    fontWeight: '500',
  },
});
