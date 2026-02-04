import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AD_DURATION = 5; // seconds (shorter for mock, real ads are 15-30s)

interface MockRewardedAdProps {
  visible: boolean;
  onClose: () => void;
  onRewardEarned: () => void;
}

export function MockRewardedAd({ visible, onClose, onRewardEarned }: MockRewardedAdProps) {
  const [countdown, setCountdown] = useState(AD_DURATION);
  const [canSkip, setCanSkip] = useState(false);
  const [rewardEarned, setRewardEarned] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset state
      setCountdown(AD_DURATION);
      setCanSkip(false);
      setRewardEarned(false);
      progressAnim.setValue(0);

      // Start progress animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: AD_DURATION * 1000,
        useNativeDriver: false,
      }).start();

      // Countdown timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanSkip(true);
            setRewardEarned(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [visible]);

  const handleClose = () => {
    if (rewardEarned) {
      onRewardEarned();
    }
    onClose();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {
        if (canSkip) handleClose();
      }}
    >
      <View style={styles.container}>
        {/* Mock Ad Content */}
        <View style={styles.adContent}>
          <View style={styles.adBanner}>
            <Text style={styles.adLabel}>AD</Text>
          </View>

          {/* Mock ad visual */}
          <View style={styles.adVisual}>
            <Ionicons name="game-controller" size={80} color="#6366f1" />
            <Text style={styles.adTitle}>GamePalette Pro</Text>
            <Text style={styles.adSubtitle}>Unlimited Color Extractions</Text>
            <Text style={styles.adDescription}>
              Watch this ad to get +5 free extractions!
            </Text>
          </View>

          {/* Mock ad features */}
          <View style={styles.adFeatures}>
            <View style={styles.featureItem}>
              <Ionicons name="infinite" size={24} color="#22c55e" />
              <Text style={styles.featureText}>Unlimited Extractions</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="color-palette" size={24} color="#f59e0b" />
              <Text style={styles.featureText}>All Style Filters</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="sparkles" size={24} color="#ec4899" />
              <Text style={styles.featureText}>Premium Features</Text>
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
        </View>

        {/* Bottom section */}
        <View style={styles.bottomSection}>
          {rewardEarned ? (
            <View style={styles.rewardEarned}>
              <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
              <Text style={styles.rewardText}>+5 Extractions Earned!</Text>
            </View>
          ) : (
            <Text style={styles.countdown}>
              Ad ends in {countdown}s
            </Text>
          )}

          <TouchableOpacity
            style={[styles.closeButton, !canSkip && styles.closeButtonDisabled]}
            onPress={handleClose}
            disabled={!canSkip}
          >
            <Text style={[styles.closeButtonText, !canSkip && styles.closeButtonTextDisabled]}>
              {canSkip ? 'Claim Reward' : `Wait ${countdown}s...`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Developer notice */}
        <View style={styles.devNotice}>
          <Text style={styles.devNoticeText}>
            [DEV] Mock Ad - Will be replaced with real AdMob
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a10',
  },
  adContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  adBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  adVisual: {
    alignItems: 'center',
    marginBottom: 40,
  },
  adTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  adSubtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
  },
  adDescription: {
    fontSize: 18,
    color: '#6366f1',
    marginTop: 24,
    textAlign: 'center',
    fontWeight: '600',
  },
  adFeatures: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16161e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: SCREEN_WIDTH - 80,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#2d2d38',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  bottomSection: {
    padding: 20,
    paddingBottom: 50,
    alignItems: 'center',
    gap: 16,
  },
  countdown: {
    fontSize: 14,
    color: '#888',
  },
  rewardEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  closeButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonDisabled: {
    backgroundColor: '#2d2d38',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  closeButtonTextDisabled: {
    color: '#666',
  },
  devNotice: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  devNoticeText: {
    fontSize: 10,
    color: '#444',
  },
});
