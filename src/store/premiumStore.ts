import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// CONSTANTS
// ============================================

const FREE_DAILY_EXTRACTIONS = 5;
const REWARD_EXTRACTIONS = 5; // Extra extractions from watching ad

// ============================================
// TYPES
// ============================================

interface PremiumState {
  // Premium status
  isPremium: boolean;

  // Daily limits
  dailyExtractionsUsed: number;
  bonusExtractions: number; // From watching ads
  lastResetDate: string; // YYYY-MM-DD format

  // Ad tracking
  adsWatchedToday: number;

  // Actions
  useExtraction: () => boolean; // Returns false if limit reached
  watchRewardedAd: () => void;
  canExtract: () => boolean;
  getRemainingExtractions: () => number;
  resetDailyLimits: () => void;
  setPremium: (value: boolean) => void;

  // For development/testing
  _resetAll: () => void;
}

// ============================================
// HELPERS
// ============================================

const getTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// ============================================
// STORE
// ============================================

export const usePremiumStore = create<PremiumState>()(
  persist(
    (set, get) => ({
      // Initial state
      isPremium: false,
      dailyExtractionsUsed: 0,
      bonusExtractions: 0,
      lastResetDate: getTodayString(),
      adsWatchedToday: 0,

      // Check and reset daily limits if new day
      resetDailyLimits: () => {
        const today = getTodayString();
        const state = get();

        if (state.lastResetDate !== today) {
          set({
            dailyExtractionsUsed: 0,
            bonusExtractions: 0,
            adsWatchedToday: 0,
            lastResetDate: today,
          });
        }
      },

      // Check if user can extract
      canExtract: () => {
        const state = get();

        // Premium users have unlimited extractions
        if (state.isPremium) return true;

        // Check daily reset
        const today = getTodayString();
        if (state.lastResetDate !== today) {
          get().resetDailyLimits();
          return true;
        }

        const totalAvailable = FREE_DAILY_EXTRACTIONS + state.bonusExtractions;
        return state.dailyExtractionsUsed < totalAvailable;
      },

      // Get remaining extractions
      getRemainingExtractions: () => {
        const state = get();

        // Premium = unlimited
        if (state.isPremium) return 999;

        // Check daily reset
        const today = getTodayString();
        if (state.lastResetDate !== today) {
          return FREE_DAILY_EXTRACTIONS;
        }

        const totalAvailable = FREE_DAILY_EXTRACTIONS + state.bonusExtractions;
        return Math.max(0, totalAvailable - state.dailyExtractionsUsed);
      },

      // Use one extraction
      useExtraction: () => {
        const state = get();

        // Premium users don't consume extractions
        if (state.isPremium) return true;

        // Check daily reset first
        const today = getTodayString();
        if (state.lastResetDate !== today) {
          set({
            dailyExtractionsUsed: 1,
            bonusExtractions: 0,
            adsWatchedToday: 0,
            lastResetDate: today,
          });
          return true;
        }

        // Check if can extract
        if (!get().canExtract()) return false;

        set({ dailyExtractionsUsed: state.dailyExtractionsUsed + 1 });
        return true;
      },

      // Watch rewarded ad (mock)
      watchRewardedAd: () => {
        const state = get();

        // Reset if new day
        const today = getTodayString();
        if (state.lastResetDate !== today) {
          set({
            dailyExtractionsUsed: 0,
            bonusExtractions: REWARD_EXTRACTIONS,
            adsWatchedToday: 1,
            lastResetDate: today,
          });
        } else {
          set({
            bonusExtractions: state.bonusExtractions + REWARD_EXTRACTIONS,
            adsWatchedToday: state.adsWatchedToday + 1,
          });
        }
      },

      // Set premium status
      setPremium: (value: boolean) => {
        set({ isPremium: value });
      },

      // Development: reset all
      _resetAll: () => {
        set({
          isPremium: false,
          dailyExtractionsUsed: 0,
          bonusExtractions: 0,
          lastResetDate: getTodayString(),
          adsWatchedToday: 0,
        });
      },
    }),
    {
      name: 'gamepalette-premium',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
