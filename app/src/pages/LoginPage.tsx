import { useState, useEffect } from 'react';
import { LucideActivity, LucideEye, LucideEyeOff, LucideShield, LucideChevronRight } from 'lucide-react';
import { getDoc, doc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import { login, loginWithGoogle, setupFirstAdmin, sendPasswordReset } from '@/services/authService';

// ─────────────────────────────────────────────────────────────
// エラーコード → 日本語変換
// ─────────────────────────────────────────────────────────────

const toJpError = (code: string): string => {
  if (!code) return '予期しないエラーが発生しました。再試行してください';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return '';
  if (code.includes('not-registered'))
    return 'このGoogleアカウントはシステムに登録されていません。管理者に連絡してください';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'メールアドレスまたはパスワードが正しくありません';
  if (code.includes('too-many-requests'))
    return 'ログイン試行が多すぎます。しばらくしてから再試行してください';
  if (code.includes('email-already-in-use'))
    return 'このメールアドレスはすでに使用されています';
  if (code.includes('weak-password'))
    return 'パスワードは6文字以上にしてください';
  if (code.includes('permission-denied'))
    return 'アクセス権限エラーです。Firebase ConsoleでSecurityRulesを確認してください';
  return `予期しないエラーが発生しました（${code}）`;
};

// ─────────────────────────────────────────────────────────────
// Google ロゴ SVG
// ─────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

type Mode = 'login' | 'reset' | 'admin' | 'setup';

export default function LoginPage() {
  const [mode,        setMode]        = useState<Mode>('login');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [resetSent,   setResetSent]   = useState(false);

  // admin が存在するかを公開ドキュメントで確認
  // null = 確認中、true = 存在する（初回設定非表示）、false = 未セットアップ
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'artifacts', APP_ID, 'public', 'meta'))
      .then(snap => setAdminExists(!!(snap.exists() && snap.data()?.adminExists)))
      .catch(() => setAdminExists(true)); // エラー時は存在扱い（初回設定を隠す）
  }, []);

  const switchMode = (m: Mode) => { setMode(m); setError(''); setResetSent(false); };

  // ── Google ログイン ────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      // 成功 → useAuth の onSnapshot が user を更新しコンポーネントがアンマウント
    } catch (err: any) {
      setLoading(false);
      const msg = toJpError(err.code ?? '');
      if (msg) setError(msg);
    }
  };

  // ── メール/パスワードログイン ─────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setLoading(false);
      setError(toJpError(err.code ?? ''));
    }
  };

  // ── パスワード再設定 ──────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err: any) {
      const code: string = err.code ?? '';
      // user-not-found = システムに登録されていないメールアドレス
      if (code.includes('user-not-found'))
        setError('このメールアドレスはシステムに登録されていません');
      else
        setError(toJpError(code));
    } finally {
      setLoading(false);
    }
  };

  // ── 初回セットアップ ──────────────────────────────────────
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError('担当者名を入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      await setupFirstAdmin(email, password, displayName.trim());
    } catch (err: any) {
      setLoading(false);
      setError(toJpError(err.code ?? ''));
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] flex flex-col items-center justify-center p-4">

      {/* ロゴ */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-[#C5A059] to-[#E6C687] flex items-center justify-center shadow-lg">
          <span className="text-white font-extrabold text-2xl">住</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-white">住良建設</h1>
          <p className="text-xs text-[#C5A059] tracking-wider">Genba-SFA</p>
        </div>
      </div>

      {/* ── メインカード: ログイン / パスワード再設定 ── */}
      {(mode === 'login' || mode === 'reset') && (
        <div className="bg-[#111A35] border border-[#C5A059]/20 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

          {/* タブ */}
          <div className="flex border-b border-gray-800">
            <button onClick={() => switchMode('login')}
              className={`flex-1 py-3 text-sm font-bold transition ${mode === 'login' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
              ログイン
            </button>
            <button onClick={() => switchMode('reset')}
              className={`flex-1 py-3 text-sm font-bold transition ${mode === 'reset' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
              パスワード再設定
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400 mb-4">
                {error}
              </div>
            )}

            {/* ── ログインフォーム ── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">メールアドレス</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="例: sato@sumiyoshi.com"
                    className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C5A059] placeholder-gray-600" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">パスワード</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} required
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="パスワード"
                      className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:border-[#C5A059] placeholder-gray-600" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPw ? <LucideEyeOff size={15} /> : <LucideEye size={15} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-extrabold py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50">
                  <LucideActivity size={16} className="animate-spin" style={{ display: loading ? 'inline-block' : 'none' }} />
                  <span style={{ display: loading ? 'inline' : 'none' }}>ログイン中...</span>
                  <span style={{ display: loading ? 'none'   : 'inline' }}>ログイン</span>
                </button>
              </form>
            )}

            {/* ── パスワード再設定フォーム ── */}
            {mode === 'reset' && (
              resetSent ? (
                <div className="text-center space-y-4 py-2">
                  <div className="text-4xl">📧</div>
                  <p className="text-sm font-semibold text-white">再設定メールを送信しました</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <span className="text-[#E6C687]">{email}</span> 宛に再設定リンクを送信しました。
                    メールボックスをご確認ください。
                  </p>
                  <button onClick={() => { switchMode('login'); setEmail(''); }}
                    className="text-xs text-[#C5A059] hover:text-[#E6C687] underline transition">
                    ログイン画面に戻る
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <p className="text-xs text-gray-400">
                    登録済みのメールアドレスを入力してください。パスワード再設定リンクを送信します。
                  </p>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">メールアドレス</label>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="例: sato@sumiyoshi.com"
                      className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C5A059] placeholder-gray-600" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-extrabold py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50">
                    <LucideActivity size={16} className="animate-spin" style={{ display: loading ? 'inline-block' : 'none' }} />
                  <span style={{ display: loading ? 'inline' : 'none' }}>送信中...</span>
                  <span style={{ display: loading ? 'none'   : 'inline' }}>再設定メールを送信</span>
                  </button>
                </form>
              )
            )}
          </div>

          {/* システム管理者リンク */}
          <div className="border-t border-gray-800 px-6 py-3 flex justify-center">
            <button onClick={() => switchMode('admin')}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition">
              システム管理者はこちら <LucideChevronRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* ── 管理者カード: Google ログイン ── */}
      {mode === 'admin' && (
        <div className="bg-[#111A35] border border-[#C5A059]/20 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20">
            <div className="flex items-center gap-2 text-[#E6C687]">
              <LucideShield size={14} />
              <span className="text-sm font-bold">システム管理者ログイン</span>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}
            <button onClick={handleGoogleLogin} disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-3 transition disabled:opacity-50 border border-gray-200 shadow-sm">
              <LucideActivity size={18} className="animate-spin text-gray-500" style={{ display: loading ? 'inline-block' : 'none' }} />
              <span style={{ display: loading ? 'none' : 'inline-flex' }}><GoogleIcon /></span>
              <span className="text-sm">Googleでログイン</span>
            </button>

            {/* 初回セットアップ: admin 不在時のみ表示 */}
            {adminExists === false && (
              <button onClick={() => switchMode('setup')}
                className="w-full border border-[#C5A059]/30 text-[#C5A059] text-xs font-semibold py-2.5 rounded-lg hover:bg-[#C5A059]/10 transition flex items-center justify-center gap-1.5">
                <LucideShield size={13} /> 初回セットアップ（管理者アカウント作成）
              </button>
            )}

            <button onClick={() => switchMode('login')}
              className="w-full text-xs text-gray-500 hover:text-gray-300 transition py-1">
              ← ログイン画面に戻る
            </button>
          </div>
        </div>
      )}

      {/* ── 初回セットアップカード ── */}
      {mode === 'setup' && (
        <div className="bg-[#111A35] border border-[#C5A059]/20 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20">
            <div className="flex items-center gap-2 text-[#E6C687]">
              <LucideShield size={14} />
              <span className="text-sm font-bold">初回セットアップ</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">管理者アカウントを作成してスタートします</p>
          </div>
          <div className="p-6">
            {error && (
              <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400 mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">担当者名 *</label>
                <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder="例: 管理者 太郎"
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C5A059] placeholder-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">メールアドレス *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@sumiyoshi.com"
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C5A059] placeholder-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">パスワード *（6文字以上）</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required minLength={6}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="6文字以上"
                    className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:border-[#C5A059] placeholder-gray-600" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPw ? <LucideEyeOff size={15} /> : <LucideEye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-extrabold py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50">
                  <LucideActivity size={16} className="animate-spin" style={{ display: loading ? 'inline-block' : 'none' }} />
                  <span style={{ display: loading ? 'inline' : 'none' }}>作成中...</span>
                  <span style={{ display: loading ? 'none'   : 'inline' }}>管理者アカウントを作成</span>
              </button>
              <button type="button" onClick={() => switchMode('admin')}
                className="w-full text-xs text-gray-500 hover:text-gray-300 transition py-1">
                ← 戻る
              </button>
            </form>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-600 mt-6">住良建設 Genba-SFA — Powered by Firebase</p>
    </div>
  );
}
