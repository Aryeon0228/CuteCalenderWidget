import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CreatureType = 'chick' | 'sprout' | 'bunny';
export type DecorationId = 'sun-lamp' | 'moss-rock' | 'rain-bell';
export type CareAction = 'feed' | 'play';
export type DueDateMode = 'date' | 'ongoing' | 'unscheduled';
export type Quadrant = 'do' | 'schedule' | 'delegate' | 'eliminate';

export interface TodoItem {
  id: string;
  title: string;
  startDate: string;
  dueDateMode: DueDateMode;
  dueDate: string | null;
  importance: boolean;
  urgency: boolean;
  done: boolean;
  rewardCoins: number;
  rewardXp: number;
  createdAt: number;
  completedAt?: number;
}

export interface AddTodoInput {
  title: string;
  startDate?: string;
  dueDateMode?: DueDateMode;
  dueDate?: string | null;
  rewardCoins?: number;
  rewardXp?: number;
  importance?: boolean;
  urgency?: boolean;
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
  addTodo: (input: AddTodoInput) => void;
  completeTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  setTodoPriority: (id: string, priority: Partial<Pick<TodoItem, 'importance' | 'urgency'>>) => void;
  setTodoQuadrant: (id: string, quadrant: Quadrant) => void;
  runDailyTick: () => void;
  careCreature: (action: CareAction) => void;
  changeCreature: (creature: CreatureType) => void;
  purchaseDecoration: (id: DecorationId, cost: number) => boolean;
  seedStarterTodos: (dateKey?: string) => void;
}

type PersistedTodo = Partial<TodoItem> & {
  dueDate?: unknown;
  dueDateMode?: unknown;
  startDate?: unknown;
  importance?: unknown;
  urgency?: unknown;
};

type PersistedPetLoopData = Partial<
  Omit<
    PetLoopState,
    | 'addTodo'
    | 'completeTodo'
    | 'removeTodo'
    | 'setTodoPriority'
    | 'setTodoQuadrant'
    | 'runDailyTick'
    | 'careCreature'
    | 'changeCreature'
    | 'purchaseDecoration'
    | 'seedStarterTodos'
  >
> & {
  todos?: PersistedTodo[];
};

const MAX_STAT = 100;
const FEED_COST = 20;
const STARTER_TITLES = ['아침 물 1잔 마시기', '오늘 핵심 할 일 1개 끝내기', '산책 10분'];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const toDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const isValidDateKey = (dateKey: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

const normalizeDateKey = (value: string | null | undefined, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  return isValidDateKey(value) ? value : fallback;
};

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

const resolveQuadrant = (importance: boolean, urgency: boolean): Quadrant => {
  if (importance && urgency) return 'do';
  if (importance && !urgency) return 'schedule';
  if (!importance && urgency) return 'delegate';
  return 'eliminate';
};

const resolveFlagsByQuadrant = (quadrant: Quadrant): { importance: boolean; urgency: boolean } => {
  if (quadrant === 'do') return { importance: true, urgency: true };
  if (quadrant === 'schedule') return { importance: true, urgency: false };
  if (quadrant === 'delegate') return { importance: false, urgency: true };
  return { importance: false, urgency: false };
};

const calculateGrowth = (
  level: number,
  xp: number,
  xpGoal: number,
  earnedXp: number
): { level: number; xp: number; xpGoal: number; levelUpCoins: number } => {
  let nextLevel = level;
  let nextXp = xp + earnedXp;
  let nextGoal = xpGoal;
  let levelUpCoins = 0;

  while (nextXp >= nextGoal) {
    nextXp -= nextGoal;
    nextLevel += 1;
    nextGoal = nextXpGoal(nextLevel);
    levelUpCoins += 20;
  }

  return {
    level: nextLevel,
    xp: nextXp,
    xpGoal: nextGoal,
    levelUpCoins,
  };
};

const sanitizeDueDate = (
  dueDateMode: DueDateMode,
  dueDate: string | null | undefined,
  startDate: string
): string | null => {
  if (dueDateMode !== 'date') {
    return null;
  }
  const normalized = normalizeDateKey(dueDate, startDate);
  return dayDifference(startDate, normalized) >= 0 ? normalized : startDate;
};

const makeTodo = (input: AddTodoInput): TodoItem => {
  const today = toDateKey();
  const startDate = normalizeDateKey(input.startDate, today);
  const dueDateMode = input.dueDateMode ?? 'date';

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: input.title,
    startDate,
    dueDateMode,
    dueDate: sanitizeDueDate(dueDateMode, input.dueDate, startDate),
    importance: input.importance ?? true,
    urgency: input.urgency ?? true,
    done: false,
    rewardCoins: input.rewardCoins ?? 18,
    rewardXp: input.rewardXp ?? 16,
    createdAt: Date.now(),
  };
};

