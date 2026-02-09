import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Image } from 'expo-image';

interface SplashScreenProps {
  onFinish: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY_RING_SIZE = Math.min(SCREEN_WIDTH * 0.52, 250);
const SECONDARY_RING_SIZE = PRIMARY_RING_SIZE * 1.24;

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const coverScaleAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;

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

    ringLoop.start();
    ring2Loop.start();

    Animated.timing(coverScaleAnim, {
      toValue: 1.03,
      duration: 1300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 1350);

    return () => {
      clearTimeout(finishTimer);
      ringLoop.stop();
      ring2Loop.stop();
    };
  }, [coverScaleAnim, onFinish, ring2Anim, ringAnim]);

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
});
