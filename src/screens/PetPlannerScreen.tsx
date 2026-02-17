import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  CareAction,
  CreatureType,
  DecorationId,
  DueDateMode,
  Quadrant,
  TodoItem,
} from '../store/petLoopStore';
import {
  getRecentDateKeys,
  getTodoQuadrant,
  isValidDateKey,
  toDateKey,
  usePetLoopStore,
} from '../store/petLoopStore';

interface CreatureMeta {
  id: CreatureType;
  emoji: string;
  title: string;
}

interface DecorationItem {
  id: DecorationId;
  emoji: string;
  title: string;
  cost: number;
}

interface QuadrantMeta {
  id: Quadrant;
  title: string;
  subtitle: string;
  background: string;
  border: string;
}

const CREATURES: CreatureMeta[] = [
  { id: 'chick', emoji: '🐥', title: '병아리' },
  { id: 'sprout', emoji: '🌱', title: '새싹' },
  { id: 'bunny', emoji: '🐰', title: '토끼' },
];

const DECORATIONS: DecorationItem[] = [
  { id: 'sun-lamp', emoji: '🪔', title: '햇살 램프', cost: 28 },
  { id: 'moss-rock', emoji: '🪨', title: '이끼 바위', cost: 34 },
  { id: 'rain-bell', emoji: '🔔', title: '빗방울 벨', cost: 48 },
];

const QUADRANT_META: QuadrantMeta[] = [
  {
    id: 'do',
    title: 'Q1 지금 하기',
    subtitle: '중요 + 긴급',
    background: '#fff4d8',
    border: '#eed59a',
  },
  {
    id: 'schedule',
    title: 'Q2 일정 잡기',
    subtitle: '중요 + 비긴급',
    background: '#eaf6dd',
    border: '#bdd8a5',
  },
  {
    id: 'delegate',
    title: 'Q3 위임/간단 처리',
    subtitle: '비중요 + 긴급',
    background: '#def3f8',
    border: '#b3d8df',
  },
  {
    id: 'eliminate',
    title: 'Q4 줄이기',
    subtitle: '비중요 + 비긴급',
    background: '#f0ebfb',
    border: '#d3c8e8',
  },
];

const DUE_MODE_META: Array<{ id: DueDateMode; title: string }> = [
  { id: 'date', title: '날짜 지정' },
  { id: 'ongoing', title: '계속' },
  { id: 'unscheduled', title: '미정' },
];

const QUADRANT_LABEL: Record<Quadrant, string> = {
  do: 'Q1',
  schedule: 'Q2',
  delegate: 'Q3',
  eliminate: 'Q4',
};

const dayLabel = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const parsed = new Date(year, month - 1, day);
  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  return labels[parsed.getDay()];
};

const percent = (value: number, max: number): `${number}%` =>
  `${Math.min(100, Math.round((value / max) * 100))}%`;

const dateKeyToEpoch = (dateKey: string): number => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day).getTime();
};

const isOnOrBefore = (leftDateKey: string, rightDateKey: string): boolean =>
  dateKeyToEpoch(leftDateKey) <= dateKeyToEpoch(rightDateKey);

const isBefore = (leftDateKey: string, rightDateKey: string): boolean =>
  dateKeyToEpoch(leftDateKey) < dateKeyToEpoch(rightDateKey);

const getNextQuadrant = (quadrant: Quadrant): Quadrant => {
  const ordered: Quadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];
  const index = ordered.indexOf(quadrant);
  return ordered[(index + 1) % ordered.length];
};

const getDueLabel = (mode: DueDateMode, dueDate: string | null): string => {
  if (mode === 'ongoing') return '마감: 계속';
  if (mode === 'unscheduled') return '마감: 미정';
  return `마감: ${dueDate ?? '-'}`;
};

const getTodoScheduleSummary = (todo: TodoItem): string =>
  `시작: ${todo.startDate} · ${getDueLabel(todo.dueDateMode, todo.dueDate)}`;