const normalizePersistedTodo = (todo: PersistedTodo, index: number): TodoItem => {
  const today = toDateKey();
  const fallbackDue = normalizeDateKey(
    typeof todo.dueDate === 'string' ? todo.dueDate : null,
    today
  );
  const startDate = normalizeDateKey(
    typeof todo.startDate === 'string' ? todo.startDate : null,
    fallbackDue
  );

  const dueDateMode: DueDateMode =
    todo.dueDateMode === 'ongoing' ||
    todo.dueDateMode === 'unscheduled' ||
    todo.dueDateMode === 'date'
      ? todo.dueDateMode
      : 'date';

  return {
    id: typeof todo.id === 'string' ? todo.id : `legacy-${index}-${Date.now()}`,
    title: typeof todo.title === 'string' ? todo.title : '이전 할 일',
    startDate,
    dueDateMode,
    dueDate: sanitizeDueDate(
      dueDateMode,
      typeof todo.dueDate === 'string' ? todo.dueDate : null,
      startDate
    ),
    importance: typeof todo.importance === 'boolean' ? todo.importance : true,
    urgency: typeof todo.urgency === 'boolean' ? todo.urgency : true,
    done: Boolean(todo.done),
    rewardCoins: typeof todo.rewardCoins === 'number' ? todo.rewardCoins : 18,
    rewardXp: typeof todo.rewardXp === 'number' ? todo.rewardXp : 16,
    createdAt: typeof todo.createdAt === 'number' ? todo.createdAt : Date.now(),
    completedAt: typeof todo.completedAt === 'number' ? todo.completedAt : undefined,
  };
};

export const getRecentDateKeys = (days: number): string[] => {
  const today = new Date();
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(toDateKey(createDateWithOffset(today, -i)));
  }
  return result;
};

export const getTodoQuadrant = (todo: Pick<TodoItem, 'importance' | 'urgency'>): Quadrant =>
  resolveQuadrant(todo.importance, todo.urgency);

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

      addTodo: (input) => {
        const trimmed = input.title.trim();
        if (!trimmed) {
          return;
        }

        set((state) => ({
          todos: [makeTodo({ ...input, title: trimmed }), ...state.todos],
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
          const growth = calculateGrowth(state.level, state.xp, state.xpGoal, target.rewardXp);

          const updatedTodos = state.todos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  done: true,
                  completedAt: now,
                }
              : todo
          );

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
            level: growth.level,
            xp: growth.xp,
            xpGoal: growth.xpGoal,
            coins: state.coins + target.rewardCoins + growth.levelUpCoins,
            happiness: clamp(state.happiness + 7, 0, MAX_STAT),
            energy: clamp(state.energy - 4, 0, MAX_STAT),
            habitatTier: Math.max(state.habitatTier, Math.floor((growth.level + 1) / 3)),
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

      setTodoPriority: (id, priority) => {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  importance: priority.importance ?? todo.importance,
                  urgency: priority.urgency ?? todo.urgency,
                }
              : todo
          ),
        }));
      },

      setTodoQuadrant: (id, quadrant) => {
        const flags = resolveFlagsByQuadrant(quadrant);
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  ...flags,
                }
              : todo
          ),
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
            if (todo.dueDateMode === 'date' && todo.dueDate) {
              return dayDifference(todo.dueDate, staleCutoff) <= 0;
            }
            if (todo.dueDateMode === 'ongoing') {
              return true;
            }
            return dayDifference(todo.startDate, staleCutoff) <= 0;
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

          const growth = calculateGrowth(state.level, state.xp, state.xpGoal, 3);
          return {
            level: growth.level,
            xp: growth.xp,
            xpGoal: growth.xpGoal,
            coins: state.coins + growth.levelUpCoins,
            energy: clamp(state.energy - 7, 0, MAX_STAT),
            happiness: clamp(state.happiness + 16, 0, MAX_STAT),
            habitatTier: Math.max(state.habitatTier, Math.floor((growth.level + 1) / 3)),
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
          const existingTitleSet = new Set(
            state.todos
              .filter((todo) => todo.startDate === dateKey)
              .map((todo) => todo.title)
          );
          const starterTodos = STARTER_TITLES.filter((title) => !existingTitleSet.has(title)).map(
            (title, index) =>
              makeTodo({
                title,
                startDate: dateKey,
                dueDateMode: 'date',
                dueDate: dateKey,
                rewardCoins: 14 + index * 3,
                rewardXp: 12 + index * 2,
                importance: true,
                urgency: true,
              })
          );

          if (starterTodos.length === 0) {
            return state;
          }

          return {
            todos: [...starterTodos, ...state.todos],
          };
        });
      },
    }),
    {
      name: 'pet-loop-storage',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        petName: state.petName,
        creature: state.creature,
        level: state.level,
        xp: state.xp,
        xpGoal: state.xpGoal,
        coins: state.coins,
        happiness: state.happiness,
        energy: state.energy,
        habitatTier: state.habitatTier,
        streak: state.streak,
        todos: state.todos,
        purchasedDecorations: state.purchasedDecorations,
        completionLog: state.completionLog,
        lastCompletedDate: state.lastCompletedDate,
        lastActiveDate: state.lastActiveDate,
      }),
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState as never;
        }

        const state = persistedState as PersistedPetLoopData;
        const today = toDateKey();
        return {
          ...state,
          todos: Array.isArray(state.todos)
            ? state.todos.map((todo, index) => normalizePersistedTodo(todo, index))
            : [],
          lastActiveDate: normalizeDateKey(
            typeof state.lastActiveDate === 'string' ? state.lastActiveDate : null,
            today
          ),
          lastCompletedDate:
            typeof state.lastCompletedDate === 'string' && isValidDateKey(state.lastCompletedDate)
              ? state.lastCompletedDate
              : null,
        } as never;
      },
      onRehydrateStorage: () => (state) => {
        state?.runDailyTick();
      },
    }
  )
);
