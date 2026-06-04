import { useState } from 'react';
import {
  LucideUsers, LucidePlusCircle, LucideX, LucideTrash2,
  LucideShield, LucideUser2, LucideAlertTriangle, LucideActivity,
  LucideEye, LucideEyeOff, LucidePencil,
} from 'lucide-react';
import type { AppUser, UserRole } from '@/types';
import {
  createAppUser, updateUserRole, removeAppUser, updateUserDisplayName,
} from '@/services/authService';

// ─────────────────────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  staff:   '営業・現場',
  manager: '管理者',
  admin:   'スーパー管理者',
};

const ROLE_COLOR: Record<UserRole, string> = {
  staff:   'bg-blue-900/40 text-blue-300 border-blue-700/40',
  manager: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  admin:   'bg-purple-900/40 text-purple-300 border-purple-700/40',
};

// ─────────────────────────────────────────────────────────────
// ユーザー追加ダイアログ
// ─────────────────────────────────────────────────────────────

function AddUserDialog({
  onClose, onCreated,
}: {
  onClose:   () => void;
  onCreated: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [role,        setRole]        = useState<UserRole>('staff');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError('担当者名を入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      await createAppUser(email, password, displayName.trim(), role);
      onCreated(`${displayName} を追加しました`);
      onClose();
    } catch (err: any) {
      const code: string = err.code ?? '';
      if (code.includes('email-already-in-use'))
        setError('このメールアドレスはすでに使用されています');
      else if (code.includes('weak-password'))
        setError('パスワードは6文字以上にしてください');
      else if (code.includes('operation-not-allowed'))
        setError('メール/パスワード認証が無効です。Firebase Console → Authentication → Sign-in method で「メール/パスワード」を有効にしてください');
      else if (code.includes('permission-denied'))
        setError('権限エラーです。Firestoreのセキュリティルールを確認してください');
      else
        setError(`追加に失敗しました（${code || 'unknown'}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-md shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucidePlusCircle size={15} className="text-[#C5A059]" /> 新規ユーザー追加
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">担当者名 *</label>
            <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="例: 田中 スタッフ"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">メールアドレス *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="例: tanaka@sumiyoshi.com"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">初期パスワード *（6文字以上）</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} required minLength={6}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="6文字以上"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-[#C5A059]" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? <LucideEyeOff size={14} /> : <LucideEye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">ロール</label>
            <div className="grid grid-cols-3 gap-2">
              {(['staff', 'manager', 'admin'] as UserRole[]).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition ${
                    role === r ? ROLE_COLOR[r] : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition">
              キャンセル
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-50">
              {loading ? <><LucideActivity size={14} className="animate-spin" /> 追加中...</> : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 名前変更ダイアログ
// ─────────────────────────────────────────────────────────────

function RenameDialog({
  user, onClose, onRenamed,
}: {
  user:      AppUser;
  onClose:   () => void;
  onRenamed: (msg: string) => void;
}) {
  const [name,    setName]    = useState(user.displayName);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('名前を入力してください'); return; }
    if (trimmed === user.displayName) { onClose(); return; }
    setError('');
    setLoading(true);
    try {
      await updateUserDisplayName(user.userId, trimmed);
      onRenamed(`${trimmed} に名前を変更しました`);
    } catch {
      setError('変更に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucidePencil size={14} className="text-[#C5A059]" /> 名前を変更
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">担当者名 *</label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
            />
          </div>
          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition">
              キャンセル
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-50">
              {loading ? <><LucideActivity size={14} className="animate-spin" /> 保存中...</> : '保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 削除確認ダイアログ
// ─────────────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  user, onConfirm, onCancel, loading,
}: {
  user:      AppUser;
  onConfirm: () => void;
  onCancel:  () => void;
  loading:   boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-red-700/40 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-red-700/30 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideAlertTriangle size={14} className="text-red-400" /> ユーザーの削除
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-300">
            <span className="font-bold text-white">{user.displayName}</span>（{user.email}）を削除しますか？
          </p>
          <p className="text-xs text-gray-500">
            ※ Firebase Auth アカウントは残ります。完全削除は Firebase Console で行ってください。
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition disabled:opacity-50">
              キャンセル
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-50">
              {loading
                ? <><LucideActivity size={14} className="animate-spin" /> 削除中...</>
                : <><LucideTrash2 size={14} /> 削除する</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

interface Props {
  users:       AppUser[];
  currentUid:  string;
  onShowToast: (msg: string) => void;
}

export default function UserManagePage({ users, currentUid, onShowToast }: Props) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [updatingId,    setUpdatingId]    = useState<string | null>(null);
  const [renameTarget,  setRenameTarget]  = useState<AppUser | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<AppUser | null>(null);

  const sortedUsers = [...users].sort((a, b) => {
    const order: Record<UserRole, number> = { admin: 0, manager: 1, staff: 2 };
    return order[a.role] - order[b.role];
  });

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUid && newRole !== 'admin') {
      onShowToast('自分自身のロールは変更できません');
      return;
    }
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, newRole);
      onShowToast('ロールを更新しました');
    } catch {
      onShowToast('ロール変更に失敗しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.userId);
    try {
      await removeAppUser(deleteTarget.userId);
      onShowToast(`${deleteTarget.displayName} を削除しました`);
      setDeleteTarget(null);
    } catch {
      onShowToast('削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <LucideUsers className="text-[#C5A059]" size={18} />
            ユーザー管理
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            スタッフの追加・名前変更・ロール変更・削除（スーパー管理者専用）
          </p>
        </div>
        <button onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold px-4 py-2 rounded-lg transition">
          <LucidePlusCircle size={14} /> ユーザーを追加
        </button>
      </div>

      {/* ロール凡例 */}
      <div className="flex flex-wrap gap-3 text-[11px] text-gray-400 bg-[#111A35] border border-gray-800 rounded-xl px-4 py-3">
        {(['staff', 'manager', 'admin'] as UserRole[]).map(r => (
          <span key={r} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${ROLE_COLOR[r]}`}>
            <LucideShield size={9} /> {ROLE_LABEL[r]}
          </span>
        ))}
        <span className="text-gray-500 self-center text-[10px]">
          ※ スーパー管理者のみユーザー管理タブにアクセスできます
        </span>
      </div>

      {/* ユーザーリスト */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
        {sortedUsers.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            ユーザーが登録されていません
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {sortedUsers.map(u => (
              <div key={u.userId}
                className={`flex flex-wrap items-center gap-3 px-4 py-3.5 transition ${
                  u.userId === currentUid ? 'bg-[#C5A059]/5' : 'hover:bg-[#0B132B]/40'
                }`}>

                {/* アバター */}
                <div className="h-9 w-9 rounded-full bg-[#1C2C54] flex items-center justify-center shrink-0 text-sm font-bold text-[#E6C687]">
                  {u.avatarInitials ?? <LucideUser2 size={14} className="text-[#C5A059]" />}
                </div>

                {/* 名前・メール */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{u.displayName}</span>
                    {u.userId === currentUid && (
                      <span className="text-[10px] bg-[#C5A059]/20 text-[#E6C687] px-1.5 py-0.5 rounded border border-[#C5A059]/40">
                        自分
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">{u.email}</div>
                </div>

                {/* ロール選択 */}
                <div className="shrink-0">
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.userId, e.target.value as UserRole)}
                    disabled={updatingId === u.userId || u.userId === currentUid}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${ROLE_COLOR[u.role]} bg-transparent`}
                  >
                    {(['staff', 'manager', 'admin'] as UserRole[]).map(r => (
                      <option key={r} value={r} className="bg-[#111A35] text-white">
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 名前変更ボタン */}
                <button
                  onClick={() => setRenameTarget(u)}
                  className="text-gray-500 hover:text-[#C5A059] transition p-1.5 rounded-lg hover:bg-[#C5A059]/10"
                  title="名前を変更"
                >
                  <LucidePencil size={14} />
                </button>

                {/* 削除ボタン */}
                <button
                  onClick={() => {
                    if (u.userId === currentUid) {
                      onShowToast('自分自身を削除することはできません');
                      return;
                    }
                    setDeleteTarget(u);
                  }}
                  disabled={deletingId === u.userId || u.userId === currentUid}
                  className="text-gray-500 hover:text-red-400 transition disabled:opacity-30 disabled:cursor-not-allowed p-1.5 rounded-lg hover:bg-red-900/20"
                  title={u.userId === currentUid ? '自分は削除できません' : '削除'}
                >
                  {deletingId === u.userId
                    ? <LucideActivity size={14} className="animate-spin text-red-400" />
                    : <LucideTrash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 注記 */}
      <div className="flex items-start gap-2 text-[11px] text-gray-500 bg-[#111A35] border border-gray-800 rounded-xl px-4 py-3">
        <LucideAlertTriangle size={12} className="text-yellow-600 shrink-0 mt-0.5" />
        <span>
          ユーザーを削除してもFirebase Authアカウントは残ります。完全削除はFirebase Consoleで行ってください。
          パスワードの変更はログイン画面の「パスワード再設定」タブから各自で行えます。
        </span>
      </div>

      {/* ── ダイアログ群 ── */}
      {showAddDialog && (
        <AddUserDialog
          onClose={() => setShowAddDialog(false)}
          onCreated={msg => { onShowToast(msg); }}
        />
      )}
      {renameTarget && (
        <RenameDialog
          user={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={msg => { onShowToast(msg); setRenameTarget(null); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteDialog
          user={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deletingId === deleteTarget.userId}
        />
      )}
    </div>
  );
}
