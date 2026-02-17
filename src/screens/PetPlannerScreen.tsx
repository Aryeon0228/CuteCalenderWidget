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
import type { CareAction, CreatureType, DecorationId, TodoItem } from '../store/petLoopStore';
import { getRecentDateKeys, toDateKey, usePetLoopStore } from '../store/petLoopStore';

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

const dayLabel = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const parsed = new Date(year, month - 1, day);
  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  return labels[parsed.getDay()];
};

const percent = (value: number, max: number): `${number}%` =>
  `${Math.min(100, Math.round((value / max) * 100))}%`;

const creatureMood = (happiness: number, energy: number): string => {
  if (happiness >= 75 && energy >= 65) return '반짝반짝 최고 컨디션!';
  if (happiness >= 55) return '기분이 좋아요. 오늘도 성장 중!';
  if (energy < 35) return '조금 지친 상태예요. 먹이와 휴식이 필요해요.';
  return '심심해요. 투두를 완료하고 놀아주세요.';
};

const rewardPreset = (tier: 'mini' | 'focus'): { coins: number; xp: number } =>
  tier === 'mini' ? { coins: 12, xp: 10 } : { coins: 22, xp: 18 };

const completionSummary = (todos: TodoItem[]): string => {
  const completed = todos.filter((todo) => todo.done).length;
  if (todos.length === 0) {
    return '오늘의 퀘스트를 추가해 주세요.';
  }
  if (completed === todos.length) {
    return '오늘 퀘스트 올클리어! 보상 루프가 완성됐어요.';
  }
  return `${completed}/${todos.length} 완료`;
};

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
    runDailyTick,
    careCreature,
    changeCreature,
    purchaseDecoration,
    seedStarterTodos,
  } = usePetLoopStore((state) => state);

  const [todoDraft, setTodoDraft] = useState('');
  const [tier, setTier] = useState<'mini' | 'focus'>('mini');
  const pulse = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;

  const todayKey = useMemo(() => toDateKey(), []);
  const recentDates = useMemo(() => getRecentDateKeys(7), []);
  const todayTodos = useMemo(() => todos.filter((todo) => todo.dueDate === todayKey), [todos, todayKey]);
  const selectedCreature = useMemo(
    () => CREATURES.find((entry) => entry.id === creature) ?? CREATURES[0],
    [creature]
  );
  const loopSummary = completionSummary(todayTodos);

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

    const reward = rewardPreset(tier);
    addTodo(todoDraft, todayKey, reward.coins, reward.xp);
    setTodoDraft('');
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
          <Text style={styles.heroSubtitle}>할 일 완료 → 씨앗 코인 획득 → 돌봄/꾸미기 → 성장</Text>
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
              <Text style={styles.widgetSub}>남은 퀘스트 {todayTodos.filter((todo) => !todo.done).length}개</Text>
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
              <View style={[styles.barFillWarm, { width: `${happiness}%` }]} />
            </View>
            <Text style={styles.barLabel}>에너지 {energy}%</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFillCool, { width: `${energy}%` }]} />
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
          <Text style={styles.cardTitle}>오늘의 투두 퀘스트</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={todoDraft}
              onChangeText={setTodoDraft}
              placeholder="예: 블로그 30분 쓰기"
              placeholderTextColor="#8a8f8b"
              returnKeyType="done"
              onSubmitEditing={onAddTodo}
            />
            <TouchableOpacity style={styles.addButton} onPress={onAddTodo}>
              <Text style={styles.addButtonText}>추가</Text>
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

          <View style={styles.todoList}>
            {todayTodos.length === 0 && <Text style={styles.emptyText}>퀘스트를 추가하면 병아리가 반응해요.</Text>}
            {todayTodos.map((todo) => (
              <View key={todo.id} style={styles.todoItem}>
                <TouchableOpacity
                  disabled={todo.done}
                  style={[styles.checkButton, todo.done && styles.checkButtonDone]}
                  onPress={() => onCompleteTodo(todo.id)}
                >
                  <Text style={styles.checkButtonText}>{todo.done ? '완료' : '완료하기'}</Text>
                </TouchableOpacity>

                <View style={styles.todoContent}>
                  <Text style={[styles.todoTitle, todo.done && styles.todoTitleDone]}>{todo.title}</Text>
                  <Text style={styles.todoMeta}>
                    보상 {todo.rewardCoins}코인 · {todo.rewardXp}XP
                  </Text>
                </View>

                {!todo.done && (
                  <TouchableOpacity onPress={() => removeTodo(todo.id)} style={styles.removeButton}>
                    <Text style={styles.removeButtonText}>삭제</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
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
    fontSize: 14,
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
    marginTop: 12,
    gap: 9,
  },
  emptyText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    color: '#728070',
  },
  todoItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eceee5',
    backgroundColor: '#fbfcf8',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkButton: {
    borderRadius: 999,
    backgroundColor: '#2c4a37',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  checkButtonDone: {
    backgroundColor: '#98af9b',
  },
  checkButtonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#f2f7f2',
    fontSize: 11,
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#2f3530',
    fontSize: 14,
  },
  todoTitleDone: {
    color: '#8c9589',
    textDecorationLine: 'line-through',
  },
  todoMeta: {
    marginTop: 2,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#789074',
    fontSize: 12,
  },
  removeButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  removeButtonText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#a08f83',
    fontSize: 12,
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
