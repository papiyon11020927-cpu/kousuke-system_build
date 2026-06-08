import { useState, useMemo, useEffect } from 'react';
import {
  LucideSearch, LucideFolder, LucideX, LucideLayoutList,
} from 'lucide-react';
import type {
  Customer, Project, InOutLog, ProjectStatus, UserRole,
  Estimate, Contract, EstimateTemplate,
  Vendor, VendorQuoteRequest,
} from '@/types';
import type { WorkspaceSection } from '@/types';
import {
  ProjectWorkspaceModal,
  STATUS_LABEL,
  STATUS_COLOR,
} from './DatabasePage';

// ─────────────────────────────────────────────────────────────
// ステータス優先順（左パネルリストの並び順）
// ─────────────────────────────────────────────────────────────
const STATUS_PRIORITY: Record<ProjectStatus, number> = {
  construction: 0,
  settlement:   1,
  contract:     2,
  estimate:     3,
  lead:         4,
  completed:    5,
  closed:       6,
  lost:         7,
};

const ALL_STATUSES: ProjectStatus[] = [
  'lead', 'estimate', 'contract', 'construction', 'completed', 'settlement', 'closed', 'lost',
];

/** 'active' = 完工以外の全ステータス（初期フィルタ用） */
type StatusFilter = ProjectStatus | 'all' | 'active';

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
interface Props {
  projects:             Project[];
  customers:            Customer[];
  logs:                 InOutLog[];
  estimates:            Estimate[];
  contracts:            Contract[];
  estimateTemplates:    EstimateTemplate[];
  vendors?:             Vendor[];
  vendorQuoteRequests?: VendorQuoteRequest[];
  staffList:            string[];
  currentRole:          UserRole;
  currentUserName:      string;
  currentUserId?:       string;
  onShowToast:          (msg: string) => void;
  /** 他タブからのジャンプ時: 自動選択するプロジェクト ID */
  initialProjectId?:    string;
  /** 他タブからのジャンプ時: 初期表示セクション */
  initialSection?:      WorkspaceSection;
  /** 通知からの deep-link */
  deepLinkTarget?: {
    customerId: string;
    projectId:  string;
    section:    'estimates' | 'vendor_quotes';
    itemId:     string;
  } | null;
  onDeepLinkConsumed?: () => void;
}

