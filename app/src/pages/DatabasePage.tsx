import { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import {
  LucideBookOpen, LucideX, LucideSearch, LucideLayoutGrid,
  LucideList, LucideFilter, LucideChevronRight, LucideCamera,
  LucideChevronDown, LucideChevronUp, LucidePlusCircle, LucideActivity,
  LucideUserPlus, LucideUser, LucideFolder, LucideFileText, LucideClipboardList,
  LucideCalendarDays, LucidePercent, LucideAlertCircle, LucideTag, LucidePencil,
  LucideCheck, LucidePlus, LucideTrash2, LucideThumbsUp, LucideThumbsDown,
  LucideInfo, LucideClock, LucideClipboardCheck, LucideRefreshCw, LucideTrendingUp,
  LucideLink, LucideCopy, LucideBuilding2, LucideSend, LucideChevronLeft,
  LucideMic, LucideSquare, LucideUserMinus, LucideAlertTriangle, LucideUsers,
  LucideMapPin,
} from 'lucide-react';
import type {
  Customer, Project, InOutLog, ProjectStatus, UserRole,
  Estimate, Contract, PaymentTerm, ContractApprovalStatus, EstimateTemplate,
  Vendor, VendorCostEntry, VendorQuoteRequest, VendorQuoteItem, ProjectAssignee,
  WorkspaceSection,
} from '@/types';
import { saveCustomer }  from '@/services/customerService';
import { saveProject, updateProjectStatus, setLostReason, approveProjectCreation } from '@/services/projectService';
import { saveEstimate, submitForApproval, approveEstimate, rejectEstimate, revertEstimateToDraft, deleteEstimate } from '@/services/estimateService';
import { createVendorQuoteRequest, updateVendorQuoteStatus, deleteVendorQuoteRequest,
  setVendorPaymentDueDate, markVendorPaid, unmarkVendorPaid, saveVendorReceiptSignature,
} from '@/services/vendorQuoteService';
import {
  saveContract, saveSignature,
  submitContractForApproval, approveContract, rejectContract,
  revertContractToDraft, deleteContract, updatePaymentTerms, voidContract,
} from '@/services/contractService';
import {
  generateEstimateHtml, generateContractHtml, openPrintPreview,
  getEstimateSummaryText, getContractSummaryText,
} from '@/services/documentService';
import { createNotification } from '@/services/notificationService';
import SettlementPanel from '@/components/SettlementPanel';

interface Props {
  customers:              Customer[];
  projects:               Project[];
  logs:                   InOutLog[];
  estimates:              Estimate[];
  contracts:              Contract[];
  estimateTemplates:      EstimateTemplate[];
  vendors?:               Vendor[];
  vendorQuoteRequests?:   VendorQuoteRequest[];
  staffList:              string[];
  currentRole:            UserRole;
  currentUserName:        string;
  currentUserId?:         string;
  onShowToast:            (msg: string) => void;
  /** パイプライン等から顧客名を渡して検索欄を初期化する */
  initialSearch?: string;
  /** 顧客モーダルから案件ワークスペースへのコールバック（App.tsx がワークスペースタブへ遷移させる） */
  onOpenWorkspace: (project: Project, section?: WorkspaceSection) => void;
}

type ViewMode = 'card' | 'grid';

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  lead:         '引き合い',
  estimate:     '見積提出',
  contract:     '契約済',
  construction: '施工中',
  completed:    '完工',
  lost:         '失注',
};

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  lead:         'bg-gray-700 text-gray-300',
  estimate:     'bg-yellow-900/60 text-yellow-300',
  contract:     'bg-blue-900/60 text-blue-300',
  construction: 'bg-emerald-900/60 text-emerald-300',
  completed:    'bg-gray-800 text-gray-400',
  lost:         'bg-red-900/40 text-red-400',
};

const ALL_STATUSES: ProjectStatus[] = [
  'lead', 'estimate', 'contract', 'construction', 'completed', 'lost',
];

const PRIORITY: Record<ProjectStatus, number> = {
  construction: 0, contract: 1, estimate: 2,
  lead: 3, completed: 4, lost: 5,
};

const getLatestStatus = (custProjects: Project[]): ProjectStatus | null => {
  if (!custProjects.length) return null;
  return [...custProjects].sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status])[0].status;
};

