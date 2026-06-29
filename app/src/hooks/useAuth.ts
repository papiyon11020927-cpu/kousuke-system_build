import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, APP_ID } from '@/firebase/config';
import type { AppUser, NotificationSettings, ColorTheme } from '@/types';

export interface AuthUser {
  uid:                  string;
  email:                string | null;
  displayName:          string;
  role:                 AppUser['role'];
  notificationSettings?: NotificationSettings;
  theme?:               ColorTheme;
  hasSeenTutorial?:     boolean;
}

export interface UseAuthReturn {
  user:    AuthUser | null;
  loading: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      // 前のプロフィールリスナーをクリーンアップ
      profileUnsub?.();
      profileUnsub = null;

      if (!firebaseUser || firebaseUser.isAnonymous) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userDocRef = doc(
        db, 'artifacts', APP_ID, 'public', 'data', 'users', firebaseUser.uid,
      );

      // プロフィールをリアルタイム購読
      // - 初回セットアップ中にドキュメントが作成されたら自動検知 → 競合状態を解消
      // - ロール変更もリアルタイムで反映
      profileUnsub = onSnapshot(
        userDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as AppUser;
            setUser({
              uid:                  firebaseUser.uid,
              email:                firebaseUser.email,
              displayName:          data.displayName,
              role:                 data.role,
              notificationSettings: data.notificationSettings,
              theme:                data.theme,
              hasSeenTutorial:      data.hasSeenTutorial,
            });
          } else {
            // 認証済みだがプロフィール未作成（セットアップ中の過渡状態）
            setUser(null);
          }
          setLoading(false);
        },
        () => {
          // Rules 未設定等のエラー時
          setUser(null);
          setLoading(false);
        },
      );
    });

    return () => {
      authUnsub();
      profileUnsub?.();
    };
  }, []);

  return { user, loading };
}
