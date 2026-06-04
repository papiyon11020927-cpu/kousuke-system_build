import { useFirestoreCollection } from './useFirestoreCollection';
import type { AppNotification } from '@/types';

/**
 * アプリ内通知をリアルタイム購読するフック
 * manager / admin が使用する（全通知を購読）
 */
export const useNotifications = (userId: string | null) =>
  useFirestoreCollection<AppNotification>('notifications', userId);
