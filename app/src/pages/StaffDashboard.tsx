import { useMemo, useState } from 'react';
import {
  LucideTrendingUp, LucideMapPin, LucideFileText,
  LucideSparkles, LucideArrowRight, LucideBell, LucideCheckCheck,
  LucideAlertCircle, LucideAlertTriangle, LucideClock, LucideBuilding2, LucideUsers,
  LucideCircleAlert, LucideCheck,
} from 'lucide-react';
import type { Customer, Project, Schedule, AppNotification, Contract, VendorQuoteRequest, DashboardTodo } from '@/types';
import { calcKpi, calcPriorityRecs, calcDashboardTodos, type PriorityRec } from '@/services/kpiService';

type ActiveTab = 'dashboard' | 'calendar' | 'database' | 'goals' | 'report' | 'masters';

interface Props {
  customers:           Customer[];
  projects:            Project[];
  schedules:           Schedule[];
  contracts:           Contract[];
  vendorQuoteRequests: VendorQuoteRequest[];
  selectedStaff:       string;
  onShowToast:         (msg: string) => void;
  notifications:           AppNotification[];
  currentUserId:           string | null;
  onNotificationRead:      (id: string) => void;
  onNotificationClick:     (n: AppNotification) => void;
  onTabChange:             (tab: ActiveTab) => void;
  /** true の場合、通知・TODO・未入金などのバナーを表示しない（管理者ダッシュボードに統合表示する際、上位の ManagerDashboard 側のバナーと重複させないため） */
  hideBanners?:            boolean;
}