// ─────────────────────────────────────────────────────────────
// WorkspacePage
// ─────────────────────────────────────────────────────────────
export default function WorkspacePage({
  projects, customers, logs, estimates, contracts, estimateTemplates,
  vendors = [], vendorQuoteRequests = [],
  staffList, currentRole, currentUserName, currentUserId,
  onShowToast,
  initialProjectId, initialSection,
  deepLinkTarget, onDeepLinkConsumed,
}: Props) {

  // ── 選択中案件 ─────────────────────────────────────────────
  const [selectedId,      setSelectedId]      = useState<string | null>(initialProjectId ?? null);
  const [selectedSection, setSelectedSection] = useState<WorkspaceSection>(initialSection ?? 'overview');
  // モバイル表示: 'list' | 'detail'
  const [mobileView,      setMobileView]      = useState<'list' | 'detail'>(
    initialProjectId ? 'detail' : 'list',
  );

  // ── 左パネル: 検索・フィルター ─────────────────────────────
  const [searchText,    setSearchText]    = useState('');
  // 初期フィルタ: 完工以外（完工案件はフォローアップ不要のため）
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('active');

  // 外部からのジャンプ（initialProjectId が変わったとき）
  useEffect(() => {
    if (!initialProjectId) return;
    setSelectedId(initialProjectId);
    setSelectedSection(initialSection ?? 'overview');
    setMobileView('detail');
  }, [initialProjectId, initialSection]);

  // deep-link 処理（通知クリック）
  useEffect(() => {
    if (!deepLinkTarget) return;
    setSelectedId(deepLinkTarget.projectId);
    setSelectedSection('estimates');
    setMobileView('detail');
    onDeepLinkConsumed?.();
  }, [deepLinkTarget]);

  // ── 派生データ ─────────────────────────────────────────────
  const selectedProject = useMemo(
    () => projects.find(p => p.projectId === selectedId) ?? null,
    [projects, selectedId],
  );
  const selectedCustomer = useMemo(
    () => selectedProject
      ? customers.find(c => c.customerId === selectedProject.customerId) ?? null
      : null,
    [customers, selectedProject],
  );

  // カスタマー名マップ（左パネル表示用）
  const customerMap = useMemo(
    () => new Map(customers.map(c => [c.customerId, c])),
    [customers],
  );

  // ── 営業・現場権限は自分の担当案件のみ表示 ─────────────────
  const myProjects = useMemo(() => {
    if (currentRole !== 'staff') return projects;
    // assignees 配列にも自分の名前があれば含める
    return projects.filter(p =>
      p.assignee === currentUserName ||
      (p.assignees ?? []).some(a => a.name === currentUserName),
    );
  }, [projects, currentRole, currentUserName]);

  // フィルタ＋ソート済み案件リスト
  const filteredProjects = useMemo(() => {
    const q = searchText.toLowerCase();
    return [...myProjects]
      .filter(p => {
        // ステータスフィルタ（'active' = 完工・失注以外）
        if (statusFilter === 'active' && (p.status === 'completed' || p.status === 'lost')) return false;
        if (statusFilter !== 'all' && statusFilter !== 'active' && p.status !== statusFilter) return false;
        // テキスト検索
        if (!q) return true;
        const cust = customerMap.get(p.customerId);
        return (
          p.title.toLowerCase().includes(q) ||
          (cust?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const pd = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (pd !== 0) return pd;
        return b.lastActivityAt.localeCompare(a.lastActivityAt);
      });
  }, [myProjects, customerMap, searchText, statusFilter]);

  // ── ハンドラ ───────────────────────────────────────────────
  const handleSelectProject = (p: Project) => {
    setSelectedId(p.projectId);
    setSelectedSection('overview');
    setMobileView('detail');
  };

  // ─────────────────────────────────────────────────────────────
  // 左パネル: 案件リスト
  // ─────────────────────────────────────────────────────────────
  const LeftPanel = (
    <div className="flex flex-col bg-[#111A35] border-r border-gray-800 md:rounded-l-xl overflow-hidden h-full">

      {/* ── 検索バー ── */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-800 space-y-2 shrink-0">
        <div className="relative">
          <LucideSearch
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            size={13}
          />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="案件・顧客名で検索…"
            className="w-full bg-[#0A0F1D] border border-gray-700 focus:border-[#C5A059] text-white text-xs pl-8 pr-3 py-2 rounded-lg outline-none transition-colors"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <LucideX size={11} />
            </button>
          )}
        </div>

        {/* ステータスフィルターチップ */}
        <div className="flex gap-1 flex-wrap">
          {/* 完工・失注以外（デフォルト） */}
          <button
            onClick={() => setStatusFilter('active')}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              statusFilter === 'active'
                ? 'bg-[#C5A059] text-[#0A0F1D] font-bold'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            進行中 ({myProjects.filter(p => p.status !== 'completed' && p.status !== 'lost').length})
          </button>
          {/* 全て */}
          <button
            onClick={() => setStatusFilter('all')}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              statusFilter === 'all'
                ? 'bg-[#C5A059] text-[#0A0F1D] font-bold'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            全て ({myProjects.length})
          </button>
          {/* 個別ステータス */}
          {ALL_STATUSES.map(s => {
            const count = myProjects.filter(p => p.status === s).length;
            if (count === 0) return null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'active' : s)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  statusFilter === s
                    ? STATUS_COLOR[s] + ' font-bold ring-1 ring-white/20'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {STATUS_LABEL[s]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 案件リスト ── */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/50">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600 gap-2">
            <LucideFolder size={28} />
            <p className="text-xs">案件が見つかりません</p>
          </div>
        ) : (
          filteredProjects.map(p => {
            const cust = customerMap.get(p.customerId);
            const isSelected = p.projectId === selectedId;
            const projEsts = estimates.filter(e => e.projectId === p.projectId);
            const projCts  = contracts.filter(c => c.projectId === p.projectId);
            const pendingEst = projEsts.filter(e => e.approvalStatus === 'pending_approval').length;
            const pendingCt  = projCts.filter(c => c.approvalStatus  === 'pending_approval').length;
            const projectPending = p.projectApprovalStatus === 'needs_approval' ? 1 : 0;
            const hasPending = pendingEst + pendingCt + projectPending > 0;

            return (
              <button
                key={p.projectId}
                onClick={() => handleSelectProject(p)}
                className={`w-full text-left px-3 py-3 flex flex-col gap-1.5 transition-colors
                  ${isSelected
                    ? 'bg-[#1C2C54] border-l-2 border-[#C5A059]'
                    : 'hover:bg-[#0A0F1D] border-l-2 border-transparent'
                  }`}
              >
                {/* 顧客名 + ステータスバッジ */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-gray-500 truncate min-w-0">
                    {cust?.name ?? '—'} 様
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasPending && (
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" title="承認待ちあり" />
                    )}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                </div>

                {/* 案件名 */}
                <p className={`text-xs font-semibold truncate leading-snug
                  ${isSelected ? 'text-[#E6C687]' : 'text-white'}`}>
                  {p.title}
                </p>

                {/* 金額 + 見積/契約件数 */}
                <div className="flex items-center gap-2">
                  {p.amount > 0 && (
                    <span className="text-[10px] text-[#C5A059] font-mono">
                      ¥{p.amount.toLocaleString()}
                    </span>
                  )}
                  {(projEsts.length > 0 || projCts.length > 0) && (
                    <span className="text-[9px] text-gray-600">
                      見積{projEsts.length} 契約{projCts.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // 右パネル: 案件詳細（WorkspaceModal panel モード）
  // ─────────────────────────────────────────────────────────────
  const RightPanel = selectedProject && selectedCustomer ? (
    <ProjectWorkspaceModal
      key={selectedProject.projectId}
      mode="panel"
      onBack={() => setMobileView('list')}
      project={selectedProject}
      customer={selectedCustomer}
      estimates={estimates.filter(e => e.projectId === selectedProject.projectId)}
      allEstimates={estimates}
      contracts={contracts.filter(c => c.projectId === selectedProject.projectId)}
      logs={logs}
      estimateTemplates={estimateTemplates}
      vendors={vendors}
      vendorQuoteRequests={vendorQuoteRequests}
      staffList={staffList}
      currentRole={currentRole}
      currentUserName={currentUserName}
      currentUserId={currentUserId}
      onClose={() => setSelectedId(null)}
      onShowToast={onShowToast}
      initialSection={selectedSection}
      deepLinkTarget={deepLinkTarget ?? undefined}
      onDeepLinkConsumed={onDeepLinkConsumed}
    />
  ) : (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3 bg-[#0A0F1D]/50 border-l border-gray-800/50">
      <LucideLayoutList size={36} className="text-gray-700" />
      <p className="text-sm text-gray-500">左の一覧から案件を選択</p>
      <p className="text-xs text-gray-600">顧客カルテから案件をクリックしても開けます</p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // レイアウト: PC = 左右分割 / モバイル = ドリルダウン
  // どちらも通常カード枠（ページ幅を超えない）
  // ─────────────────────────────────────────────────────────────
  const cardHeight = 'h-[calc(100vh-11rem)] min-h-[400px]';

  return (
    <div className={`bg-[#111A35] border border-gray-800 rounded-xl shadow-xl overflow-hidden flex ${cardHeight}`}>

      {/* ── PC: 左右分割 ── */}
      <div className="hidden md:flex w-full h-full">
        {/* 左パネル: 固定幅 */}
        <div className="w-64 lg:w-72 shrink-0 h-full">
          {LeftPanel}
        </div>
        {/* 右パネル: 残り幅 */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          {RightPanel}
        </div>
      </div>

      {/* ── モバイル: ドリルダウン ── */}
      <div className="flex md:hidden w-full h-full">
        {mobileView === 'list' ? (
          <div className="w-full h-full">
            {LeftPanel}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            {RightPanel}
          </div>
        )}
      </div>
    </div>
  );
}
