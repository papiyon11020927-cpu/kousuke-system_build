/**
 * userService.ts
 * ユーザーマスタの更新操作
 */
import { doc, updateDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { NotificationSettings } from '@/types';

const userRef = (uid: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', uid);

/** メール通知設定を更新 */
export const updateNotificationSettings = async (
  userId:   string,
  settings: NotificationSettings,
): Promise<void> => {
  await updateDoc(userRef(userId), {
    notificationSettings: settings,
    updatedAt: new Date().toISOString(),
  });
};
