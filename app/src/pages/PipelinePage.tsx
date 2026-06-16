/**
 * PipelinePage — 案件パイプライン（カンバンビュー）
 *
 * ステータスフロー:
 *   引き合い → 見積提出 → 契約済 → 施工中 → 完工 → 精算中 → [クローズ]
 *   どの段階からでも → 失注
 *
 * 表示列: 引き合い / 見積提出 / 契約済 / 施工中 / 完工 / 精算中
 * 「クローズ」「失注」は ⋯ メニューからのみ遷移（アーカイブ扱い）
 * 右端に「期日超過」仮想列: 完工予定日を超過しているのに精算中になっていない案件
 * PC : カードをドラッグ＆ドロップでステータス変更
 */
import { useState, useMemo, memo } from 'react';
import {
  LucideLayoutDashboard, LucideChevronRight, LucideCheck, LucideUser,
  LucideMic, LucideSquare, LucideAlertTriangle, LucideClock,
} from 'lucide-react';
import type { Project, Customer, Estimate, Contract, ProjectStatus, UserRole } from '@/types';
import { updateProjectStatus, setLostReason } from '@/services/projectService';
import { validateStatusTransition } from '@/utils/statusValidation';

// ─── 定数 ────────────────────────────────────────────────────────

/** パイプライン表示列（クローズ・失注は除外） */
const PIPELINE_STATUSES: ProjectStatus[] = [
  'lead', 'estimate', 'contract', 'construction', 'completed', 'settlement',
];

/** ステータス変更メニューには全ステータスを表示 */
const ALL_STATUSES: ProjectStatus[] = [
  'lead', 'estimate', 'contract', 'construction', 'completed', 'settlement', 'closed', 'lost',
];

const STATUS_CFG: Record<ProjectStatus, {
  label:     string;
  headCls:   string;
  dropCls:   string;
  cardCls:   string;
  borderCls: string;
}> = {
  lead:         { label: '引き合い', headCls: 'bg-gray-800 text-gray-300',            dropCls: 'bg-gray-800/40',     cardCls: 'bg-[#131C38] border-gray-700',        borderCls: 'border-gray-700'       },
  estimate:     { label: '見積提出', headCls: 'bg-yellow-900/60 text-yellow-300',     dropCls: 'bg-yellow-900/20',   cardCls: 'bg-[#1C1808] border-yellow-900/40',   borderCls: 'border-yellow-900/40'  },
  contract:     { label: '契約済',   headCls: 'bg-blue-900/60 text-blue-300',         dropCls: 'bg-blue-900/20',     cardCls: 'bg-[#080E1F] border-blue-900/40',     borderCls: 'border-blue-900/40'    },
  construction: { label: '施工中',   headCls: 'bg-emerald-900/60 text-emerald-300',   dropCls: 'bg-emerald-900/20',  cardCls: 'bg-[#071510] border-emerald-900/40',  borderCls: 'border-emerald-900/40' },
  completed:    { label: '完工',     headCls: 'bg-sky-900/60 text-sky-300',           dropCls: 'bg-sky-900/20',      cardCls: 'bg-[#060E18] border-sky-900/40',      borderCls: 'border-sky-900/40'     },
  settlement:   { label: '精算中',   headCls: 'bg-violet-900/60 text-violet-300',     dropCls: 'bg-violet-900/20',   cardCls: 'bg-[#0D0714] border-violet-900/40',   borderCls: 'border-violet-900/40'  },
  closed:       { label: 'クローズ', headCls: 'bg-teal-900/60 text-teal-300',         dropCls: 'bg-teal-900/20',     cardCls: 'bg-[#051210] border-teal-900/40',     borderCls: 'border-teal-900/40'    },
  lost:         { label: '失注',     headCls: 'bg-red-950/60 text-red-400',           dropCls: 'bg-red-950/20',      cardCls: 'bg-[#130808] border-red-900/30',      borderCls: 'border-red-900/30'     },
};

