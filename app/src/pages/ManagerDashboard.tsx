import { useMemo, useState } from 'react';
import { LucideUsers, LucideUser, LucideAlertTriangle, LucideMessageSquare, LucideBell, LucideCheckCheck,
  LucideAlertCircle, LucideClock, LucideBuilding2, LucideCircleAlert, LucideArrowRight, LucideCheck } from 'lucide-react';
import type { Customer, Project, Schedule, ProjectComment, AppNotification, Contract, VendorQuoteRequest, DashboardTodo } from '@/types';
import { calcStaffStats, calcDashboardTodos } from '@/services/kpiService';
import { saveComment } from '@/services/commentService';

const STAFF_LIST = ['佐藤 営業マン', '山本 営業主任'];

type ActiveTab = 'dashboard' | 'calendar' | 'database' | 'goals' | 'report' | 'masters';

interface Props {
  currentUserId:       string | null;
  customers:           Customer[];
  projects:            Project[];
  schedules:           Schedule[];
  contracts:           Contract[];
  vendorQuoteRequests: VendorQuoteRequest[];
  comments:            ProjectComment[];
  onShowToast:         (msg: string) => void;
  notifications:       AppNotification[];
  onNotificationRead:  (id: string) => void;
  onNotificationClick: (n: AppNotification) => void;
  onTabChange:         (tab: ActiveTab) => void;
}

