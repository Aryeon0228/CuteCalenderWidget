import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Image } from 'expo-image';

interface SplashScreenProps {
  onFinish: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FINISH_DELAY_MS = 2450;

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const coverScaleAnim = useRef(new Animated.Value(0.62)).current;
  const auroraAnim = useRef(new Animated.Value(0)).current;
  const mistAnim = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const titleOpacityAnim = useRef(new Animated.Value(0)).current;
  const titleTranslateAnim = useRef(new Animated.Value(18)).current;
  const titleScaleAnim = useRef(new Animated.Value(0.92)).current;
  const subtitleOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const auroraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(auroraAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(auroraAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const mistLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mistAnim, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(mistAnim, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );

    auroraLoop.start();
    mistLoop.start();
    sweepLoop.start();

    Animated.timing(coverScaleAnim, {
      toValue: 0.68,
      duration: 2100,
      easing: Easing.out(Easing.cubic),
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
      auroraLoop.stop();
      mistLoop.stop();
      sweepLoop.stop();
    };
  }, [
    auroraAnim,
    coverScaleAnim,
    mistAnim,
    onFinish,
    subtitleOpacityAnim,
    sweepAnim,
    titleOpacityAnim,
    titleScaleAnim,
    titleTranslateAnim,
  ]);

  const auroraOpacity = auroraAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.42],
  });

  const auroraScale = auroraAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.06],
  });

  const mistOpacity = mistAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.3],
  });

  const mistTranslateY = mistAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -14],
  });

  const sweepTranslateX = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH * 1.2, SCREEN_WIDTH * 1.2],
  });

  const sweepOpacity = sweepAnim.interpolate({
    inputRange: [0, 0.14, 0.55, 1],
    outputRange: [0, 0.24, 0.18, 0],
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
          styles.auroraGlow,
          {
            opacity: auroraOpacity,
            transform: [{ scale: auroraScale }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.mistGlow,
          {
            opacity: mistOpacity,
            transform: [{ translateY: mistTranslateY }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.sweepLight,
          {
            opacity: sweepOpacity,
            transform: [{ translateX: sweepTranslateX }, { rotate: '-14deg' }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteTop,
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteBottom,
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
          Palette Extractor for Game Art
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
    backgroundColor: 'rgba(5, 7, 16, 0.18)',
  },
  auroraGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_WIDTH * 0.95,
    borderRadius: (SCREEN_WIDTH * 0.95) / 2,
    backgroundColor: 'rgba(185, 200, 255, 0.28)',
    shadowColor: '#d8e1ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 36,
  },
  mistGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.15,
    height: SCREEN_WIDTH * 0.72,
    borderRadius: (SCREEN_WIDTH * 0.72) / 2,
    backgroundColor: 'rgba(104, 134, 255, 0.24)',
  },
  sweepLight: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.4,
    height: '130%',
    borderRadius: SCREEN_WIDTH * 0.2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  vignetteTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  vignetteBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
  },
  brandBlock: {
    position: 'absolute',
    top: '28%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  brandTitle: {
    color: '#f5f7ff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 46,
    letterSpacing: -0.7,
    textShadowColor: 'rgba(3, 6, 20, 0.68)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  brandSubtitle: {
    marginTop: 8,
    color: 'rgba(243, 246, 255, 0.92)',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
