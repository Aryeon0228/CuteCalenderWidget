import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Floating color particles config
const PARTICLES = [
  { color: '#f472b6', size: 12, x: -80, y: -140, delay: 0 },
  { color: '#60a5fa', size: 10, x: 90, y: -100, delay: 100 },
  { color: '#fbbf24', size: 14, x: -110, y: -40, delay: 200 },
  { color: '#34d399', size: 8, x: 120, y: 20, delay: 300 },
  { color: '#a78bfa', size: 11, x: -60, y: 80, delay: 150 },
  { color: '#fb923c', size: 9, x: 70, y: 100, delay: 250 },
  { color: '#6366f1', size: 13, x: -130, y: 60, delay: 50 },
  { color: '#f87171', size: 10, x: 140, y: -60, delay: 350 },
];

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const subtitleFadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.2)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    PARTICLES.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
      scale: new Animated.Value(0.3),
    }))
  ).current;
  const ringScaleAnim = useRef(new Animated.Value(0.8)).current;
  const ring2ScaleAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.7,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.2,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    ).start();

    // Ring pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringScaleAnim, {
          toValue: 1.1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(ringScaleAnim, {
          toValue: 0.8,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ring2ScaleAnim, {
          toValue: 1.2,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(ring2ScaleAnim, {
          toValue: 0.6,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Particle float animations
    particleAnims.forEach((anim, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(anim.translateY, {
              toValue: -10,
              duration: 1500 + index * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 1.2,
              duration: 1500 + index * 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.translateY, {
              toValue: 10,
              duration: 1500 + index * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 0.8,
              duration: 1500 + index * 200,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    });

    // Main animation sequence
    Animated.sequence([
      // Particles fade in
      Animated.stagger(
        60,
        particleAnims.map((anim) =>
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          })
        )
      ),
      // Logo appears with bounce
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 40,
          friction: 6,
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
      // Wait
      Animated.delay(600),
    ]).start(() => {
      onFinish();
    });
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinReverse = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      {/* Background gradient circles */}
      <View style={styles.bgGradient1} />
      <View style={styles.bgGradient2} />

      {/* Outer ring glow 1 */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            opacity: glowAnim,
            transform: [{ rotate: spin }, { scale: ringScaleAnim }],
          },
        ]}
      />

      {/* Outer ring glow 2 */}
      <Animated.View
        style={[
          styles.glowRing2,
          {
            opacity: glowAnim,
            transform: [{ rotate: spinReverse }, { scale: ring2ScaleAnim }],
          },
        ]}
      />

      {/* Floating color particles */}
      {PARTICLES.map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              width: particle.size,
              height: particle.size,
              borderRadius: particle.size / 2,
              backgroundColor: particle.color,
              left: SCREEN_WIDTH / 2 + particle.x - particle.size / 2,
              top: SCREEN_HEIGHT / 2 + particle.y - particle.size / 2,
              opacity: particleAnims[index].opacity,
              transform: [
                { translateY: particleAnims[index].translateY },
                { scale: particleAnims[index].scale },
              ],
              shadowColor: particle.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 8,
            },
          ]}
        />
      ))}

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
            <Ionicons name="color-palette" size={44} color="#fff" />
          </View>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View
        style={[
          styles.textContainer,
          { opacity: textFadeAnim, transform: [{ translateY: textFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <Text style={styles.title}>Pixel Paw</Text>
        <View style={styles.titleAccent} />
      </Animated.View>

      {/* Subtitle */}
      <Animated.View
        style={[
          styles.subtitleContainer,
          { opacity: subtitleFadeAnim },
        ]}
      >
        <Text style={styles.subtitle}>Game Art Color Extractor</Text>
      </Animated.View>

      {/* Bottom branding */}
      <View style={styles.bottomBranding}>
        <Text style={styles.brandingText}>Studio Aryeon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080e',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bgGradient1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#6366f1',
    opacity: 0.06,
    top: SCREEN_HEIGHT * 0.2,
    left: -60,
  },
  bgGradient2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#a78bfa',
    opacity: 0.04,
    bottom: SCREEN_HEIGHT * 0.15,
    right: -50,
  },
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  glowRing2: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#a78bfa',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  particle: {
    position: 'absolute',
  },
  logoContainer: {
    position: 'relative',
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoOuter: {
    width: 110,
    height: 110,
    borderRadius: 30,
    backgroundColor: '#12121a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2a2a3a',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  textContainer: {
    marginTop: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  titleAccent: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#6366f1',
    marginTop: 8,
  },
  subtitleContainer: {
    marginTop: 14,
  },
  subtitle: {
    fontSize: 15,
    color: '#7777a0',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  bottomBranding: {
    position: 'absolute',
    bottom: 50,
  },
  brandingText: {
    fontSize: 12,
    color: '#3a3a50',
    fontWeight: '600',
    letterSpacing: 1,
  },
});
