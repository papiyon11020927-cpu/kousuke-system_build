import { useState } from 'react';
import {
  LucideX, LucideUser, LucidePencil, LucideLock,
  LucideCheck, LucideLoader,
} from 'lucide-react';
import type { AuthUser } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { updateUserDisplayName, changePassword } from '@/services/authService';

const ROLE_LABEL: Record<UserRole, string> = {
  staff:   '営業・現場',
  manager: '管理者',
  admin:   'スーパー管理者',
};

const ROLE_BADGE: Record<UserRole, string> = {
  staff:   'bg-blue-900/40 text-blue-300 border border-blue-700/40',
  manager: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
  admin:   'bg-purple-900/40 text-purple-300 border border-purple-700/40',
};

type Tab = 'profile' | 'password';

interface Props {
  user:        AuthUser;
  userId:      string;
  onClose:     () => void;
  onShowToast: (msg: string) => void;
}

export default function ProfileModal({ user, userId, onClose, onShowToast }: Props) {
  const [tab, setTab] = useState<Tab>('profile');

  // ── プロフィール編集 ──
  const [displayName, setDisplayName] = useState(user.displayName);
  const [savingName,  setSavingName]  = useState(false);
  const [nameError,   setNameError]   = useState('');

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) { setNameError('名前を入力してください'); return; }
    if (trimmed === user.displayName) { setNameError(''); onShowToast('変更がありません'); return; }
    setSavingName(true);
    setNameError('');
    try {
      await updateUserDisplayName(userId, trimmed);
      onShowToast('表示名を更新しました');
      onClose();
    } catch {
      setNameError('更新に失敗しました。もう一度お試しください');
    } finally {
      setSavingName(false);
    }
  };

  // ── パスワード変更 ──
  const [currentPw,   setCurrentPw]   = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [savingPw,    setSavingPw]    = useState(false);
  const [pwError,     setPwError]     = useState('');

  const handleChangePassword = async () => {
    setPwError('');
    if (!currentPw)                    { setPwError('現在のパスワードを入力してください'); return; }
    if (newPw.length < 6)              { setPwError('新しいパスワードは6文字以上で入力してください'); return; }
    if (newPw !== confirmPw)           { setPwError('新しいパスワードが一致しません'); return; }
    if (newPw === currentPw)           { setPwError('新しいパスワードは現在と異なるものを入力してください'); return; }
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      onShowToast('パスワードを変更しました');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      onClose();
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwError('現在のパスワードが正しくありません');
      } else if (code === 'auth/weak-password') {
        setPwError('パスワードが弱すぎます（6文字以上にしてください）');
      } else {
        setPwError('変更に失敗しました。もう一度お試しください');
      }
    } finally {
      setSavingPw(false);
    }
  };

  const initials = user.displayName ? user.displayName.slice(0, 1) : '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#111A35] border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 shrink-0">
          <h3 className="text-sm font-bold text-white">プロフィール</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition">
            <LucideX size={15} />
          </button>
        </div>

        {/* アバター・基本情報 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="h-12 w-12 rounded-full bg-[#1C2C54] border border-[#C5A059]/30 flex items-center justify-center text-lg font-bold text-[#E6C687] shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
            <p className="text-[11px] text-gray-400 truncate">{user.email ?? ''}</p>
            <span className={`mt-1 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded ${ROLE_BADGE[user.role]}`}>
              {ROLE_LABEL[user.role]}
            </span>
          </div>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-700 shrink-0">
          <TabButton active={tab === 'profile'}  icon={<LucideUser   size={12} />} label="表示名変更"    onClick={() => setTab('profile')}  />
          <TabButton active={tab === 'password'} icon={<LucideLock   size={12} />} label="パスワード変更" onClick={() => setTab('password')} />
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {tab === 'profile' && (
            <>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1.5">表示名</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => { setDisplayName(e.target.value); setNameError(''); }}
                  maxLength={20}
                  placeholder="表示名を入力"
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]/60"
                />
                <p className="text-[10px] text-gray-600 mt-1 text-right">{displayName.length}/20</p>
              </div>
              {nameError && <p className="text-xs text-red-400">{nameError}</p>}
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="w-full flex items-center justify-center gap-2 bg-[#C5A059] hover:bg-[#E6C687] disabled:opacity-50 text-[#0A0F1D] text-xs font-bold py-2.5 rounded-lg transition"
              >
                {savingName
                  ? <><LucideLoader size={13} className="animate-spin" />保存中...</>
                  : <><LucideCheck  size={13} />表示名を保存</>
                }
              </button>
            </>
          )}

          {tab === 'password' && (
            <>
              <Field label="現在のパスワード" value={currentPw} onChange={setCurrentPw} onClearError={() => setPwError('')} />
              <Field label="新しいパスワード（6文字以上）" value={newPw} onChange={setNewPw} onClearError={() => setPwError('')} />
              <Field label="新しいパスワード（確認）" value={confirmPw} onChange={setConfirmPw} onClearError={() => setPwError('')} />
              {pwError && <p className="text-xs text-red-400">{pwError}</p>}
              <button
                onClick={handleChangePassword}
                disabled={savingPw}
                className="w-full flex items-center justify-center gap-2 bg-[#C5A059] hover:bg-[#E6C687] disabled:opacity-50 text-[#0A0F1D] text-xs font-bold py-2.5 rounded-lg transition"
              >
                {savingPw
                  ? <><LucideLoader size={13} className="animate-spin" />変更中...</>
                  : <><LucideLock   size={13} />パスワードを変更</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: {
  active: boolean; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition
        ${active
          ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5'
          : 'text-gray-400 hover:text-white'}`}
    >
      {icon}{label}
    </button>
  );
}

function Field({ label, value, onChange, onClearError }: {
  label: string; value: string;
  onChange: (v: string) => void;
  onClearError: () => void;
}) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 mb-1.5">{label}</label>
      <input
        type="password"
        value={value}
        onChange={e => { onChange(e.target.value); onClearError(); }}
        className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]/60"
      />
    </div>
  );
}