export default function StaffDashboard({ customers, projects, schedules, contracts, vendorQuoteRequests, selectedStaff, onShowToast, notifications, currentUserId, onNotificationRead, onNotificationClick, onTabChange, hideBanners = false }: Props) {
  const [showAllNotifs, setShowAllNotifs] = useState(false);

  const kpi = useMemo(
    () => calcKpi(selectedStaff, projects, schedules),
    [selectedStaff, projects, schedules],
  );

  const recs = useMemo(
    () => calcPriorityRecs(selectedStaff, projects, customers, schedules),
    [selectedStaff, projects, customers, schedules],
  );

  const unread = useMemo(
    () => notifications.filter(n => currentUserId && !n.readBy.includes(currentUserId)),
    [notifications, currentUserId],
  );

  const todos = useMemo(
    () => calcDashboardTodos(contracts, vendorQuoteRequests, projects, customers, selectedStaff, false),
    [contracts, vendorQuoteRequests, projects, customers, selectedStaff],
  );

  // 未入金アラート：入金予定月が過ぎたのに未入金の支払条件
  const overduePayments = useMemo(() => {
    const currentYM = new Date().toISOString().slice(0, 7); // "2026-06"
    return contracts
      .filter(c => c.approvalStatus === 'approved' && c.staffName === selectedStaff)
      .flatMap(c =>
        (c.paymentTerms ?? [])
          .filter(t => !t.isPaid && t.scheduledDate)
          .map(t => ({
            contractId:   c.contractId,
            customerName: c.customerName,
            projectTitle: c.projectTitle,
            termName:     t.termName,
            amount:       t.amount,
            scheduledDate: t.scheduledDate!,
            isOverdue:    t.scheduledDate! < currentYM,
            isDueThisMonth: t.scheduledDate! === currentYM,
          }))
          .filter(item => item.isOverdue || item.isDueThisMonth)
      )
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, [contracts, selectedStaff]);

  return (
    <div className="space-y-6">

      {/* ─── 未入金アラート ─── */}
      {!hideBanners && overduePayments.length > 0 && (
        <OverduePaymentsBanner items={overduePayments} onTabChange={onTabChange} />
      )}

      {/* ─── TODO バナー ─── */}
      {!hideBanners && todos.length > 0 && (
        <TodoBanner todos={todos} onTabChange={onTabChange} />
      )}

      {/* ─── 通知バナー（未読のみ表示・既読で非表示） ─── */}
      {!hideBanners && unread.length > 0 && (
        <div className="bg-[#111A35] border border-[#C5A059]/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <div className="flex items-center gap-2 text-xs font-bold text-[#E6C687]">
              <LucideBell size={13} className="text-[#C5A059]" />
              お知らせ
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {unread.length}件未読
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAllNotifs(p => !p)}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showAllNotifs ? '未読のみ' : `全${notifications.length}件`}
              </button>
              <button
                onClick={() => unread.forEach(n => onNotificationRead(n.notificationId))}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#E6C687] transition-colors"
              >
                <LucideCheckCheck size={11} /> 全既読
              </button>
            </div>
          </div>
          <ul className="divide-y divide-gray-800/60 max-h-48 overflow-y-auto">
            {[...(showAllNotifs ? notifications : unread)]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 8)
              .map(n => {
                const isUnread = currentUserId && !n.readBy.includes(currentUserId);
                const elapsed = (() => {
                  const diff = Date.now() - new Date(n.createdAt).getTime();
                  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
                  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
                  return `${Math.floor(diff / 86400000)}日前`;
                })();
                return (
                  <li key={n.notificationId}
                    className={`px-4 py-2.5 flex items-start gap-2 hover:bg-[#1C2C54]/40 transition-colors ${isUnread ? 'bg-[#1C2C54]/20' : 'opacity-50'}`}
                  >
                    {isUnread && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onNotificationClick(n)}>
                      <p className={`text-xs ${isUnread ? 'text-white font-semibold' : 'text-gray-400'} truncate`}>{n.title}</p>
                      <p className="text-[11px] text-gray-500 truncate">{n.body}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{elapsed}</p>
                    </div>
                    {isUnread && (
                      <button
                        onClick={() => onNotificationRead(n.notificationId)}
                        title="既読にする"
                        className="shrink-0 mt-0.5 h-5 w-5 rounded-full border border-gray-700 hover:border-emerald-500 hover:text-emerald-400 text-gray-600 flex items-center justify-center transition-colors"
                      >
                        <LucideCheck size={10} />
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* KPIボード */}
      <div className="bg-[#131F3F] border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#C5A059] to-[#0B132B]" />
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-extrabold text-[#E6C687] tracking-wider flex items-center gap-2">
            <LucideTrendingUp size={16} />
            {selectedStaff} 今月の目標・KPI達成度
          </h3>
          <span className="text-[11px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            リアルタイム更新中
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiBar
            label="売上達成度" rate={kpi.salesRate}
            actual={kpi.actualSales} goal={kpi.salesGoal}
            barClass="from-[#C5A059] to-[#E6C687]" rateColor="text-[#E6C687]"
          />
          <KpiBar
            label="粗利達成度" rate={kpi.profitRate}
            actual={kpi.actualProfit} goal={kpi.profitGoal}
            barClass="from-cyan-500 to-emerald-400" rateColor="text-cyan-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
          <CountStat
            icon={<LucideMapPin size={18} />} label="現調 / 洗浄数"
            actual={kpi.actualSurveyCount} goal={kpi.surveyGoal}
            colorClass="bg-indigo-950 text-indigo-400 border border-indigo-900"
          />
          <CountStat
            icon={<LucideFileText size={18} />} label="見積提出数"
            actual={kpi.actualEstimateCount} goal={kpi.estimateGoal}
            colorClass="bg-purple-950 text-purple-400 border border-purple-900"
          />
        </div>
      </div>

      {/* 優先フォロー案件 */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold text-white tracking-wider flex items-center gap-1.5">
            <LucideSparkles className="text-[#C5A059]" size={16} />
            本日動くべき「優先フォロー案件」
          </h3>
          <span className="text-xs bg-[#C5A059]/10 text-[#E6C687] px-2 py-0.5 rounded border border-[#C5A059]/20 font-mono">
            {recs.length} 件
          </span>
        </div>

        <div className="space-y-3">
          {recs.length === 0 ? (
            <p className="text-center py-8 text-gray-500 text-xs">優先フォローが必要な案件はありません。</p>
          ) : (
            recs.map((rec, i) => (
              <RecCard key={i} rec={rec} onNavigate={() => onShowToast(`${rec.project.projectId} の報告ページへ移動します（Phase 2 実装予定）`)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── サブコンポーネント ─────────────────────────────────────

function KpiBar({ label, rate, actual, goal, barClass, rateColor }: {
  label: string; rate: number; actual: number; goal: number;
  barClass: string; rateColor: string;
}) {
  return (
    <div className="bg-[#0B132B] p-4 rounded-lg border border-gray-800">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={`font-bold ${rateColor}`}>{rate}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-3 mb-2 overflow-hidden">
        <div
          className={`bg-gradient-to-r ${barClass} h-3 rounded-full transition-all duration-1000`}
          style={{ width: `${rate}%` }}
        />
      </div>
      <div className="flex justify-between items-end">
        <span className="text-xs text-gray-400">実績: <strong className="text-white text-sm">¥{actual.toLocaleString()}</strong></span>
        <span className="text-xs text-gray-400">目標: ¥{goal.toLocaleString()}</span>
      </div>
    </div>
  );
}

function CountStat({ icon, label, actual, goal, colorClass }: {
  icon: React.ReactNode; label: string; actual: number; goal: number; colorClass: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClass}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm font-bold text-white">
          {actual} <span className="text-xs text-gray-500">/ 目標 {goal} 件</span>
        </div>
      </div>
    </div>
  );
}

function RecCard({ rec, onNavigate }: { rec: PriorityRec; onNavigate: () => void }) {
  const bgMap = {
    stagnant:    'bg-[#2A1E24]/60 border-rose-900/40',
    ltv_trigger: 'bg-[#1C233C]/60 border-blue-900/40',
    new_lead:    'bg-[#19242E]/60 border-amber-900/40',
  };
  const badgeMap = {
    stagnant:    'bg-rose-500/20 text-rose-300',
    ltv_trigger: 'bg-blue-500/20 text-cyan-300',
    new_lead:    'bg-amber-500/20 text-amber-300',
  };
  const labelMap = { stagnant: '見積フォロー', ltv_trigger: 'LTV点検', new_lead: '新規' };

  return (
    <div className={`p-4 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${bgMap[rec.type]}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeMap[rec.type]}`}>
            {labelMap[rec.type]}
          </span>
          <span className="text-xs font-mono text-gray-500">{rec.project.projectId}</span>
        </div>
        <h4 className="text-sm font-bold text-white mb-1">{rec.title}</h4>
        <p className="text-xs text-gray-300 leading-relaxed">{rec.desc}</p>
        <div className="text-[11px] text-[#E6C687] mt-2">
          📍 顧客: <strong>{rec.customer.name}</strong>
          <span className="text-gray-500 ml-2">{rec.customer.address}</span>
        </div>
      </div>
      <button
        onClick={onNavigate}
        className="bg-[#C5A059] text-[#0A0F1D] px-3 py-1.5 rounded text-xs font-extrabold flex items-center gap-1 hover:bg-[#D4AF37] transition-colors shrink-0"
      >
        訪問報告へ <LucideArrowRight size={13} />
      </button>
    </div>
  );
}

// ─── 未入金アラートバナー ─────────────────────────────────────

type OverdueItem = {
  contractId: string; customerName: string; projectTitle: string;
  termName: string; amount: number; scheduledDate: string;
  isOverdue: boolean; isDueThisMonth: boolean;
};

function OverduePaymentsBanner({ items, onTabChange }: {
  items: OverdueItem[];
  onTabChange: (tab: ActiveTab) => void;
}) {
  const overdueCount   = items.filter(i => i.isOverdue).length;
  const thisMonthCount = items.filter(i => i.isDueThisMonth).length;
  const fmtYM = (ym: string) => { const [y, m] = ym.split('-'); return `${y}年${parseInt(m)}月`; };
  const fmtAmt = (n: number) => `¥${n.toLocaleString()}`;
  return (
    <div className="bg-[#1A0A0A] border border-red-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-900/50 bg-red-950/30">
        <div className="flex items-center gap-2 text-xs font-bold text-red-300">
          <LucideCircleAlert size={14} className="text-red-400" />
          未入金アラート
          {overdueCount > 0 && (
            <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              期限超過 {overdueCount} 件
            </span>
          )}
          {thisMonthCount > 0 && (
            <span className="bg-yellow-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              今月 {thisMonthCount} 件
            </span>
          )}
        </div>
        <button
          onClick={() => onTabChange('database')}
          className="text-[10px] text-red-400 hover:text-red-200 transition-colors flex items-center gap-1">
          契約管理へ <LucideArrowRight size={11} />
        </button>
      </div>
      <ul className="divide-y divide-red-900/30 max-h-48 overflow-y-auto">
        {items.map((item, i) => (
          <li key={i} className="px-4 py-2.5 flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {item.customerName}　{item.termName}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{item.projectTitle}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-[#E6C687]">{fmtAmt(item.amount)}</p>
              <p className={`text-[10px] ${item.isOverdue ? 'text-red-400' : 'text-yellow-400'}`}>
                {item.isOverdue ? `${fmtYM(item.scheduledDate)} 期限超過` : '今月予定'}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── TODO バナー ─────────────────────────────────────────────

const TODO_CONFIG: Record<DashboardTodo['type'], {
  icon: React.ReactNode; label: string;
  high: string; medium: string;
}> = {
  collection_overdue:     { icon: <LucideAlertCircle size={13} />,  label: '未収金',     high: 'bg-red-950/60 border-red-700/50 text-red-300',      medium: 'bg-red-950/40 border-red-700/30 text-red-400' },
  collection_due_soon:    { icon: <LucideClock size={13} />,         label: '入金予定',   high: 'bg-yellow-950/60 border-yellow-700/50 text-yellow-300', medium: 'bg-yellow-950/30 border-yellow-700/30 text-yellow-400' },
  vendor_payment_pending:    { icon: <LucideBuilding2 size={13} />,     label: '業者支払い',   high: 'bg-orange-950/60 border-orange-700/50 text-orange-300', medium: 'bg-orange-950/30 border-orange-700/30 text-orange-400' },
  estimate_followup:         { icon: <LucideAlertTriangle size={13} />, label: '見積フォロー', high: 'bg-rose-950/60 border-rose-700/50 text-rose-300',    medium: 'bg-rose-950/30 border-rose-700/30 text-rose-400' },
  ltv_followup:              { icon: <LucideUsers size={13} />,         label: 'LTV',          high: 'bg-blue-950/60 border-blue-700/50 text-blue-300',     medium: 'bg-blue-950/30 border-blue-700/30 text-blue-400' },
  vendor_report_pending:     { icon: <LucideBuilding2 size={13} />,     label: '完了報告待ち', high: 'bg-purple-950/60 border-purple-700/50 text-purple-300', medium: 'bg-purple-950/30 border-purple-700/30 text-purple-400' },
  vendor_inspection_pending: { icon: <LucideBuilding2 size={13} />,     label: '検収待ち',     high: 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300', medium: 'bg-indigo-950/30 border-indigo-700/30 text-indigo-400' },
  vendor_invoice_pending:    { icon: <LucideBuilding2 size={13} />,     label: '請求書待ち',   high: 'bg-cyan-950/60 border-cyan-700/50 text-cyan-300',       medium: 'bg-cyan-950/30 border-cyan-700/30 text-cyan-400' },
};

function TodoBanner({ todos, onTabChange }: {
  todos: DashboardTodo[];
  onTabChange: (tab: ActiveTab) => void;
}) {
  const highCount = todos.filter(t => t.urgency === 'high').length;
  return (
    <div className="bg-[#0D1428] border border-[#C5A059]/20 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/80 bg-[#0B132B]">
        <div className="flex items-center gap-2 text-xs font-bold text-[#E6C687]">
          <LucideAlertCircle size={13} className="text-[#C5A059]" />
          アクション TODO
          {highCount > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              緊急 {highCount} 件
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-500">{todos.length} 件</span>
      </div>
      <ul className="divide-y divide-gray-800/40 max-h-52 overflow-y-auto">
        {todos.slice(0, 8).map(todo => {
          const cfg = TODO_CONFIG[todo.type];
          return (
            <li
              key={todo.todoId}
              onClick={() => onTabChange('database')}
              className="px-4 py-2.5 flex items-start gap-3 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <span className={`mt-0.5 shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg[todo.urgency]}`}>
                {cfg.icon} {cfg.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-semibold truncate">{todo.title}</p>
                <p className="text-[11px] text-gray-400 truncate">{todo.body}</p>
              </div>
              {todo.amount != null && (
                <span className="text-xs font-bold text-[#E6C687] shrink-0">
                  ¥{todo.amount.toLocaleString()}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

