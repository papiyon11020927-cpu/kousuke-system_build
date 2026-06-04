/**
 * notificationService.ts
 * アプリ内通知の作成・既読管理
 *
 * 通知ドキュメントが作成されると Cloud Function が起動し、
 * ユーザーの notificationSettings に従ってメールを送信する。
 */
import {
  doc, setDoc, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { AppNotification, NotificationType } from '@/types';

const colPath = () =>
  `artifacts/${APP_ID}/public/data/notifications`;

const docRef = (id: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'notifications', id);

// ─── 通知を作成 ──────────────────────────────────────────────
export const createNotification = async (params: {
  type:              NotificationType;
  title:             string;
  body:              string;
  relatedId:         string;
  projectTitle:      string;
  notifiedUserIds?:  string[];  // manager/admin 以外の個別通知対象UID
}): Promise<void> => {
  const notificationId = crypto.randomUUID();
  const { notifiedUserIds, ...rest } = params;
  const notification: AppNotification = {
    notificationId,
    ...rest,
    createdAt: new Date().toISOString(),
    readBy:    [],
    ...(notifiedUserIds?.length ? { notifiedUserIds } : {}),
  };
  await setDoc(docRef(notificationId), notification);
};

// ─── 既読にする（自分の userId を readBy に追加）────────────
export const markNotificationRead = async (
  notificationId: string,
  userId:         string,
): Promise<void> => {
  await updateDoc(docRef(notificationId), {
    readBy: arrayUnion(userId),
  });
};

// ─── 全通知を既読にする ─────────────────────────────────────
export const markAllNotificationsRead = async (
  notificationIds: string[],
  userId:          string,
): Promise<void> => {
  await Promise.all(
    notificationIds.map(id =>
      updateDoc(docRef(id), { readBy: arrayUnion(userId) }),
    ),
  );
};

export { colPath };