function genId(prefix: string): string {
  const d    = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${date}${rand}`;
}

/** 金額を ¥X,XXX,XXX 形式にフォーマット */
const formatAmt = (n: number) => `¥${n.toLocaleString()}`;

// ─────────────────────────────────────────────────────────────
// 失注理由入力ダイアログ
// ─────────────────────────────────────────────────────────────

function LostReasonDialog({
  projectTitle, onConfirm, onCancel,
}: {
  projectTitle: string;
  onConfirm:   (reason: string) => Promise<void>;
  onCancel:    () => void;
}) {
  const [reason,     setReason]     = useState('');
  const [recording,  setRecording]  = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('このブラウザは音声入力に対応していません'); return; }
    const rec = new SR();
    rec.lang = 'ja-JP'; rec.continuous = false;
    rec.onresult = (e: any) => setReason(prev => (prev ? prev + '　' : '') + e.results[0][0].transcript);
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    setRecording(true); rec.start();
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    await onConfirm(reason.trim());
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-[#111A35] border border-red-700/40 rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
          <LucideAlertTriangle size={15} /> 失注理由の入力
        </h3>
        <p className="text-xs text-gray-400">「{projectTitle}」を失注に変更します。</p>
        <div className="space-y-2">
          <label className="text-xs text-gray-400 block">失注理由（任意）</label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="例: 予算超過、競合他社に決定 など"
            rows={3}
            className="w-full bg-[#0B132B] border border-gray-700 focus:border-red-600 text-white text-xs rounded-lg px-3 py-2 focus:outline-none resize-none"
          />
          <button onClick={startVoice} disabled={recording}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              recording ? 'bg-red-900/40 border-red-700 text-red-300 animate-pulse'
                        : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'}`}>
            {recording ? <LucideSquare size={11} /> : <LucideMic size={11} />}
            {recording ? '録音中...' : '音声入力'}
          </button>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 border border-gray-700 text-gray-400 text-xs py-2 rounded-lg hover:border-gray-500 transition-colors">
            キャンセル
          </button>
          <button onClick={handleConfirm} disabled={submitting}
            className="flex-[2] bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
            {submitting ? '処理中...' : <><LucideCheck size={11} /> 失注として確定</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 複数担当者ピッカー（フロートウィンドウ）
// ─────────────────────────────────────────────────────────────

function AssigneePicker({
  selected, staffList, onClose, onChange,
}: {
  selected:  ProjectAssignee[];
  staffList: string[];
  onClose:   () => void;
  onChange:  (list: ProjectAssignee[]) => void;
}) {
  const [search, setSearch] = useState('');

  const balancePercentages = (list: ProjectAssignee[]): ProjectAssignee[] => {
    if (!list.length) return [];
    const base      = Math.floor(100 / list.length);
    const remainder = 100 - base * list.length;
    return list.map((a, i) => ({ ...a, percentage: i === 0 ? base + remainder : base }));
  };

  const add = (name: string) => {
    const next = [...selected, { name, percentage: 0 }];
    onChange(balancePercentages(next));
  };

  const remove = (name: string) => {
    const next = selected.filter(a => a.name !== name);
    onChange(next.length ? balancePercentages(next) : []);
  };

  const updatePct = (name: string, pct: number) => {
    onChange(selected.map(a => a.name === name ? { ...a, percentage: Math.min(100, Math.max(0, pct)) } : a));
  };

  const total = selected.reduce((s, a) => s + a.percentage, 0);
  const available = staffList.filter(s => !selected.some(a => a.name === s) && s.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-md shadow-2xl">
        <div className="bg-[#0B132B] px-4 py-3 border-b border-[#C5A059]/20 flex items-center justify-between rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideUsers size={14} className="text-[#C5A059]" /> 担当者を設定
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={15} /></button>
        </div>
        <div className="p-4 space-y-4">
          {/* 選択済みリスト */}
          {selected.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-semibold">選択中の担当者</p>
              {selected.map(a => (
                <div key={a.name} className="flex items-center gap-2 bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2">
                  <LucideUser size={12} className="text-[#C5A059] shrink-0" />
                  <span className="flex-1 text-sm text-white">{a.name}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100"
                      value={a.percentage}
                      onChange={e => updatePct(a.name, parseInt(e.target.value) || 0)}
                      className="w-14 bg-[#111A35] border border-gray-700 text-white text-xs rounded px-2 py-1 text-right focus:outline-none focus:border-[#C5A059]"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                  <button onClick={() => remove(a.name)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <LucideUserMinus size={13} />
                  </button>
                </div>
              ))}
              <div className={`text-[10px] ${total === 100 ? 'text-emerald-400' : 'text-yellow-400'} text-right`}>
                合計: {total}% {total !== 100 && '（100%になるよう調整してください）'}
              </div>
            </div>
          )}

          {/* スタッフ検索・追加 */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-semibold">担当者を追加</p>
            <div className="relative">
              <LucideSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="名前で検索..."
                className="w-full bg-[#0B132B] border border-gray-700 focus:border-[#C5A059] text-white text-xs pl-7 pr-3 py-2 rounded-lg focus:outline-none"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {available.map(name => (
                <button key={name} onClick={() => add(name)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-[#1C2C54] hover:text-white flex items-center gap-2 transition-colors">
                  <LucideUserPlus size={12} className="text-[#C5A059]" /> {name}
                </button>
              ))}
              {available.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-3">
                  {search ? '該当なし' : 'すべての担当者が選択済みです'}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-xs py-2 rounded-lg hover:border-gray-500 transition-colors">
              キャンセル
            </button>
            <button onClick={onClose}
              className="flex-[2] bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <LucideCheck size={11} /> 確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 見積明細の初期行セット */
const defaultItems = (): Estimate['items'] => [
  { itemId: 'item-1', itemName: '材料費', quantity: 1, unit: '式', unitPrice: 0, total: 0 },
  { itemId: 'item-2', itemName: '施工費', quantity: 1, unit: '式', unitPrice: 0, total: 0 },
  { itemId: 'item-3', itemName: '諸経費', quantity: 1, unit: '式', unitPrice: 0, total: 0 },
];

/** 支払条件の標準テンプレート生成（着工30% / 中間30% / 完工40%） */
const generateDefaultPaymentTerms = (totalAmount: number): PaymentTerm[] => [
  {
    termName:    '着工金',
    percentage:  30,
    amount:      Math.round(totalAmount * 0.3),
    description: '着工確認後・工事開始前にお支払いください',
    isPaid:      false,
  },
  {
    termName:    '中間金',
    percentage:  30,
    amount:      Math.round(totalAmount * 0.3),
    description: '工事中間確認完了後にお支払いください',
    isPaid:      false,
  },
  {
    termName:    '完工金（残金）',
    percentage:  40,
    amount:      Math.round(totalAmount * 0.4),
    description: '引き渡し確認・完工後にお支払いください',
    isPaid:      false,
  },
];

interface SimilarComparison {
  samples:     Estimate[];
  avgAmount:   number;
  diffPct:     number;
}

/** 類似案件見積との比較を算出（承認レビュー用） */
function getSimilarComparison(
  target:       Estimate,
  allEstimates: Estimate[],
  projectTitle: string,
): SimilarComparison {
  const approved = allEstimates.filter(e =>
    e.estimateId    !== target.estimateId &&
    e.approvalStatus === 'approved' &&
    e.totalAmount    > 0,
  );
  if (!approved.length) return { samples: [], avgAmount: 0, diffPct: 0 };

  // キーワード一致（案件名の2文字以上の語で照合）
  const words = projectTitle.split(/[\s・ー　、。]+/).filter(w => w.length >= 2);
  let samples = approved.filter(e =>
    e.customerId === target.customerId ||
    words.some(w => (e.projectTitle ?? '').includes(w)),
  );

  // 一致なし → 金額帯で絞る（±50%）
  if (!samples.length) {
    samples = approved
      .filter(e => e.totalAmount >= target.totalAmount * 0.5 && e.totalAmount <= target.totalAmount * 1.5)
      .slice(0, 5);
  }

  // それでもなければ最新5件
  if (!samples.length) samples = approved.slice(0, 5);

  const avgAmount = Math.round(
    samples.reduce((s, e) => s + e.totalAmount, 0) / samples.length,
  );
  const diffPct = avgAmount > 0
    ? Math.round(((target.totalAmount - avgAmount) / avgAmount) * 1000) / 10
    : 0;

  return { samples: samples.slice(0, 5), avgAmount, diffPct };
}

/** 承認ステータスのラベル・スタイル */
const APPROVAL_LABEL: Record<Estimate['approvalStatus'], string> = {
  draft:            '下書き',
  pending_approval: '承認待ち',
  approved:         '承認済',
  rejected:         '差し戻し',
};
const APPROVAL_COLOR: Record<Estimate['approvalStatus'], string> = {
  draft:            'bg-gray-700 text-gray-400',
  pending_approval: 'bg-yellow-900/60 text-yellow-300',
  approved:         'bg-emerald-900/60 text-emerald-300',
  rejected:         'bg-red-900/50 text-red-400',
};

/** 契約ステータスのラベル・スタイル */
const CONTRACT_LABEL: Record<Contract['status'], string> = {
  pending:   '未署名',
  signed:    '署名済',
  cancelled: 'キャンセル',
};
const CONTRACT_COLOR: Record<Contract['status'], string> = {
  pending:   'bg-yellow-900/60 text-yellow-300',
  signed:    'bg-emerald-900/60 text-emerald-300',
  cancelled: 'bg-gray-700 text-gray-400',
};

/** 契約書承認ステータスのラベル・スタイル */
const CONTRACT_APPROVAL_LABEL: Record<ContractApprovalStatus, string> = {
  draft:            '下書き',
  pending_approval: '承認待ち',
  approved:         '承認済',
  rejected:         '差し戻し',
  voided:           '廃止',
};
const CONTRACT_APPROVAL_COLOR: Record<ContractApprovalStatus, string> = {
  draft:            'bg-gray-700 text-gray-400',
  pending_approval: 'bg-yellow-900/60 text-yellow-300',
  approved:         'bg-emerald-900/60 text-emerald-300',
  rejected:         'bg-red-900/50 text-red-400',
  voided:           'bg-gray-800 text-gray-500',
};

// ─────────────────────────────────────────────────────────────
// 書類送付ダイアログ（印刷/メール/LINE）
// ─────────────────────────────────────────────────────────────

function SendDocumentDialog({
  title, customerEmail, summaryText, onOpenPrint, onClose, onSent,
}: {
  title:          string;
  customerEmail?: string;
  summaryText:    string;
  onOpenPrint:    () => void;
  onClose:        () => void;
  /** 何らかの方法で送付された際のコールバック（ステータス変更トリガー） */
  onSent?:        () => void;
}) {
  const lineUrl   = `https://line.me/R/share?text=${encodeURIComponent(summaryText)}`;
  const mailtoUrl = customerEmail
    ? `mailto:${customerEmail}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(summaryText)}`
    : '';

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white">📤 書類の送付・ダウンロード</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <div className="p-4 space-y-2.5">

          {/* 印刷 / PDF保存 */}
          <button
            onClick={() => { onOpenPrint(); onSent?.(); onClose(); }}
            className="w-full flex items-center gap-3 bg-[#0A0F1D] hover:bg-[#1C2C54] border border-gray-700 hover:border-[#C5A059]/50 rounded-xl px-4 py-3 transition-colors text-left"
          >
            <span className="text-2xl shrink-0">🖨️</span>
            <div>
              <div className="text-sm font-bold text-white">印刷 / PDF として保存</div>
              <div className="text-[10px] text-gray-400">印刷ダイアログで「PDFとして保存」を選択</div>
            </div>
          </button>

          {/* メール送信 */}
          {customerEmail ? (
            <a href={mailtoUrl}
              onClick={() => { onSent?.(); onClose(); }}
              className="w-full flex items-center gap-3 bg-[#0A0F1D] hover:bg-[#1C2C54] border border-gray-700 hover:border-[#C5A059]/50 rounded-xl px-4 py-3 transition-colors text-left"
            >
              <span className="text-2xl shrink-0">📧</span>
              <div>
                <div className="text-sm font-bold text-white">メールで送付</div>
                <div className="text-[10px] text-gray-400">{customerEmail}</div>
              </div>
            </a>
          ) : (
            <div className="flex items-center gap-3 bg-[#0A0F1D] border border-gray-700 rounded-xl px-4 py-3 opacity-50 cursor-not-allowed">
              <span className="text-2xl shrink-0">📧</span>
              <div>
                <div className="text-sm font-bold text-gray-400">メールで送付</div>
                <div className="text-[10px] text-gray-500">顧客情報にメールアドレスを登録してください</div>
              </div>
            </div>
          )}

          {/* LINE 送信 */}
          <a href={lineUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => { onSent?.(); onClose(); }}
            className="w-full flex items-center gap-3 bg-[#0A0F1D] hover:bg-[#06C755]/10 border border-gray-700 hover:border-[#06C755]/50 rounded-xl px-4 py-3 transition-colors text-left"
          >
            <span className="text-2xl shrink-0">💬</span>
            <div>
              <div className="text-sm font-bold text-white">LINE で送付</div>
              <div className="text-[10px] text-gray-400">LINE アプリで内容をシェア</div>
            </div>
          </a>

          <p className="text-[10px] text-gray-500 text-center leading-relaxed pt-1">
            ※ PDF ファイルを添付する場合は「印刷/PDF保存」から<br />
            保存後、各アプリで手動添付してください
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 顧客登録ダイアログ
// ─────────────────────────────────────────────────────────────

function AddCustomerDialog({
  onClose, onCreated,
}: {
  onClose:   () => void;
  onCreated: (msg: string) => void;
}) {
  const [name,    setName]    = useState('');
  const [address, setAddress] = useState('');
  const [phone,   setPhone]   = useState('');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())    { setError('顧客名を入力してください'); return; }
    if (!address.trim()) { setError('住所を入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const customer: Customer = {
        customerId: genId('C'),
        name:       name.trim(),
        address:    address.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        totalLtv:   0,
        createdAt:  now,
      };
      await saveCustomer(customer);
      onCreated(`顧客「${customer.name}」を登録しました`);
      onClose();
    } catch (err: any) {
      setError(err.code?.includes('permission-denied')
        ? '権限エラーです（Firestoreルールを確認）'
        : `登録に失敗しました（${err.code ?? 'unknown'}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-md shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideUserPlus size={15} className="text-[#C5A059]" /> 新規顧客登録
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">顧客名 *</label>
            <input type="text" required autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="例: 山田 太郎"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">住所 *</label>
            <input type="text" required value={address} onChange={e => setAddress(e.target.value)}
              placeholder="例: 大阪府大阪市住之江区..."
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">電話番号（任意）</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="例: 06-XXXX-XXXX"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">メールアドレス（任意・見積・契約書の送付に使用）</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="例: yamada@example.com"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>
          {error && <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition-colors">
              キャンセル
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50">
              {loading ? <><LucideActivity size={14} className="animate-spin" /> 登録中...</> : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 案件登録ダイアログ（全ロール対応・複数担当者対応）
// ─────────────────────────────────────────────────────────────

function AddProjectDialog({
  customer, staffList, currentRole, currentUserName, onClose, onCreated,
}: {
  customer:        Customer;
  staffList:       string[];
  currentRole:     UserRole;
  currentUserName: string;
  onClose:         () => void;
  onCreated:       (msg: string) => void;
}) {
  const isManagerLike = currentRole === 'manager' || currentRole === 'admin';
  const [title,        setTitle]        = useState('');
  const [projectId,    setProjectId]    = useState(genId('P'));
  const [status,       setStatus]       = useState<ProjectStatus>('lead');
  const [amount,       setAmount]       = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [deadline,     setDeadline]     = useState('');
  const [issue,        setIssue]        = useState('');
  const [probability,  setProbability]  = useState('50');
  const [assignees,    setAssignees]    = useState<ProjectAssignee[]>(
    () => currentUserName ? [{ name: currentUserName, percentage: 100 }] : [],
  );
  const [notes,        setNotes]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [showPicker,   setShowPicker]   = useState(false);

  const primaryAssignee = assignees[0]?.name ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim())     { setError('案件名を入力してください'); return; }
    if (!projectId.trim()) { setError('案件IDを入力してください'); return; }
    const amountNum = parseInt(String(amount).replace(/,/g, ''), 10) || 0;
    const budgetNum = parseInt(String(budgetAmount).replace(/,/g, ''), 10) || undefined;
    const probNum   = Math.min(100, Math.max(0, parseInt(probability) || 0));
    setError('');
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const pid = projectId.trim();
      await saveProject({
        projectId:    pid,
        customerId:   customer.customerId,
        title:        title.trim(),
        status,
        amount:       amountNum,
        assignee:     primaryAssignee,
        assignees:    assignees.length > 0 ? assignees : undefined,
        lastActivityAt: now,
        createdAt:    now,
        // スタッフが作成した場合は管理者承認待ち
        ...(isManagerLike ? {} : { projectApprovalStatus: 'needs_approval' as const, createdByRole: currentRole }),
        ...(budgetNum            ? { budgetAmount: budgetNum }      : {}),
        ...(deadline             ? { deadline }                     : {}),
        ...(issue.trim()         ? { issue: issue.trim() }          : {}),
        ...(probNum !== undefined ? { probability: probNum }         : {}),
        ...(notes.trim()         ? { notes: notes.trim() }          : {}),
      });
      // スタッフ作成 → 管理者に承認依頼通知（失敗しても登録自体は成功扱い）
      if (!isManagerLike) {
        createNotification({
          type:            'project_approval_requested',
          title:           '案件登録 承認依頼',
          body:            `${currentUserName} が「${title.trim()}」（${customer.name} 様）の案件を登録しました。承認をお願いします。`,
          relatedId:       pid,
          projectTitle:    title.trim(),
          notifiedUserIds: [],  // 管理者は全通知を閲覧するため空で OK
        }).catch(console.error);
      }
      onCreated(isManagerLike
        ? `案件「${title.trim()}」を登録しました`
        : `案件「${title.trim()}」を登録しました（管理者の承認待ち）`);
      onClose();
    } catch (err: any) {
      setError(err.code?.includes('permission-denied')
        ? '権限エラーです（Firestoreルールを確認）'
        : `登録に失敗しました（${err.code ?? 'unknown'}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showPicker && (
        <AssigneePicker
          selected={assignees}
          staffList={staffList}
          onClose={() => setShowPicker(false)}
          onChange={list => setAssignees(list)}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
        <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl sticky top-0 z-10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <LucidePlusCircle size={15} className="text-[#C5A059]" />
              新規案件登録
              <span className="text-[#C5A059] text-xs font-normal">— {customer.name}</span>
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            {/* スタッフ作成の説明 */}
            {!isManagerLike && (
              <div className="bg-yellow-950/30 border border-yellow-700/30 rounded-lg px-3 py-2.5 text-xs text-yellow-300 flex items-start gap-2">
                <LucideAlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>登録後は管理者の承認が必要です。承認されるまで「承認待ち」として表示されます。</span>
              </div>
            )}

            {/* 案件名 + ID */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">案件名 *</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="例: 外壁塗装工事"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
            {isManagerLike && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">案件ID（自動生成・変更可）</label>
                <input type="text" required value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
              </div>
            )}

            {/* ステータス */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">ステータス</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_STATUSES.map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium ${
                      status === s ? STATUS_COLOR[s] + ' border-current' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* 見込み度 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                <LucidePercent size={11} /> 見込み度: <span className="text-white font-bold ml-1">{probability}%</span>
              </label>
              <input type="range" min="0" max="100" step="5"
                value={probability} onChange={e => setProbability(e.target.value)}
                className="w-full accent-[#C5A059]" />
            </div>

            {/* 金額・予算 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">受注金額（円）</label>
                <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">顧客予算（円）</label>
                <input type="number" min="0" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)}
                  placeholder="未入力"
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
              </div>
            </div>

            {/* 希望納期 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                <LucideCalendarDays size={11} /> 希望納期
              </label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>

            {/* 顧客課題 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">顧客課題・ニーズ</label>
              <textarea value={issue} onChange={e => setIssue(e.target.value)} rows={2}
                placeholder="例: 外壁の剥がれが気になっている。雨漏りの懸念あり..."
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
            </div>

            {/* 担当者（複数・按分） */}
            {staffList.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">担当者</label>
                <div className="space-y-1.5">
                  {assignees.map(a => (
                    <div key={a.name} className="flex items-center gap-2 bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-1.5">
                      <LucideUser size={11} className="text-[#C5A059] shrink-0" />
                      <span className="flex-1 text-sm text-white">{a.name}</span>
                      <span className="text-xs text-gray-400">{a.percentage}%</span>
                    </div>
                  ))}
                  <button type="button" onClick={() => setShowPicker(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-[#C5A059] border border-dashed border-[#C5A059]/40 hover:border-[#C5A059] py-1.5 rounded-lg transition-colors">
                    <LucideUserPlus size={12} /> 担当者を追加・変更
                  </button>
                </div>
              </div>
            )}

            {/* 備考 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">備考</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="その他メモ"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
            </div>

            {error && <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition-colors">
                キャンセル
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50">
                {loading ? <><LucideActivity size={14} className="animate-spin" /> 登録中...</>
                  : isManagerLike ? '登録する' : '承認依頼として登録'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 案件編集ダイアログ
// ─────────────────────────────────────────────────────────────

function EditProjectDialog({
  project, staffList, onClose, onSaved,
}: {
  project:   Project;
  staffList: string[];
  onClose:   () => void;
  onSaved:   (msg: string) => void;
}) {
  const [title,        setTitle]        = useState(project.title);
  const [status,       setStatus]       = useState<ProjectStatus>(project.status);
  const [amount,       setAmount]       = useState(String(project.amount || ''));
  const [budgetAmount, setBudgetAmount] = useState(String(project.budgetAmount || ''));
  const [deadline,     setDeadline]     = useState(project.deadline || '');
  const [issue,        setIssue]        = useState(project.issue || '');
  const [probability,  setProbability]  = useState(String(project.probability ?? 50));
  const [assignees,    setAssignees]    = useState<ProjectAssignee[]>(
    () => project.assignees ?? (project.assignee ? [{ name: project.assignee, percentage: 100 }] : []),
  );
  const [notes,        setNotes]        = useState(project.notes || '');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [showPicker,   setShowPicker]   = useState(false);

  const primaryAssignee = assignees[0]?.name ?? project.assignee ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('案件名を入力してください'); return; }
    const amountNum = parseInt(String(amount).replace(/,/g, ''), 10) || 0;
    const budgetNum = parseInt(String(budgetAmount).replace(/,/g, ''), 10) || undefined;
    const probNum   = Math.min(100, Math.max(0, parseInt(probability) || 0));
    setError('');
    setLoading(true);
    try {
      await saveProject({
        ...project,
        title:          title.trim(),
        status,
        amount:         amountNum,
        assignee:       primaryAssignee,
        assignees:      assignees.length > 0 ? assignees : undefined,
        probability:    probNum,
        lastActivityAt: new Date().toISOString(),
        ...(budgetNum    ? { budgetAmount: budgetNum }  : {}),
        ...(deadline     ? { deadline }                 : {}),
        ...(issue.trim() ? { issue: issue.trim() }      : {}),
        ...(notes.trim() ? { notes: notes.trim() }      : {}),
      });
      onSaved(`案件「${title.trim()}」を更新しました`);
      onClose();
    } catch (err: any) {
      setError(err.code?.includes('permission-denied')
        ? '権限エラーです（Firestoreルールを確認）'
        : `更新に失敗しました（${err.code ?? 'unknown'}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl sticky top-0 z-10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucidePencil size={15} className="text-[#C5A059]" />
            案件情報を編集
            <span className="text-[11px] text-gray-400 font-mono font-normal">{project.projectId}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">案件名 *</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">ステータス</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium ${
                    status === s ? STATUS_COLOR[s] + ' border-current' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <LucidePercent size={11} /> 見込み度: <span className="text-white font-bold ml-1">{probability}%</span>
            </label>
            <input type="range" min="0" max="100" step="5"
              value={probability} onChange={e => setProbability(e.target.value)}
              className="w-full accent-[#C5A059]" />
            <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">受注金額（円）</label>
              <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">顧客予算（円）</label>
              <input type="number" min="0" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)}
                placeholder="未入力"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <LucideCalendarDays size={11} /> 希望納期
            </label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">顧客課題・ニーズ</label>
            <textarea value={issue} onChange={e => setIssue(e.target.value)} rows={2}
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
          </div>

          {staffList.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">担当者（複数可・按分設定）</label>
              <div className="space-y-1.5">
                {assignees.map(a => (
                  <div key={a.name} className="flex items-center gap-2 bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-1.5">
                    <LucideUser size={11} className="text-[#C5A059] shrink-0" />
                    <span className="flex-1 text-sm text-white">{a.name}</span>
                    <span className="text-xs text-gray-400">{a.percentage}%</span>
                  </div>
                ))}
                <button type="button" onClick={() => setShowPicker(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-[#C5A059] border border-dashed border-[#C5A059]/40 hover:border-[#C5A059] py-1.5 rounded-lg transition-colors">
                  <LucideUsers size={12} /> 担当者を追加・変更
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1">備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
          </div>

          {error && <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition-colors">
              キャンセル
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50">
              {loading ? <><LucideActivity size={14} className="animate-spin" /> 更新中...</> : '更新する'}
            </button>
          </div>
        </form>
      </div>
      {showPicker && (
        <AssigneePicker
          selected={assignees}
          staffList={staffList}
          onClose={() => setShowPicker(false)}
          onChange={list => setAssignees(list)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 見積書作成ダイアログ
// ─────────────────────────────────────────────────────────────

function CreateEstimateDialog({
  project, customer, existingVersion, createdBy, estimateTemplates,
  vendors = [], vendorQuoteRequests = [], onClose, onCreated,
  existingEstimate,
}: {
  project:                Project;
  customer:               Customer;
  existingVersion:        number;
  createdBy:              string;
  estimateTemplates:      EstimateTemplate[];
  vendors?:               Vendor[];
  vendorQuoteRequests?:   VendorQuoteRequest[];
  onClose:                () => void;
  onCreated:              (msg: string) => void;
  existingEstimate?:      Estimate;
}) {
  const isEditMode = !!existingEstimate;
  // この案件の採用済み業者見積
  const acceptedVendorQuotes = vendorQuoteRequests.filter(
    r => r.projectId === project.projectId && r.status === 'accepted',
  );

  const [items,           setItems]           = useState<Estimate['items']>(() => existingEstimate?.items ?? defaultItems());
  const [validityDays,    setValidityDays]     = useState(existingEstimate?.validityDays ?? 30);
  const [notes,           setNotes]           = useState(existingEstimate?.notes ?? '');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [showTplPicker,   setShowTplPicker]   = useState(false);
  const [showCost,        setShowCost]        = useState(() =>
    (existingEstimate?.vendorCosts?.length ?? 0) > 0 ||
    acceptedVendorQuotes.length > 0   // 採用済み業者見積があれば自動展開
  );
  const [vendorCosts,     setVendorCosts]     = useState<VendorCostEntry[]>(() => existingEstimate?.vendorCosts ?? []);

  const addVendorCost = () => setVendorCosts(prev => [...prev, {
    entryId: `vc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    vendorId:   undefined,
    vendorName: '',
    amount:     0,
  }]);

  const updateVendorCost = (idx: number, updates: Partial<VendorCostEntry>) =>
    setVendorCosts(prev => { const n = [...prev]; n[idx] = { ...n[idx], ...updates }; return n; });

  const removeVendorCost = (idx: number) =>
    setVendorCosts(prev => prev.filter((_, i) => i !== idx));

  const totalAmount = items.reduce((s, it) => s + it.total, 0);

  const updateItem = (idx: number, updates: Partial<Estimate['items'][number]>) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[idx], ...updates };
      if ('quantity' in updates || 'unitPrice' in updates) {
        item.total = Math.round((item.quantity || 0) * (item.unitPrice || 0));
      }
      next[idx] = item;
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, {
    itemId:    `item-${Date.now()}`,
    itemName:  '',
    quantity:  1,
    unit:      '式',
    unitPrice: 0,
    total:     0,
  }]);

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (isDraft: boolean) => {
    const validItems = items.filter(it => it.itemName.trim());
    if (!validItems.length) { setError('明細行を1つ以上入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      const mappedItems = validItems.map(it => ({
        ...it,
        itemId: it.itemId || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }));

      // 原価データ（金額 > 0 の有効エントリのみ保存）
      const validCosts = vendorCosts.filter(vc => vc.amount > 0 && (vc.vendorId || vc.vendorName.trim()));
      const totalCostVal    = validCosts.reduce((s, vc) => s + vc.amount, 0);
      const grossProfitVal  = totalAmount - totalCostVal;
      const grossProfitRate = totalAmount > 0 ? Math.round((grossProfitVal / totalAmount) * 1000) / 10 : 0;
      const costFields = validCosts.length > 0
        ? { vendorCosts: validCosts, totalCost: totalCostVal, grossProfit: grossProfitVal, grossProfitRate }
        : {};

      if (isEditMode && existingEstimate) {
        // ── 編集モード: 同じ ID・バージョンで上書き保存 ──
        const updated: Estimate = {
          ...existingEstimate,
          items:          mappedItems,
          totalAmount,
          validityDays,
          approvalStatus: isDraft ? 'draft' : 'pending_approval',
          ...costFields,
        };
        if (notes.trim()) updated.notes = notes.trim();
        else delete updated.notes;
        if (!validCosts.length) { delete updated.vendorCosts; delete updated.totalCost; delete updated.grossProfit; delete updated.grossProfitRate; }
        await saveEstimate(updated);
        onCreated(isDraft
          ? `見積書 Ver.${existingEstimate.version} を更新しました（下書き）`
          : `見積書 Ver.${existingEstimate.version} を更新して承認依頼しました`);
      } else {
        // ── 新規作成 ──
        const version = existingVersion + 1;
        const estimate: Estimate = {
          estimateId:     genId('E'),
          projectId:      project.projectId,
          customerId:     customer.customerId,
          projectTitle:   project.title,
          customerName:   customer.name,
          createdBy,
          status:         'draft',
          approvalStatus: isDraft ? 'draft' : 'pending_approval',
          totalAmount,
          items:          mappedItems,
          validityDays,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...costFields,
          version,
          createdAt: new Date().toISOString(),
        };
        await saveEstimate(estimate);
        onCreated(isDraft
          ? `見積書 Ver.${version} を下書き保存しました`
          : `見積書 Ver.${version} を承認依頼として提出しました`);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { code?: string };
      setError(`保存に失敗しました（${e.code ?? 'unknown'}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* ヘッダー */}
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideFileText size={15} className="text-[#C5A059]" />
            {isEditMode ? `見積書 Ver.${existingEstimate!.version} を編集` : '新規見積書作成'}
            <span className="text-[11px] text-gray-400 font-normal">— {project.title} / {customer.name}様</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* テンプレートから読み込み */}
          {estimateTemplates.length > 0 && (
            <div>
              {!showTplPicker ? (
                <button
                  onClick={() => setShowTplPicker(true)}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C5A059]/50 text-[#E6C687] text-xs font-semibold rounded-lg py-2.5 hover:bg-[#C5A059]/5 transition-colors"
                >
                  <LucideClipboardList size={13} /> テンプレートから明細を読み込む
                </button>
              ) : (
                <div className="border border-[#C5A059]/30 rounded-lg overflow-hidden bg-[#0A0F1D]">
                  <div className="px-3 py-2 bg-[#0B132B] border-b border-gray-800 flex justify-between items-center">
                    <span className="text-xs font-bold text-[#E6C687] flex items-center gap-1.5">
                      <LucideClipboardList size={12} /> テンプレートを選択
                    </span>
                    <button onClick={() => setShowTplPicker(false)} className="text-gray-500 hover:text-white">
                      <LucideX size={14} />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-800 max-h-52 overflow-y-auto">
                    {estimateTemplates.map(tpl => (
                      <button
                        key={tpl.templateId}
                        onClick={() => {
                          setItems(tpl.items.map(it => ({ ...it, itemId: `item-${Date.now()}-${Math.random().toString(36).slice(2)}` })));
                          setShowTplPicker(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#1C2C54] transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <p className="text-xs font-semibold text-white group-hover:text-[#E6C687] transition-colors">{tpl.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {tpl.category && <span className="text-gray-400 mr-2">{tpl.category}</span>}
                            {tpl.items.length} 項目
                          </p>
                        </div>
                        <LucideCheck size={13} className="text-gray-700 group-hover:text-[#C5A059] transition-colors" />
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-1.5 bg-[#0B132B] border-t border-gray-800">
                    <p className="text-[10px] text-gray-500">選択すると現在の明細行が置き換わります</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 明細テーブル */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-300">明細行</label>
              <button onClick={addItem}
                className="flex items-center gap-1 text-[11px] text-[#C5A059] hover:text-[#E6C687] transition-colors">
                <LucidePlus size={11} /> 行を追加
              </button>
            </div>
            <div className="rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0A0F1D] text-gray-500">
                    <th className="px-2 py-1.5 text-left font-normal w-[38%]">項目名</th>
                    <th className="px-2 py-1.5 text-right font-normal w-[12%]">数量</th>
                    <th className="px-2 py-1.5 text-left font-normal w-[10%]">単位</th>
                    <th className="px-2 py-1.5 text-right font-normal w-[20%]">単価（円）</th>
                    <th className="px-2 py-1.5 text-right font-normal w-[16%]">小計</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.itemId ?? idx} className="border-t border-gray-800">
                      <td className="px-1 py-1">
                        <input
                          type="text" value={it.itemName}
                          onChange={e => updateItem(idx, { itemName: e.target.value })}
                          placeholder="例: 外壁塗装工事"
                          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-[#C5A059]"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number" min="0" value={it.quantity}
                          onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-1.5 py-1 text-right focus:outline-none focus:border-[#C5A059]"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="text" value={it.unit}
                          onChange={e => updateItem(idx, { unit: e.target.value })}
                          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-1.5 py-1 focus:outline-none focus:border-[#C5A059]"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number" min="0" value={it.unitPrice}
                          onChange={e => updateItem(idx, { unitPrice: parseInt(e.target.value) || 0 })}
                          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-1.5 py-1 text-right focus:outline-none focus:border-[#C5A059]"
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-[#E6C687] font-mono whitespace-nowrap">
                        {formatAmt(it.total)}
                      </td>
                      <td className="px-1 py-1 text-center">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)}
                            className="text-gray-600 hover:text-red-400 transition-colors">
                            <LucideTrash2 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#C5A059]/30 bg-[#0A0F1D]">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-300">合計（税抜）</td>
                    <td className="px-2 py-2 text-right text-base font-extrabold text-[#E6C687]">
                      {formatAmt(totalAmount)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 有効期限・備考 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">有効期限（日数）</label>
              <input
                type="number" min="1" max="365" value={validityDays}
                onChange={e => setValidityDays(parseInt(e.target.value) || 30)}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
            <div className="flex items-end">
              <span className="text-xs text-gray-500">発行日より {validityDays} 日間有効</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">備考・特記事項</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="例: 足場代・養生費を含む"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none"
            />
          </div>

          {/* ── 原価入力（任意・折りたたみ） ── */}
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCost(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#0A0F1D] hover:bg-[#0F1A30] transition-colors text-xs text-gray-400"
            >
              <span className="flex items-center gap-2 font-bold text-gray-300">
                <LucideTrendingUp size={12} className="text-[#C5A059]" />
                原価・粗利入力（任意）
                {/* 採用済み業者見積が引用可能なときバッジ表示 */}
                {acceptedVendorQuotes.length > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-700/40">
                    業者見積 {acceptedVendorQuotes.length}件 引用可
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                {(() => {
                  const tc = vendorCosts.reduce((s, vc) => s + vc.amount, 0);
                  return tc > 0 ? (
                    <span className="text-[11px] text-emerald-300">
                      原価 {formatAmt(tc)} → 粗利 {formatAmt(totalAmount - tc)}
                      {totalAmount > 0 && <span className="ml-1 text-emerald-400/70">({Math.round((totalAmount - tc) / totalAmount * 1000) / 10}%)</span>}
                    </span>
                  ) : null;
                })()}
                {showCost ? <LucideChevronUp size={12} /> : <LucideChevronDown size={12} />}
              </span>
            </button>

            {showCost && (
              <div className="p-3 space-y-3 bg-[#111A35]">
                {/* 原価明細テーブル */}
                <div className="rounded border border-gray-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#0A0F1D] text-gray-500">
                        <th className="px-2 py-1.5 text-left font-normal w-[38%]">業者</th>
                        <th className="px-2 py-1.5 text-left font-normal">内容メモ</th>
                        <th className="px-2 py-1.5 text-right font-normal w-[22%]">金額（円）</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {vendorCosts.map((vc, idx) => (
                        <tr key={vc.entryId} className="border-t border-gray-800">
                          <td className="px-1 py-1">
                            <select
                              value={vc.vendorId ?? ''}
                              onChange={e => {
                                const vid = e.target.value || undefined;
                                const v = vendors.find(vn => vn.vendorId === vid);
                                updateVendorCost(idx, { vendorId: vid, vendorName: v ? v.name : '', description: undefined });
                              }}
                              className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-[#C5A059]"
                            >
                              <option value="">自社 / その他</option>
                              {vendors.filter(v => v.status === 'active').map(v => (
                                <option key={v.vendorId} value={v.vendorId}>{v.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="text"
                              value={vc.vendorId ? (vc.description ?? '') : vc.vendorName}
                              onChange={e => updateVendorCost(idx, vc.vendorId
                                ? { description: e.target.value }
                                : { vendorName:  e.target.value })}
                              placeholder={vc.vendorId ? '工事内容（任意）' : '費目名'}
                              className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-[#C5A059]"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number" min="0" value={vc.amount}
                              onChange={e => updateVendorCost(idx, { amount: parseInt(e.target.value) || 0 })}
                              className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-1.5 py-1 text-right focus:outline-none focus:border-[#C5A059]"
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <button type="button" onClick={() => removeVendorCost(idx)}
                              className="text-gray-600 hover:text-red-400 transition-colors">
                              <LucideTrash2 size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {vendorCosts.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-gray-800 bg-[#0A0F1D]">
                          <td colSpan={2} className="px-3 py-1.5 text-right text-[11px] text-gray-400 font-bold">原価合計</td>
                          <td className="px-2 py-1.5 text-right font-bold text-red-400 font-mono">
                            {formatAmt(vendorCosts.reduce((s, vc) => s + vc.amount, 0))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* 採用済み業者見積を一括取込 */}
                {acceptedVendorQuotes.length > 0 && (
                  <div className="bg-emerald-950/20 border border-emerald-700/30 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <LucideCheck size={10} /> 採用済み業者見積（原価に取込可）
                    </p>
                    {acceptedVendorQuotes.map(vq => (
                      <div key={vq.requestId} className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-gray-300 flex-1 min-w-0">
                          <span className="font-medium truncate block">{vq.vendorName}</span>
                          <span className="text-gray-500 text-[10px]">{vq.workScope.slice(0, 40)}</span>
                        </div>
                        <span className="text-[11px] font-bold text-[#E6C687] shrink-0">
                          ¥{(vq.totalAmount ?? 0).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const alreadyAdded = vendorCosts.some(vc => vc.vendorId === vq.vendorId && vc.amount === vq.totalAmount);
                            if (alreadyAdded) return;
                            setVendorCosts(prev => [...prev, {
                              entryId:    `vc-vq-${vq.requestId}`,
                              vendorId:   vq.vendorId,
                              vendorName: vq.vendorName,
                              description: vq.workScope.slice(0, 40),
                              amount:     vq.totalAmount ?? 0,
                            }]);
                          }}
                          className="shrink-0 text-[10px] font-bold px-2 py-1 rounded border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/30 transition-colors"
                        >
                          取込
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" onClick={addVendorCost}
                  className="flex items-center gap-1 text-[11px] text-[#C5A059] hover:text-[#E6C687] transition-colors">
                  <LucidePlus size={11} /> 原価項目を追加
                </button>

                {/* 粗利サマリー */}
                {(() => {
                  const tc = vendorCosts.reduce((s, vc) => s + vc.amount, 0);
                  if (tc === 0 || totalAmount === 0) return null;
                  const gp   = totalAmount - tc;
                  const rate = Math.round(gp / totalAmount * 1000) / 10;
                  return (
                    <div className="rounded-lg border border-gray-700 bg-[#0A0F1D] px-3 py-2.5 text-xs space-y-1.5">
                      <div className="flex justify-between text-gray-400">
                        <span>売上（税抜）</span>
                        <span className="text-white font-mono">{formatAmt(totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>原価合計</span>
                        <span className="text-red-400 font-mono">▲ {formatAmt(tc)}</span>
                      </div>
                      <div className={`flex justify-between border-t border-gray-700 pt-1.5 font-bold ${gp >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                        <span className="flex items-center gap-1">
                          <LucidePercent size={11} /> 粗利
                        </span>
                        <span className="font-mono">
                          {formatAmt(gp)}
                          <span className="text-[11px] font-normal ml-2">({rate}%)</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3.5 border-t border-gray-800 flex gap-2 shrink-0 bg-[#0B132B] rounded-b-xl">
          <button onClick={onClose}
            className="border border-gray-700 text-gray-400 text-sm py-2 px-4 rounded-lg hover:border-gray-500 hover:text-white transition-colors">
            キャンセル
          </button>
          <button onClick={() => handleSubmit(true)} disabled={loading}
            className="flex-1 border border-[#C5A059]/40 text-[#E6C687] text-sm py-2 rounded-lg hover:bg-[#C5A059]/10 transition-colors disabled:opacity-50">
            {loading ? '保存中…' : '下書き保存'}
          </button>
          <button onClick={() => handleSubmit(false)} disabled={loading}
            className="flex-[2] bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
            {loading
              ? <><LucideActivity size={13} className="animate-spin" /> 送信中…</>
              : '承認依頼として提出する'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 見積書カード（EstimateManageModal 内で1件ずつ表示）
// ─────────────────────────────────────────────────────────────

function EstimateCard({
  estimate, project, customer, allEstimates, vendors = [], isManagerLike, currentUserName, onShowToast,
  onEditRequest,
}: {
  estimate:        Estimate;
  project:         Project;
  customer:        Customer;
  allEstimates:    Estimate[];
  vendors?:        Vendor[];
  isManagerLike:   boolean;
  currentUserName: string;
  onShowToast:     (msg: string) => void;
  onEditRequest:   () => void;
}) {
  const [expanded,        setExpanded]        = useState(false);
  const [showComparison,  setShowComparison]  = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [rejectComment,   setRejectComment]   = useState('');
  const [showReject,      setShowReject]      = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [showSend,        setShowSend]        = useState(false);
  const [confirmDel,      setConfirmDel]      = useState(false);

  const isPending  = estimate.approvalStatus === 'pending_approval';
  const comparison = showComparison ? getSimilarComparison(estimate, allEstimates, project.title) : null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await approveEstimate(estimate.estimateId, currentUserName, approvalComment);
      onShowToast(`見積書 Ver.${estimate.version} を承認しました`);
    } catch { onShowToast('承認に失敗しました'); }
    finally { setLoading(false); }
  };

  const handleRevertToDraft = async () => {
    setLoading(true);
    try {
      await revertEstimateToDraft(estimate.estimateId);
      onShowToast(`見積書 Ver.${estimate.version} の承認依頼を取り下げ、下書きに戻しました`);
    } catch { onShowToast('操作に失敗しました'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteEstimate(estimate.estimateId);
      onShowToast(`見積書 Ver.${estimate.version} を削除しました`);
    } catch { onShowToast('削除に失敗しました'); }
    finally { setLoading(false); setConfirmDel(false); }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) return;
    setLoading(true);
    try {
      await rejectEstimate(estimate.estimateId, currentUserName, rejectComment);
      onShowToast(`見積書 Ver.${estimate.version} を差し戻しました`);
      setShowReject(false);
    } catch { onShowToast('差し戻しに失敗しました'); }
    finally { setLoading(false); }
  };

  return (
    <div className={`rounded-lg border overflow-hidden ${isPending && isManagerLike ? 'border-yellow-700/50' : 'border-gray-800'}`}>
      {/* カードヘッダー */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-[#0A0F1D] cursor-pointer hover:bg-[#0F1A30] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-[10px] font-mono text-gray-500 shrink-0">Ver.{estimate.version}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${APPROVAL_COLOR[estimate.approvalStatus]}`}>
          {APPROVAL_LABEL[estimate.approvalStatus]}
        </span>
        <span className="text-xs font-bold text-[#E6C687] shrink-0">{formatAmt(estimate.totalAmount ?? 0)}</span>
        <span className="text-[10px] text-gray-500 flex-1 text-right">
          {estimate.createdBy} · {new Date(estimate.createdAt).toLocaleDateString('ja-JP')}
        </span>
        {expanded ? <LucideChevronUp size={12} className="text-gray-500 shrink-0" />
                  : <LucideChevronDown size={12} className="text-gray-500 shrink-0" />}
      </div>

      {/* 展開コンテンツ */}
      {expanded && (
        <div className="bg-[#111A35] border-t border-gray-800 p-3 space-y-3">
          {/* 明細テーブル */}
          <div className="rounded border border-gray-800 overflow-hidden text-xs">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0A0F1D] text-gray-500">
                  <th className="px-2 py-1 text-left font-normal">項目</th>
                  <th className="px-2 py-1 text-right font-normal">数量</th>
                  <th className="px-2 py-1 text-left font-normal">単位</th>
                  <th className="px-2 py-1 text-right font-normal">単価</th>
                  <th className="px-2 py-1 text-right font-normal">小計</th>
                </tr>
              </thead>
              <tbody>
                {(estimate.items ?? []).map((it, i) => (
                  <tr key={it.itemId ?? i} className="border-t border-gray-800">
                    <td className="px-2 py-1 text-white">{it.itemName}</td>
                    <td className="px-2 py-1 text-right text-gray-300">{it.quantity}</td>
                    <td className="px-2 py-1 text-gray-400">{it.unit}</td>
                    <td className="px-2 py-1 text-right text-gray-300">{formatAmt(it.unitPrice)}</td>
                    <td className="px-2 py-1 text-right text-[#E6C687] font-mono">{formatAmt(it.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#C5A059]/30 bg-[#0A0F1D]">
                  <td colSpan={4} className="px-3 py-1.5 text-right text-xs font-bold text-gray-400">合計（税抜）</td>
                  <td className="px-2 py-1.5 text-right font-extrabold text-[#E6C687]">{formatAmt(estimate.totalAmount ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 原価・粗利サマリー */}
          {estimate.vendorCosts && estimate.vendorCosts.length > 0 && (
            <div className="rounded-lg border border-gray-700 bg-[#0A0F1D] overflow-hidden">
              <div className="px-3 py-1.5 bg-[#0B132B] border-b border-gray-800 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                <LucideTrendingUp size={10} className="text-[#C5A059]" /> 原価・粗利
              </div>
              <div className="px-3 py-2 text-[11px] space-y-1">
                {estimate.vendorCosts.map(vc => (
                  <div key={vc.entryId} className="flex justify-between items-center text-gray-500">
                    <span className="truncate max-w-[60%]">
                      {vc.vendorId ? (vendors.find(v => v.vendorId === vc.vendorId)?.name ?? vc.vendorName) : vc.vendorName}
                      {vc.description && <span className="ml-1 text-gray-600">— {vc.description}</span>}
                    </span>
                    <span className="font-mono text-gray-400">{formatAmt(vc.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-800 pt-1.5 flex justify-between text-gray-400 font-semibold">
                  <span>原価合計</span>
                  <span className="font-mono text-red-400">▲ {formatAmt(estimate.totalCost ?? 0)}</span>
                </div>
                <div className={`flex justify-between font-bold ${(estimate.grossProfit ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                  <span className="flex items-center gap-1"><LucidePercent size={10} /> 粗利</span>
                  <span className="font-mono">
                    {formatAmt(estimate.grossProfit ?? 0)}
                    <span className="text-[10px] font-normal ml-1.5">({estimate.grossProfitRate ?? 0}%)</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {estimate.notes && (
            <p className="text-[11px] text-gray-400 bg-[#0A0F1D] px-2 py-1.5 rounded border border-gray-800">
              📝 {estimate.notes}
            </p>
          )}

          {/* 承認済みコメント表示 */}
          {estimate.approvalComment && (
            <div className={`text-[11px] px-2 py-1.5 rounded border ${estimate.approvalStatus === 'approved' ? 'bg-emerald-950/30 border-emerald-700/30 text-emerald-300' : 'bg-red-950/30 border-red-700/30 text-red-300'}`}>
              {estimate.approvalStatus === 'approved' ? '✓ ' : '✗ '}
              {estimate.approvedBy} : {estimate.approvalComment}
            </div>
          )}

          {/* 承認済み → 送付ボタン */}
          {estimate.approvalStatus === 'approved' && (
            <div className="pt-1 border-t border-gray-800">
              <button
                onClick={() => setShowSend(true)}
                className="w-full bg-blue-900/20 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                📤 お客様へ送付する（印刷 / メール / LINE）
              </button>
            </div>
          )}

          {/* 下書き → 承認依頼への提出ボタン（draft のみ・担当者向け） */}
          {estimate.approvalStatus === 'draft' && (
            <div className="pt-1 border-t border-gray-800">
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    await submitForApproval(estimate.estimateId, estimate.projectTitle ?? '', estimate.createdBy ?? '');
                    onShowToast(`見積書 Ver.${estimate.version} を承認依頼として提出しました`);
                  } catch { onShowToast('提出に失敗しました'); }
                  finally { setLoading(false); }
                }}
                disabled={loading}
                className="w-full bg-[#C5A059]/10 hover:bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E6C687] text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {/* Fragment ternary → CSS display（insertBefore 回避） */}
                <LucideActivity size={12} className="animate-spin" style={{ display: loading ? 'inline-block' : 'none' }} />
                <span style={{ display: loading ? 'inline' : 'none' }}> 提出中…</span>
                <span style={{ display: loading ? 'none' : 'inline' }}>承認依頼として提出する</span>
              </button>
            </div>
          )}

          {/* 起案者の取り下げ（pending_approval のみ・非管理者） */}
          {estimate.approvalStatus === 'pending_approval' && !isManagerLike && estimate.createdBy === currentUserName && (
            <div className="pt-1 border-t border-gray-800">
              <button
                onClick={handleRevertToDraft}
                disabled={loading}
                className="w-full border border-amber-700/40 text-amber-400 hover:bg-amber-950/30 text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {/* Fragment ternary → CSS display（insertBefore 回避） */}
                <LucideActivity size={11} className="animate-spin" style={{ display: loading ? 'inline-block' : 'none' }} />
                <span style={{ display: loading ? 'inline' : 'none' }}> 処理中…</span>
                <LucideRefreshCw size={11} style={{ display: loading ? 'none' : 'inline-block' }} />
                <span style={{ display: loading ? 'none' : 'inline' }}> 承認依頼を取り下げる（下書きに戻す）</span>
              </button>
            </div>
          )}

          {/* 内容を編集 + 削除（draft または rejected のみ・起案者または管理者） */}
          {(estimate.approvalStatus === 'draft' || estimate.approvalStatus === 'rejected') &&
            (estimate.createdBy === currentUserName || isManagerLike) && (
            <div className="pt-1 border-t border-gray-800 space-y-1.5">
              {/* 編集ボタン */}
              <button
                onClick={onEditRequest}
                disabled={loading}
                className="w-full border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <LucidePencil size={11} />
                {estimate.approvalStatus === 'rejected' ? '内容を修正して再提出する' : '内容を編集する'}
              </button>
              {/* 削除ボタン（確認付き）*/}
              <div style={{ display: confirmDel ? 'none' : 'block' }}>
                <button
                  onClick={() => setConfirmDel(true)}
                  disabled={loading}
                  className="w-full border border-red-700/30 text-red-400/70 hover:text-red-400 hover:border-red-700/60 text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                  <LucideTrash2 size={11} /> この見積書を削除
                </button>
              </div>
              <div className="flex gap-1.5" style={{ display: confirmDel ? 'flex' : 'none' }}>
                <button onClick={() => setConfirmDel(false)}
                  className="flex-1 border border-gray-700 text-gray-400 text-xs py-1.5 rounded-lg hover:border-gray-500 transition-colors">
                  キャンセル
                </button>
                <button onClick={handleDelete} disabled={loading}
                  className="flex-[2] bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-bold py-1.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                  <LucideActivity size={11} className="animate-spin" style={{ display: loading ? 'inline-block' : 'none' }} />
                  <LucideTrash2 size={11} style={{ display: loading ? 'none' : 'inline-block' }} />
                  削除する
                </button>
              </div>
            </div>
          )}

          {/* 管理者の承認UI（pending_approval のみ） */}
          {isManagerLike && isPending && (
            <div className="space-y-2 pt-1 border-t border-gray-800">
              {/* 類似比較トグル */}
              <button
                onClick={() => setShowComparison(v => !v)}
                className="flex items-center gap-1.5 text-[11px] text-[#C5A059] hover:text-[#E6C687] transition-colors">
                <LucideInfo size={11} />
                {showComparison ? '比較パネルを閉じる' : '類似案件と金額を比較する'}
              </button>

              {/* 類似比較パネル */}
              {showComparison && comparison && (
                <div className="bg-[#0A0F1D] border border-gray-800 rounded-lg p-3 space-y-2">
                  {comparison.samples.length === 0 ? (
                    <p className="text-[11px] text-gray-500">比較できる過去見積がありません</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-gray-400">
                          類似 {comparison.samples.length} 件の平均:
                          <span className="text-white font-bold ml-1">{formatAmt(comparison.avgAmount)}</span>
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          Math.abs(comparison.diffPct) <= 15  ? 'bg-emerald-900/50 text-emerald-300' :
                          Math.abs(comparison.diffPct) <= 30  ? 'bg-yellow-900/50 text-yellow-300'  :
                                                                 'bg-red-900/50    text-red-400'
                        }`}>
                          {comparison.diffPct >= 0 ? '+' : ''}{comparison.diffPct}%
                          {Math.abs(comparison.diffPct) > 30 && ' ⚠️ 大きな差異'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {comparison.samples.map(s => (
                          <div key={s.estimateId} className="flex justify-between items-center text-[10px]">
                            <span className="text-gray-400 truncate max-w-[60%]">
                              {s.customerName} · {s.projectTitle} ({new Date(s.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })})
                            </span>
                            <span className="text-gray-300 font-mono">{formatAmt(s.totalAmount)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 承認コメント */}
              <input
                type="text"
                value={approvalComment}
                onChange={e => setApprovalComment(e.target.value)}
                placeholder="承認コメント（任意）"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
              />

              {/* 差し戻しコメント（展開時のみ） */}
              {showReject && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={rejectComment}
                    onChange={e => setRejectComment(e.target.value)}
                    placeholder="差し戻し理由（必須）"
                    autoFocus
                    className="w-full bg-[#0B132B] border border-red-700/50 text-white text-xs rounded-lg px-3 py-2 focus:outline-none"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => setShowReject(false)}
                      className="flex-1 border border-gray-700 text-gray-400 text-xs py-1.5 rounded-lg hover:border-gray-500 transition-colors">
                      キャンセル
                    </button>
                    <button onClick={handleReject} disabled={!rejectComment.trim() || loading}
                      className="flex-[2] bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-bold py-1.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                      <LucideThumbsDown size={11} /> 差し戻す
                    </button>
                  </div>
                </div>
              )}

              {!showReject && (
                <div className="flex gap-1.5">
                  <button onClick={() => setShowReject(true)} disabled={loading}
                    className="flex-1 border border-red-700/40 text-red-400 text-xs py-2 rounded-lg hover:bg-red-950/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                    <LucideThumbsDown size={11} /> 差し戻す
                  </button>
                  <button onClick={handleApprove} disabled={loading}
                    className="flex-[2] bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                    {/* Fragment ternary → CSS display（insertBefore 回避） */}
                    <LucideActivity size={12} className="animate-spin" style={{ display: loading ? 'inline-block' : 'none' }} />
                    <span style={{ display: loading ? 'inline' : 'none' }}> 処理中…</span>
                    <LucideThumbsUp size={11} style={{ display: loading ? 'none' : 'inline-block' }} />
                    <span style={{ display: loading ? 'none' : 'inline' }}> 承認する</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showSend && (
        <SendDocumentDialog
          title={`御見積書 — ${estimate.projectTitle}`}
          customerEmail={customer.email}
          summaryText={getEstimateSummaryText(estimate, customer)}
          onOpenPrint={() => openPrintPreview(generateEstimateHtml(estimate, customer))}
          onClose={() => setShowSend(false)}
          onSent={async () => {
            // 送付完了 → 案件ステータスを「見積提出」へ自動更新
            try {
              await updateProjectStatus(project.projectId, 'estimate');
              onShowToast('ステータスを「見積提出」に更新しました');
            } catch { /* ignore */ }
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 業者見積依頼パネル（EstimateManageModal 内の1タブ）
// ─────────────────────────────────────────────────────────────

const VQ_STATUS_LABEL: Record<VendorQuoteRequest['status'], string> = {
  pending:   '回答待ち',
  submitted: '回答済み',
  reviewed:  '確認済み',
  accepted:  '採用',
  rejected:  '不採用',
};
const VQ_STATUS_COLOR: Record<VendorQuoteRequest['status'], string> = {
  pending:   'bg-orange-900/40 text-orange-300 border-orange-700/40',
  submitted: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  reviewed:  'bg-gray-700/60 text-gray-300 border-gray-600/40',
  accepted:  'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  rejected:  'bg-red-900/40 text-red-300 border-red-700/40',
};

// VendorQuotePanel: memo 化・CreateVendorQuoteDialog は EstimateManageModal 直下に移動済み
const VendorQuotePanel = memo(function VendorQuotePanel({
  project, vendors, vendorQuoteRequests,
  currentUserName, onRequestCreate, onShowToast, onOpenCreateEstimate,
}: {
  project:                  Project;
  vendors:                  Vendor[];
  vendorQuoteRequests:      VendorQuoteRequest[];
  currentUserName:          string;
  onRequestCreate:          () => void;
  onShowToast:              (msg: string) => void;
  /** 採用済み業者見積を見積書原価に取込む — 見積タブを開いて作成ダイアログを起動 */
  onOpenCreateEstimate?:    () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copying,    setCopying]    = useState<string | null>(null);

  const handleCopyUrl = useCallback(async (req: VendorQuoteRequest) => {
    const url = `${window.location.origin}/?token=${req.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopying(req.requestId);
      onShowToast('URLをクリップボードにコピーしました');
      setTimeout(() => setCopying(null), 2000);
    } catch {
      onShowToast('コピーに失敗しました。URLを手動でコピーしてください。');
    }
  }, [onShowToast]);

  const handleStatusChange = useCallback(async (requestId: string, status: VendorQuoteRequest['status']) => {
    try {
      await updateVendorQuoteStatus(requestId, status);
      onShowToast(`ステータスを「${VQ_STATUS_LABEL[status]}」に更新しました`);
    } catch {
      onShowToast('更新に失敗しました');
    }
  }, [onShowToast]);

  const handleDelete = useCallback(async (requestId: string) => {
    if (!confirm('この業者見積依頼を削除しますか？')) return;
    try {
      await deleteVendorQuoteRequest(requestId);
      onShowToast('依頼を削除しました');
    } catch {
      onShowToast('削除に失敗しました');
    }
  }, [onShowToast]);

  return (
    <div className="space-y-3">
      {/* 新規依頼ボタン */}
      <button
        onClick={onRequestCreate}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-orange-700/40 hover:border-orange-600 text-orange-400 hover:text-orange-300 text-sm font-bold py-2.5 rounded-lg transition-colors"
      >
        <LucideSend size={13} /> 業者へ見積依頼を送る
      </button>

      {vendorQuoteRequests.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-10 flex flex-col items-center gap-2">
          <LucideBuilding2 size={22} className="text-gray-600" />
          <span>まだ業者見積依頼はありません</span>
        </div>
      ) : (
        <div className="space-y-2">
          {vendorQuoteRequests.map(req => {
            const isExpanded = expandedId === req.requestId;
            const url = `${window.location.origin}/?token=${req.token}`;
            return (
              <div key={req.requestId} className="bg-[#0B132B] border border-gray-800 rounded-lg overflow-hidden">
                {/* ヘッダー行 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.requestId)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <LucideBuilding2 size={14} className="text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{req.vendorName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${VQ_STATUS_COLOR[req.status]}`}>
                        {VQ_STATUS_LABEL[req.status]}
                      </span>
                      {req.dueDate && (
                        <span className={`text-[10px] flex items-center gap-0.5 ${
                          new Date(req.dueDate) < new Date() ? 'text-red-400' : 'text-gray-500'
                        }`}>
                          <LucideCalendarDays size={10} /> {req.dueDate}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{req.workScope}</p>
                  </div>
                  {req.totalAmount != null && (
                    <span className="text-sm font-bold text-[#E6C687] shrink-0">
                      ¥{req.totalAmount.toLocaleString()}
                    </span>
                  )}
                  {/* URL コピーボタン（折り畳み状態でも常に表示） */}
                  <button
                    onClick={e => { e.stopPropagation(); handleCopyUrl(req); }}
                    title="業者向けURLをコピー"
                    className={`shrink-0 flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      copying === req.requestId
                        ? 'text-emerald-400 border-emerald-700/40 bg-emerald-900/20'
                        : 'text-gray-500 border-gray-700 hover:text-[#C5A059] hover:border-[#C5A059]/40'
                    }`}
                  >
                    <LucideCheck size={10} style={{ display: copying === req.requestId ? 'inline-block' : 'none' }} />
                    <LucideCopy size={10} style={{ display: copying === req.requestId ? 'none' : 'inline-block' }} />
                    URL
                  </button>
                  <LucideChevronUp   size={14} className="text-gray-500 shrink-0" style={{ display: isExpanded ? 'inline-block' : 'none' }} />
                  <LucideChevronDown size={14} className="text-gray-500 shrink-0" style={{ display: isExpanded ? 'none' : 'inline-block' }} />
                </button>

                {/* 展開パネル */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4 space-y-4">
                    {/* 依頼URL */}
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">業者向け回答URL</p>
                      <div className="flex items-center gap-2 bg-[#111A35] border border-gray-700 rounded-lg px-3 py-2">
                        <LucideLink size={12} className="text-gray-500 shrink-0" />
                        <span className="text-[10px] text-gray-400 flex-1 truncate font-mono">{url}</span>
                        <button
                          onClick={() => handleCopyUrl(req)}
                          className={`shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                            copying === req.requestId
                              ? 'text-emerald-400 bg-emerald-900/20'
                              : 'text-[#C5A059] hover:text-[#E6C687] hover:bg-[#C5A059]/10'
                          }`}
                        >
                          <LucideCheck size={10} style={{ display: copying === req.requestId ? 'inline-block' : 'none' }} />
                          <span style={{ display: copying === req.requestId ? 'inline' : 'none' }}> コピー済み</span>
                          <LucideCopy size={10} style={{ display: copying === req.requestId ? 'none' : 'inline-block' }} />
                          <span style={{ display: copying === req.requestId ? 'none' : 'inline' }}> コピー</span>
                        </button>
                      </div>
                    </div>

                    {/* 依頼内容 */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500 text-[10px]">作業範囲</span>
                        <p className="mt-0.5 text-gray-200 whitespace-pre-wrap">{req.workScope}</p>
                      </div>
                      {req.requestNote && (
                        <div>
                          <span className="text-gray-500 text-[10px]">担当メモ</span>
                          <p className="mt-0.5 text-gray-400 italic">{req.requestNote}</p>
                        </div>
                      )}
                    </div>

                    {/* 業者回答 */}
                    {req.status !== 'pending' && req.totalAmount != null && (
                      <div className="bg-[#111A35] border border-emerald-800/30 rounded-lg p-3 space-y-2">
                        <p className="text-[10px] text-emerald-400 font-semibold">業者からの回答</p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">
                            {req.quoteType === 'itemized' ? '明細入力' : '合計のみ'}
                          </span>
                          <span className="text-base font-bold text-[#E6C687]">
                            ¥{req.totalAmount.toLocaleString()}
                          </span>
                        </div>
                        {req.quoteType === 'itemized' && req.items && req.items.length > 0 && (
                          <table className="w-full text-[10px] text-gray-400">
                            <thead>
                              <tr className="text-gray-600 border-b border-gray-700">
                                <th className="text-left pb-1">品名</th>
                                <th className="text-right pb-1">数量</th>
                                <th className="text-center pb-1">単位</th>
                                <th className="text-right pb-1">単価</th>
                                <th className="text-right pb-1">金額</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.items.map((it, i) => (
                                <tr key={i} className="border-b border-gray-800/50">
                                  <td className="py-1">{it.itemName}</td>
                                  <td className="text-right">{it.quantity}</td>
                                  <td className="text-center">{it.unit}</td>
                                  <td className="text-right">¥{it.unitPrice.toLocaleString()}</td>
                                  <td className="text-right text-white">¥{it.total.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {req.vendorNote && (
                          <p className="text-[10px] text-gray-400 italic border-t border-gray-700 pt-2">
                            備考: {req.vendorNote}
                          </p>
                        )}
                        {req.submittedAt && (
                          <p className="text-[10px] text-gray-600">
                            回答日時: {new Date(req.submittedAt).toLocaleString('ja-JP')}
                          </p>
                        )}
                        {req.pdfUrl && (
                          <a
                            href={req.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                          >
                            <LucideLink size={10} /> 添付PDF を開く
                          </a>
                        )}
                      </div>
                    )}

                    {/* アクション：submitted / reviewed どちらでも採用/不採用可 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(req.status === 'submitted' || req.status === 'reviewed') && (
                        <>
                          <button
                            onClick={() => handleStatusChange(req.requestId, 'accepted')}
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/70 transition-colors border border-emerald-700/40"
                          >
                            <LucideCheck size={11} /> 採用
                          </button>
                          <button
                            onClick={() => handleStatusChange(req.requestId, 'rejected')}
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-red-900/40 text-red-300 hover:bg-red-900/70 transition-colors border border-red-700/40"
                          >
                            <LucideTrash2 size={11} /> 不採用
                          </button>
                        </>
                      )}
                      {req.status === 'accepted' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                            <LucideCheck size={11} /> 採用済み
                          </span>
                          {onOpenCreateEstimate && (
                            <button
                              onClick={onOpenCreateEstimate}
                              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/60 transition-colors border border-emerald-700/40"
                            >
                              <LucideChevronRight size={11} /> 見積書の原価に取込む
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => handleDelete(req.requestId)}
                        className="ml-auto flex items-center gap-1 text-[11px] text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <LucideTrash2 size={11} /> 削除
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── 業者支払い管理（採用済みのみ） ─── */}
                {req.status === 'accepted' && (
                  <VendorPaymentSection req={req} onShowToast={onShowToast} />
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// 業者支払い管理セクション（VendorQuotePanel 内）
// ─────────────────────────────────────────────────────────────

function VendorPaymentSection({ req, onShowToast }: {
  req:         VendorQuoteRequest;
  onShowToast: (msg: string) => void;
}) {
  const [dueDateInput,   setDueDateInput]   = useState(req.vendorPaymentDueDate ?? '');
  const [paidDateInput,  setPaidDateInput]  = useState('');
  const [showSignPad,    setShowSignPad]    = useState(false);
  const [savingDue,      setSavingDue]      = useState(false);
  const [savingPay,      setSavingPay]      = useState(false);

  const handleSaveDueDate = async () => {
    if (!dueDateInput) return;
    setSavingDue(true);
    try {
      await setVendorPaymentDueDate(req.requestId, dueDateInput);
      onShowToast('支払い予定日を設定しました');
    } catch { onShowToast('保存に失敗しました'); }
    finally { setSavingDue(false); }
  };

  const handleMarkPaid = async () => {
    const paidAt = paidDateInput || new Date().toISOString().split('T')[0];
    setSavingPay(true);
    try {
      await markVendorPaid(req.requestId, paidAt);
      onShowToast('業者支払いを記録しました');
      setPaidDateInput('');
    } catch { onShowToast('記録に失敗しました'); }
    finally { setSavingPay(false); }
  };

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = req.vendorPaymentDueDate && !req.vendorPaid && req.vendorPaymentDueDate < today;

  return (
    <div className={`border-t mt-3 pt-3 space-y-3 ${isOverdue ? 'border-orange-700/40' : 'border-gray-800'}`}>
      <p className="text-[10px] font-bold text-orange-300 flex items-center gap-1">
        <LucideBuilding2 size={10} /> 業者支払い管理
        {req.vendorPaid && (
          <span className="text-emerald-400 font-bold flex items-center gap-0.5 ml-2">
            <LucideCheck size={10} /> 支払済 {req.vendorPaidAt}
          </span>
        )}
        {isOverdue && (
          <span className="text-red-400 font-bold ml-2">⚠ 支払期限超過</span>
        )}
      </p>

      {/* 受領署名表示 */}
      {req.vendorReceiptSignature && (
        <div className="bg-emerald-950/20 border border-emerald-700/30 rounded-lg p-2 space-y-1">
          <p className="text-[10px] text-emerald-400 font-semibold">受領署名済み ({req.vendorReceiptSignedAt?.split('T')[0]})</p>
          <img
            src={req.vendorReceiptSignature}
            alt="受領署名"
            className="max-h-16 bg-white rounded border border-gray-300"
          />
        </div>
      )}

      {!req.vendorPaid && (
        <>
          {/* 支払い予定日 */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-400 shrink-0">支払予定日</label>
            <input
              type="date"
              value={dueDateInput}
              onChange={e => setDueDateInput(e.target.value)}
              className="flex-1 bg-[#0A0F1D] border border-gray-700 text-white text-[10px] rounded px-2 py-1 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleSaveDueDate}
              disabled={savingDue || !dueDateInput}
              className="text-[10px] bg-[#1C2C54] border border-gray-600 text-gray-300 hover:text-white px-2 py-1 rounded transition-colors disabled:opacity-40"
            >
              {savingDue ? '保存中...' : '設定'}
            </button>
          </div>

          {/* 支払い済みにする */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-400 shrink-0">支払日</label>
            <input
              type="date"
              value={paidDateInput}
              onChange={e => setPaidDateInput(e.target.value)}
              placeholder={today}
              className="flex-1 bg-[#0A0F1D] border border-gray-700 text-white text-[10px] rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleMarkPaid}
              disabled={savingPay}
              className="text-[10px] bg-emerald-800/60 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-700/60 px-2 py-1 rounded font-bold transition-colors disabled:opacity-40"
            >
              {savingPay ? '記録中...' : '支払済にする'}
            </button>
          </div>

          {/* 受領署名 */}
          <button
            onClick={() => setShowSignPad(true)}
            className="w-full text-[11px] border border-dashed border-orange-700/40 text-orange-400 hover:border-orange-500 hover:text-orange-300 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <LucideFileText size={12} /> 受領署名を取得して支払済にする
          </button>
        </>
      )}

      {/* 受領署名パッド */}
      {showSignPad && (
        <VendorReceiptSignatureDialog
          req={req}
          onClose={() => setShowSignPad(false)}
          onSaved={(msg) => { onShowToast(msg); setShowSignPad(false); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 業者受領署名ダイアログ
// ─────────────────────────────────────────────────────────────

function VendorReceiptSignatureDialog({ req, onClose, onSaved }: {
  req:     VendorQuoteRequest;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const ctxRef     = useRef<CanvasRenderingContext2D | null>(null);
  const drawing    = useRef(false);
  const isEmptyRef = useRef(true);
  const [isEmpty,  setIsEmpty]  = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [paidAt,   setPaidAt]   = useState(new Date().toISOString().split('T')[0]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.dataset.initialized) return;
    const dpr    = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctxRef.current  = ctx;
    canvas.dataset.initialized = '1';
  };

  const getPos = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };
  const startAt = (x: number, y: number) => {
    initCanvas();
    drawing.current = true;
    const ctx = ctxRef.current!;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  // 同期描画 + stroke後にbeginPath/moveTo でO(1)パス長を維持
  const drawTo = (x: number, y: number) => {
    if (!drawing.current) return;
    if (isEmptyRef.current) { isEmptyRef.current = false; setIsEmpty(false); }
    const ctx = ctxRef.current!;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const endDraw = () => { drawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current!;
    ctxRef.current?.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    delete canvas.dataset.initialized;
    ctxRef.current = null;
    initCanvas();
    isEmptyRef.current = true;
    setIsEmpty(true);
  };

  const handleSave = async () => {
    if (isEmpty) return;
    setLoading(true);
    try {
      const dataUrl = canvasRef.current!.toDataURL('image/png');
      await saveVendorReceiptSignature(req.requestId, dataUrl, paidAt);
      onSaved(`${req.vendorName} の受領署名を記録し、支払済にしました`);
    } catch { onSaved('保存に失敗しました'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-md shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white">
            受領署名取得 — {req.vendorName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-[#0B132B] rounded-lg p-3 text-xs text-gray-300 space-y-1">
            <div className="flex justify-between">
              <span>案件</span>
              <span className="text-white font-semibold">{req.projectTitle}</span>
            </div>
            <div className="flex justify-between">
              <span>支払い金額</span>
              <span className="text-[#E6C687] font-bold">¥{(req.totalAmount ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>支払日</span>
              <input
                type="date"
                value={paidAt}
                onChange={e => setPaidAt(e.target.value)}
                className="bg-[#111A35] border border-gray-700 text-white text-xs rounded px-2 py-0.5 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            受取業者（{req.vendorName}）の担当者にサインをお願いします。
          </p>

          <div className="border-2 border-gray-500 rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
            <div className="relative">
              {isEmpty && (
                <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none select-none">
                  業者担当者にサインしてもらってください
                </span>
              )}
              <canvas
                ref={canvasRef}
                className="w-full block"
                style={{ height: 140, cursor: 'crosshair', touchAction: 'none', display: 'block' }}
                onMouseDown={e => { const p = getPos(e.clientX, e.clientY); startAt(p.x, p.y); }}
                onMouseMove={e => { const p = getPos(e.clientX, e.clientY); drawTo(p.x, p.y); }}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={e => { const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); startAt(p.x, p.y); }}
                onTouchMove={e => { const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); drawTo(p.x, p.y); }}
                onTouchEnd={endDraw}
              />
            </div>
            <div className="border-t border-gray-200 bg-gray-50 px-3 py-1.5 flex justify-between items-center">
              <span className="text-xs text-gray-500">指またはペンでサインしてください</span>
              <button onClick={clear} className="text-xs text-gray-500 hover:text-red-600 underline transition-colors">クリア</button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition-colors">
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isEmpty || loading}
              className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-40"
            >
              {loading ? '保存中...' : '署名確定・支払済にする'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 業者見積依頼作成ダイアログ
// ─────────────────────────────────────────────────────────────

function CreateVendorQuoteDialog({
  project, vendors, currentUserName, currentUserId, onClose, onCreated,
}: {
  project:         Project;
  vendors:         Vendor[];
  currentUserName: string;
  currentUserId?:  string;
  onClose:         () => void;
  onCreated:       (msg: string) => void;
}) {
  const [vendorId,   setVendorId]   = useState('');
  const [workScope,  setWorkScope]  = useState('');
  const [dueDate,    setDueDate]    = useState('');
  const [reqNote,    setReqNote]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const selectedVendor = vendors.find(v => v.vendorId === vendorId) ?? null;

  const handleSubmit = async () => {
    if (!vendorId)         { setError('業者を選択してください。'); return; }
    if (!workScope.trim()) { setError('依頼内容を入力してください。'); return; }

    setLoading(true);
    setError('');

    // 成功時は onCreated がコンポーネントをアンマウントするため
    // setLoading(false) を呼ばない（アンマウント後の state 更新を防止）
    let succeeded = false;
    try {
      const req = await createVendorQuoteRequest({
        projectId:    project.projectId,
        projectTitle: project.title,
        customerId:   project.customerId,
        vendorId,
        vendorName:   selectedVendor?.name ?? '',
        vendorEmail:  selectedVendor?.email,
        workScope:    workScope.trim(),
        dueDate:      dueDate || undefined,
        requestNote:  reqNote.trim() || undefined,
        createdBy:       currentUserName,
        createdByUserId: currentUserId,
      });

      // URLを自動コピー
      const url = `${window.location.origin}/?token=${req.token}`;
      try { await navigator.clipboard.writeText(url); } catch { /* コピー失敗は無視 */ }

      succeeded = true;
      onCreated('業者見積依頼を作成しました。URLをクリップボードにコピーしました。');
    } catch {
      setError('作成に失敗しました。再度お試しください。');
    } finally {
      // 成功時はコンポーネントがアンマウントされるため setLoading は呼ばない
      if (!succeeded) setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-[#111A35] border border-orange-700/30 rounded-xl max-w-lg w-full shadow-2xl">
        {/* ヘッダー */}
        <div className="bg-[#0B132B] px-5 py-3.5 border-b border-orange-700/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideSend size={14} className="text-orange-400" />
            業者見積依頼を作成
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* 案件情報（参照） */}
          <div className="bg-[#0B132B] rounded-lg px-3 py-2 border border-gray-800 text-xs text-gray-400">
            <span className="text-gray-600">案件：</span>
            <span className="text-white font-medium ml-1">{project.title}</span>
          </div>

          {/* 業者選択 */}
          <div>
            <label className="text-[11px] text-gray-400 font-semibold">
              依頼先業者 <span className="text-red-400">*</span>
            </label>
            {vendors.length === 0 ? (
              <p className="mt-1 text-xs text-orange-400">
                有効な業者がいません。マスタ管理から業者を登録してください。
              </p>
            ) : (
              <select
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
                className="mt-1 w-full bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-600/60"
              >
                <option value="">— 業者を選択 —</option>
                {vendors.map(v => (
                  <option key={v.vendorId} value={v.vendorId}>
                    {v.name}{v.specialty.length > 0 ? `（${v.specialty.join('・')}）` : ''}
                  </option>
                ))}
              </select>
            )}
            {selectedVendor?.email && (
              <p className="mt-1 text-[10px] text-gray-500">✉ {selectedVendor.email}</p>
            )}
          </div>

          {/* 依頼内容 */}
          <div>
            <label className="text-[11px] text-gray-400 font-semibold">
              依頼内容・作業範囲 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={workScope}
              onChange={e => setWorkScope(e.target.value)}
              rows={4}
              placeholder="例: 外壁塗装工事全般（下地処理・3回塗り）&#10;使用材料: シリコン塗料&#10;施工面積: 約150㎡"
              className="mt-1 w-full bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-600/60 resize-none"
            />
          </div>

          {/* 回答期限 */}
          <div>
            <label className="text-[11px] text-gray-400 font-semibold">回答期限（任意）</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="mt-1 w-full bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-600/60"
            />
          </div>

          {/* 担当メモ */}
          <div>
            <label className="text-[11px] text-gray-400 font-semibold">担当者メモ（業者には表示）</label>
            <input
              type="text"
              value={reqNote}
              onChange={e => setReqNote(e.target.value)}
              placeholder="特記事項、前提条件など"
              className="mt-1 w-full bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-600/60"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <LucideInfo size={12} /> {error}
            </p>
          )}

          <p className="text-[10px] text-gray-600 bg-[#0B132B] border border-gray-800 rounded-lg p-2">
            📋 作成後、URLが自動的にクリップボードにコピーされます。業者にそのURLをメール・SMS等でお送りください。
          </p>

          {/* ボタン */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white transition-colors">
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                loading ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-orange-700 hover:bg-orange-600 text-white'
              }`}
            >
              <LucideActivity size={12} className="animate-spin" style={{ display: loading ? 'inline-block' : 'none' }} />
              <span style={{ display: loading ? 'inline' : 'none' }}>作成中…</span>
              <span style={{ display: loading ? 'none' : 'inline' }}>依頼を作成してURLをコピー</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 見積書管理モーダル
// ─────────────────────────────────────────────────────────────

function EstimateManageModal({
  project, customer, estimates, allEstimates,
  estimateTemplates, vendors = [], vendorQuoteRequests = [],
  currentRole, currentUserName, currentUserId, onClose, onShowToast,
  initialSection, embedded = false,
}: {
  project:                Project;
  customer:               Customer;
  estimates:              Estimate[];
  allEstimates:           Estimate[];
  estimateTemplates:      EstimateTemplate[];
  vendors?:               Vendor[];
  vendorQuoteRequests?:   VendorQuoteRequest[];
  currentRole:            UserRole;
  currentUserName:        string;
  currentUserId?:         string;
  onClose:                () => void;
  onShowToast:            (msg: string) => void;
  initialSection?:        'estimates' | 'vendor_quotes';
  /** ワークスペース内埋め込みモード：固定オーバーレイとヘッダーを省略 */
  embedded?:              boolean;
}) {
  const [showCreate,      setShowCreate]      = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [activeTab,       setActiveTab]       = useState<'estimates' | 'vendor_quotes'>(initialSection ?? 'estimates');
  const [showCreateVQ,    setShowCreateVQ]    = useState(false);

  const isManagerLike   = currentRole === 'manager' || currentRole === 'admin';
  const sortedEstimates = [...estimates].sort((a, b) => b.version - a.version);
  const maxVersion      = estimates.length ? Math.max(...estimates.map(e => e.version)) : 0;
  const pendingCount    = estimates.filter(e => e.approvalStatus === 'pending_approval').length;
  // ★ この案件の業者見積のみに絞る（他案件の見積が混入しないよう projectId でフィルタ）
  const projectVendorQuotes = useMemo(
    () => vendorQuoteRequests.filter(r => r.projectId === project.projectId),
    [vendorQuoteRequests, project.projectId],
  );
  const vqPendingCount  = projectVendorQuotes.filter(r => r.status === 'pending').length;
  const activeVendors   = useMemo(() => vendors.filter(v => v.status === 'active'), [vendors]);

  // ── 埋め込みモード用の共通パーツを変数化 ──────────────────────────
  const emTabBar = (
    <div className="flex border-b border-gray-800 shrink-0 bg-[#0B132B]">
      <button onClick={() => setActiveTab('estimates')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${activeTab === 'estimates' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
        <LucideFileText size={12} /> 見積書 ({estimates.length})
        {pendingCount > 0 && <span className="ml-1 bg-yellow-900/60 text-yellow-300 text-[9px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
      </button>
      <button onClick={() => setActiveTab('vendor_quotes')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${activeTab === 'vendor_quotes' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
        <LucideBuilding2 size={12} /> 業者見積依頼 ({projectVendorQuotes.length})
        {vqPendingCount > 0 && <span className="ml-1 bg-orange-900/60 text-orange-300 text-[9px] px-1.5 py-0.5 rounded-full">{vqPendingCount}</span>}
      </button>
    </div>
  );
  const emContent = (
    <div className="overflow-y-auto flex-1 p-4 space-y-3">
      {activeTab === 'estimates' && (
        <>
          <button onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C5A059]/40 hover:border-[#C5A059] text-[#C5A059] hover:text-[#E6C687] text-sm font-bold py-2.5 rounded-lg transition-colors">
            <LucidePlusCircle size={14} /> 新規見積書を作成する
          </button>
          {sortedEstimates.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">まだ見積書がありません</div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-gray-500">▼ 行をクリックすると明細が展開されます</p>
              {sortedEstimates.map(est => (
                <EstimateCard key={est.estimateId} estimate={est} project={project} customer={customer}
                  allEstimates={allEstimates} vendors={vendors} isManagerLike={isManagerLike}
                  currentUserName={currentUserName} onShowToast={onShowToast}
                  onEditRequest={() => setEditingEstimate(est)} />
              ))}
            </div>
          )}
        </>
      )}
      {activeTab === 'vendor_quotes' && (
        <VendorQuotePanel project={project} vendors={vendors} vendorQuoteRequests={projectVendorQuotes}
          currentUserName={currentUserName} onRequestCreate={() => setShowCreateVQ(true)} onShowToast={onShowToast}
          onOpenCreateEstimate={() => { setActiveTab('estimates'); setShowCreate(true); }} />
      )}
    </div>
  );
  const emSubDialogs = (
    <>
      {showCreateVQ && (
        <CreateVendorQuoteDialog project={project} vendors={activeVendors} currentUserName={currentUserName}
          currentUserId={currentUserId} onClose={() => setShowCreateVQ(false)}
          onCreated={msg => { onShowToast(msg); setShowCreateVQ(false); }} />
      )}
      <div>
        {showCreate && (
          <CreateEstimateDialog project={project} customer={customer} existingVersion={maxVersion}
            createdBy={currentUserName} estimateTemplates={estimateTemplates} vendors={vendors}
            vendorQuoteRequests={projectVendorQuotes}
            onClose={() => setShowCreate(false)} onCreated={msg => { onShowToast(msg); setShowCreate(false); }} />
        )}
      </div>
      <div>
        {editingEstimate && (
          <CreateEstimateDialog project={project} customer={customer} existingVersion={editingEstimate.version}
            createdBy={currentUserName} estimateTemplates={estimateTemplates} vendors={vendors}
            vendorQuoteRequests={projectVendorQuotes}
            onClose={() => setEditingEstimate(null)} onCreated={msg => { onShowToast(msg); setEditingEstimate(null); }}
            existingEstimate={editingEstimate} />
        )}
      </div>
    </>
  );

  // ── 埋め込みモード（ProjectWorkspaceModal のタブ内で使用）──────────
  if (embedded) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {emTabBar}
        {emContent}
        {emSubDialogs}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* ヘッダー */}
        <div className="bg-[#0B132B] px-5 py-3.5 border-b border-[#C5A059]/20 flex justify-between items-center shrink-0 rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideFileText size={15} className="text-[#C5A059]" />
            見積・業者管理
            <span className="text-[11px] text-gray-400 font-normal">— {project.title}</span>
            {pendingCount > 0 && (
              <span className="bg-yellow-900/60 text-yellow-300 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <LucideClock size={9} /> {pendingCount}件 承認待ち
              </span>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        {/* サブタブ（ピル型・ドリルダウンを視覚的に区別） */}
        <div className="px-3 py-2 bg-[#0A0F1D]/60 border-b border-gray-800/60 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('estimates')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              activeTab === 'estimates'
                ? 'bg-[#C5A059]/15 text-[#E6C687] border border-[#C5A059]/40'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-transparent'
            }`}
          >
            <LucideFileText size={11} /> 見積書 ({estimates.length})
          </button>
          <button
            onClick={() => setActiveTab('vendor_quotes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              activeTab === 'vendor_quotes'
                ? 'bg-blue-900/20 text-blue-300 border border-blue-700/40'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-transparent'
            }`}
          >
            <LucideBuilding2 size={11} /> 業者依頼 ({projectVendorQuotes.length})
            {vqPendingCount > 0 && (
              <span className="ml-1 bg-orange-900/60 text-orange-300 text-[9px] px-1.5 py-0.5 rounded-full">
                {vqPendingCount}
              </span>
            )}
          </button>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">

          {/* ── 見積書タブ ── */}
          {activeTab === 'estimates' && (
            <>
              <button onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C5A059]/40 hover:border-[#C5A059] text-[#C5A059] hover:text-[#E6C687] text-sm font-bold py-2.5 rounded-lg transition-colors">
                <LucidePlusCircle size={14} /> 新規見積書を作成する
              </button>

              {sortedEstimates.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  まだ見積書がありません
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500">▼ 行をクリックすると明細が展開されます</p>
                  {sortedEstimates.map(est => (
                    <EstimateCard
                      key={est.estimateId}
                      estimate={est}
                      project={project}
                      customer={customer}
                      allEstimates={allEstimates}
                      vendors={vendors}
                      isManagerLike={isManagerLike}
                      currentUserName={currentUserName}
                      onShowToast={msg => { onShowToast(msg); }}
                      onEditRequest={() => setEditingEstimate(est)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 業者見積依頼タブ ── */}
          {activeTab === 'vendor_quotes' && (
            <VendorQuotePanel
              project={project}
              vendors={vendors}
              vendorQuoteRequests={projectVendorQuotes}
              currentUserName={currentUserName}
              onRequestCreate={() => setShowCreateVQ(true)}
              onShowToast={onShowToast}
              onOpenCreateEstimate={() => { setActiveTab('estimates'); setShowCreate(true); }}
            />
          )}
        </div>
      </div>

      {/* ── 業者見積依頼作成ダイアログ（VendorQuotePanel の外・EstimateManageModal 直下）── */}
      {showCreateVQ && (
        <CreateVendorQuoteDialog
          project={project}
          vendors={activeVendors}
          currentUserName={currentUserName}
          currentUserId={currentUserId}
          onClose={() => setShowCreateVQ(false)}
          onCreated={msg => { onShowToast(msg); setShowCreateVQ(false); }}
        />
      )}

      <div>
        {showCreate && (
          <CreateEstimateDialog
            project={project}
            customer={customer}
            existingVersion={maxVersion}
            createdBy={currentUserName}
            estimateTemplates={estimateTemplates}
            vendors={vendors}
            vendorQuoteRequests={projectVendorQuotes}
            onClose={() => setShowCreate(false)}
            onCreated={msg => { onShowToast(msg); setShowCreate(false); }}
          />
        )}
      </div>
      <div>
        {editingEstimate && (
          <CreateEstimateDialog
            project={project}
            customer={customer}
            existingVersion={editingEstimate.version}
            createdBy={currentUserName}
            estimateTemplates={estimateTemplates}
            vendors={vendors}
            vendorQuoteRequests={projectVendorQuotes}
            onClose={() => setEditingEstimate(null)}
            onCreated={msg => { onShowToast(msg); setEditingEstimate(null); }}
            existingEstimate={editingEstimate}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 契約書作成ダイアログ
// ─────────────────────────────────────────────────────────────

const CreateContractDialog = memo(function CreateContractDialog({
  project, customer, estimate, staffName, onClose, onCreated, existingContract,
}: {
  project:           Project;
  customer:          Customer;
  estimate:          Estimate;
  staffName:         string;
  onClose:           () => void;
  onCreated:         (msg: string) => void;
  existingContract?: Contract;  // 編集モード時にセット
}) {
  const isEditMode    = !!existingContract;
  const initialTerms  = existingContract?.paymentTerms ?? generateDefaultPaymentTerms(estimate.totalAmount);

  // ── controlled: percentage と amount のみ（totalPct のリアルタイム表示に必要）
  const [termPctAmounts, setTermPctAmounts] = useState<{percentage: number; amount: number}[]>(
    () => initialTerms.map(t => ({ percentage: t.percentage, amount: t.amount }))
  );
  // ── uncontrolled refs: テキスト系（1文字ごとの再レンダリングを防ぐ）
  const termNamesRef     = useRef<string[]>(initialTerms.map(t => t.termName));
  const termScheduledRef = useRef<string[]>(initialTerms.map(t => t.scheduledDate ?? ''));
  const termDescRef      = useRef<string[]>(initialTerms.map(t => t.description ?? ''));
  const scheduledInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // ── 入金管理フィールド（このダイアログでは編集しない・保存時に引き継ぐ）
  const termExtrasRef = useRef(initialTerms.map(t => ({
    isPaid: t.isPaid, paidAt: t.paidAt, dueDate: t.dueDate, invoicedAt: t.invoicedAt,
  })));

  const [constructionStart, setConstructionStart] = useState(existingContract?.constructionStartDate ?? '');
  const [constructionEnd,   setConstructionEnd]   = useState(existingContract?.constructionEndDate   ?? '');
  const [warrantyMonths,    setWarrantyMonths]     = useState(existingContract?.warrantyMonths ?? 12);
  const specialNotesRef = useRef(
    existingContract?.specialNotes ??
    '・本契約は着工金のご入金確認後に正式に成立します。\n・工事期間中の天候等による工期延長は甲乙協議の上、調整します。\n・引き渡し後の追加工事は別途御見積となります。',
  );
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const updatePct = (idx: number, pct: number) => {
    setTermPctAmounts(prev => {
      const next = [...prev];
      next[idx] = { percentage: pct, amount: Math.round(estimate.totalAmount * pct / 100) };
      return next;
    });
  };

  const totalPct = termPctAmounts.reduce((s, t) => s + t.percentage, 0);

  const handleSave = async (isDraft: boolean) => {
    if (totalPct !== 100) { setError('支払条件の合計が100%になるよう設定してください'); return; }
    setError('');
    setLoading(true);
    if (import.meta.env.DEV) console.log('[CreateContractDialog] handleSave START isDraft=', isDraft);
    try {
      const contract: Contract = {
        // 編集モードは既存のIDをそのまま使用
        contractId:      existingContract?.contractId ?? genId('CT'),
        projectId:       project.projectId,
        customerId:      customer.customerId,
        estimateId:      estimate.estimateId,
        projectTitle:    project.title,
        customerName:    customer.name,
        status:          existingContract?.status ?? 'pending',
        approvalStatus:  isDraft ? 'draft' : 'pending_approval',
        totalAmount:     estimate.totalAmount,
        paymentTerms: termPctAmounts.map((pa, i) => ({
          termName:      termNamesRef.current[i] ?? '',
          percentage:    pa.percentage,
          amount:        pa.amount,
          description:   termDescRef.current[i] || undefined,
          scheduledDate: termScheduledRef.current[i] || undefined,
          isPaid:        termExtrasRef.current[i]?.isPaid ?? false,
          paidAt:        termExtrasRef.current[i]?.paidAt,
          dueDate:       termExtrasRef.current[i]?.dueDate,
          invoicedAt:    termExtrasRef.current[i]?.invoicedAt,
        })),
        signedByCustomer: existingContract?.signedByCustomer ?? false,
        staffName,
        ...(constructionStart ? { constructionStartDate: constructionStart } : {}),
        ...(constructionEnd   ? { constructionEndDate:   constructionEnd   } : {}),
        ...(warrantyMonths    ? { warrantyMonths }                           : {}),
        ...(specialNotesRef.current.trim() ? { specialNotes: specialNotesRef.current.trim() } : {}),
        createdAt: existingContract?.createdAt ?? new Date().toISOString(),
      };
      if (import.meta.env.DEV) console.log('[CreateContractDialog] saveContract 呼び出し前');
      await saveContract(contract);
      if (import.meta.env.DEV) console.log('[CreateContractDialog] saveContract 完了（Firestore write OK）');
      const msg = isEditMode
        ? (isDraft ? '契約書を更新しました' : '契約書を承認依頼として提出しました')
        : (isDraft ? '契約書を下書き保存しました' : '契約書を承認依頼として提出しました');
      // ① setLoading(false) を先に呼ぶ（アンマウント前に自身の状態をリセット）
      // ② onClose() は onCreated 内で setShowCreate(false) が呼ばれるため不要（重複削除）
      if (import.meta.env.DEV) console.log('[CreateContractDialog] setLoading(false) → then onCreated');
      setLoading(false);
      if (import.meta.env.DEV) console.log('[CreateContractDialog] onCreated 呼び出し前');
      onCreated(msg);
      if (import.meta.env.DEV) console.log('[CreateContractDialog] onCreated 呼び出し後（unmount される可能性あり）');
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (import.meta.env.DEV) console.log('[CreateContractDialog] エラー:', e);
      setError(`保存に失敗しました（${e.code ?? 'unknown'}）`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* ヘッダー */}
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideClipboardCheck size={15} className="text-[#C5A059]" />
            {isEditMode ? '契約書を編集' : '契約書作成'}
            <span className="text-[11px] text-gray-400 font-normal">— {project.title}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* 見積書情報（読み取り専用） */}
          <div className="bg-[#0A0F1D] rounded-lg border border-[#C5A059]/20 p-3 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-500 block">紐づく見積書</span>
              <span className="text-sm font-bold text-white">Ver.{estimate.version}</span>
              <span className="text-[11px] text-gray-400 ml-2">（{estimate.createdBy}作成）</span>
            </div>
            <span className="text-lg font-extrabold text-[#E6C687]">{formatAmt(estimate.totalAmount ?? 0)}</span>
          </div>

          {/* 支払条件 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-300">支払条件</label>
              <span className={`text-[11px] font-bold ${totalPct === 100 ? 'text-emerald-400' : 'text-red-400'}`}>
                合計 {totalPct}%
              </span>
            </div>
            <div className="space-y-2">
              {termPctAmounts.map((pa, idx) => (
                <div key={idx} className="bg-[#0A0F1D] rounded-lg border border-gray-800 p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    {/* termName — uncontrolled（再レンダリングなし） */}
                    <input
                      type="text"
                      defaultValue={termNamesRef.current[idx]}
                      onChange={e => { termNamesRef.current[idx] = e.target.value; }}
                      className="flex-1 bg-[#111A35] border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C5A059]"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      {/* percentage — controlled（totalPct 表示のため） */}
                      <input
                        type="number" min="0" max="100" value={pa.percentage}
                        onChange={e => updatePct(idx, parseInt(e.target.value) || 0)}
                        className="w-14 bg-[#111A35] border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 text-right focus:outline-none focus:border-[#C5A059]"
                      />
                      <span className="text-xs text-gray-400">%</span>
                      <span className="text-xs font-mono text-[#E6C687] w-24 text-right">
                        {formatAmt(pa.amount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500 shrink-0">入金予定月</label>
                    {/* scheduledDate — uncontrolled */}
                    <input
                      type="month"
                      defaultValue={termScheduledRef.current[idx]}
                      ref={el => { scheduledInputRefs.current[idx] = el; }}
                      onChange={e => { termScheduledRef.current[idx] = e.target.value; }}
                      className="flex-1 bg-[#111A35] border border-[#C5A059]/40 text-white text-[11px] rounded px-2 py-1 focus:outline-none focus:border-[#C5A059]"
                    />
                    <button
                      onClick={() => {
                        termScheduledRef.current[idx] = '';
                        if (scheduledInputRefs.current[idx]) scheduledInputRefs.current[idx]!.value = '';
                      }}
                      className="text-[10px] text-gray-500 hover:text-red-400 transition-colors">✕</button>
                  </div>
                  {/* description — uncontrolled */}
                  <input
                    type="text"
                    defaultValue={termDescRef.current[idx]}
                    onChange={e => { termDescRef.current[idx] = e.target.value; }}
                    placeholder="備考・支払条件の説明（任意）"
                    className="w-full bg-[#111A35] border border-gray-700 text-gray-400 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 工期 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                <LucideCalendarDays size={11} /> 着工予定日
              </label>
              <input type="date" value={constructionStart} onChange={e => setConstructionStart(e.target.value)}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                <LucideCalendarDays size={11} /> 完工予定日
              </label>
              <input type="date" value={constructionEnd} onChange={e => setConstructionEnd(e.target.value)}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
          </div>

          {/* 保証期間 */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">保証期間（ヶ月）</label>
            <input type="number" min="0" value={warrantyMonths} onChange={e => setWarrantyMonths(parseInt(e.target.value) || 0)}
              className="w-32 bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
          </div>

          {/* 特記事項（uncontrolled — キーストロークごとの再レンダリングを防止） */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">特記事項</label>
            <textarea
              defaultValue={specialNotesRef.current}
              onChange={e => { specialNotesRef.current = e.target.value; }}
              rows={4}
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none leading-relaxed"
            />
          </div>

          <div className="bg-[#0A0F1D] rounded-lg border border-[#C5A059]/20 px-3 py-2 text-[11px] text-gray-400 flex items-start gap-2">
            <LucideInfo size={12} className="shrink-0 mt-0.5 text-[#C5A059]" />
            お客様サインは管理者承認後、契約書画面から取得します。
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3.5 border-t border-gray-800 flex gap-2 shrink-0 bg-[#0B132B] rounded-b-xl">
          <button onClick={onClose}
            className="border border-gray-700 text-gray-400 text-sm py-2 px-4 rounded-lg hover:border-gray-500 hover:text-white transition-colors">
            キャンセル
          </button>
          <button onClick={() => handleSave(true)} disabled={loading}
            className="border border-gray-600 text-gray-300 text-sm py-2 px-4 rounded-lg hover:border-gray-400 hover:text-white transition-colors disabled:opacity-50">
            {loading ? '保存中…' : '下書き保存'}
          </button>
          <button onClick={() => handleSave(false)} disabled={loading}
            className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
            {loading
              ? <><LucideActivity size={13} className="animate-spin" /> 提出中…</>
              : <><LucideClipboardCheck size={13} /> 承認依頼として提出</>}
          </button>
        </div>
      </div>
    </div>
  );
},
// カスタム比較関数 — Firestore スナップショットで project/customer の参照が変わっても
// ID が同じなら再レンダリングしない（ダイアログ開中の不要な再描画を防止）
(prev, next) =>
  prev.project.projectId          === next.project.projectId          &&
  prev.customer.customerId        === next.customer.customerId         &&
  prev.estimate.estimateId        === next.estimate.estimateId         &&
  prev.staffName                  === next.staffName                   &&
  prev.existingContract?.contractId === next.existingContract?.contractId &&
  prev.onClose                    === next.onClose                     &&
  prev.onCreated                  === next.onCreated,
);

// 契約書カード内の送付ボタン（インラインで状態を持つ小コンポーネント）
function SendContractButton({ ct, customer }: { ct: Contract; customer: Customer }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 border border-blue-700/30 hover:border-blue-500/50 rounded-lg px-2.5 py-1 transition-colors"
      >
        📤 お客様へ送付する
      </button>
      {show && (
        <SendDocumentDialog
          title={`工事請負契約書 — ${ct.projectTitle}`}
          customerEmail={customer.email}
          summaryText={getContractSummaryText(ct, customer)}
          onOpenPrint={() => openPrintPreview(generateContractHtml(ct, customer))}
          onClose={() => setShow(false)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 契約書カード（ContractManageModal 内で1件ずつ表示）
// EstimateCard と同じパターンで分離し、React DOM 整合性を保つ
// ─────────────────────────────────────────────────────────────

function ContractCard({
  ct, isManagerLike, customer, currentUserName, onShowToast, onEditRequest, estimates,
}: {
  ct:              Contract;
  isManagerLike:   boolean;
  customer:        Customer;
  currentUserName: string;
  onShowToast:     (msg: string) => void;
  onEditRequest:   (ct: Contract) => void;
  estimates?:      Estimate[];
}) {
  const [isLoading,       setIsLoading]       = useState(false);
  const [comment,         setComment]         = useState('');
  const [showReject,      setShowReject]       = useState(false);
  const [confirmDel,      setConfirmDel]       = useState(false);
  const [payingTermIdx,   setPayingTermIdx]    = useState<number | null>(null);
  const [payDateInput,    setPayDateInput]     = useState('');
  const [vendorOrderIdx,  setVendorOrderIdx]   = useState<number | null>(null); // 注文書送付ダイアログ対象インデックス

  // この契約書に紐づく見積書の業者コスト明細
  const linkedEstimate = estimates?.find(e => e.estimateId === ct.estimateId);
  const vendorCosts    = (linkedEstimate?.vendorCosts ?? []).filter(vc => vc.vendorName.trim() && vc.amount > 0);

  // 業者コスト注文書 HTML 生成
  const buildVendorCostOrderHtml = (vc: VendorCostEntry): string => {
    const workName = vc.description?.trim() || `${ct.projectTitle}工事`;
    const itemHtml = `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:6px 8px;text-align:center">1</td>
        <td style="padding:6px 8px">${workName} 一式</td>
        <td style="padding:6px 8px;text-align:center">1</td>
        <td style="padding:6px 8px">式</td>
        <td style="padding:6px 8px;text-align:right">¥${vc.amount.toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:bold">¥${vc.amount.toLocaleString()}</td>
      </tr>`;
    return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
      <title>注文書</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Hiragino Kaku Gothic ProN','ヒラギノ角ゴ ProN','Meiryo','メイリオ','MS PGothic','ＭＳ Ｐゴシック',sans-serif;color:#111;font-size:10pt;line-height:1.6;background:#c8c8c8;padding:20px 0 40px}
        @page{size:A4 portrait;margin:0}
        @media print{
          body{background:white;padding:0}
          .no-print{display:none!important}
          .page{box-shadow:none;border:none;margin:0;padding:18mm 20mm;width:100%;min-height:auto}
        }
        .no-print{text-align:center;margin-bottom:14px}
        .no-print button{background:#444;color:white;border:none;padding:7px 24px;border-radius:5px;cursor:pointer;font-size:10pt;letter-spacing:0.05em}
        .no-print button:hover{background:#222}
        .page{width:210mm;min-height:297mm;background:white;margin:0 auto;padding:18mm 20mm;box-shadow:0 4px 20px rgba(0,0,0,0.35);border:1px solid #aaa}
        h1{font-size:18pt;text-align:center;letter-spacing:0.35em;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:16px}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
        .label{font-size:8pt;color:#666;margin-bottom:2px}
        .val{font-weight:bold;font-size:11pt}
        table{width:100%;border-collapse:collapse;margin-bottom:12px;table-layout:fixed}
        th{background:#e8e8e8;padding:5px 8px;font-size:9pt;border:1px solid #555;font-weight:bold}
        td{padding:5px 8px;border:1px solid #ccc;word-break:break-word;font-size:10pt}
        .total{text-align:right;font-size:13pt;font-weight:bold;margin-top:10px;padding-top:8px;border-top:2px solid #111}
        .footer{margin-top:24px;font-size:8pt;color:#666;border-top:1px solid #ccc;padding-top:10px}
      </style>
      </head><body>
      <div class="no-print"><button onclick="window.print()">🖨 PDF保存・印刷する</button></div>
      <div class="page">
        <h1>注　文　書</h1>
        <div class="info">
          <div><div class="label">発注先</div><div class="val">${vc.vendorName} 御中</div></div>
          <div><div class="label">案件名</div><div class="val">${ct.projectTitle}</div></div>
          <div><div class="label">発注日</div><div class="val">${new Date().toLocaleDateString('ja-JP')}</div></div>
        </div>
        <table>
          <thead><tr>
            <th style="text-align:center;width:36px">No.</th>
            <th style="text-align:left">品目・作業内容</th>
            <th style="text-align:center;width:52px">数量</th>
            <th style="text-align:center;width:36px">単位</th>
            <th style="text-align:right;width:88px">単価</th>
            <th style="text-align:right;width:88px">金額</th>
          </tr></thead>
          <tbody>${itemHtml}</tbody>
        </table>
        <div class="total">合計金額：¥${vc.amount.toLocaleString()}（税抜）</div>
        <div class="footer">本注文書に基づき、上記作業をご依頼申し上げます。</div>
      </div>
      </body></html>`;
  };

  const buildVendorCostSummaryText = (vc: VendorCostEntry): string => {
    const workName = vc.description?.trim() || `${ct.projectTitle}工事`;
    return `【注文書】${ct.projectTitle}\n発注先: ${vc.vendorName} 様\n作業内容: ${workName} 一式\n発注金額: ¥${vc.amount.toLocaleString()} （税抜）\n\n住良建設株式会社`;
  };

  const handleMarkPaid = async (termIdx: number) => {
    const today = new Date().toISOString().split('T')[0];
    const paidAt = payDateInput || today;
    setIsLoading(true);
    try {
      const updated = (ct.paymentTerms ?? []).map((t, i) =>
        i === termIdx ? { ...t, isPaid: true, paidAt } : t,
      );
      await updatePaymentTerms(ct.contractId, updated);
      onShowToast(`${ct.paymentTerms?.[termIdx]?.termName ?? '入金'} を記録しました`);
      setPayingTermIdx(null);
      setPayDateInput('');
    } catch { onShowToast('記録に失敗しました'); }
    finally { setIsLoading(false); }
  };

  const handleCancelPaid = async (termIdx: number) => {
    setIsLoading(true);
    try {
      const updated = (ct.paymentTerms ?? []).map((t, i) =>
        i === termIdx ? { ...t, isPaid: false, paidAt: undefined } : t,
      );
      await updatePaymentTerms(ct.contractId, updated);
      onShowToast('入金記録を取り消しました');
    } catch { onShowToast('操作に失敗しました'); }
    finally { setIsLoading(false); }
  };

  const approvalStatus = ct.approvalStatus ?? 'draft';

  // DEV ログ
  if (import.meta.env.DEV) {
    console.log(`[ContractCard] RENDER id=${ct.contractId} status=${approvalStatus} isLoading=${isLoading}`);
  }

  const handleSubmit = async () => {
    if (import.meta.env.DEV) console.log('[ContractCard] handleSubmit START');
    setIsLoading(true);
    try {
      await submitContractForApproval(ct.contractId);
      if (import.meta.env.DEV) console.log('[ContractCard] handleSubmit Firestore write OK');
      onShowToast('契約書を承認依頼として提出しました');
    } catch { onShowToast('提出に失敗しました'); }
    finally {
      if (import.meta.env.DEV) console.log('[ContractCard] handleSubmit finally setIsLoading(false)');
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await approveContract(ct.contractId, currentUserName, comment);
      onShowToast('契約書を承認しました');
    } catch { onShowToast('承認に失敗しました'); }
    finally { setIsLoading(false); }
  };

  const handleRevertToDraft = async () => {
    setIsLoading(true);
    try {
      await revertContractToDraft(ct.contractId);
      onShowToast('承認依頼を取り下げ、下書きに戻しました');
    } catch { onShowToast('操作に失敗しました'); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await deleteContract(ct.contractId);
      onShowToast('契約書を削除しました');
    } catch { onShowToast('削除に失敗しました'); }
    finally { setIsLoading(false); setConfirmDel(false); }
  };

  const handleReject = async () => {
    if (!comment.trim()) return;
    setIsLoading(true);
    try {
      await rejectContract(ct.contractId, currentUserName, comment);
      onShowToast('契約書を差し戻しました');
      setShowReject(false);
    } catch { onShowToast('差し戻しに失敗しました'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className={`bg-[#0A0F1D] rounded-lg border p-3 space-y-2 ${
      approvalStatus === 'pending_approval' ? 'border-yellow-700/40' :
      approvalStatus === 'approved'         ? 'border-emerald-700/30' :
      approvalStatus === 'rejected'         ? 'border-red-700/30'    :
      approvalStatus === 'voided'           ? 'border-gray-700/30 opacity-50' :
      'border-gray-800'
    }`}>

      {/* ステータス行 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${CONTRACT_APPROVAL_COLOR[approvalStatus]}`}>
          {CONTRACT_APPROVAL_LABEL[approvalStatus]}
        </span>
        {/* 署名済バッジ — DOM 常駐・CSS 切替 */}
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-900/60 text-emerald-300"
          style={{ display: ct.status === 'signed' ? 'inline-block' : 'none' }}
        >
          署名済
        </span>
        <span className="text-xs font-bold text-[#E6C687]">{formatAmt(ct.totalAmount ?? 0)}</span>
        <span className="text-[10px] text-gray-500 ml-auto">
          {new Date(ct.createdAt).toLocaleDateString('ja-JP')}
        </span>
      </div>

      {/* ─── 入金予定（支払条件ごと・契約タブは日付確認のみ。操作は精算タブで）─── */}
      {(ct.paymentTerms ?? []).length > 0 && (
        <div className="space-y-1.5">
          {(ct.paymentTerms ?? []).map((t, i) => (
            <div key={i} className={`rounded-lg border px-3 py-2 flex flex-wrap items-center gap-2 ${
              t.isPaid ? 'bg-emerald-950/20 border-emerald-700/30' : 'bg-[#111A35] border-gray-700'
            }`}>
              {/* 名称・金額 */}
              <span className="text-xs font-bold text-white min-w-[60px]">{t.termName}</span>
              <span className="text-xs text-[#E6C687] font-mono">{formatAmt(t.amount)}</span>
              {/* 入金予定日 */}
              {t.scheduledDate && !t.isPaid && (
                <span className={`text-[10px] flex items-center gap-0.5 ${
                  t.scheduledDate < new Date().toISOString().split('T')[0]
                    ? 'text-red-400 font-bold' : 'text-gray-500'
                }`}>
                  <LucideCalendarDays size={9} /> 予定: {t.scheduledDate}
                </span>
              )}
              {t.isPaid ? (
                <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 ml-auto">
                  <LucideCheck size={10} /> 入金済 {t.paidAt ?? ''}
                </span>
              ) : (
                <span className="ml-auto text-[10px] text-gray-600 italic">
                  ※精算タブで管理
                </span>
              )}
              {/* ダミー要素（不使用だが削除しない） */}
              {false && payingTermIdx === i && payDateInput && (
                <button
                  onClick={() => { setPayingTermIdx(null); setPayDateInput(''); }}
                  className="hidden"
                >
                  入金済みにする
                </button>
              )}
            </div>
          ))}
          {/* 回収サマリー */}
          {(() => {
            const terms = ct.paymentTerms ?? [];
            const paid = terms.filter(t => t.isPaid).reduce((s, t) => s + t.amount, 0);
            const total = terms.reduce((s, t) => s + t.amount, 0);
            const unpaid = total - paid;
            return unpaid > 0 ? (
              <div className="flex items-center gap-3 text-[10px] pt-0.5 text-gray-400">
                <span>回収済: <strong className="text-emerald-400">{formatAmt(paid)}</strong></span>
                <span>未収金: <strong className={unpaid > 0 ? 'text-red-400' : 'text-gray-400'}>{formatAmt(unpaid)}</strong></span>
              </div>
            ) : (
              <p className="text-[10px] text-emerald-400 pt-0.5 flex items-center gap-1">
                <LucideCheck size={10} /> 全額回収完了
              </p>
            );
          })()}
        </div>
      )}

      {/* 工期 — DOM 常駐・CSS 切替 */}
      <p
        className="text-[11px] text-gray-400"
        style={{ display: (ct.constructionStartDate || ct.constructionEndDate) ? 'block' : 'none' }}
      >
        工期: {ct.constructionStartDate ?? '?'} 〜 {ct.constructionEndDate ?? '?'}
        {ct.warrantyMonths ? `　保証: ${ct.warrantyMonths}ヶ月` : ''}
      </p>

      {/* 差し戻しコメント — DOM 常駐・CSS 切替 */}
      <div
        className="bg-red-950/30 border border-red-700/30 rounded px-2.5 py-1.5 text-[11px] text-red-300 flex items-start gap-1.5"
        style={{ display: approvalStatus === 'rejected' && !!ct.approvalComment ? 'flex' : 'none' }}
      >
        <LucideInfo size={11} className="shrink-0 mt-0.5" />
        差し戻し理由: {ct.approvalComment ?? ''}
      </div>

      {/* 承認コメント — DOM 常駐・CSS 切替 */}
      <div
        className="text-[11px] text-emerald-400 flex items-center gap-1"
        style={{ display: approvalStatus === 'approved' && !!ct.approvalComment ? 'flex' : 'none' }}
      >
        <LucideCheck size={10} /> {ct.approvalComment ?? ''}
      </div>

      {/* ── 承認フロー アクション（全セクション DOM 常駐・CSS で切替） ── */}

      {/* draft → 承認依頼提出 */}
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        style={{ display: approvalStatus === 'draft' ? 'flex' : 'none' }}
        className="w-full border border-[#C5A059]/40 hover:border-[#C5A059] text-[#C5A059] hover:text-[#E6C687] text-xs font-bold py-1.5 rounded-lg transition-colors disabled:opacity-50 items-center justify-center gap-1">
        {/* アイコン ternary → CSS display（insertBefore 回避） */}
        <LucideActivity size={11} className="animate-spin" style={{ display: isLoading ? 'inline-block' : 'none' }} />
        <LucideClock size={11} style={{ display: isLoading ? 'none' : 'inline-block' }} />
        承認依頼として提出する
      </button>

      {/* pending_approval → 管理者が承認 / 差し戻し（管理者のみ表示） */}
      <div
        className="space-y-1.5 pt-1 border-t border-yellow-700/20"
        style={{ display: approvalStatus === 'pending_approval' && isManagerLike ? 'block' : 'none' }}
      >
        <input
          type="text"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="承認コメント（任意）"
          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#C5A059]"
        />
        {/* 差し戻し入力 — DOM 常駐 */}
        <div className="space-y-1.5" style={{ display: showReject ? 'block' : 'none' }}>
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="差し戻し理由（必須）"
            className="w-full bg-[#0B132B] border border-red-700/50 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none"
          />
          <div className="flex gap-1.5">
            <button onClick={() => setShowReject(false)}
              className="flex-1 border border-gray-700 text-gray-400 text-xs py-1.5 rounded-lg hover:border-gray-500 transition-colors">
              キャンセル
            </button>
            <button
              onClick={handleReject}
              disabled={!comment.trim() || isLoading}
              className="flex-[2] bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-bold py-1.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
              <LucideThumbsDown size={11} /> 差し戻す
            </button>
          </div>
        </div>
        {/* 承認 / 差し戻し ボタン行 — DOM 常駐 */}
        <div className="flex gap-1.5" style={{ display: showReject ? 'none' : 'flex' }}>
          <button onClick={() => setShowReject(true)} disabled={isLoading}
            className="flex-1 border border-red-700/40 text-red-400 text-xs py-1.5 rounded-lg hover:bg-red-950/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
            <LucideThumbsDown size={11} /> 差し戻す
          </button>
          <button onClick={handleApprove} disabled={isLoading}
            className="flex-[2] bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 text-xs font-bold py-1.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
            {/* Fragment ternary → 全要素 DOM 常駐・CSS 切替（insertBefore 回避） */}
            <LucideActivity size={12} className="animate-spin" style={{ display: isLoading ? 'inline-block' : 'none' }} />
            <span style={{ display: isLoading ? 'inline' : 'none' }}> 処理中…</span>
            <LucideThumbsUp size={11} style={{ display: isLoading ? 'none' : 'inline-block' }} />
            <span style={{ display: isLoading ? 'none' : 'inline' }}> 承認する</span>
          </button>
        </div>
      </div>

      {/* 承認済み → サイン取得 + 送付 */}
      <div
        className="pt-1 border-t border-gray-800 space-y-1.5"
        style={{ display: approvalStatus === 'approved' ? 'block' : 'none' }}
      >
        {/* サイン取得済み */}
        <div className="flex items-center gap-2" style={{ display: ct.customerSignature ? 'flex' : 'none' }}>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <LucideCheck size={10} /> お客様サイン取得済み
          </span>
          <img
            src={ct.customerSignature ?? ''}
            alt="サイン"
            className="h-8 border border-gray-700 rounded bg-white"
            style={{ display: ct.customerSignature ? 'block' : 'none' }}
          />
        </div>
        {/* 署名URL — 別タブで開く軽量ページ（アプリ外）*/}
        <div style={{ display: ct.customerSignature ? 'none' : 'block' }} className="space-y-1">
          <button
            onClick={() => window.open(`${window.location.origin}/?customerSign=${ct.contractId}`, '_blank')}
            className="flex items-center gap-1.5 text-[11px] text-[#C5A059] hover:text-[#E6C687] border border-[#C5A059]/30 hover:border-[#C5A059] rounded-lg px-2.5 py-1.5 transition-colors w-full justify-center font-bold">
            ✍️ 署名ページを開く（お客様に渡す）
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/?customerSign=${ct.contractId}`);
            }}
            className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 w-full justify-center py-0.5 transition-colors">
            <LucideCopy size={10} /> 署名URLをコピー
          </button>
        </div>
        <SendContractButton ct={ct} customer={customer} />

        {/* 業者への注文書（見積書に業者コストが記載されている場合） */}
        {vendorCosts.length > 0 && (
          <div className="mt-1 pt-1.5 border-t border-gray-800/60 space-y-1.5">
            <p className="text-[10px] text-gray-500 font-semibold flex items-center gap-1">
              <LucideBuilding2 size={10} /> 外部業者への注文書
            </p>
            {vendorCosts.map((vc, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex-1 text-[11px] text-gray-300 truncate">{vc.vendorName}</span>
                <span className="text-[10px] text-gray-500 font-mono">¥{vc.amount.toLocaleString()}</span>
                <button
                  onClick={() => setVendorOrderIdx(idx)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-700/30 hover:border-blue-700/60 px-2 py-0.5 rounded transition-colors flex items-center gap-0.5 shrink-0">
                  <LucideFileText size={9} /> 注文書・送付
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 業者注文書 送付ダイアログ */}
        {vendorOrderIdx !== null && vendorCosts[vendorOrderIdx] && (() => {
          const vc = vendorCosts[vendorOrderIdx];
          return (
            <SendDocumentDialog
              title={`注文書 — ${vc.vendorName} 宛`}
              summaryText={buildVendorCostSummaryText(vc)}
              onOpenPrint={() => openPrintPreview(buildVendorCostOrderHtml(vc))}
              onClose={() => setVendorOrderIdx(null)}
            />
          );
        })()}

        {/* 廃止ボタン（管理者のみ・署名前） */}
        {isManagerLike && ct.status !== 'signed' && (
          <button
            onClick={async () => {
              if (!window.confirm('この契約書を廃止にしますか？\n廃止後も履歴として残ります（削除ではありません）')) return;
              setIsLoading(true);
              try {
                await voidContract(ct.contractId, currentUserName);
                onShowToast('契約書を廃止にしました');
              } catch { onShowToast('操作に失敗しました'); }
              finally { setIsLoading(false); }
            }}
            disabled={isLoading}
            className="w-full mt-1 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-700/40 text-[10px] py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <LucideX size={10} /> この契約書を廃止にする
          </button>
        )}
      </div>

      {/* ── 担当・現場スタッフ向けアクション ─────────────────── */}

      {/* pending_approval → 取り下げ（非管理者のみ表示） */}
      <button
        onClick={handleRevertToDraft}
        disabled={isLoading}
        style={{ display: approvalStatus === 'pending_approval' && !isManagerLike ? 'flex' : 'none' }}
        className="w-full border border-amber-700/40 text-amber-400 hover:bg-amber-950/30 text-xs font-bold py-1.5 rounded-lg transition-colors disabled:opacity-50 items-center justify-center gap-1">
        <LucideActivity size={11} className="animate-spin" style={{ display: isLoading ? 'inline-block' : 'none' }} />
        <LucideRefreshCw size={11} style={{ display: isLoading ? 'none' : 'inline-block' }} />
        承認依頼を取り下げる（下書きに戻す）
      </button>

      {/* draft（非管理者のみ）/ rejected（全員）→ 編集ボタン */}
      <button
        onClick={() => onEditRequest(ct)}
        disabled={isLoading}
        style={{ display: (approvalStatus === 'draft' && !isManagerLike) || approvalStatus === 'rejected' ? 'flex' : 'none' }}
        className="w-full border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white text-xs font-bold py-1.5 rounded-lg transition-colors disabled:opacity-50 items-center justify-center gap-1">
        <LucidePencil size={11} /> 内容を修正して再提出する
      </button>

      {/* draft（非管理者のみ）/ rejected（全員）→ 削除 */}
      <div style={{ display: (approvalStatus === 'draft' && !isManagerLike) || approvalStatus === 'rejected' ? 'block' : 'none' }}>
        <div style={{ display: confirmDel ? 'none' : 'block' }}>
          <button
            onClick={() => setConfirmDel(true)}
            disabled={isLoading}
            className="w-full border border-red-700/30 text-red-400/70 hover:text-red-400 hover:border-red-700/60 text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
            <LucideTrash2 size={11} /> この契約書を削除
          </button>
        </div>
        <div className="flex gap-1.5" style={{ display: confirmDel ? 'flex' : 'none' }}>
          <button onClick={() => setConfirmDel(false)}
            className="flex-1 border border-gray-700 text-gray-400 text-xs py-1.5 rounded-lg hover:border-gray-500 transition-colors">
            キャンセル
          </button>
          <button onClick={handleDelete} disabled={isLoading}
            className="flex-[2] bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-bold py-1.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
            <LucideActivity size={11} className="animate-spin" style={{ display: isLoading ? 'inline-block' : 'none' }} />
            <LucideTrash2 size={11} style={{ display: isLoading ? 'none' : 'inline-block' }} />
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 契約書管理モーダル
// ─────────────────────────────────────────────────────────────

function ContractManageModal({
  project, customer, contracts, approvedEstimates,
  staffName, currentRole, currentUserName, onClose, onShowToast,
  embedded = false,
}: {
  project:           Project;
  customer:          Customer;
  contracts:         Contract[];
  approvedEstimates: Estimate[];
  staffName:         string;
  currentRole:       UserRole;
  currentUserName:   string;
  onClose:           () => void;
  onShowToast:       (msg: string) => void;
  /** ワークスペース内埋め込みモード：固定オーバーレイとヘッダーを省略 */
  embedded?:         boolean;
}) {
  const isManagerLike = currentRole === 'manager' || currentRole === 'admin';

  const [showCreate,       setShowCreate]       = useState(false);
  const [editingContract,  setEditingContract]  = useState<Contract | null>(null);
  const [selectedEst,      setSelectedEst]      = useState<Estimate | null>(
    approvedEstimates.length === 1 ? approvedEstimates[0] : null,
  );
  // signingContract は別URLページへ移行済みのため不使用（削除済み）

  // ── DEV ログ ──────────────────────────────────────────────
  if (import.meta.env.DEV) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      console.log(
        '[ContractManageModal] contracts 変化',
        contracts.map(c => `${c.contractId}:${c.approvalStatus}`),
      );
    }, [contracts]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      console.log('[ContractManageModal] showCreate=', showCreate,
        '/ editingContract=', editingContract?.contractId ?? null);
    }, [showCreate, editingContract]);
    console.log('[ContractManageModal] RENDER — contracts.length=', contracts.length,
      'showCreate=', showCreate);
  }
  // ──────────────────────────────────────────────────────────

  // 編集リクエスト：既存契約書の内容でダイアログを開く
  const handleEditRequest = useCallback((ct: Contract) => {
    const est = approvedEstimates.find(e => e.estimateId === ct.estimateId) ?? approvedEstimates[0] ?? null;
    setSelectedEst(est);
    setEditingContract(ct);
    setShowCreate(true);
  }, [approvedEstimates]);

  // CreateContractDialog へ渡すコールバック — useCallback で参照を安定化して memo を機能させる
  const handleDialogClose = useCallback(() => {
    setShowCreate(false);
    setEditingContract(null);
  }, []);

  const handleDialogCreated = useCallback((msg: string) => {
    onShowToast(msg);
    setShowCreate(false);
    setEditingContract(null);
  }, [onShowToast]);

  const pendingCount = contracts.filter(c => c.approvalStatus === 'pending_approval').length;

  // ── 埋め込みモード用コンテンツ ──────────────────────────────────
  const cmContent = (
    <div className="overflow-y-auto flex-1 p-4 space-y-3">
      <div style={{ display: approvedEstimates.length === 0 ? 'block' : 'none' }}>
        <div className="bg-amber-950/30 border border-amber-700/30 rounded-lg px-4 py-3 text-xs text-amber-300 flex items-start gap-2">
          <LucideAlertCircle size={13} className="shrink-0 mt-0.5" />
          承認済みの見積書がないため、契約書を作成できません。先に見積書を承認してください。
        </div>
      </div>
      <div className="space-y-2" style={{ display: approvedEstimates.length > 0 ? 'block' : 'none' }}>
        <div style={{ display: approvedEstimates.length > 1 ? 'block' : 'none' }}>
          <label className="text-xs text-gray-400 block mb-1">紐づける見積書を選択</label>
          <select value={selectedEst?.estimateId ?? ''} onChange={e => setSelectedEst(approvedEstimates.find(est => est.estimateId === e.target.value) ?? null)}
            className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]">
            <option value="">-- 選択してください --</option>
            {approvedEstimates.map(est => <option key={est.estimateId} value={est.estimateId}>Ver.{est.version ?? '?'} — {formatAmt(est.totalAmount ?? 0)} ({new Date(est.createdAt).toLocaleDateString('ja-JP')})</option>)}
          </select>
        </div>
        <button onClick={() => { setEditingContract(null); selectedEst && setShowCreate(true); }} disabled={!selectedEst}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C5A059]/40 hover:border-[#C5A059] text-[#C5A059] hover:text-[#E6C687] text-sm font-bold py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <LucidePlusCircle size={14} /> 新規契約書を作成する
        </button>
      </div>
      <div style={{ display: contracts.length === 0 ? 'block' : 'none' }}>
        <div className="text-center text-gray-500 text-sm py-6">契約書がまだありません</div>
      </div>
      <div className="space-y-2" style={{ display: contracts.length > 0 ? 'block' : 'none' }}>
        <p className="text-[10px] text-gray-500">▼ 作成済み契約書</p>
        {[...contracts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(ct => (
          <ContractCard key={ct.contractId} ct={ct} isManagerLike={isManagerLike} customer={customer}
            currentUserName={currentUserName} onShowToast={onShowToast} onEditRequest={handleEditRequest}
            estimates={approvedEstimates} />
        ))}
      </div>
    </div>
  );
  const cmSubDialog = (
    <div>
      {showCreate && selectedEst && (
        <CreateContractDialog project={project} customer={customer} estimate={selectedEst}
          staffName={staffName} existingContract={editingContract ?? undefined}
          onClose={handleDialogClose} onCreated={handleDialogCreated} />
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {cmContent}
        {cmSubDialog}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* ヘッダー — バッジは display:none で DOM に常駐させて insertBefore を防ぐ */}
        <div className="bg-[#0B132B] px-5 py-3.5 border-b border-[#C5A059]/20 flex justify-between items-center shrink-0 rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideClipboardCheck size={15} className="text-[#C5A059]" />
            契約書管理
            <span className="text-[11px] text-gray-400 font-normal">— {project.title}</span>
            <span
              className="bg-yellow-900/60 text-yellow-300 text-[10px] px-2 py-0.5 rounded-full font-semibold items-center gap-1"
              style={{ display: pendingCount > 0 ? 'inline-flex' : 'none' }}
            >
              <LucideClock size={9} /> {pendingCount}件 承認待ち
            </span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {/* 新規作成エリア — DOM常駐・CSS切替 */}
          <div style={{ display: approvedEstimates.length === 0 ? 'block' : 'none' }}>
            <div className="bg-amber-950/30 border border-amber-700/30 rounded-lg px-4 py-3 text-xs text-amber-300 flex items-start gap-2">
              <LucideAlertCircle size={13} className="shrink-0 mt-0.5" />
              承認済みの見積書がないため、契約書を作成できません。先に見積書を承認してください。
            </div>
          </div>
          <div className="space-y-2" style={{ display: approvedEstimates.length > 0 ? 'block' : 'none' }}>
            <div style={{ display: approvedEstimates.length > 1 ? 'block' : 'none' }}>
              <label className="text-xs text-gray-400 block mb-1">紐づける見積書を選択</label>
              <select
                value={selectedEst?.estimateId ?? ''}
                onChange={e => setSelectedEst(approvedEstimates.find(est => est.estimateId === e.target.value) ?? null)}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
              >
                <option value="">-- 選択してください --</option>
                {approvedEstimates.map(est => (
                  <option key={est.estimateId} value={est.estimateId}>
                    Ver.{est.version ?? '?'} — {formatAmt(est.totalAmount ?? 0)} ({new Date(est.createdAt).toLocaleDateString('ja-JP')})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { setEditingContract(null); selectedEst && setShowCreate(true); }}
              disabled={!selectedEst}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C5A059]/40 hover:border-[#C5A059] text-[#C5A059] hover:text-[#E6C687] text-sm font-bold py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <LucidePlusCircle size={14} /> 新規契約書を作成する
            </button>
          </div>

          {/* 既存契約書一覧 — DOM常駐・CSS切替でinsertBeforeを根絶 */}
          <div style={{ display: contracts.length === 0 ? 'block' : 'none' }}>
            <div className="text-center text-gray-500 text-sm py-6">契約書がまだありません</div>
          </div>
          <div className="space-y-2" style={{ display: contracts.length > 0 ? 'block' : 'none' }}>
            <p className="text-[10px] text-gray-500">▼ 作成済み契約書</p>
            {[...contracts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(ct => (
              <ContractCard
                key={ct.contractId}
                ct={ct}
                isManagerLike={isManagerLike}
                customer={customer}
                currentUserName={currentUserName}
                onShowToast={onShowToast}
                onEditRequest={handleEditRequest}
              />
            ))}
          </div>
        </div>
      </div>

      {/* サブダイアログを安定ラッパーで囲む
           → Concurrent Mode でアンカーノードが消えて insertBefore が失敗するのを防ぐ */}
      <div>
        {showCreate && selectedEst && (
          <CreateContractDialog
            project={project}
            customer={customer}
            estimate={selectedEst}
            staffName={staffName}
            existingContract={editingContract ?? undefined}
            onClose={handleDialogClose}
            onCreated={handleDialogCreated}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 案件ワークスペース（E-2）
// 案件に紐づく全情報を1画面で管理するハブ
// ─────────────────────────────────────────────────────────────

const WS_STEP_INDEX: Record<ProjectStatus, number> = {
  lead:         0,
  estimate:     1,
  contract:     2,
  construction: 3,
  completed:    4,
  lost:        -1,
};

const WS_STEPS: Array<{ id: WorkspaceSection; label: string; shortLabel: string }> = [
  { id: 'overview',   label: '概要',  shortLabel: '概要' },
  { id: 'estimates',  label: '見積',  shortLabel: '見積' },
  { id: 'contracts',  label: '契約',  shortLabel: '契約' },
  { id: 'settlement', label: '精算',  shortLabel: '精算' },
];

export function ProjectWorkspaceModal({
  project, customer,
  estimates, allEstimates,
  contracts, logs,
  estimateTemplates, vendors, vendorQuoteRequests,
  staffList, currentRole, currentUserName, currentUserId,
  onClose, onShowToast,
  initialSection = 'overview',
  deepLinkTarget, onDeepLinkConsumed,
  mode = 'modal', onBack,
}: {
  project:              Project;
  customer:             Customer;
  estimates:            Estimate[];
  allEstimates:         Estimate[];
  contracts:            Contract[];
  logs:                 InOutLog[];
  estimateTemplates:    EstimateTemplate[];
  vendors:              Vendor[];
  vendorQuoteRequests:  VendorQuoteRequest[];
  staffList:            string[];
  currentRole:          UserRole;
  currentUserName:      string;
  currentUserId?:       string;
  onClose:              () => void;
  onShowToast:          (msg: string) => void;
  initialSection?:      WorkspaceSection;
  deepLinkTarget?:      { customerId: string; projectId: string; section: 'estimates' | 'vendor_quotes'; itemId: string };
  onDeepLinkConsumed?:  () => void;
  /** 'modal': 全画面オーバーレイ / 'panel': 親コンテナ内インライン */
  mode?:                'modal' | 'panel';
  /** パネルモードのモバイル「一覧へ戻る」ボタン */
  onBack?:              () => void;
}) {
  const isManagerLike = currentRole === 'manager' || currentRole === 'admin';

  // deep-link からの初期セクション解決
  const resolvedInitial: WorkspaceSection =
    deepLinkTarget?.projectId === project.projectId && deepLinkTarget.section === 'estimates'
      ? 'estimates'
      : initialSection;

  const [section, setSection] = useState<WorkspaceSection>(resolvedInitial);

  // 概要タブ: ステータス変更
  const [statusChanging,   setStatusChanging]   = useState(false);
  const [lostReasonTarget, setLostReasonTarget] = useState<ProjectStatus | null>(null);

  const handleStatusChange = (s: ProjectStatus) => {
    if (s === 'lost') {
      // 失注理由ダイアログを表示
      setLostReasonTarget(s);
      return;
    }
    setStatusChanging(true);
    updateProjectStatus(project.projectId, s)
      .then(() => onShowToast(`ステータスを「${STATUS_LABEL[s]}」に変更しました`))
      .catch(() => onShowToast('変更に失敗しました'))
      .finally(() => setStatusChanging(false));
  };

  const handleLostConfirm = async (reason: string) => {
    setStatusChanging(true);
    try {
      await updateProjectStatus(project.projectId, 'lost');
      if (reason) await setLostReason(project.projectId, reason);
      onShowToast('ステータスを「失注」に変更しました');
    } catch { onShowToast('変更に失敗しました'); }
    finally { setStatusChanging(false); setLostReasonTarget(null); }
  };

  // 案件に紐づくログ（新しい順）
  const projectLogs = useMemo(() =>
    [...logs].filter(l => l.projectId === project.projectId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  [logs, project.projectId]);

  const approvedEstimates = useMemo(
    () => estimates.filter(e => e.approvalStatus === 'approved'),
    [estimates],
  );

  const estPending = estimates.filter(e => e.approvalStatus === 'pending_approval').length;
  const ctPending  = contracts.filter(c => c.approvalStatus === 'pending_approval').length;

  // ── ワークフロー進捗 ──
  const stepIdx  = WS_STEP_INDEX[project.status]; // -1=lost, 0〜4
  const isLost   = project.status === 'lost';
  const isDone   = project.status === 'completed';

  return (
    <>
    {/* 失注理由ダイアログ */}
    {lostReasonTarget && (
      <LostReasonDialog
        projectTitle={project.title}
        onConfirm={handleLostConfirm}
        onCancel={() => setLostReasonTarget(null)}
      />
    )}
    <div className={mode === 'modal'
      ? 'fixed inset-0 z-[55] flex flex-col bg-[#0A0F1D]'
      : 'flex flex-col h-full bg-[#0A0F1D] rounded-xl border border-gray-800 overflow-hidden'}>

      {/* ─── ヘッダー ─────────────────────────────────────────── */}
      <div className="bg-[#0B132B] border-b border-[#C5A059]/20 px-4 py-3 flex items-center gap-3 shrink-0">
        {mode === 'modal' ? (
          <button onClick={onClose}
            className="text-gray-400 hover:text-white flex items-center gap-1 text-xs border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1.5 transition-colors shrink-0">
            <LucideX size={13} /> 閉じる
          </button>
        ) : onBack && (
          <button onClick={onBack}
            className="md:hidden text-gray-400 hover:text-white flex items-center gap-1 text-xs border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1.5 transition-colors shrink-0">
            <LucideChevronLeft size={13} /> 一覧
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-500 truncate">{customer.name}&ensp;様</p>
          <h2 className="text-sm font-bold text-white truncate leading-tight">{project.title}</h2>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${STATUS_COLOR[project.status]}`}>
          {STATUS_LABEL[project.status]}
        </span>
        {project.amount > 0 && (
          <span className="text-sm font-extrabold text-[#E6C687] shrink-0 font-mono">
            ¥{project.amount.toLocaleString()}
          </span>
        )}
      </div>

      {/* ─── ステッパータブバー ────────────────────────────────── */}
      <div className={`border-b border-gray-800 shrink-0 ${isLost ? 'bg-gray-900/60' : 'bg-[#0B132B]'}`}>
        {isLost && (
          <div className="text-center text-[10px] text-red-400 py-1 border-b border-red-900/30">
            失注 — このフローはクローズされました
          </div>
        )}
        <div className="flex items-stretch">
          {WS_STEPS.map(({ id, label, shortLabel }, idx) => {
            const stepCompleted = !isLost && (isDone || stepIdx > idx);
            const stepCurrent   = !isLost && !isDone && stepIdx === idx;
            const isActive      = section === id;

            return (
              <div key={id} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => setSection(id)}
                  disabled={isLost}
                  className={`relative flex-1 flex flex-col items-center justify-center py-2.5 px-1 gap-1 transition-colors min-w-0
                    ${isActive && !isLost ? 'bg-[#C5A059]/8' : 'hover:bg-[#0A0F1D]/40'}
                    ${isLost ? 'cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {/* ステップ番号 or チェックマーク */}
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                    ${stepCompleted
                      ? 'bg-[#C5A059] text-[#0A0F1D]'
                      : stepCurrent
                        ? 'bg-transparent border-2 border-[#C5A059] text-[#E6C687]'
                        : isLost
                          ? 'bg-gray-800 text-gray-600'
                          : 'bg-gray-800 text-gray-500'
                    }
                    ${isActive && !isLost ? 'ring-2 ring-[#C5A059]/30' : ''}
                  `}>
                    {stepCompleted ? <LucideCheck size={10} /> : idx + 1}
                  </div>
                  {/* ラベル */}
                  <span className={`text-[10px] font-semibold leading-none truncate w-full text-center
                    ${isActive && !isLost ? 'text-[#E6C687]'
                      : stepCompleted ? 'text-[#C5A059]'
                      : stepCurrent   ? 'text-white'
                      : 'text-gray-500'
                    }
                  `}>
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </span>
                  {/* 承認待ちドット */}
                  {id === 'estimates' && estPending > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-yellow-400" />
                  )}
                  {id === 'contracts' && ctPending > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-yellow-400" />
                  )}
                  {/* アクティブ下線 */}
                  {isActive && !isLost && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C5A059]" />
                  )}
                </button>
                {/* コネクター */}
                {idx < WS_STEPS.length - 1 && (
                  <span className={`shrink-0 text-[11px] px-0.5
                    ${(!isLost && (isDone || stepIdx > idx)) ? 'text-[#C5A059]' : 'text-gray-700'}
                  `}>›</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── コンテンツ ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* 概要 */}
        {section === 'overview' && (
          <div className="overflow-y-auto flex-1 p-4 space-y-4">

            {/* ステータス＋金額 */}
            <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 flex items-center gap-1.5"><LucideFolder size={12} /> 案件情報</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">ステータス</p>
                  <select
                    value={project.status}
                    onChange={e => handleStatusChange(e.target.value as ProjectStatus)}
                    disabled={statusChanging}
                    className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C5A059]"
                  >
                    {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">担当</p>
                  {(project.assignees && project.assignees.length > 1) ? (
                    <div className="space-y-0.5">
                      {project.assignees.map(a => (
                        <p key={a.name} className="text-white text-xs">
                          {a.name} <span className="text-gray-500">({a.percentage}%)</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white text-xs py-1.5">{project.assignee || '—'}</p>
                  )}
                </div>
                {/* 承認待ちバッジ（スタッフ作成案件） */}
                {project.projectApprovalStatus === 'needs_approval' && (
                  <div className="col-span-2">
                    <div className="bg-yellow-950/30 border border-yellow-700/30 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-yellow-300 flex items-center gap-1.5">
                        <LucideClock size={11} /> 管理者の承認待ちです
                      </p>
                      {isManagerLike && (
                        <button
                          onClick={async () => {
                            try {
                              await approveProjectCreation(project.projectId);
                              onShowToast('案件を承認しました');
                            } catch { onShowToast('承認に失敗しました'); }
                          }}
                          className="text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2 py-0.5 rounded transition-colors flex items-center gap-0.5">
                          <LucideCheck size={9} /> 承認する
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* 失注理由（status=lost の場合に表示） */}
                {project.status === 'lost' && project.lostReason && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-500 mb-1">失注理由</p>
                    <p className="text-red-300 text-xs bg-red-950/20 border border-red-700/20 rounded-lg px-3 py-2 whitespace-pre-wrap">{project.lostReason}</p>
                  </div>
                )}
                {project.amount > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">受注金額</p>
                    <p className="text-[#E6C687] font-mono text-sm font-bold">¥{project.amount.toLocaleString()}</p>
                  </div>
                )}
                {project.budgetAmount && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">顧客予算</p>
                    <p className="text-white text-xs">¥{project.budgetAmount.toLocaleString()}</p>
                  </div>
                )}
                {project.probability != null && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">確度</p>
                    <p className="text-white text-xs">{project.probability}%</p>
                  </div>
                )}
                {project.deadline && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">希望納期</p>
                    <p className="text-white text-xs">{new Date(project.deadline).toLocaleDateString('ja-JP')}</p>
                  </div>
                )}
              </div>
              {project.issue && (
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">顧客課題</p>
                  <p className="text-gray-300 text-xs whitespace-pre-wrap">{project.issue}</p>
                </div>
              )}
              {project.notes && (
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">備考</p>
                  <p className="text-gray-400 text-xs whitespace-pre-wrap">{project.notes}</p>
                </div>
              )}
            </div>

            {/* 顧客情報 */}
            <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-gray-400 flex items-center gap-1.5"><LucideUser size={12} /> 顧客情報</h3>
              <p className="text-sm font-bold text-white">{customer.name}&ensp;様</p>
              <p className="text-xs text-gray-400">📍 {customer.address}</p>
              {customer.phone && <p className="text-xs text-gray-400">📞 {customer.phone}</p>}
              {customer.email && <p className="text-xs text-gray-400">✉ {customer.email}</p>}
              <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                <span className="text-[10px] text-gray-500">累計 LTV</span>
                <span className="text-sm font-bold text-[#E6C687] font-mono">¥{(customer.totalLtv ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {/* クイックナビ */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'estimates'  as WorkspaceSection, icon: <LucideFileText size={18} />, label: '見積', count: estimates.length, badge: estPending },
                { id: 'contracts'  as WorkspaceSection, icon: <LucideClipboardCheck size={18} />, label: '契約', count: contracts.length, badge: ctPending },
                { id: 'settlement' as WorkspaceSection, icon: <LucideTrendingUp size={18} />, label: '精算', count: contracts.reduce((s, c) => s + (c.paymentTerms?.filter(t => t.isPaid).length ?? 0), 0), badge: 0 },
              ].map(({ id, icon, label, count, badge }) => (
                <button key={id} onClick={() => setSection(id)}
                  className="bg-[#111A35] border border-gray-800 hover:border-[#C5A059]/40 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-colors">
                  <span className="text-[#C5A059] relative">
                    {icon}
                    {badge > 0 && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-yellow-400 text-[8px] text-black font-bold flex items-center justify-center">{badge}</span>}
                  </span>
                  <span className="text-[10px] text-gray-400">{label}</span>
                  <span className="text-sm font-bold text-white">{count}</span>
                </button>
              ))}
            </div>

            {/* 活動履歴（全件）*/}
            <div className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                  <LucideActivity size={12} /> 活動履歴
                </span>
                {projectLogs.length > 0 && (
                  <span className="text-[10px] text-gray-600">{projectLogs.length}件</span>
                )}
              </div>
              {projectLogs.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-600">まだ活動履歴はありません</div>
              ) : (
                <div className="divide-y divide-gray-800/60 max-h-64 overflow-y-auto">
                  {projectLogs.map(log => (
                    <div key={log.logId} className="px-4 py-2.5 flex items-start gap-2.5">
                      <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${log.type === 'in' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/40 text-red-400'}`}>
                        {log.type === 'in' ? 'IN' : 'OUT'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-white">{log.userName}</span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(log.timestamp).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {log.voiceText && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{log.voiceText}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 見積 — EstimateManageModal 埋め込み */}
        {section === 'estimates' && (
          <EstimateManageModal
            embedded
            project={project} customer={customer}
            estimates={estimates} allEstimates={allEstimates}
            estimateTemplates={estimateTemplates}
            vendors={vendors} vendorQuoteRequests={vendorQuoteRequests}
            currentRole={currentRole} currentUserName={currentUserName} currentUserId={currentUserId}
            onClose={() => {}} onShowToast={onShowToast}
            initialSection={deepLinkTarget?.projectId === project.projectId ? deepLinkTarget.section : undefined}
          />
        )}

        {/* 契約書 — ContractManageModal 埋め込み */}
        {section === 'contracts' && (
          <ContractManageModal
            embedded
            project={project} customer={customer}
            contracts={contracts} approvedEstimates={approvedEstimates}
            staffName={currentUserName}
            currentRole={currentRole} currentUserName={currentUserName}
            onClose={() => {}} onShowToast={onShowToast}
          />
        )}

        {/* 精算タブ — 入出金管理 */}
        {section === 'settlement' && (
          <SettlementPanel
            project={project}
            contracts={contracts}
            vendorQuoteRequests={vendorQuoteRequests.filter(vq => vq.projectId === project.projectId)}
            onShowToast={onShowToast}
            onSectionChange={setSection}
            currentUserName={currentUserName}
          />
        )}
      </div>
    </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 案件カード（クリックでワークスペースへ遷移）
// ─────────────────────────────────────────────────────────────

const ProjectCard = memo(function ProjectCard({
  project,
  onWorkspace,
  onEdit,
  estimateCount,
  pendingApprovalCount,
  contractCount,
}: {
  project:              Project;
  onWorkspace?:         () => void;
  onEdit?:              () => void;
  estimateCount:        number;
  pendingApprovalCount: number;
  contractCount:        number;
}) {
  // ワークフロー上の完了ステップ数（概要=0, 見積=1, 契約=2, 精算=3）
  const stepIdx = WS_STEP_INDEX[project.status];
  const isDone  = project.status === 'completed';
  const isLost  = project.status === 'lost';

  return (
    <div
      className="bg-[#0B132B] rounded-lg border border-gray-800 hover:border-[#C5A059]/30 transition-colors cursor-pointer group"
      onClick={onWorkspace}
    >
      <div className="p-3">
        {/* ヘッダー行 */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {/* ステータス + 承認待ちバッジ */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[project.status]}`}>
                {STATUS_LABEL[project.status]}
              </span>
              {pendingApprovalCount > 0 && (
                <span className="bg-yellow-900/60 text-yellow-300 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <LucideClock size={9} /> {pendingApprovalCount}件承認待ち
                </span>
              )}
            </div>
            {/* 案件名 */}
            <p className="text-sm font-bold text-white group-hover:text-[#E6C687] transition-colors">{project.title}</p>
            {/* サブ情報 */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-400">
              {project.amount > 0 && <span className="text-[#C5A059] font-mono">¥{project.amount.toLocaleString()}</span>}
              {project.assignee && <span>担当: {project.assignee}</span>}
              {project.deadline && <span>納期: {project.deadline}</span>}
              {project.probability != null && <span>確度 {project.probability}%</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {onEdit && (
              <button
                onClick={e => { e.stopPropagation(); onEdit(); }}
                title="案件情報を編集"
                className="p-1 text-gray-600 hover:text-[#E6C687] transition-colors rounded"
              >
                <LucidePencil size={12} />
              </button>
            )}
            <LucideChevronRight size={14} className="text-gray-600 group-hover:text-[#C5A059] transition-colors" />
          </div>
        </div>

        {/* ワークフロー進捗ミニバー */}
        <div className="mt-2.5 flex items-center gap-1">
          {WS_STEPS.map(({ id }, idx) => {
            const done    = !isLost && (isDone || stepIdx > idx);
            const current = !isLost && !isDone && stepIdx === idx;
            return (
              <div key={id} className="flex items-center gap-1 flex-1">
                <div className={`h-1 flex-1 rounded-full transition-colors
                  ${done    ? 'bg-[#C5A059]'
                  : current ? 'bg-[#C5A059]/40'
                  : isLost  ? 'bg-gray-800'
                  : 'bg-gray-800'
                  }`} />
              </div>
            );
          })}
        </div>

        {/* 見積・契約カウンタ */}
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-600">
          <span className="flex items-center gap-1">
            <LucideFileText size={9} className="text-gray-700" /> 見積 {estimateCount}件
          </span>
          <span className="flex items-center gap-1">
            <LucideClipboardCheck size={9} className="text-gray-700" /> 契約 {contractCount}件
          </span>
          <span className="ml-auto text-[9px] text-gray-700 group-hover:text-[#C5A059] transition-colors">
            ワークスペースを開く →
          </span>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

function DatabasePage({ customers, projects, logs, estimates, contracts, estimateTemplates, vendors = [], vendorQuoteRequests = [], staffList, currentRole, currentUserName, currentUserId, onShowToast, initialSearch = '', onOpenWorkspace }: Props) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [viewMode,         setViewMode]         = useState<ViewMode>('card');
  const [searchText,       setSearchText]       = useState(initialSearch);
  const [filterStatus,     setFilterStatus]     = useState<ProjectStatus | 'ALL'>('ALL');
  const [showAddCustomer,  setShowAddCustomer]  = useState(false);

  const isManagerLike = currentRole === 'manager' || currentRole === 'admin';

  const handleSelectCustomer = useCallback((c: Customer) => setSelectedCustomer(c), []);
  const handleCloseModal     = useCallback(() => setSelectedCustomer(null), []);
  const handleCloseAdd       = useCallback(() => setShowAddCustomer(false), []);

  const filteredCustomers = useMemo(() => {
    const q = searchText.toLowerCase();
    return customers.filter(c => {
      if (q && !c.name.toLowerCase().includes(q) && !c.address.toLowerCase().includes(q)) return false;
      if (filterStatus !== 'ALL') {
        const has = projects.filter(p => p.customerId === c.customerId).some(p => p.status === filterStatus);
        if (!has) return false;
      }
      return true;
    });
  }, [customers, projects, searchText, filterStatus]);

  return (
    <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-6 shadow-xl space-y-4">

      {/* ── ヘッダー ── */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-gray-800">
        <h2 className="text-base font-extrabold text-white flex items-center gap-1.5">
          <LucideBookOpen className="text-[#C5A059]" size={18} />
          住良建設 一気通貫 顧客カルテ一覧
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-gray-800 px-3 py-1 rounded font-mono text-[#E6C687]">
            {filteredCustomers.length} / {customers.length} 件 | 案件 {projects.length} 件
          </span>
          <button onClick={() => setShowAddCustomer(true)}
            className="flex items-center gap-1.5 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            <LucideUserPlus size={13} /> 顧客登録
          </button>
        </div>
      </div>

      {/* 操作フロー */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 bg-[#0B132B] border border-gray-700/50 rounded-lg px-4 py-2.5">
        <span className="flex items-center gap-1 text-[#C5A059] font-semibold"><LucideUserPlus size={11} /> ① 顧客登録</span>
        <span className="text-gray-700">›</span>
        <span className="flex items-center gap-1 font-semibold"><LucideFolder size={11} /> ② カルテを開く</span>
        <span className="text-gray-700">›</span>
        <span className="flex items-center gap-1 font-semibold"><LucideTag size={11} /> ③ 案件登録</span>
        <span className="text-gray-700">›</span>
        <span className="flex items-center gap-1 font-semibold"><LucideFileText size={11} /> ④ 見積書・契約書（案件ごと）</span>
      </div>

      {/* 検索・フィルター */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <LucideSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="顧客名・住所で検索..."
            className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md pl-8 pr-3 py-2 focus:outline-none focus:border-[#C5A059] placeholder-gray-600" />
        </div>
        <div className="relative">
          <LucideFilter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ProjectStatus | 'ALL')}
            className="bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md pl-7 pr-3 py-2 focus:outline-none focus:border-[#C5A059] appearance-none">
            <option value="ALL">全ステータス</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="flex bg-[#0B132B] border border-gray-700 rounded-md overflow-hidden shrink-0">
          <button onClick={() => setViewMode('card')}
            className={`px-3 py-2 flex items-center gap-1.5 text-xs font-semibold transition-colors ${viewMode === 'card' ? 'bg-[#C5A059]/20 text-[#E6C687]' : 'text-gray-400 hover:text-white'}`}>
            <LucideLayoutGrid size={14} /> カード
          </button>
          <button onClick={() => setViewMode('grid')}
            className={`px-3 py-2 flex items-center gap-1.5 text-xs font-semibold transition-colors ${viewMode === 'grid' ? 'bg-[#C5A059]/20 text-[#E6C687]' : 'text-gray-400 hover:text-white'}`}>
            <LucideList size={14} /> リスト
          </button>
        </div>
      </div>

      {filteredCustomers.length === 0 && (
        <div className="py-12 text-center text-gray-500 text-sm">
          {customers.length === 0
            ? <span>顧客が登録されていません。<button onClick={() => setShowAddCustomer(true)} className="text-[#C5A059] underline ml-1">顧客を登録する</button></span>
            : '条件に一致する顧客が見つかりませんでした'}
        </div>
      )}

      {/* ── カード表示 ── */}
      {viewMode === 'card' && filteredCustomers.length > 0 && (
        <CustomerCardList
          customers={filteredCustomers}
          projects={projects}
          onSelect={handleSelectCustomer}
        />
      )}

      {/* ── リスト表示 ── */}
      {viewMode === 'grid' && filteredCustomers.length > 0 && (
        <CustomerTableList
          customers={filteredCustomers}
          projects={projects}
          onSelect={handleSelectCustomer}
        />
      )}

      {/* ── 顧客カルテ詳細モーダル ── */}
      {selectedCustomer && (
        <CustomerModal
          customer={selectedCustomer}
          projects={projects.filter(p => p.customerId === selectedCustomer.customerId)}
          logs={logs.filter(l => l.customerId === selectedCustomer.customerId)}
          estimates={estimates.filter(e => e.customerId === selectedCustomer.customerId)}
          allEstimates={estimates}
          contracts={contracts.filter(c => c.customerId === selectedCustomer.customerId)}
          estimateTemplates={estimateTemplates}
          vendors={vendors}
          vendorQuoteRequests={vendorQuoteRequests}
          staffList={staffList}
          currentRole={currentRole}
          isManagerLike={isManagerLike}
          currentUserName={currentUserName}
          currentUserId={currentUserId}
          onClose={handleCloseModal}
          onShowToast={onShowToast}
          onOpenWorkspace={onOpenWorkspace}
        />
      )}

      {/* ── 顧客登録ダイアログ ── */}
      {showAddCustomer && (
        <AddCustomerDialog
          onClose={handleCloseAdd}
          onCreated={msg => { onShowToast(msg); setShowAddCustomer(false); }}
        />
      )}
    </div>
  );
}

export default memo(DatabasePage);

// ─── カード一覧（メモ化） ──────────────────────────────────────

const CustomerCardList = memo(function CustomerCardList({
  customers, projects, onSelect,
}: {
  customers: Customer[];
  projects:  Project[];
  onSelect:  (c: Customer) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {customers.map(cust => {
        const custProjects = projects.filter(p => p.customerId === cust.customerId);
        return (
          <div key={cust.customerId}
            className="bg-[#0B132B] border border-gray-800 rounded-lg p-4 space-y-3 hover:border-gray-700 transition-colors">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <span className="text-[10px] text-[#C5A059] font-mono block">{cust.customerId}</span>
                <h4 className="text-sm font-bold text-white truncate">{cust.name}</h4>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">📍 {cust.address}</p>
                {cust.phone && <p className="text-[11px] text-gray-400">📞 {cust.phone}</p>}
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-gray-400 block">累計 LTV</span>
                <span className="text-sm font-black text-[#E6C687]">¥{(cust.totalLtv ?? 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-[#111A35] p-3 rounded border border-gray-800/80 space-y-2">
              <span className="text-[10px] text-gray-400 font-extrabold block">🔗 紐づく案件</span>
              {custProjects.length === 0 ? (
                <p className="text-[11px] text-gray-500 italic">案件なし</p>
              ) : custProjects.map(p => (
                <div key={p.projectId} className="flex justify-between items-center text-xs bg-[#0A0F1D] p-2 rounded">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-mono text-gray-500 block">{p.projectId}</span>
                    <span className="font-bold text-gray-300 truncate block">{p.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block ${STATUS_COLOR[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <span className="font-mono text-[#E6C687] shrink-0 ml-2">¥{(p.amount ?? 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button onClick={() => onSelect(cust)}
              className="w-full text-center bg-gray-800 text-xs text-gray-300 py-1.5 rounded hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5">
              <LucideClipboardList size={12} /> カルテ・案件・訪問ログを開く
            </button>
          </div>
        );
      })}
    </div>
  );
});

// ─── テーブル一覧（メモ化） ───────────────────────────────────

const CustomerTableList = memo(function CustomerTableList({
  customers, projects, onSelect,
}: {
  customers: Customer[];
  projects:  Project[];
  onSelect:  (c: Customer) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#0A0F1D] border-b border-gray-700">
            <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 tracking-wide whitespace-nowrap">顧客名<span className="block text-[9px] font-normal text-gray-600">顧客ID</span></th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 tracking-wide whitespace-nowrap hidden md:table-cell">住所</th>
            <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-400 tracking-wide w-24 whitespace-nowrap">案件数<span className="block text-[9px] font-normal text-gray-600">全 / 進行中</span></th>
            <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-400 tracking-wide w-32 whitespace-nowrap">最新ステータス</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-bold text-gray-400 tracking-wide w-36 whitespace-nowrap">累計 LTV</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((cust, idx) => {
            const custProjects = projects.filter(p => p.customerId === cust.customerId);
            const latestStatus = getLatestStatus(custProjects);
            const total        = custProjects.length;
            const activeCount  = custProjects.filter(p => p.status !== 'completed' && p.status !== 'lost').length;
            return (
              <tr key={cust.customerId} onClick={() => onSelect(cust)}
                className={`border-b border-gray-800 last:border-0 cursor-pointer transition-colors group hover:bg-[#1C284D]/60 ${idx % 2 === 0 ? 'bg-[#0B132B]' : 'bg-[#0A0F1D]'}`}>
                <td className="px-4 py-3"><div className="font-semibold text-white truncate max-w-[160px]">{cust.name}</div><div className="text-[10px] text-gray-500 font-mono mt-0.5">{cust.customerId}</div></td>
                <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs text-gray-400 truncate block max-w-[200px]">{cust.address}</span>{cust.phone && <span className="text-[10px] text-gray-500 mt-0.5 block">{cust.phone}</span>}</td>
                <td className="px-4 py-3 text-center"><span className="text-base font-bold text-white">{total}</span><span className="block text-[10px] mt-0.5">{activeCount > 0 ? <span className="text-emerald-400">{activeCount} 件進行中</span> : <span className="text-gray-600">進行なし</span>}</span></td>
                <td className="px-4 py-3 text-center">{latestStatus ? <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${STATUS_COLOR[latestStatus]}`}>{STATUS_LABEL[latestStatus]}</span> : <span className="text-[11px] text-gray-600">案件なし</span>}</td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1.5"><span className="font-bold text-[#E6C687] whitespace-nowrap">¥{(cust.totalLtv ?? 0).toLocaleString()}</span><LucideChevronRight size={14} className="text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" /></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// ─── 顧客カルテモーダル ──────────────────────────────────────

type ModalTab = 'projects' | 'logs' | 'ltv';

interface ModalProps {
  customer:             Customer;
  projects:             Project[];
  logs:                 InOutLog[];
  estimates:            Estimate[];       // この顧客の見積書
  allEstimates:         Estimate[];       // 全件（比較用）
  contracts:            Contract[];       // この顧客の契約書
  estimateTemplates:    EstimateTemplate[];
  vendors?:             Vendor[];
  vendorQuoteRequests?: VendorQuoteRequest[];
  staffList:            string[];
  currentRole:          UserRole;
  isManagerLike:        boolean;
  currentUserName:      string;
  currentUserId?:       string;
  onClose:              () => void;
  onShowToast:          (msg: string) => void;
  /** E-2: 案件ワークスペースを開くコールバック（DatabasePage が管理） */
  onOpenWorkspace:      (project: Project, section?: WorkspaceSection) => void;
}

function CustomerModal({
  customer, projects, logs,
  estimates, allEstimates, contracts,
  estimateTemplates, vendors = [], vendorQuoteRequests = [],
  staffList, currentRole, isManagerLike, currentUserName, currentUserId,
  onClose, onShowToast, onOpenWorkspace,
}: ModalProps) {
  const [activeTab,      setActiveTab]      = useState<ModalTab>('projects');
  const [expandedPhotos, setExpandedPhotos] = useState<Set<string>>(new Set());
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const togglePhotos = (logId: string) =>
    setExpandedPhotos(prev => { const n = new Set(prev); n.has(logId) ? n.delete(logId) : n.add(logId); return n; });

  const sortedLogs = useMemo(() =>
    [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [logs]
  );

  // ── LTV計算 ─────────────────────────────────────────────────
  const completedProjects = useMemo(() => projects.filter(p => p.status === 'completed'), [projects]);
  const activeProjects    = useMemo(() => projects.filter(p => p.status !== 'completed' && p.status !== 'lost'), [projects]);
  const completedLtv      = useMemo(() => completedProjects.reduce((s, p) => s + (p.amount || 0), 0), [completedProjects]);
  const activeLtv         = useMemo(() => activeProjects.reduce((s, p) => s + (p.amount || 0), 0), [activeProjects]);
  const totalExpectedLtv  = useMemo(() => projects.filter(p => p.status !== 'lost').reduce((s, p) => s + (p.amount || 0), 0), [projects]);
  const maxAmount         = useMemo(() => Math.max(...projects.map(p => p.amount || 0), 1), [projects]);
  const sortedByActivity  = useMemo(() =>
    [...projects].sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()),
    [projects]
  );
  const lastCompletedDate = useMemo(() => {
    const ts = completedProjects.map(p => new Date(p.lastActivityAt).getTime()).filter(n => !isNaN(n));
    return ts.length > 0 ? new Date(Math.max(...ts)) : null;
  }, [completedProjects]);
  const daysSinceLastCompletion = useMemo(() => {
    if (!lastCompletedDate) return 0;
    return Math.floor((Date.now() - lastCompletedDate.getTime()) / 86_400_000);
  }, [lastCompletedDate]);
  const paymentSummary = useMemo(() => {
    const terms = contracts.flatMap(c => c.paymentTerms ?? []);
    return {
      totalBilled: terms.reduce((s, t) => s + (t.amount || 0), 0),
      totalPaid:   terms.filter(t => t.isPaid).reduce((s, t) => s + (t.amount || 0), 0),
    };
  }, [contracts]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">

        {/* ヘッダー */}
        <div className="bg-[#0B132B] p-4 border-b border-[#C5A059]/20 flex justify-between items-start shrink-0">
          <div>
            <span className="text-[10px] text-[#C5A059] font-mono">{customer.customerId}</span>
            <h3 className="text-base font-extrabold text-white">{customer.name} 顧客カルテ</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              📍 {customer.address}
              {customer.phone && `　📞 ${customer.phone}`}
              {customer.email && `　✉ ${customer.email}`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-gray-400 block">累計 LTV</span>
              <span className="text-lg font-extrabold text-[#E6C687]">¥{(customer.totalLtv ?? 0).toLocaleString()}</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><LucideX size={18} /></button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-800 shrink-0 bg-[#0B132B]">
          <button onClick={() => setActiveTab('projects')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${activeTab === 'projects' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
            <LucideFolder size={12} /> 案件 ({projects.length})
          </button>
          <button onClick={() => setActiveTab('ltv')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${activeTab === 'ltv' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
            <LucideTrendingUp size={12} /> LTV分析
          </button>
          <button onClick={() => setActiveTab('logs')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${activeTab === 'logs' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
            <LucideClipboardList size={12} /> 訪問ログ ({logs.length})
          </button>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">

          {/* ── 案件タブ ── */}
          {activeTab === 'projects' && (
            <>
              <button onClick={() => setShowAddProject(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C5A059]/40 hover:border-[#C5A059] text-[#C5A059] hover:text-[#E6C687] text-sm font-bold py-2.5 rounded-lg transition-colors">
                <LucidePlusCircle size={14} />
                {isManagerLike ? 'この顧客に案件を追加する' : '案件を追加する（管理者承認後に有効）'}
              </button>

              {projects.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                  <LucideAlertCircle size={20} className="text-gray-600" />
                  まだ案件が登録されていません
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500">▼ 案件をクリックするとワークスペースで詳細を確認できます</p>
                  {projects.map(p => {
                    const pEsts = estimates.filter(e => e.projectId === p.projectId);
                    const pCts  = contracts.filter(c => c.projectId === p.projectId);
                    return (
                      <ProjectCard
                        key={p.projectId}
                        project={p}
                        onWorkspace={() => onOpenWorkspace(p, 'overview')}
                        onEdit={isManagerLike ? () => setEditingProject(p) : undefined}
                        estimateCount={pEsts.length}
                        pendingApprovalCount={pEsts.filter(e => e.approvalStatus === 'pending_approval').length}
                        contractCount={pCts.length}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── LTV分析タブ ── */}
          {activeTab === 'ltv' && (
            <div className="space-y-4">

              {/* フォローアップ推奨 */}
              {completedProjects.length > 0 && daysSinceLastCompletion >= 180 && (
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 flex items-start gap-2.5">
                  <LucideAlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-300">LTV フォローアップ推奨</p>
                    <p className="text-[11px] text-amber-200/70 mt-0.5">
                      最後の完工から <span className="font-bold text-amber-300">{daysSinceLastCompletion} 日</span> 経過。再アプローチの好機です。
                    </p>
                  </div>
                </div>
              )}

              {/* LTVサマリ 3カード */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#0B132B] border border-gray-800 rounded-xl p-3 text-center">
                  <span className="text-[9px] text-gray-500 block mb-1">完工済み受注</span>
                  <span className="text-sm font-extrabold text-[#E6C687] font-mono block">¥{completedLtv.toLocaleString()}</span>
                  <span className="text-[9px] text-gray-600 mt-1 block">{completedProjects.length}件完工</span>
                </div>
                <div className="bg-[#0B132B] border border-gray-800 rounded-xl p-3 text-center">
                  <span className="text-[9px] text-gray-500 block mb-1">進行中見込み</span>
                  <span className="text-sm font-extrabold text-blue-400 font-mono block">¥{activeLtv.toLocaleString()}</span>
                  <span className="text-[9px] text-gray-600 mt-1 block">{activeProjects.length}件進行中</span>
                </div>
                <div className="bg-[#0B132B] border border-emerald-800/40 rounded-xl p-3 text-center">
                  <span className="text-[9px] text-gray-500 block mb-1">総見込みLTV</span>
                  <span className="text-sm font-extrabold text-emerald-400 font-mono block">¥{totalExpectedLtv.toLocaleString()}</span>
                  <span className="text-[9px] text-gray-600 mt-1 block">失注除く全案件</span>
                </div>
              </div>

              {/* 入金サマリ */}
              {paymentSummary.totalBilled > 0 && (
                <div className="bg-[#0B132B] border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1.5">
                    <LucideCheck size={11} className="text-emerald-400" /> 入金サマリ
                  </p>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-gray-400">入金済み</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      ¥{paymentSummary.totalPaid.toLocaleString()} / ¥{paymentSummary.totalBilled.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{ width: `${paymentSummary.totalBilled > 0 ? Math.round((paymentSummary.totalPaid / paymentSummary.totalBilled) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-gray-600 mt-1 text-right">
                    {paymentSummary.totalBilled > 0 ? Math.round((paymentSummary.totalPaid / paymentSummary.totalBilled) * 100) : 0}% 回収済み
                  </p>
                </div>
              )}

              {/* 案件別受注金額バーチャート */}
              <div className="bg-[#0B132B] border border-gray-800 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 mb-3 flex items-center gap-1.5">
                  <LucideActivity size={11} className="text-[#C5A059]" /> 案件別 受注金額
                </p>
                {projects.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">案件データがありません</p>
                ) : (
                  <div className="space-y-3">
                    {sortedByActivity.map(p => {
                      const barPct = maxAmount > 0 ? Math.round((p.amount / maxAmount) * 100) : 0;
                      const barColor =
                        p.status === 'completed'   ? 'bg-[#C5A059]' :
                        p.status === 'lost'        ? 'bg-gray-600' :
                        p.status === 'contract' || p.status === 'construction' ? 'bg-blue-600' :
                        'bg-indigo-700';
                      return (
                        <div key={p.projectId}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-white truncate max-w-[55%] leading-snug">{p.title}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[p.status]}`}>
                                {STATUS_LABEL[p.status]}
                              </span>
                              <span className={`text-[11px] font-mono font-bold ${p.status === 'completed' ? 'text-[#E6C687]' : p.status === 'lost' ? 'text-gray-500' : 'text-blue-300'}`}>
                                ¥{(p.amount || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
                          </div>
                          <p className="text-[9px] text-gray-600 mt-0.5">
                            {new Date(p.lastActivityAt).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── 訪問ログタブ ── */}
          {activeTab === 'logs' && (
            <div className="relative border-l border-gray-700 pl-4 ml-2 space-y-4">
              {sortedLogs.length === 0 ? (
                <p className="text-xs text-gray-500 italic">まだ訪問履歴はありません。</p>
              ) : sortedLogs.map(log => (
                <div key={log.logId} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#111A35] ${log.type === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div className="bg-[#0B132B] p-3 rounded border border-gray-800 text-xs">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span className="font-bold">
                        {log.type === 'in' ? <span className="text-emerald-400">🟢 到着 (IN)</span> : <span className="text-rose-400">🔴 退室 (OUT)</span>}
                        {' '}— {log.userName}
                        {log.duration != null && <span className="text-gray-500 ml-2">({Math.floor(log.duration / 60)}分{log.duration % 60}秒)</span>}
                      </span>
                      <span>{new Date(log.timestamp).toLocaleString('ja-JP')}</span>
                    </div>
                    {log.structuredData && typeof log.structuredData === 'object' ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {([['顧客の課題', log.structuredData.customerIssue], ['キーマンの反応', log.structuredData.keymanReaction], ['予算感', log.structuredData.budget], ['次回アクション', log.structuredData.nextAction]] as [string, unknown][]).map(([label, val]) => (
                          val != null && val !== '' ? (
                            <div key={label} className="bg-[#111A35] p-2 rounded border border-gray-800">
                              <span className="text-[9px] text-gray-500 block">{label}</span>
                              <span className="text-white leading-snug">{String(val)}</span>
                            </div>
                          ) : null
                        ))}
                      </div>
                    ) : log.voiceText ? (
                      <p className="text-gray-300 font-mono whitespace-pre-wrap bg-[#111A35] p-2 rounded mt-1.5 border border-gray-800 leading-relaxed">{log.voiceText}</p>
                    ) : (
                      log.location ? null : <p className="text-gray-500 italic text-xs">報告内容なし</p>
                    )}
                    {/* GPS地図ボタン */}
                    {log.location && (
                      <a
                        href={`https://maps.google.com/?q=${log.location.lat},${log.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/30 border border-blue-700/30 rounded-lg px-2.5 py-1 mt-1 transition"
                      >
                        <LucideMapPin size={11} /> 訪問地点を地図で確認
                      </a>
                    )}
                    {log.photoUrls && log.photoUrls.length > 0 && (
                      <div className="mt-2">
                        <button onClick={() => togglePhotos(log.logId)} className="flex items-center gap-1.5 text-[10px] text-[#C5A059] hover:text-[#E6C687] transition-colors">
                          <LucideCamera size={11} /> 現場写真 {log.photoUrls.length}枚
                          {expandedPhotos.has(log.logId) ? <LucideChevronUp size={10} /> : <LucideChevronDown size={10} />}
                        </button>
                        {expandedPhotos.has(log.logId) && (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {log.photoUrls.map((url, pi) => (
                              <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={`写真${pi + 1}`} className="h-16 w-16 object-cover rounded border border-gray-700 hover:brightness-110 transition-colors" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 案件追加ダイアログ */}
      {showAddProject && (
        <AddProjectDialog
          customer={customer}
          staffList={staffList}
          currentRole={currentRole}
          currentUserName={currentUserName}
          onClose={() => setShowAddProject(false)}
          onCreated={msg => { onShowToast(msg); setShowAddProject(false); }}
        />
      )}

      {/* 案件編集ダイアログ */}
      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          staffList={staffList}
          onClose={() => setEditingProject(null)}
          onSaved={msg => { onShowToast(msg); setEditingProject(null); }}
        />
      )}

      {/* ※ 見積/契約モーダルは E-2 で ProjectWorkspaceModal に統合済み
           → onOpenWorkspace(project, 'estimates'|'contracts') で開く */}
    </div>
  );
}