export default function ManagerDashboard({
  currentUserId, customers, projects, schedules, contracts, vendorQuoteRequests,
  comments, onShowToast, notifications, onNotificationRead, onNotificationClick, onTabChange,
}: Props) {
  const [instructionTexts, setInstructionTexts] = useState<Record<string, string>>({});
  const [showAllNotifs, setShowAllNotifs] = useState(false);

  const stagnantProjects = useMemo(() => {
    const today = new Date();
    return projects
      .filter((p) => {
        if (p.status !== 'estimate') return false;
        return Math.floor((today.getTime() - new Date(p.lastActivityAt).getTime()) / 86_400_000) >= 7;
      })
      .map((p) => {
        const days = Math.floor((today.getTime() - new Date(p.lastActivityAt).getTime()) / 86_400_000);
        const cust = customers.find((c) => c.customerId === p.customerId);
        return { ...p, inactiveDays: days, customerName: cust?.name ?? '不明な顧客' };
      });
  }, [projects, customers]);

  const totalSales = useMemo(() =>
    projects
      .filter((p) => p.status === 'completed' || p.status === 'contract')
      .reduce((s, p) => s + (p.amount ?? 0), 0),
  [projects]);

  const totalProfit = useMemo(() =>
    projects
      .filter((p) => p.status === 'completed' || p.status === 'contract')
      .reduce((s, p) => s + (p.profit ?? 0), 0),
  [projects]);

  const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100 * 10) / 10 : 0;

  const handleSendInstruction = async (projectId: string) => {
    const text = instructionTexts[projectId]?.trim();
    if (!text) return;
    try {
      await saveComment(projectId, currentUserId ?? 'manager-01', '管理者（住良建設本部）', text);
      setInstructionTexts((prev) => ({ ...prev, [projectId]: '' }));
      onShowToast('担当者へのダイレクト指示を送信しました');
    } catch {
      onShowToast('送信に失敗しました。再試行してください。');
    }
  };

  const unread = useMemo(
    () => notifications.filter(n => currentUserId && !n.readBy.includes(currentUserId)),
    [notifications, currentUserId],
  );

  const todos = useMemo(
    () => calcDashboardTodos(contracts, vendorQuoteRequests, projects, customers, '', true),
    [contracts, vendorQuoteRequests, projects, customers],
  );

  // 全担当者分の未入金アラート
  const overduePayments = useMemo(() => {
    const currentYM = new Date().toISOString().slice(0, 7);
    return contracts
      .filter(c => c.approvalStatus === 'approved')
      .flatMap(c =>
        (c.paymentTerms ?? [])
          .filter(t => !t.isPaid && t.scheduledDate)
          .map(t => ({
            contractId:    c.contractId,
            customerName:  c.customerName,
            projectTitle:  c.projectTitle,
            staffName:     c.staffName,
            termName:      t.termName,
            amount:        t.amount,
            scheduledDate: t.scheduledDate!,
            isOverdue:     t.scheduledDate! < currentYM,
            isDueThisMonth: t.scheduledDate! === currentYM,
          }))
          .filter(item => item.isOverdue || item.isDueThisMonth)
      )
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, [contracts]);

  return (
    <div className="space-y-6">

      {/* ─── 未入金アラート ─── */}
      {overduePayments.length > 0 && (
        <OverduePaymentsBanner items={overduePayments} onTabChange={onTabChange} />
      )}

      {/* ─── TODO バナー ─── */}
      {todos.length > 0 && (
        <TodoBanner todos={todos} onTabChange={onTabChange} />
      )}

      {/* ─── 通知バナー（未読のみ表示・既読で非表示） ─── */}
      {unread.length > 0 && (
        <div className="bg-[#111A35] border border-[#C5A059]/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <div className="flex items-center gap-2 text-xs font-bold text-[#E6C687]">
              <LucideBell size={13} className="text-[#C5A059]" />
              最新のお知らせ
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

      {/* スタッフ稼働状況 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#111A35] border border-gray-800 rounded-xl p-5 shadow-lg lg:col-span-2">
          <h3 className="text-sm font-bold text-white tracking-wider mb-2 flex items-center gap-2">
            <LucideUsers className="text-[#C5A059]" size={16} />
            全営業スタッフの稼働状況
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STAFF_LIST.map((name) => {
              const stats = calcStaffStats(name, projects, schedules);
              const color = stats.workloadPercent > 80 ? 'bg-red-500' : stats.workloadPercent > 50 ? 'bg-yellow-500' : 'bg-green-500';
              const badge = stats.workloadPercent > 80 ? 'bg-red-500/20 text-red-300' : stats.workloadPercent > 50 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300';
              return (
                <div key={name} className="bg-[#0B132B] p-4 rounded-lg border border-gray-800">
                  <div className="flex justify-between items-center mb-3">
                    <strong className="text-sm text-white flex items-center gap-1">
                      <LucideUser size={14} className="text-[#C5A059]" /> {name}
                    </strong>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${badge}`}>
                      稼働率 {stats.workloadPercent}%
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">カレンダー予定数:</span>
                      <span className="text-white font-bold">{stats.totalSchedules} 件</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">見積中 / 施工中:</span>
                      <span className="text-[#E6C687] font-bold">{stats.estimateCount} / {stats.constructionCount} 件</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                      <div className={`${color} h-2 rounded-full`} style={{ width: `${stats.workloadPercent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 今月実績サマリ */}
        <div className="bg-[#111A35] border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col justify-center">
          <h3 className="text-sm font-bold text-white tracking-wider mb-4">📊 今月の全体受注実績</h3>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-gray-400 block mb-1">総受注金額（確定/着工ベース）</span>
              <strong className="text-2xl font-black text-white">¥{totalSales.toLocaleString()}</strong>
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">平均粗利率</span>
              <strong className="text-lg font-bold text-[#E6C687]">{profitRate} %</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 停滞案件アラート */}
      <div className="bg-[#111A35] border border-rose-950/50 rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <LucideAlertTriangle size={15} />
          </div>
          <h3 className="text-sm font-extrabold text-white tracking-wider">
            ⚠️ 見積提出後1週間動きがない「停滞案件」アラート
          </h3>
        </div>

        {stagnantProjects.length === 0 ? (
          <p className="text-center py-8 text-gray-500 text-xs">停滞している案件は検出されませんでした。</p>
        ) : (
          <div className="space-y-4">
            {stagnantProjects.map((proj) => {
              const projComments = comments.filter((c) => c.projectId === proj.projectId);
              return (
                <div key={proj.projectId} className="bg-[#0B132B] border-l-4 border-rose-500 rounded-r-lg p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* 案件情報 */}
                  <div className="text-xs">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 font-extrabold px-2 py-0.5 rounded">
                        停滞 {proj.inactiveDays} 日目
                      </span>
                      <span className="font-mono text-gray-500">{proj.projectId}</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white mb-1">{proj.title}</h4>
                    <p className="text-xs text-[#E6C687]">👤 {proj.customerName}</p>
                    <p className="text-xs text-gray-400 mt-1">担当: {proj.assignee}</p>
                  </div>

                  {/* 指示履歴 */}
                  <div className="bg-[#12192C] p-3 rounded border border-gray-800 max-h-[140px] overflow-y-auto">
                    <span className="text-[10px] text-gray-400 font-bold block mb-2">本部からの指示履歴</span>
                    {projComments.length === 0 ? (
                      <p className="text-[11px] text-gray-500 italic">まだ指示はありません</p>
                    ) : (
                      projComments.map((c) => (
                        <div key={c.commentId} className="text-[11px] bg-[#1C233C] p-2 rounded mb-1.5">
                          <div className="flex justify-between text-[9px] text-rose-300 font-bold mb-0.5">
                            <span>{c.userName}</span>
                            <span>{new Date(c.createdAt).toLocaleDateString('ja-JP')}</span>
                          </div>
                          <p className="text-gray-300 leading-normal">{c.commentText}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 指示入力 */}
                  <div className="flex flex-col justify-between">
                    <textarea
                      value={instructionTexts[proj.projectId] ?? ''}
                      onChange={(e) => setInstructionTexts((prev) => ({ ...prev, [proj.projectId]: e.target.value }))}
                      placeholder="指示内容を入力してください..."
                      className="w-full bg-[#16223F] border border-gray-700 text-xs text-white p-2 rounded focus:outline-none focus:border-rose-500 h-16 resize-none"
                    />
                    <button
                      onClick={() => handleSendInstruction(proj.projectId)}
                      className="bg-rose-600 text-white font-bold px-3 py-1.5 rounded text-xs hover:bg-rose-700 transition-colors w-full mt-2 flex items-center justify-center gap-1"
                    >
                      <LucideMessageSquare size={12} /> 指示を送信
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 未入金アラートバナー ─────────────────────────────────────

type OverdueItem = {
  contractId: string; customerName: string; projectTitle: string;
  staffName: string; termName: string; amount: number; scheduledDate: string;
  isOverdue: boolean; isDueThisMonth: boolean;
};

function OverduePaymentsBanner({ items, onTabChange }: {
  items: OverdueItem[];
  onTabChange: (tab: ActiveTab) => void;
}) {
  const overdueCount   = items.filter(i => i.isOverdue).length;
  const thisMonthCount = items.filter(i => i.isDueThisMonth).length;
  const fmtYM  = (ym: string) => { const [y, m] = ym.split('-'); return `${y}年${parseInt(m)}月`; };
  const fmtAmt = (n: number)  => `¥${n.toLocaleString()}`;
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
      <ul className="divide-y divide-red-900/30 max-h-56 overflow-y-auto">
        {items.map((item, i) => (
          <li key={i} className="px-4 py-2.5 flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {item.customerName}　{item.termName}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{item.projectTitle}　担当: {item.staffName}</p>
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

// ─── TODO バナー（Manager用・staff共用コンポーネント） ────────

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

