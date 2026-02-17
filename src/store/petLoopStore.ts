import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CreatureType = 'chick' | 'sprout' | 'bunny';
export type DecorationId = 'sun-lamp' | 'moss-rock' | 'rain-bell';
export type CareAction = 'feed' | 'play';

export interface TodoItem {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
  rewardCoins: number;
  rewardXp: number;
  createdAt: number;
  completedAt?: number;
}

interface PetLoopState {
  petName: string;
  creature: CreatureType;
  level: number;
  xp: number;
  xpGoal: number;
  coins: number;
  happiness: number;
  energy: number;
  habitatTier: number;
  streak: number;
  todos: TodoItem[];
  purchasedDecorations: DecorationId[];
  completionLog: Record<string, number>;
  lastCompletedDate: string | null;
  lastActiveDate: string;
  addTodo: (title: string, dueDate?: string, rewardCoins?: number, rewardXp?: number) => void;
  completeTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  runDailyTick: () => void;
  careCreature: (action: CareAction) => void;
  changeCreature: (creature: CreatureType) => void;
  purchaseDecoration: (id: DecorationId, cost: number) => boolean;
  seedStarterTodos: (dateKey?: string) => void;
}

const MAX_STAT = 100;
const FEED_COST = 20;
const STARTER_TITLES = ['아침 물 1잔 마시기', '오늘 핵심 할 일 1개 끝내기', '산책 10분'];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const toDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day);
};

const createDateWithOffset = (base: Date, dayOffset: number): Date => {
  const next = new Date(base);
  next.setDate(next.getDate() + dayOffset);
  return next;
};

const dayDifference = (from: string, to: string): number => {
  const fromDate = parseDateKey(from);
  const toDate = parseDateKey(to);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / msPerDay);
};

const nextXpGoal = (level: number): number => 60 + (level - 1) * 22;

const makeTodo = (title: string, dueDate: string, rewardCoins: number, rewardXp: number): TodoItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  title,
  dueDate,
  done: false,
  rewardCoins,
  rewardXp,
  createdAt: Date.now(),
});

export const getRecentDateKeys = (days: number): string[] => {
  const today = new Date();
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(toDateKey(createDateWithOffset(today, -i)));
  }
  return result;
};