// 次ステータスへの遷移マップ
const NEXT_STATUS: Partial<Record<ProjectStatus, { status: ProjectStatus; label: string }>> = {
  lead:         { status: 'estimate',     label: '見積提出へ' },
  estimate:     { status: 'contract',     label: '契約へ'     },
  contract:     { status: 'construction', label: '着工へ'     },
  construction: { status: 'completed',   label: '完工へ'     },
  completed:    { status: 'settlement',  label: '精算へ'     },
  settlement:   { status: 'closed',      label: 'クローズ'   },
};

// ─── ユーティリティ ──────────────────────────────────────────────

function relativeTime(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return '今日';
  if (d === 1) return '昨日';
  if (d <  7) return `${d}日前`;
  if (d < 30) return `${Math.floor(d / 7)}週間前`;
  return `${Math.floor(d / 30)}ヶ月前`;
}

function fmtMan(yen: number): string {
  if (yen === 0) return '';
  const man = yen / 10000;
  return `¥${man % 1 === 0 ? man.toLocaleString() : man.toFixed(1)}万`;
}

// ─── 失注理由ダイアログ ──────────────────────────────────────────

function LostReasonDialog({
  projectTitle,
  onConfirm,
  onCancel,
}: {
  projectTitle: string;
  onConfirm:   (reason: string) => Promise<void>;
  onCancel:    () => void;
}) {
  const [reason,      setReason]      = useState('');
  const [recording,   setRecording]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('このブラウザは音声入力に対応していません'); return; }
    const rec = new SR();
    rec.lang = 'ja-JP';
    rec.continuous = false;
    rec.onresult = (e: any) => setReason(prev => (prev ? prev + '　' : '') + e.results[0][0].transcript);
    rec.onend    = () => setRecording(false);
    rec.onerror  = () => setRecording(false);
    setRecording(true);
    rec.start();
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    await onConfirm(reason.trim());
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#111A35] border border-red-700/40 rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
          <LucideAlertTriangle size={15} /> 失注理由の入力
        </h3>
        <p className="text-xs text-gray-400">「{projectTitle}」を失注に変更します。</p>
        <div className="space-y-2">
          <label className="text-xs text-gray-400 block">失注理由（任意）</label>
          <div className="relative">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="例: 予算超過、競合他社に決定 など"
              rows={3}
              className="w-full bg-[#0B132B] border border-gray-700 focus:border-red-600 text-white text-xs rounded-lg px-3 py-2 focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={startVoice}
            disabled={recording}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              recording
                ? 'bg-red-900/40 border-red-700 text-red-300 animate-pulse'
                : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'
            }`}
          >
            {recording ? <LucideSquare size={11} /> : <LucideMic size={11} />}
            {recording ? '録音中...' : '音声入力'}
          </button>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 border border-gray-700 text-gray-400 text-xs py-2 rounded-lg hover:border-gray-500 transition-colors">
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-[2] bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
            {submitting ? '処理中...' : <><LucideCheck size={11} /> 失注として確定</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── カンバンカード ──────────────────────────────────────────────

const KanbanCard = memo(function KanbanCard({
  project,
  customer,
  showAssignee,
  overdueDays,
  onStatusChange,
  onCardClick,
  isDragging,
}: {
  project:        Project;
  customer?:      Customer;
  showAssignee:   boolean;
  overdueDays?:   number;   // 期日超過列: 何日超過か
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
  onCardClick:    (projectId: string) => void;
  isDragging:     boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [hovered, setHovered]   = useState(false);
  const cfg  = STATUS_CFG[project.status];
  const next = NEXT_STATUS[project.status];

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('projectId', project.projectId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onCardClick(project.projectId)}
      data-status={project.status}
      className={`
        relative rounded-lg border ${cfg.cardCls}
        p-3 cursor-pointer select-none pl-card
        ${hovered ? 'pl-hovered' : ''}
        transition-colors
        ${isDragging ? 'opacity-30 scale-95' : ''}
      `}
    >
      {/* 超過日数バッジ（期日超過列のみ） */}
      {overdueDays != null && overdueDays > 0 && (
        <div className="absolute top-2 right-2 bg-amber-700/60 text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
          <LucideClock size={8} /> {overdueDays}日超過
        </div>
      )}

      {/* 期日超過列: 現ステータスバッジ */}
      {overdueDays != null && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold mb-1 inline-block ${STATUS_CFG[project.status].headCls}`}>
          {STATUS_CFG[project.status].label}
        </span>
      )}

      {/* 顧客名 ＋ 案件名 */}
      <p className="text-[11px] text-gray-500 truncate">{customer?.name ?? '—'}&ensp;様</p>
      <p className="text-sm font-bold text-white mt-0.5 leading-snug line-clamp-2">{project.title}</p>

      {/* 金額 */}
      {project.amount > 0 && (
        <p className="text-xs font-mono text-[#C5A059] mt-1.5">{fmtMan(project.amount)}</p>
      )}

      {/* メタ情報行 */}
      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
        {showAssignee && (
          <span className="flex items-center gap-0.5">
            <LucideUser size={9} /> {project.assignee}
          </span>
        )}
        {project.probability != null && (
          <span className="ml-auto shrink-0">{project.probability}%</span>
        )}
        <span className="ml-auto shrink-0">{relativeTime(project.lastActivityAt)}</span>
      </div>

      {/* アクション行 */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-800/60">
        {next ? (
          <button
            onClick={e => { e.stopPropagation(); onStatusChange(project.projectId, next.status); }}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] text-gray-400 hover:text-emerald-300 border border-gray-700 hover:border-emerald-700/50 rounded px-1.5 py-1 transition-colors"
          >
            <LucideChevronRight size={10} /> {next.label}
          </button>
        ) : (
          <span className="flex-1" />
        )}

        {/* ステータス選択メニュー */}
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="text-[11px] text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition-colors leading-none"
          >
            ⋯
          </button>
          {showMenu && (
            <div
              className="absolute bottom-full right-0 mb-1 bg-[#1C284D] border border-gray-700 rounded-lg shadow-2xl z-20 overflow-hidden min-w-[110px]"
              onClick={e => e.stopPropagation()}
            >
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(project.projectId, s); setShowMenu(false); }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-left hover:bg-white/10 transition-colors
                    ${s === project.status ? 'text-[#C5A059] font-bold' : 'text-gray-300'}
                    ${s === 'lost'   ? 'text-red-400 hover:text-red-300'   : ''}
                    ${s === 'closed' ? 'text-teal-400 hover:text-teal-300' : ''}
                  `}
                >
                  {s === project.status && <LucideCheck size={9} className="shrink-0" />}
                  <span className={s === project.status ? '' : 'pl-[13px]'}>{STATUS_CFG[s].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── カンバン列 ──────────────────────────────────────────────────

interface ColumnProps {
  status:         ProjectStatus;
  items:          Array<{ project: Project; customer?: Customer; overdueDays?: number }>;
  showAssignee:   boolean;
  isDragOver:     boolean;
  draggingId:     string | null;
  onDragOver:     (e: React.DragEvent, s: ProjectStatus) => void;
  onDragLeave:    () => void;
  onDrop:         (e: React.DragEvent, s: ProjectStatus) => void;
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
  onCardClick:    (projectId: string) => void;
  /** 期日超過仮想列 */
  isOverdue?:       boolean;
  overdueItems?:    Array<{ project: Project; customer?: Customer; overdueDays: number }>;
}

function KanbanColumn({
  status, items, showAssignee, isDragOver, draggingId,
  onDragOver, onDragLeave, onDrop, onStatusChange, onCardClick,
  isOverdue, overdueItems,
}: ColumnProps) {
  const cfg = isOverdue
    ? { label: '期日超過', headCls: 'bg-amber-900/60 text-amber-300', dropCls: 'bg-amber-900/20', borderCls: 'border-amber-900/40' }
    : STATUS_CFG[status];
  const totalAmt     = items.reduce((s, { project: p }) => s + (p.amount ?? 0), 0);
  const displayItems = isOverdue ? (overdueItems ?? []) : items;

  return (
    <div className="w-52 shrink-0 flex flex-col" style={{ maxHeight: 'calc(100vh - 230px)' }}>
      {/* 列ヘッダー */}
      <div className={`rounded-t-lg px-3 py-2 ${cfg.headCls}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold flex items-center gap-1">
            {isOverdue && <LucideAlertTriangle size={11} />}
            {cfg.label}
          </span>
          <span className="text-[10px] font-mono bg-black/25 px-1.5 py-0.5 rounded-full">{displayItems.length}</span>
        </div>
        {totalAmt > 0 && !isOverdue && (
          <p className="text-[10px] opacity-70 mt-0.5 font-mono">{fmtMan(totalAmt)}</p>
        )}
        {isOverdue && (
          <p className="text-[10px] opacity-70 mt-0.5">精算未着手の超過案件</p>
        )}
        {status === 'settlement' && !isOverdue && (
          <p className="text-[10px] opacity-70 mt-0.5">入出金精算フェーズ</p>
        )}
      </div>

      {/* ドロップゾーン ＋ カードリスト */}
      <div
        onDragOver={e => onDragOver(e, status)}
        onDragLeave={onDragLeave}
        onDrop={e => onDrop(e, status)}
        className={`
          flex-1 overflow-y-auto space-y-2 p-2 rounded-b-lg border border-t-0
          ${cfg.borderCls}
          ${isDragOver
            ? `${cfg.dropCls} border-dashed border-2 border-opacity-100`
            : 'bg-[#0A0F1D]/40'
          }
        `}
      >
        {displayItems.map(({ project, customer, overdueDays }) => (
          <KanbanCard
            key={project.projectId}
            project={project}
            customer={customer}
            showAssignee={showAssignee}
            overdueDays={isOverdue ? (overdueDays ?? 0) : undefined}
            onStatusChange={onStatusChange}
            onCardClick={onCardClick}
            isDragging={draggingId === project.projectId}
          />
        ))}
        {displayItems.length === 0 && (
          <div className="flex items-center justify-center h-14 text-[10px] text-gray-700 border border-dashed border-gray-800 rounded-lg">
            {isOverdue ? '超過案件なし' : '案件なし'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── メインページ ────────────────────────────────────────────────

interface Props {
  projects:        Project[];
  customers:       Customer[];
  estimates:       Estimate[];
  contracts:       Contract[];
  currentRole:     UserRole;
  currentUserName: string;
  staffList:       string[];
  onShowToast:     (msg: string) => void;
  /** カード押下時にワークスペースへジャンプするコールバック */
  onCardClick:     (projectId: string) => void;
}

export default function PipelinePage({
  projects, customers, estimates, contracts,
  currentRole, currentUserName, staffList, onShowToast, onCardClick,
}: Props) {
  const isManagerLike = currentRole === 'manager' || currentRole === 'admin';

  const [staffFilter, setStaffFilter] = useState<string>(isManagerLike ? '' : currentUserName);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const [dragOver,    setDragOver]    = useState<ProjectStatus | null>(null);
  const [lostDialog,  setLostDialog]  = useState<{ projectId: string; title: string } | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // 顧客マップ
  const customerMap = useMemo(() => {
    const m: Record<string, Customer> = {};
    customers.forEach(c => { m[c.customerId] = c; });
    return m;
  }, [customers]);

  // プロジェクトごとの完工予定日
  const projectEndDateMap = useMemo(() => {
    const m: Record<string, string> = {};
    contracts.forEach(c => {
      if (!c.constructionEndDate) return;
      if (c.approvalStatus !== 'approved' && c.approvalStatus !== 'voided') return;
      const existing = m[c.projectId];
      if (!existing || c.constructionEndDate > existing) {
        m[c.projectId] = c.constructionEndDate;
      }
    });
    return m;
  }, [contracts]);

  // スタッフフィルター適用
  const filteredProjects = useMemo(() =>
    staffFilter
      ? projects.filter(p =>
          p.assignee === staffFilter ||
          (p.assignees ?? []).some(a => a.name === staffFilter))
      : projects,
  [projects, staffFilter]);

  // 期日超過仮想列: 施工中または完工済で、完工予定日超過かつ精算中になっていない案件
  const overdueItems = useMemo(() => {
    return filteredProjects
      .filter(p => {
        if (p.status !== 'construction' && p.status !== 'completed') return false;
        const endDate = projectEndDateMap[p.projectId] || p.deadline;
        return !!(endDate && endDate < today);
      })
      .map(p => {
        const endDate = projectEndDateMap[p.projectId] || p.deadline!;
        const overdueDays = Math.floor((Date.now() - new Date(endDate).getTime()) / 86400000);
        return { project: p, customer: customerMap[p.customerId], overdueDays };
      })
      .sort((a, b) => b.overdueDays - a.overdueDays);
  }, [filteredProjects, projectEndDateMap, customerMap, today]);

  const overdueIds = useMemo(
    () => new Set(overdueItems.map(i => i.project.projectId)),
    [overdueItems],
  );

  // 各ステータスにカテゴライズ（期日超過列に入ったものは除外）
  const itemsByStatus = useMemo(() => {
    const map: Partial<Record<ProjectStatus, Array<{ project: Project; customer?: Customer }>>> = {};
    PIPELINE_STATUSES.forEach(s => { map[s] = []; });
    filteredProjects.forEach(p => {
      if (!PIPELINE_STATUSES.includes(p.status)) return;
      if (overdueIds.has(p.projectId)) return; // 期日超過列に移動
      map[p.status]!.push({ project: p, customer: customerMap[p.customerId] });
    });
    PIPELINE_STATUSES.forEach(s => {
      map[s]!.sort((a, b) =>
        new Date(b.project.lastActivityAt).getTime() - new Date(a.project.lastActivityAt).getTime()
      );
    });
    return map as Record<ProjectStatus, Array<{ project: Project; customer?: Customer }>>;
  }, [filteredProjects, customerMap, overdueIds]);

  // パイプライン合計（クローズ・失注除く）
  const pipelineTotal = useMemo(() =>
    filteredProjects
      .filter(p => p.status !== 'lost' && p.status !== 'closed')
      .reduce((s, p) => s + (p.amount ?? 0), 0),
  [filteredProjects]);

  const activeCount = filteredProjects.filter(
    p => p.status !== 'lost' && p.status !== 'closed',
  ).length;

  const settlementCount = filteredProjects.filter(p => p.status === 'settlement').length;

  // ─── ステータス変更ハンドラ ──────────────────────────────────
  const handleStatusChange = (projectId: string, newStatus: ProjectStatus) => {
    const p = projects.find(x => x.projectId === projectId);
    if (!p || p.status === newStatus) return;

    // ステータス遷移バリデーション
    const projEstimates = estimates.filter(e => e.projectId === projectId);
    const projContracts = contracts.filter(c => c.projectId === projectId);
    const validation    = validateStatusTransition(newStatus, p.status, projEstimates, projContracts);
    if (!validation.ok) {
      onShowToast(validation.reason ?? 'このステータスへは変更できません');
      return;
    }

    if (newStatus === 'lost') {
      setLostDialog({ projectId, title: p.title });
      return;
    }
    updateProjectStatus(projectId, newStatus)
      .then(() => onShowToast(`「${STATUS_CFG[newStatus].label}」へ移動しました`))
      .catch(() => onShowToast('ステータスの変更に失敗しました'));
  };

  const handleLostConfirm = async (reason: string) => {
    if (!lostDialog) return;
    try {
      await updateProjectStatus(lostDialog.projectId, 'lost');
      if (reason) await setLostReason(lostDialog.projectId, reason);
      onShowToast('「失注」に変更しました');
    } catch {
      onShowToast('ステータスの変更に失敗しました');
    } finally {
      setLostDialog(null);
    }
  };

  // ─── ドラッグ＆ドロップ ──────────────────────────────────────
  const handleDragOver = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(status);
  };
  const handleDragLeave = () => setDragOver(null);
  const handleDrop = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    if (projectId) handleStatusChange(projectId, status);
    setDraggingId(null);
    setDragOver(null);
  };

  const showAssignee = isManagerLike || staffFilter === '';

  return (
    <div className="space-y-4">
      {/* 失注理由ダイアログ */}
      {lostDialog && (
        <LostReasonDialog
          projectTitle={lostDialog.title}
          onConfirm={handleLostConfirm}
          onCancel={() => setLostDialog(null)}
        />
      )}

      {/* ─── ヘッダー ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <LucideLayoutDashboard size={16} className="text-[#C5A059]" />
            案件パイプライン
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            進行中&ensp;<span className="text-white font-bold">{activeCount}</span>件&emsp;
            パイプライン合計&ensp;
            <span className="text-[#C5A059] font-mono font-bold">{fmtMan(pipelineTotal)}</span>
            {settlementCount > 0 && (
              <span className="ml-3 text-violet-400">
                精算中 <span className="font-bold">{settlementCount}</span>件
              </span>
            )}
            {overdueItems.length > 0 && (
              <span className="ml-3 text-amber-400">
                期日超過 <span className="font-bold">{overdueItems.length}</span>件
              </span>
            )}
          </p>
        </div>

        {/* 担当者フィルター（管理者のみ） */}
        {isManagerLike && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 shrink-0">担当：</label>
            <select
              value={staffFilter}
              onChange={e => setStaffFilter(e.target.value)}
              className="bg-[#111A35] border border-gray-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#C5A059]"
            >
              <option value="">全員</option>
              {staffList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ─── カンバンボード ───────────────────────────────────── */}
      <div
        className="overflow-x-auto pb-3 -mx-4 md:-mx-6 px-4 md:px-6"
        onDragEnd={() => { setDraggingId(null); setDragOver(null); }}
      >
        <div
          className="flex gap-3"
          style={{ minWidth: `${(PIPELINE_STATUSES.length + 1) * 220}px` }}
        >
          {/* メイン6列（引き合い〜精算中） */}
          {PIPELINE_STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              items={itemsByStatus[status] ?? []}
              showAssignee={showAssignee}
              isDragOver={dragOver === status}
              draggingId={draggingId}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onStatusChange={handleStatusChange}
              onCardClick={onCardClick}
            />
          ))}

          {/* 期日超過列（分割線あり） */}
          <div className="flex items-stretch gap-3">
            <div className="w-px bg-amber-700/30 self-stretch rounded-full" />
            <KanbanColumn
              status="construction"   /* isOverdue=true で上書きされるためダミー */
              items={[]}
              showAssignee={showAssignee}
              isDragOver={false}
              draggingId={draggingId}
              onDragOver={() => {}}
              onDragLeave={() => {}}
              onDrop={() => {}}
              onStatusChange={handleStatusChange}
              onCardClick={onCardClick}
              isOverdue={true}
              overdueItems={overdueItems}
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-700 text-center pb-2">
        PC: カードをドラッグ＆ドロップでステータス変更 ／ 「→」ボタンで次工程へ ／ カードをタップでワークスペースを開く
        ／ <span className="text-violet-600">精算中</span> = 入出金精算フェーズ
        ／ <span className="text-amber-600">期日超過</span> = 完工予定日を超過した未精算案件
        ／ クローズ・失注は ⋯ メニューから変更
      </p>
    </div>
  );
}