const creatureMood = (happiness: number, energy: number): string => {
  if (happiness >= 75 && energy >= 65) return '반짝반짝 최고 컨디션!';
  if (happiness >= 55) return '기분이 좋아요. 오늘도 성장 중!';
  if (energy < 35) return '조금 지친 상태예요. 먹이와 휴식이 필요해요.';
  return '심심해요. 할 일을 끝내고 놀아 주세요.';
};

const rewardPreset = (tier: 'mini' | 'focus'): { coins: number; xp: number } =>
  tier === 'mini' ? { coins: 12, xp: 10 } : { coins: 22, xp: 18 };

const sortVisibleTodos = (items: TodoItem[]): TodoItem[] =>
  [...items].sort((a, b) => {
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    const byStart = dateKeyToEpoch(a.startDate) - dateKeyToEpoch(b.startDate);
    if (byStart !== 0) return byStart;
    return b.createdAt - a.createdAt;
  });

export default function PetPlannerScreen() {
  const {
    petName,
    creature,
    level,
    xp,
    xpGoal,
    coins,
    happiness,
    energy,
    habitatTier,
    streak,
    todos,
    purchasedDecorations,
    completionLog,
    addTodo,
    completeTodo,
    removeTodo,
    setTodoPriority,
    setTodoQuadrant,
    runDailyTick,
    careCreature,
    changeCreature,
    purchaseDecoration,
    seedStarterTodos,
  } = usePetLoopStore((state) => state);

  const todayKey = useMemo(() => toDateKey(), []);
  const recentDates = useMemo(() => getRecentDateKeys(7), []);
  const selectedCreature = useMemo(
    () => CREATURES.find((entry) => entry.id === creature) ?? CREATURES[0],
    [creature]
  );

  const [todoDraft, setTodoDraft] = useState('');
  const [tier, setTier] = useState<'mini' | 'focus'>('mini');
  const [startDateInput, setStartDateInput] = useState(todayKey);
  const [dueDateMode, setDueDateMode] = useState<DueDateMode>('date');
  const [dueDateInput, setDueDateInput] = useState(todayKey);
  const [isImportant, setIsImportant] = useState(true);
  const [isUrgent, setIsUrgent] = useState(true);

  const pulse = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;

  const openTodos = useMemo(
    () => todos.filter((todo) => !todo.done && isOnOrBefore(todo.startDate, todayKey)),
    [todos, todayKey]
  );

  const visibleTodos = useMemo(() => {
    const merged = todos.filter((todo) => {
      if (!todo.done) {
        return isOnOrBefore(todo.startDate, todayKey);
      }
      if (!todo.completedAt) {
        return false;
      }
      return toDateKey(new Date(todo.completedAt)) === todayKey;
    });
    return sortVisibleTodos(merged);
  }, [todos, todayKey]);

  const matrixBuckets = useMemo(() => {
    const grouped: Record<Quadrant, TodoItem[]> = {
      do: [],
      schedule: [],
      delegate: [],
      eliminate: [],
    };
    openTodos.forEach((todo) => {
      grouped[getTodoQuadrant(todo)].push(todo);
    });
    return grouped;
  }, [openTodos]);

  const todayDoneCount = completionLog[todayKey] ?? 0;
  const loopSummary =
    openTodos.length === 0 && todayDoneCount === 0
      ? '오늘의 퀘스트를 추가해 주세요.'
      : `완료 ${todayDoneCount} · 진행중 ${openTodos.length}`;

  useEffect(() => {
    runDailyTick();
    seedStarterTodos(todayKey);
  }, [runDailyTick, seedStarterTodos, todayKey]);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -8,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => {
      floatLoop.stop();
    };
  }, [float]);

  const triggerRewardPulse = () => {
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1.08,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onAddTodo = () => {
    if (!todoDraft.trim()) {
      return;
    }

    const safeStartDate = isValidDateKey(startDateInput) ? startDateInput : todayKey;
    const safeDueDate = isValidDateKey(dueDateInput) ? dueDateInput : safeStartDate;
    const reward = rewardPreset(tier);

    addTodo({
      title: todoDraft,
      startDate: safeStartDate,
      dueDateMode,
      dueDate: dueDateMode === 'date' ? safeDueDate : null,
      rewardCoins: reward.coins,
      rewardXp: reward.xp,
      importance: isImportant,
      urgency: isUrgent,
    });

    if (!isValidDateKey(startDateInput)) {
      setStartDateInput(safeStartDate);
    }
    if (dueDateMode === 'date' && !isValidDateKey(dueDateInput)) {
      setDueDateInput(safeDueDate);
    }

    setTodoDraft('');
    setIsImportant(true);
    setIsUrgent(true);
    triggerRewardPulse();
  };

  const onCompleteTodo = (todoId: string) => {
    completeTodo(todoId);
    triggerRewardPulse();
  };

  const onCarePress = (action: CareAction) => {
    careCreature(action);
    triggerRewardPulse();
  };

  const onBuyDecoration = (id: DecorationId, cost: number) => {
    const purchased = purchaseDecoration(id, cost);
    if (purchased) {
      triggerRewardPulse();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Pocket Terrarium Loop</Text>
          <Text style={styles.heroSubtitle}>할 일 완료 → 코인/XP → 돌봄/꾸미기 → 성장</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>오늘</Text>
              <Text style={styles.heroStatValue}>{loopSummary}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>연속</Text>
              <Text style={styles.heroStatValue}>{streak}일</Text>
            </View>
            <Animated.View style={[styles.heroStat, { transform: [{ scale: pulse }] }]}>
              <Text style={styles.heroStatLabel}>코인</Text>
              <Text style={styles.heroStatValue}>{coins}</Text>
            </Animated.View>
          </View>
        </View>

        <View style={styles.widgetCard}>
          <Text style={styles.widgetTitle}>홈 위젯 미리보기</Text>
          <View style={styles.widgetBody}>
            <Text style={styles.widgetEmoji}>{selectedCreature.emoji}</Text>
            <View style={styles.widgetCopy}>
              <Text style={styles.widgetMain}>{petName} Lv.{level}</Text>
              <Text style={styles.widgetSub}>남은 퀘스트 {openTodos.length}개</Text>
            </View>
            <Text style={styles.widgetReward}>🌾 {coins}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>테라리움</Text>
            <Text style={styles.cardBadge}>Habitat T{habitatTier}</Text>
          </View>

          <View style={styles.creatureRow}>
            {CREATURES.map((entry) => {
              const isSelected = entry.id === creature;
              return (
                <TouchableOpacity
                  key={entry.id}
                  onPress={() => changeCreature(entry.id)}
                  style={[styles.creatureChip, isSelected && styles.creatureChipSelected]}
                >
                  <Text style={styles.creatureChipEmoji}>{entry.emoji}</Text>
                  <Text style={[styles.creatureChipText, isSelected && styles.creatureChipTextSelected]}>
                    {entry.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.petStage}>
            <Animated.Text style={[styles.petEmoji, { transform: [{ translateY: float }] }]}>
              {selectedCreature.emoji}
            </Animated.Text>
            <Text style={styles.petMood}>{creatureMood(happiness, energy)}</Text>
          </View>

          <View style={styles.barGroup}>
            <Text style={styles.barLabel}>XP {xp}/{xpGoal}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFillPrimary, { width: percent(xp, xpGoal) }]} />
            </View>
            <Text style={styles.barLabel}>행복 {happiness}%</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFillWarm, { width: percent(happiness, 100) }]} />
            </View>
            <Text style={styles.barLabel}>에너지 {energy}%</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFillCool, { width: percent(energy, 100) }]} />
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.feedButton} onPress={() => onCarePress('feed')}>
              <Text style={styles.actionText}>먹이 주기 (-20)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playButton} onPress={() => onCarePress('play')}>
              <Text style={styles.actionText}>놀아주기</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>할 일 입력</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={todoDraft}
              onChangeText={setTodoDraft}
              placeholder="예: 보고서 30분 집중 작성"
              placeholderTextColor="#8a8f8b"
              returnKeyType="done"
              onSubmitEditing={onAddTodo}
            />
            <TouchableOpacity style={styles.addButton} onPress={onAddTodo}>
              <Text style={styles.addButtonText}>추가</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.scheduleRow}>
            <View style={styles.scheduleField}>
              <Text style={styles.scheduleLabel}>시작일</Text>
              <TextInput
                style={styles.scheduleInput}
                value={startDateInput}
                onChangeText={setStartDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9da29b"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.scheduleField}>
              <Text style={styles.scheduleLabel}>마감일</Text>
              {dueDateMode === 'date' ? (
                <TextInput
                  style={styles.scheduleInput}
                  value={dueDateInput}
                  onChangeText={setDueDateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9da29b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : (
                <View style={styles.scheduleGhost}>
                  <Text style={styles.scheduleGhostText}>
                    {dueDateMode === 'ongoing' ? '계속 진행' : '미정'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.modeRow}>
            {DUE_MODE_META.map((mode) => {
              const selected = mode.id === dueDateMode;
              return (
                <TouchableOpacity
                  key={mode.id}
                  onPress={() => setDueDateMode(mode.id)}
                  style={[styles.modeChip, selected && styles.modeChipSelected]}
                >
                  <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>
                    {mode.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.priorityRow}>
            <TouchableOpacity
              onPress={() => setIsImportant((prev) => !prev)}
              style={[styles.priorityChip, isImportant && styles.priorityChipSelected]}
            >
              <Text style={[styles.priorityChipText, isImportant && styles.priorityChipTextSelected]}>
                중요 {isImportant ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsUrgent((prev) => !prev)}
              style={[styles.priorityChip, isUrgent && styles.priorityChipSelected]}
            >
              <Text style={[styles.priorityChipText, isUrgent && styles.priorityChipTextSelected]}>
                긴급 {isUrgent ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tierRow}>
            <TouchableOpacity
              style={[styles.tierChip, tier === 'mini' && styles.tierChipSelected]}
              onPress={() => setTier('mini')}
            >
              <Text style={[styles.tierChipText, tier === 'mini' && styles.tierChipTextSelected]}>
                미니 퀘스트 (+12)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tierChip, tier === 'focus' && styles.tierChipSelected]}
              onPress={() => setTier('focus')}
            >
              <Text style={[styles.tierChipText, tier === 'focus' && styles.tierChipTextSelected]}>
                집중 퀘스트 (+22)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>오늘 활성 투두</Text>
          <View style={styles.todoList}>
            {visibleTodos.length === 0 && (
              <Text style={styles.emptyText}>시작일이 오늘 이전인 투두가 여기에 보여요.</Text>
            )}
            {visibleTodos.map((todo) => {
              const quadrant = getTodoQuadrant(todo);
              const overdue =
                !todo.done &&
                todo.dueDateMode === 'date' &&
                Boolean(todo.dueDate) &&
                isBefore(todo.dueDate as string, todayKey);

              return (
                <View key={todo.id} style={[styles.todoItem, todo.done && styles.todoItemDone]}>
                  <View style={styles.todoHeaderRow}>
                    <Text style={[styles.todoTitle, todo.done && styles.todoTitleDone]} numberOfLines={1}>
                      [{QUADRANT_LABEL[quadrant]}] {todo.title}
                    </Text>
                    {overdue && <Text style={styles.overdueBadge}>지남</Text>}
                  </View>

                  <Text style={styles.todoMeta}>{getTodoScheduleSummary(todo)}</Text>
                  <Text style={styles.todoMeta}>
                    보상 {todo.rewardCoins}코인 · {todo.rewardXp}XP
                  </Text>

                  {!todo.done && (
                    <View style={styles.todoControlRow}>
                      <TouchableOpacity style={styles.todoActionButton} onPress={() => onCompleteTodo(todo.id)}>
                        <Text style={styles.todoActionButtonText}>완료</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.todoMetaButton, todo.importance && styles.todoMetaButtonOn]}
                        onPress={() =>
                          setTodoPriority(todo.id, {
                            importance: !todo.importance,
                          })
                        }
                      >
                        <Text
                          style={[styles.todoMetaButtonText, todo.importance && styles.todoMetaButtonTextOn]}
                        >
                          중요
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.todoMetaButton, todo.urgency && styles.todoMetaButtonOn]}
                        onPress={() =>
                          setTodoPriority(todo.id, {
                            urgency: !todo.urgency,
                          })
                        }
                      >
                        <Text style={[styles.todoMetaButtonText, todo.urgency && styles.todoMetaButtonTextOn]}>
                          긴급
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.todoMetaButton}
                        onPress={() => setTodoQuadrant(todo.id, getNextQuadrant(quadrant))}
                      >
                        <Text style={styles.todoMetaButtonText}>사분면 이동</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.todoDeleteButton} onPress={() => removeTodo(todo.id)}>
                        <Text style={styles.todoDeleteButtonText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>아이젠하워 매트릭스</Text>
          <Text style={styles.matrixCaption}>각 칸에서 바로 완료하거나 다음 사분면으로 이동할 수 있어요.</Text>
          <View style={styles.matrixGrid}>
            {QUADRANT_META.map((meta) => {
              const items = matrixBuckets[meta.id];
              return (
                <View
                  key={meta.id}
                  style={[
                    styles.matrixCell,
                    {
                      backgroundColor: meta.background,
                      borderColor: meta.border,
                    },
                  ]}
                >
                  <Text style={styles.matrixTitle}>{meta.title}</Text>
                  <Text style={styles.matrixSubtitle}>{meta.subtitle}</Text>
                  <Text style={styles.matrixCount}>{items.length}개</Text>
                  <View style={styles.matrixTaskList}>
                    {items.length === 0 && <Text style={styles.matrixEmpty}>없음</Text>}
                    {items.slice(0, 4).map((todo) => (
                      <View key={todo.id} style={styles.matrixTaskRow}>
                        <Text style={styles.matrixTaskText} numberOfLines={1}>
                          {todo.title}
                        </Text>
                        <TouchableOpacity
                          style={styles.matrixTaskAction}
                          onPress={() => setTodoQuadrant(todo.id, getNextQuadrant(meta.id))}
                        >
                          <Text style={styles.matrixTaskActionText}>이동</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.matrixTaskAction, styles.matrixTaskActionDone]}
                          onPress={() => onCompleteTodo(todo.id)}
                        >
                          <Text style={styles.matrixTaskActionText}>완료</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>주간 성장 캘린더</Text>
          <View style={styles.calendarRow}>
            {recentDates.map((dateKey) => {
              const doneCount = completionLog[dateKey] ?? 0;
              const isToday = dateKey === todayKey;
              return (
                <View key={dateKey} style={[styles.dayCell, isToday && styles.dayCellToday]}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{dayLabel(dateKey)}</Text>
                  <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
                    {dateKey.split('-')[2]}
                  </Text>
                  <Text style={[styles.dayCount, doneCount > 0 && styles.dayCountActive]}>{doneCount}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>보상 상점</Text>
          {DECORATIONS.map((item) => {
            const owned = purchasedDecorations.includes(item.id);
            return (
              <View key={item.id} style={styles.shopItem}>
                <View style={styles.shopMeta}>
                  <Text style={styles.shopEmoji}>{item.emoji}</Text>
                  <View>
                    <Text style={styles.shopTitle}>{item.title}</Text>
                    <Text style={styles.shopCost}>{item.cost} 코인</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.shopButton, owned && styles.shopButtonOwned]}
                  disabled={owned}
                  onPress={() => onBuyDecoration(item.id, item.cost)}
                >
                  <Text style={[styles.shopButtonText, owned && styles.shopButtonTextOwned]}>
                    {owned ? '보유중' : '구매'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6ec',
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 36,
    gap: 14,
  },
  heroCard: {
    marginTop: 12,
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#fff4cf',
    borderWidth: 1,
    borderColor: '#e2d7ad',
  },
  heroTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    color: '#2c3825',
  },
  heroSubtitle: {
    marginTop: 4,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#4f5f4e',
    fontSize: 13,
  },
  heroStatsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  heroStat: {
    flex: 1,
    backgroundColor: '#fffdf4',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  heroStatLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#7b846f',
    fontSize: 12,
  },
  heroStatValue: {
    marginTop: 4,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#2a2f24',
    fontSize: 13,
  },
  widgetCard: {
    borderRadius: 18,
    backgroundColor: '#d9f3da',
    borderColor: '#b7d7b7',
    borderWidth: 1,
    padding: 14,
  },
  widgetTitle: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
    color: '#4a6c50',
    marginBottom: 8,
  },
  widgetBody: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6fff6',
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  widgetEmoji: {
    fontSize: 28,
  },
  widgetCopy: {
    flex: 1,
  },
  widgetMain: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#25402b',
    fontSize: 14,
  },
  widgetSub: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#5b765f',
    fontSize: 12,
    marginTop: 2,
  },
  widgetReward: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#3e5437',
    fontSize: 15,
  },
  card: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e9de',
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#2f3930',
    fontSize: 18,
  },
  cardBadge: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
    color: '#567451',
    backgroundColor: '#e5f5e1',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  creatureRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  creatureChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8ddd1',
    paddingVertical: 8,
    backgroundColor: '#f6f8f0',
  },
  creatureChipSelected: {
    borderColor: '#5c8e5b',
    backgroundColor: '#e7f5e5',
  },
  creatureChipEmoji: {
    fontSize: 20,
  },
  creatureChipText: {
    marginTop: 2,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#70806f',
    fontSize: 12,
  },
  creatureChipTextSelected: {
    color: '#2f5132',
  },
  petStage: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#f5f8ef',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 132,
    padding: 12,
  },
  petEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  petMood: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    color: '#4f5f52',
    textAlign: 'center',
  },
  barGroup: {
    marginTop: 12,
    gap: 5,
  },
  barLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
    color: '#5b6657',
    marginTop: 4,
  },
  barTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#e8ece0',
    overflow: 'hidden',
  },
  barFillPrimary: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#85b854',
  },
  barFillWarm: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f5a86a',
  },
  barFillCool: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#7ab6bd',
  },
  actionRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  feedButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#ffd778',
    paddingVertical: 10,
    alignItems: 'center',
  },
  playButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#9ed3c9',
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: '#2f342d',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d8ddd0',
    backgroundColor: '#fafbf7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#2f3832',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 14,
  },
  addButton: {
    borderRadius: 12,
    backgroundColor: '#263a2f',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#f4f8f3',
    fontSize: 13,
  },
  scheduleRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  scheduleField: {
    flex: 1,
    gap: 6,
  },
  scheduleLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#5f6a5d',
    fontSize: 12,
  },
  scheduleInput: {
    borderWidth: 1,
    borderColor: '#d8ddd0',
    borderRadius: 10,
    backgroundColor: '#fbfcf8',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#2f3832',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
  },
  scheduleGhost: {
    borderWidth: 1,
    borderColor: '#d8ddd0',
    borderRadius: 10,
    backgroundColor: '#f4f6ef',
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  scheduleGhostText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#738072',
    fontSize: 13,
  },
  modeRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d8ddd0',
    borderRadius: 999,
    paddingVertical: 8,
    backgroundColor: '#f7f8f2',
  },
  modeChipSelected: {
    borderColor: '#6d9d62',
    backgroundColor: '#e8f3df',
  },
  modeChipText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#6d776c',
    fontSize: 12,
  },
  modeChipTextSelected: {
    color: '#325736',
  },
  priorityRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8ddd0',
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
  },
  priorityChipSelected: {
    borderColor: '#4f6f5c',
    backgroundColor: '#dff0e5',
  },
  priorityChipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#6b7569',
    fontSize: 12,
  },
  priorityChipTextSelected: {
    color: '#2f4f39',
  },
  tierRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  tierChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d8ddd0',
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f5f6ef',
  },
  tierChipSelected: {
    borderColor: '#6f9861',
    backgroundColor: '#e7f1df',
  },
  tierChipText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#6f786f',
    fontSize: 12,
  },
  tierChipTextSelected: {
    color: '#315332',
  },
  todoList: {
    marginTop: 10,
    gap: 8,
  },
  emptyText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#788174',
    fontSize: 13,
  },
  todoItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7ebdf',
    backgroundColor: '#fbfcf8',
    padding: 10,
    gap: 6,
  },
  todoItemDone: {
    opacity: 0.72,
  },
  todoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  todoTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#2f3530',
    fontSize: 14,
  },
  todoTitleDone: {
    textDecorationLine: 'line-through',
    color: '#8a9387',
  },
  overdueBadge: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#8f3f29',
    backgroundColor: '#ffddd2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
  },
  todoMeta: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#647063',
    fontSize: 12,
  },
  todoControlRow: {
    marginTop: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  todoActionButton: {
    borderRadius: 999,
    backgroundColor: '#2f4f38',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  todoActionButtonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#f3f7f2',
    fontSize: 11,
  },
  todoMetaButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cfd6c8',
    backgroundColor: '#f2f5ec',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  todoMetaButtonOn: {
    borderColor: '#597f62',
    backgroundColor: '#dff0e5',
  },
  todoMetaButtonText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#667263',
    fontSize: 11,
  },
  todoMetaButtonTextOn: {
    color: '#2f5236',
  },
  todoDeleteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2d1c8',
    backgroundColor: '#fff5ef',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  todoDeleteButtonText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#9e6952',
    fontSize: 11,
  },
  matrixCaption: {
    marginTop: 4,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#68756b',
    fontSize: 12,
  },
  matrixGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  matrixCell: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    minHeight: 150,
  },
  matrixTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#2f3a2f',
    fontSize: 13,
  },
  matrixSubtitle: {
    marginTop: 2,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#6b756d',
    fontSize: 11,
  },
  matrixCount: {
    marginTop: 3,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#4d5950',
    fontSize: 12,
  },
  matrixTaskList: {
    marginTop: 6,
    gap: 6,
  },
  matrixEmpty: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#7f887f',
    fontSize: 12,
  },
  matrixTaskRow: {
    borderRadius: 9,
    backgroundColor: '#ffffffc0',
    borderWidth: 1,
    borderColor: '#d9ddd3',
    padding: 6,
    gap: 4,
  },
  matrixTaskText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#3d483f',
    fontSize: 12,
  },
  matrixTaskAction: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#e8ece2',
  },
  matrixTaskActionDone: {
    backgroundColor: '#cfe7d7',
  },
  matrixTaskActionText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#445046',
    fontSize: 10,
  },
  calendarRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  dayCell: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#f4f6ef',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayCellToday: {
    backgroundColor: '#d8eec8',
  },
  dayLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#71806d',
    fontSize: 11,
  },
  dayLabelToday: {
    color: '#2d4f2f',
  },
  dayDate: {
    marginTop: 3,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#3d483f',
    fontSize: 13,
  },
  dayDateToday: {
    color: '#204022',
  },
  dayCount: {
    marginTop: 3,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#a0aa98',
    fontSize: 12,
  },
  dayCountActive: {
    color: '#3a6842',
  },
  shopItem: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eceee5',
    padding: 10,
    backgroundColor: '#fafcf7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  shopEmoji: {
    fontSize: 23,
  },
  shopTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#303730',
    fontSize: 14,
  },
  shopCost: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#70806d',
    fontSize: 12,
    marginTop: 2,
  },
  shopButton: {
    borderRadius: 999,
    backgroundColor: '#1f3f2f',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shopButtonOwned: {
    backgroundColor: '#d4ddd3',
  },
  shopButtonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#f3f7f2',
    fontSize: 12,
  },
  shopButtonTextOwned: {
    color: '#5b6759',
  },
});