export const usePetLoopStore = create<PetLoopState>()(
  persist(
    (set, get) => ({
      petName: '콩콩이',
      creature: 'chick',
      level: 1,
      xp: 0,
      xpGoal: nextXpGoal(1),
      coins: 40,
      happiness: 72,
      energy: 76,
      habitatTier: 1,
      streak: 0,
      todos: [],
      purchasedDecorations: [],
      completionLog: {},
      lastCompletedDate: null,
      lastActiveDate: toDateKey(),

      addTodo: (title, dueDate = toDateKey(), rewardCoins = 18, rewardXp = 16) => {
        const trimmed = title.trim();
        if (!trimmed) {
          return;
        }

        set((state) => ({
          todos: [makeTodo(trimmed, dueDate, rewardCoins, rewardXp), ...state.todos],
        }));
      },

      completeTodo: (id) => {
        set((state) => {
          const target = state.todos.find((todo) => todo.id === id);
          if (!target || target.done) {
            return state;
          }

          const now = Date.now();
          const today = toDateKey(new Date());
          const yesterday = toDateKey(createDateWithOffset(new Date(), -1));

          const updatedTodos = state.todos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  done: true,
                  completedAt: now,
                }
              : todo
          );

          let upgradedLevel = state.level;
          let upgradedXp = state.xp + target.rewardXp;
          let upgradedXpGoal = state.xpGoal;
          let levelUpBonusCoins = 0;

          while (upgradedXp >= upgradedXpGoal) {
            upgradedXp -= upgradedXpGoal;
            upgradedLevel += 1;
            upgradedXpGoal = nextXpGoal(upgradedLevel);
            levelUpBonusCoins += 20;
          }

          const completedCountToday = (state.completionLog[today] ?? 0) + 1;
          const nextCompletionLog = {
            ...state.completionLog,
            [today]: completedCountToday,
          };

          let nextStreak = state.streak;
          let nextCompletedDate = state.lastCompletedDate;
          if (state.lastCompletedDate !== today) {
            if (state.lastCompletedDate === yesterday) {
              nextStreak = state.streak + 1;
            } else {
              nextStreak = 1;
            }
            nextCompletedDate = today;
          }

          return {
            todos: updatedTodos,
            level: upgradedLevel,
            xp: upgradedXp,
            xpGoal: upgradedXpGoal,
            coins: state.coins + target.rewardCoins + levelUpBonusCoins,
            happiness: clamp(state.happiness + 7, 0, MAX_STAT),
            energy: clamp(state.energy - 4, 0, MAX_STAT),
            habitatTier: Math.max(state.habitatTier, Math.floor((upgradedLevel + 1) / 3)),
            completionLog: nextCompletionLog,
            streak: nextStreak,
            lastCompletedDate: nextCompletedDate,
            lastActiveDate: today,
          };
        });
      },

      removeTodo: (id) => {
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
        }));
      },

      runDailyTick: () => {
        set((state) => {
          const today = toDateKey(new Date());
          if (state.lastActiveDate === today) {
            return state;
          }

          const daysPassed = Math.max(dayDifference(state.lastActiveDate, today), 1);
          const staleCutoff = toDateKey(createDateWithOffset(new Date(), -5));
          const trimmedTodos = state.todos.filter((todo) => {
            if (todo.done) {
              return true;
            }
            return dayDifference(todo.dueDate, staleCutoff) <= 0;
          });

          let nextStreak = state.streak;
          if (state.lastCompletedDate) {
            const completedGap = dayDifference(state.lastCompletedDate, today);
            if (completedGap > 1) {
              nextStreak = 0;
            }
          }

          return {
            energy: clamp(state.energy - daysPassed * 8, 0, MAX_STAT),
            happiness: clamp(state.happiness - daysPassed * 6, 0, MAX_STAT),
            streak: nextStreak,
            todos: trimmedTodos,
            lastActiveDate: today,
          };
        });
      },

      careCreature: (action) => {
        set((state) => {
          if (action === 'feed') {
            if (state.coins < FEED_COST) {
              return state;
            }
            return {
              coins: state.coins - FEED_COST,
              energy: clamp(state.energy + 22, 0, MAX_STAT),
              happiness: clamp(state.happiness + 10, 0, MAX_STAT),
            };
          }

          return {
            energy: clamp(state.energy - 7, 0, MAX_STAT),
            happiness: clamp(state.happiness + 16, 0, MAX_STAT),
            xp: clamp(state.xp + 3, 0, state.xpGoal),
          };
        });
      },

      changeCreature: (creature) => {
        set({ creature });
      },

      purchaseDecoration: (id, cost) => {
        const current = get();
        if (current.purchasedDecorations.includes(id) || current.coins < cost) {
          return false;
        }

        set((state) => ({
          coins: state.coins - cost,
          happiness: clamp(state.happiness + 4, 0, MAX_STAT),
          purchasedDecorations: [...state.purchasedDecorations, id],
        }));
        return true;
      },

      seedStarterTodos: (dateKey = toDateKey()) => {
        set((state) => {
          const hasDateTodos = state.todos.some((todo) => todo.dueDate === dateKey);
          if (hasDateTodos) {
            return state;
          }

          const starterTodos = STARTER_TITLES.map((title, index) =>
            makeTodo(title, dateKey, 14 + index * 3, 12 + index * 2)
          );
          return {
            todos: [...starterTodos, ...state.todos],
          };
        });
      },
    }),
    {
      name: 'pet-loop-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.runDailyTick();
      },
    }
  )
);
