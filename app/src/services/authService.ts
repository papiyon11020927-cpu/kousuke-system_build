import { initializeApp, deleteApp } from 'firebase/app';
import {
  signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
  getAuth, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword,
} from 'firebase/auth';
import { doc, setDoc, deleteDoc, getDoc, getDocs, query, limit } from 'firebase/firestore';
import { auth, db, APP_ID, firebaseConfig, getCol } from '@/firebase/config';
import type { AppUser, UserRole } from '@/types';

const userRef  = (uid: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', uid);

// ログイン画面の「初回設定」表示判定用（未認証でも読める公開ドキュメント）
const metaRef  = doc(db, 'artifacts', APP_ID, 'public', 'meta');
const markAdminExists = () =>
  setDoc(metaRef, { adminExists: true }, { merge: true });

// ── ログイン / ログアウト ──────────────────────────────────────

export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

// パスワード再設定メール送信
export const sendPasswordReset = (email: string) =>
  sendPasswordResetEmail(auth, email);

// ── Google ログイン ───────────────────────────────────────────
//
// - プロフィールが存在する → 通常ログイン（何もしない）
// - プロフィールなし + ユーザーゼロ → スーパー管理者として自動登録
// - プロフィールなし + 他ユーザー存在 → 未登録エラー（管理者に登録依頼）

export const loginWithGoogle = async (): Promise<void> => {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);

  // 既存プロフィール確認
  const snap = await getDoc(userRef(cred.user.uid));
  if (snap.exists()) return; // 登録済み → useAuth の onSnapshot が自動反映

  // 既存ユーザー数確認（1件だけ取得で十分）
  const usersSnap = await getDocs(query(getCol('users'), limit(1)));
  if (!usersSnap.empty) {
    // 未登録のアカウント → サインアウトしてエラーを返す
    await signOut(auth);
    const err = new Error() as any;
    err.code = 'app/not-registered';
    throw err;
  }

  // 初回ユーザー → スーパー管理者として登録
  await setDoc(userRef(cred.user.uid), {
    userId:         cred.user.uid,
    displayName:    cred.user.displayName ?? cred.user.email?.split('@')[0] ?? '管理者',
    email:          cred.user.email ?? '',
    role:           'admin' as UserRole,
    avatarInitials: (cred.user.displayName ?? 'A').charAt(0),
    createdAt:      new Date().toISOString(),
  } satisfies AppUser);
  await markAdminExists();
};

// ── 初回セットアップ（メール/パスワードで管理者作成） ────────────

export const setupFirstAdmin = async (
  email: string,
  password: string,
  displayName: string,
): Promise<void> => {
  let uid: string;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
  } catch (err: any) {
    if (err.code?.includes('email-already-in-use')) {
      // 前回の試行で Auth ユーザーが作成されたが Firestore doc が未作成の場合に対応
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(userRef(cred.user.uid));
      if (snap.exists()) return; // 既に完了済み
      uid = cred.user.uid;
    } else {
      throw err;
    }
  }

  await setDoc(userRef(uid), {
    userId:         uid,
    displayName,
    email,
    role:           'admin' as UserRole,
    avatarInitials: displayName.charAt(0),
    createdAt:      new Date().toISOString(),
  } satisfies AppUser);
  await markAdminExists();
};

// ── 管理者によるユーザー追加（自分のセッションに影響しない） ────

export const createAppUser = async (
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
): Promise<void> => {
  const appName      = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, appName);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    await setDoc(userRef(cred.user.uid), {
      userId:         cred.user.uid,
      displayName,
      email,
      role,
      avatarInitials: displayName.charAt(0),
      createdAt:      new Date().toISOString(),
    } satisfies AppUser);
  } finally {
    await deleteApp(secondaryApp);
  }
};

// ── ロール変更 ───────────────────────────────────────────────

export const updateUserRole = async (userId: string, role: UserRole): Promise<void> => {
  await setDoc(userRef(userId), { role }, { merge: true });
};

// ── ユーザー削除（Firestore doc のみ。Firebase Auth は残る） ───

export const removeAppUser = async (userId: string): Promise<void> => {
  await deleteDoc(userRef(userId));
};

// ── 表示名変更 ───────────────────────────────────────────────

export const updateUserDisplayName = async (
  userId: string,
  displayName: string,
): Promise<void> => {
  await setDoc(userRef(userId), { displayName, avatarInitials: displayName.charAt(0) }, { merge: true });
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) throw new Error('ログインが必要です');
  const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
  await reauthenticateWithCredential(currentUser, credential);
  await updatePassword(currentUser, newPassword);
};
