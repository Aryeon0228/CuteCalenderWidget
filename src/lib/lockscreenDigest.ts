import * as Notifications from 'expo-notifications';
import type { TodoItem } from '../store/petLoopStore';

const MAX_PREVIEW_ITEMS = 4;

const buildDigestBody = (todos: TodoItem[]): string => {
  const openTodos = todos.filter((todo) => !todo.done);
  if (openTodos.length === 0) {
    return '남은 할 일이 없어요. 오늘도 잘했어요.';
  }

  const lines = openTodos
    .slice(0, MAX_PREVIEW_ITEMS)
    .map((todo, index) => `${index + 1}. ${todo.title}`);

  if (openTodos.length > MAX_PREVIEW_ITEMS) {
    lines.push(`+${openTodos.length - MAX_PREVIEW_ITEMS}개 더 있음`);
  }

  return lines.join('\n');
};

export const requestLockscreenPermission = async (): Promise<boolean> => {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    return (
      requested.granted ||
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
};

export const sendLockscreenDigest = async (todos: TodoItem[]): Promise<boolean> => {
  try {
    const granted = await requestLockscreenPermission();
    if (!granted) {
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '잠금화면 투두 요약',
        body: buildDigestBody(todos),
        sound: 'default',
        data: {
          type: 'todo-digest',
          createdAt: Date.now(),
        },
      },
      trigger: null,
    });

    return true;
  } catch {
    return false;
  }
};
