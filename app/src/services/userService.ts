/**
 * userService.ts
 * ユーザーマスタの更新操作
 */
import { doc, updateDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { NotificationSettings, ColorTheme } from '@/types';

const userRef = (uid: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', uid);

/** カラーテーマを更新 */
export const updateUserTheme = async (
  userId: string,
  theme:  ColorTheme,
): Promise<void> => {
  await updateDoc(userRef(userId), { theme, updatedAt: new Date().toISOString() });
};

/** 初回オンボーディング・チュートリアルの既読フラグを更新 */
export const markTutorialSeen = async (userId: string): Promise<void> => {
  await updateDoc(userRef(userId), { hasSeenTutorial: true, updatedAt: new Date().toISOString() });
};

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
