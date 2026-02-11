import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Image } from 'expo-image';

interface SplashScreenProps {
  onFinish: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY_RING_SIZE = Math.min(SCREEN_WIDTH * 0.52, 250);
const SECONDARY_RING_SIZE = PRIMARY_RING_SIZE * 1.24;
const FINISH_DELAY_MS = 2450;

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const coverScaleAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const titleOpacityAnim = useRef(new Animated.Value(0)).current;
  const titleTranslateAnim = useRef(new Animated.Value(12)).current;
  const titleScaleAnim = useRef(new Animated.Value(0.96)).current;
  const subtitleOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ringLoop = Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    const ring2Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(ring2Anim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    ringLoop.start();
    ring2Loop.start();
    glowLoop.start();

    Animated.timing(coverScaleAnim, {
      toValue: 1.03,
      duration: 1300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(titleOpacityAnim, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateAnim, {
          toValue: 0,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleScaleAnim, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(430),
      Animated.timing(subtitleOpacityAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const finishTimer = setTimeout(() => {
      onFinish();
    }, FINISH_DELAY_MS);

    return () => {
      clearTimeout(finishTimer);
      ringLoop.stop();
      ring2Loop.stop();
      glowLoop.stop();
    };
  }, [
    coverScaleAnim,
    glowAnim,
    onFinish,
    ring2Anim,
    ringAnim,
    subtitleOpacityAnim,
    titleOpacityAnim,
    titleScaleAnim,
    titleTranslateAnim,
  ]);

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1.34],
  });

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0],
  });

  const ring2Scale = ring2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.84, 1.5],
  });

  const ring2Opacity = ring2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.44],
  });

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });

  const glowSecondaryOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.24],
  });

  const glowSecondaryScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.2],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.coverLayer,
          {
            transform: [{ scale: coverScaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/splash-cover-1290x2796.png')}
          style={styles.coverImage}
          contentFit="cover"
          transition={0}
        />
      </Animated.View>

      <View style={styles.coverTint} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.atmosphereGlow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.atmosphereGlow,
          styles.atmosphereGlowSecondary,
          {
            opacity: glowSecondaryOpacity,
            transform: [{ scale: glowSecondaryScale }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: PRIMARY_RING_SIZE,
            height: PRIMARY_RING_SIZE,
            borderRadius: PRIMARY_RING_SIZE / 2,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          styles.ringSecondary,
          {
            width: SECONDARY_RING_SIZE,
            height: SECONDARY_RING_SIZE,
            borderRadius: SECONDARY_RING_SIZE / 2,
            opacity: ring2Opacity,
            transform: [{ scale: ring2Scale }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.brandBlock,
          {
            opacity: titleOpacityAnim,
            transform: [{ translateY: titleTranslateAnim }, { scale: titleScaleAnim }],
          },
        ]}
      >
        <Text style={styles.brandTitle}>Pixel Paw</Text>
        <Animated.Text style={[styles.brandSubtitle, { opacity: subtitleOpacityAnim }]}>
          Color Extractor - Paw Palette
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  coverLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 7, 12, 0.16)',
  },
  atmosphereGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_WIDTH * 0.72,
    borderRadius: (SCREEN_WIDTH * 0.72) / 2,
    backgroundColor: 'rgba(190, 198, 255, 0.26)',
    shadowColor: '#cfd5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
  },
  atmosphereGlowSecondary: {
    width: SCREEN_WIDTH * 0.94,
    height: SCREEN_WIDTH * 0.94,
    borderRadius: (SCREEN_WIDTH * 0.94) / 2,
    backgroundColor: 'rgba(126, 137, 255, 0.18)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  ringSecondary: {
    borderWidth: 1.1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  brandBlock: {
    position: 'absolute',
    bottom: 96,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  brandTitle: {
    color: '#f5f7ff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 38,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(4, 6, 18, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandSubtitle: {
    marginTop: 6,
    color: 'rgba(239, 242, 255, 0.84)',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
