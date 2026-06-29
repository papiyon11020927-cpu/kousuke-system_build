import { useState, useEffect, useMemo, useCallback, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// ─── ErrorBoundary ────────────────────────────────────────────
// レンダリングエラーをキャッチして白画面を防止する
interface EBState { hasError: boolean; error: Error | null }
class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary] Rendering error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center p-6">
          <div className="bg-[#111A35] border border-red-700/40 rounded-xl p-6 max-w-lg w-full space-y-3">
            <h2 className="text-base font-bold text-red-400">⚠️ 表示エラーが発生しました</h2>
            <p className="text-xs text-gray-300">
              画面の再読み込みで復旧できます。繰り返す場合は Firebase Console で
              破損データの確認・削除を行ってください。
            </p>
            {this.state.error && (
              <pre className="text-[10px] text-red-300 bg-[#0A0F1D] rounded p-3 overflow-auto max-h-32 border border-red-700/20">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); }}
              className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg transition"
            >
              再読み込み（リトライ）
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  LucideActivity,
  LucideBell, LucideX, LucideCheckCheck, LucideMail, LucideMailOpen,
  LucideHistory, LucideLayoutDashboard,
} from 'lucide-react';
import type { UserRole, AppNotification, ColorTheme, MasterSubTab } from '@/types';
import Sidebar, { HamburgerButton } from '@/components/Sidebar';
import { useAuth }         from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { markNotificationRead, markAllNotificationsRead } from '@/services/notificationService';
import { useCustomers }    from '@/hooks/useCustomers';
import { useProjects }     from '@/hooks/useProjects';
import { useSchedules }    from '@/hooks/useSchedules';
import { useLogs }         from '@/hooks/useLogs';
import { useComments }     from '@/hooks/useComments';
import { useGoals }        from '@/hooks/useGoals';
import { useDailyReports } from '@/hooks/useDailyReports';
import { useUsers }        from '@/hooks/useUsers';
import { useEstimates }         from '@/hooks/useEstimates';
import { useContracts }         from '@/hooks/useContracts';
import { useEstimateTemplates }  from '@/hooks/useEstimateTemplates';
import { useContractTemplates }  from '@/hooks/useContractTemplates';
import { useVendors }                from '@/hooks/useVendors';
import { useVendorQuoteRequests }   from '@/hooks/useVendorQuoteRequests';
import { useToast }        from '@/hooks/useToast';
import { logout }          from '@/services/authService';
import { updateUserTheme } from '@/services/userService';
import { seedInitialData, seedEstimateTemplates, seedVendors, seedContractTemplates } from '@/services/seedService';
import LoginPage        from '@/pages/LoginPage';
import StaffDashboard   from '@/pages/StaffDashboard';
import ManagerDashboard from '@/pages/ManagerDashboard';
import CalendarPage     from '@/pages/CalendarPage';
import DatabasePage     from '@/pages/DatabasePage';
import WorkspacePage    from '@/pages/WorkspacePage';
import ReportPage       from '@/pages/ReportPage';
import GoalPage         from '@/pages/GoalPage';
import DailyReportPage  from '@/pages/DailyReportPage';
import AnalyticsPage    from '@/pages/AnalyticsPage';
import MasterPage        from '@/pages/MasterPage';
import ProfileModal      from '@/components/ProfileModal';
import VendorQuotePage  from '@/pages/VendorQuotePage';
import PipelinePage     from '@/pages/PipelinePage';
import HelpPage         from '@/pages/HelpPage';
import TutorialOnboardingModal from '@/components/TutorialOnboardingModal';
import { markTutorialSeen } from '@/services/userService';
import type { WorkspaceSection } from '@/types';

type ActiveTab = 'dashboard' | 'calendar' | 'database' | 'pipeline' | 'workspace' | 'report' | 'goals' | 'daily_report' | 'analytics' | 'masters' | 'help';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;

  const { data: customers    } = useCustomers(uid);
  const { data: projects     } = useProjects(uid);
  const { data: schedules    } = useSchedules(uid);
  const { data: logs         } = useLogs(uid);
  const { data: comments     } = useComments(uid);
  const { data: goals        } = useGoals(uid);
  const { data: dailyReports } = useDailyReports(uid);
  const { data: appUsers     } = useUsers(uid);
  const { data: estimates          } = useEstimates(uid);
  const { data: contracts          } = useContracts(uid);
  const { data: estimateTemplates   } = useEstimateTemplates(uid);
  const { data: contractTemplates   } = useContractTemplates(uid);
  const { data: vendors              } = useVendors(uid);
  const { data: vendorQuoteRequests  } = useVendorQuoteRequests(uid);
  // 全ログインユーザーが通知を購読（表示フィルタは後段で行う）
  const { data: allNotifications } = useNotifications(uid);
  const { message: toastMsg, showToast } = useToast();

  const currentRole: UserRole = user?.role ?? 'staff';

  // ─── カラーテーマ ─────────────────────────────────────────────
  const [theme, setTheme] = useState<ColorTheme>(
    () => (localStorage.getItem('colorTheme') as ColorTheme | null) ?? user?.theme ?? 'navy-gold',
  );

  // Firestore のテーマが届いたら同期（初回ログイン時）
  useEffect(() => {
    if (user?.theme && user.theme !== theme) setTheme(user.theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleThemeChange = useCallback((t: ColorTheme) => {
    setTheme(t);
    localStorage.setItem('colorTheme', t);
    if (uid) updateUserTheme(uid, t).catch(console.error);
  }, [uid]);

  // staff = 自分の名前固定; manager/admin = ドロップダウンで選択
  const [selectedStaff,    setSelectedStaff]    = useState<string>('');
  const [activeTab,        setActiveTab]        = useState<ActiveTab>('dashboard');
  const [masterSubTab,     setMasterSubTab]     = useState<MasterSubTab>('templates');
  const [reportNavData,    setReportNavData]    = useState<{ projectId: string; customerId: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ─── ワークスペースジャンプ ───────────────────────────────────
  const [workspaceJump, setWorkspaceJump] = useState<{
    projectId: string;
    section?:  WorkspaceSection;
  } | null>(null);

  // ─── 通知パネル・設定 ────────────────────────────────────────
  const [showNotifPanel,    setShowNotifPanel]    = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showAllNotifs,     setShowAllNotifs]     = useState(false); // 未読のみ/全件トグル

  // 通知クリック時のdeep-link（ワークスペースへ直接ナビゲート）
  interface DeepLinkTarget {
    customerId: string;
    projectId:  string;
    section:    'estimates' | 'vendor_quotes';
    itemId:     string;
  }
  const [deepLinkTarget, setDeepLinkTarget] = useState<DeepLinkTarget | null>(null);

  // ユーザーリスト（表示名のみ）
  const staffList = useMemo(
    () => appUsers.map(u => u.displayName).filter(Boolean),
    [appUsers],
  );

  // ── フック呼び出しは早期return より前に集める（Rules of Hooks） ──
  const isManagerLike = currentRole === 'manager' || currentRole === 'admin';

  // manager/admin → 全通知表示、staff → 自分が notifiedUserIds に含まれる通知のみ
  const notifications = useMemo(() => {
    if (!uid) return [];
    if (isManagerLike) return allNotifications;
    return allNotifications.filter(
      n => n.notifiedUserIds?.includes(uid),
    );
  }, [allNotifications, uid, isManagerLike]);

  const unreadNotifications = useMemo(
    () => notifications.filter(n => uid && !n.readBy.includes(uid)),
    [notifications, uid],
  );
  const unreadCount = unreadNotifications.length;

  const selectedUserRole = useMemo(
    () => (isManagerLike && selectedStaff
      ? (appUsers.find(u => u.displayName === selectedStaff)?.role ?? currentRole)
      : currentRole),
    [appUsers, selectedStaff, currentRole, isManagerLike],
  );

  const viewingAsStaff = currentRole === 'staff' || (isManagerLike && selectedUserRole === 'staff');

  // user が確定したら selectedStaff を自分の名前に初期化（管理者も自分から開始）
  useEffect(() => {
    if (!user) return;
    setSelectedStaff(user.displayName);
  }, [user?.uid, currentRole]);

  // staffList が届いたとき manager/admin の selectedStaff が未設定なら補完
  useEffect(() => {
    if (currentRole !== 'staff' && !selectedStaff && staffList.length > 0) {
      setSelectedStaff(staffList[0]);
    }
  }, [staffList]);

  // ロール変更時にタブをリセット
  useEffect(() => {
    setActiveTab('dashboard');
  }, [currentRole]);

  // 管理者が選択ユーザーを切り替えたときタブをリセット
  useEffect(() => {
    if (!isManagerLike) return;
    setActiveTab('dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaff]);

  useEffect(() => {
    if (!uid) return;
    seedInitialData()
      .then((seeded) => { if (seeded) showToast('デモデータをデータベースへ初期化しました'); })
      .catch(console.error);
    seedEstimateTemplates()
      .catch(console.error);
    seedVendors()
      .catch(console.error);
    seedContractTemplates()
      .catch(console.error);
  }, [uid]);

  // ─── 通知クリック: deep-link + 既読 + タブ遷移（全通知パネル共通） ──────────
  const handleNotificationClick = useCallback((n: AppNotification) => {
    if (uid && !n.readBy.includes(uid)) markNotificationRead(n.notificationId, uid);
    let projectId: string | null = null;
    if (n.type === 'vendor_quote_submitted') {
      const req = vendorQuoteRequests.find(r => r.requestId === n.relatedId);
      if (req) { projectId = req.projectId; setDeepLinkTarget({ customerId: req.customerId, projectId: req.projectId, section: 'vendor_quotes', itemId: req.requestId }); }
    } else if (n.type === 'estimate_approval_requested') {
      const est = estimates.find(e => e.estimateId === n.relatedId);
      if (est) { projectId = est.projectId; setDeepLinkTarget({ customerId: est.customerId, projectId: est.projectId, section: 'estimates', itemId: est.estimateId }); }
    } else if (n.type === 'contract_approval_requested') {
      const ct = contracts.find(c => c.contractId === n.relatedId);
      if (ct)  { projectId = ct.projectId;  setDeepLinkTarget({ customerId: ct.customerId,  projectId: ct.projectId,  section: 'estimates', itemId: ct.contractId  }); }
    }
    if (projectId) {
      setWorkspaceJump({ projectId, section: 'estimates' });
      setActiveTab('workspace');
    }
  }, [uid, vendorQuoteRequests, estimates, contracts]);

  const handleNavigateToReport = useCallback((projectId: string, customerId: string) => {
    setReportNavData({ projectId, customerId });
    setActiveTab('report');
  }, []);

  const handleLogout = useCallback(async () => {
    try { await logout(); } catch { /* ignore */ }
  }, []);

  // ─── ローディング ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <LucideActivity className="text-[#C5A059] animate-spin" size={20} />
          <span className="text-[#C5A059] text-sm font-medium">住良建設 SFA 接続中...</span>
        </div>
      </div>
    );
  }

  // ─── 未ログイン → ログイン画面 ──────────────────────────────
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen bg-[#0A0F1D] text-[#E2E8F0] flex flex-col overflow-hidden" data-theme={theme}>
      {/* ─── ヘッダー（スリム化） ─── */}
      <header className="sticky top-0 z-40 bg-[#0B132B]/95 backdrop-blur border-b border-[#C5A059]/20 shadow-lg px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* ロゴ */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-[#C5A059] to-[#E6C687] flex items-center justify-center shadow-md shrink-0">
              <span className="text-white font-extrabold text-sm tracking-wider">住</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold tracking-widest text-white flex items-center gap-2">
                住良建設
                <span className="text-[10px] bg-[#C5A059]/20 text-[#E6C687] border border-[#C5A059]/40 px-1.5 py-0.5 rounded">
                  Genba-SFA
                </span>
              </h1>
              <p className="text-[9px] text-gray-500">現場主義 ＆ 顧客 LTV 最大化プラットフォーム</p>
            </div>
          </div>

          {/* 右側コントロール群 */}
          <div className="flex items-center gap-2">
            {/* 接続ステータス（PC のみ表示） */}
            <span className="hidden md:flex text-[10px] bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-full items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              接続中
            </span>

            {/* 通知ベル */}
            {(isManagerLike || notifications.length > 0) && (
              <div className="relative">
                <button
                  onClick={() => { setShowNotifPanel(p => !p); setShowNotifSettings(false); }}
                  className={`relative flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition ${
                    showNotifPanel
                      ? 'bg-[#1C2C54] text-[#E6C687] border-[#C5A059]/50'
                      : 'text-gray-400 hover:text-[#E6C687] border-gray-700 hover:border-[#C5A059]/50'
                  }`}
                >
                  <LucideBell size={13} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* 通知ドロップダウン */}
                {showNotifPanel && (
                  <div className="absolute right-0 top-10 z-50 w-80 bg-[#111A35] border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                    {/* パネルヘッダー */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 bg-[#0B132B]">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <LucideBell size={12} className="text-[#C5A059]" />
                        通知
                        {unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && uid && (
                          <button
                            onClick={() => markAllNotificationsRead(unreadNotifications.map(n => n.notificationId), uid)}
                            className="text-[10px] text-[#C5A059] hover:text-[#E6C687] flex items-center gap-1 transition"
                          >
                            <LucideCheckCheck size={11} /> 全既読
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowNotifSettings(true); setShowNotifPanel(false); }}
                          className="text-gray-500 hover:text-[#C5A059] transition"
                          title="通知ログ・設定"
                        >
                          <LucideHistory size={13} />
                        </button>
                        <button onClick={() => setShowNotifPanel(false)} className="text-gray-500 hover:text-gray-300 transition">
                          <LucideX size={12} />
                        </button>
                      </div>
                    </div>

                    {/* 通知リスト（デフォルト: 未読のみ） */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-800">
                      {(showAllNotifs ? notifications : unreadNotifications).length === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-500">
                          {showAllNotifs ? '通知はありません' : '未読通知はありません'}
                        </div>
                      ) : (
                        [...(showAllNotifs ? notifications : unreadNotifications)]
                          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                          .slice(0, 20)
                          .map(n => (
                            <NotificationItem
                              key={n.notificationId}
                              notification={n}
                              userId={uid ?? ''}
                              onRead={() => {
                                setShowNotifPanel(false);
                                handleNotificationClick(n);
                              }}
                            />
                          ))
                      )}
                    </div>
                    {/* 既読/未読トグルフッター */}
                    {notifications.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAllNotifs(p => !p); }}
                        className="w-full py-2 text-[11px] text-gray-500 hover:text-gray-300 transition border-t border-gray-800 flex items-center justify-center gap-1"
                      >
                        {showAllNotifs
                          ? '未読のみ表示に戻す'
                          : `既読を含む全 ${notifications.length} 件を表示`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* モバイル: ハンバーガー */}
            <HamburgerButton onClick={() => setDrawerOpen(true)} />
          </div>
        </div>
      </header>

      {/* ─── ボディ（サイドバー + コンテンツ） ─── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* サイドバー */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab); }}
          masterSubTab={masterSubTab}
          onMasterSubTabChange={setMasterSubTab}
          viewingAsStaff={viewingAsStaff}
          isManagerLike={isManagerLike}
          currentRole={currentRole}
          user={user}
          theme={theme}
          onThemeChange={handleThemeChange}
          onLogout={handleLogout}
          staffList={staffList}
          selectedStaff={selectedStaff}
          onStaffChange={setSelectedStaff}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          drawerOpen={drawerOpen}
          onDrawerClose={() => setDrawerOpen(false)}
          onProfileOpen={() => setShowProfileModal(true)}
        />

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 min-w-0">
      <AppErrorBoundary>
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <LucideLayoutDashboard size={16} className="text-[#C5A059]" />
                ダッシュボード
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {isManagerLike && !viewingAsStaff
                  ? '全社の営業状況とリソース状況の一覧です'
                  : `${selectedStaff} さんの本日の営業状況です`}
              </p>
            </div>

            {isManagerLike && !viewingAsStaff && (
              <ManagerDashboard
                currentUserId={uid}
                customers={customers} projects={projects} schedules={schedules}
                contracts={contracts} vendorQuoteRequests={vendorQuoteRequests}
                comments={comments} onShowToast={showToast}
                notifications={notifications}
                onNotificationRead={(id) => uid && markNotificationRead(id, uid)}
                onNotificationClick={handleNotificationClick}
                onTabChange={setActiveTab}
              />
            )}

            {isManagerLike && !viewingAsStaff && (
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                マイKPI（営業 TOP・{selectedStaff}）
              </p>
            )}
            <StaffDashboard
              customers={customers} projects={projects} schedules={schedules}
              contracts={contracts} vendorQuoteRequests={vendorQuoteRequests}
              goals={goals}
              selectedStaff={selectedStaff} onShowToast={showToast}
              notifications={notifications} currentUserId={uid ?? null}
              onNotificationRead={(id) => uid && markNotificationRead(id, uid)}
              onNotificationClick={handleNotificationClick}
              onTabChange={setActiveTab}
              hideBanners={isManagerLike && !viewingAsStaff}
            />
          </div>
        )}
        {activeTab === 'calendar' && (
          <CalendarPage
            customers={customers} projects={projects} schedules={schedules}
            staffList={staffList}
            currentRole={currentRole} selectedStaff={selectedStaff}
            onShowToast={showToast}
            onNavigateToReport={handleNavigateToReport}
          />
        )}
        {activeTab === 'pipeline' && (
          <PipelinePage
            projects={projects}
            customers={customers}
            estimates={estimates}
            contracts={contracts}
            currentRole={currentRole}
            currentUserName={user?.displayName ?? ''}
            staffList={staffList}
            onShowToast={showToast}
            onCardClick={(projectId) => {
              setWorkspaceJump({ projectId, section: 'overview' });
              setActiveTab('workspace');
            }}
          />
        )}
        {activeTab === 'workspace' && (
          <WorkspacePage
            projects={projects}
            customers={customers}
            logs={logs}
            schedules={schedules}
            estimates={estimates}
            contracts={contracts}
            estimateTemplates={estimateTemplates}
            vendors={vendors}
            vendorQuoteRequests={vendorQuoteRequests}
            staffList={staffList}
            currentRole={currentRole}
            currentUserName={user?.displayName ?? ''}
            currentUserId={uid ?? undefined}
            onShowToast={showToast}
            initialProjectId={workspaceJump?.projectId}
            initialSection={workspaceJump?.section}
            deepLinkTarget={deepLinkTarget}
            onDeepLinkConsumed={() => { setDeepLinkTarget(null); setWorkspaceJump(null); }}
          />
        )}
        {activeTab === 'database' && (
          <DatabasePage
            customers={customers} projects={projects} logs={logs} schedules={schedules}
            staffList={staffList} currentRole={currentRole} onShowToast={showToast}
            estimates={estimates} contracts={contracts}
            estimateTemplates={estimateTemplates}
            vendors={vendors}
            vendorQuoteRequests={vendorQuoteRequests}
            currentUserName={user?.displayName ?? ''}
            currentUserId={uid ?? undefined}
            onOpenWorkspace={(project, section) => {
              setWorkspaceJump({ projectId: project.projectId, section });
              setActiveTab('workspace');
            }}
          />
        )}
        {activeTab === 'goals' && (
          <GoalPage
            goals={goals} projects={projects} schedules={schedules}
            selectedStaff={selectedStaff} onShowToast={showToast}
          />
        )}
        {activeTab === 'report' && (
          <ReportPage
            customers={customers} projects={projects}
            logs={logs}
            selectedStaff={selectedStaff}
            userId={uid ?? 'anonymous'}
            onShowToast={showToast}
            initialProjectId={reportNavData?.projectId}
            initialCustomerId={reportNavData?.customerId}
            onMounted={() => setReportNavData(null)}
          />
        )}
        {activeTab === 'daily_report' && (
          <DailyReportPage
            logs={logs} dailyReports={dailyReports}
            customers={customers} projects={projects}
            staffList={staffList}
            currentRole={currentRole} selectedStaff={selectedStaff}
            onShowToast={showToast}
          />
        )}
        {activeTab === 'analytics' && isManagerLike && !viewingAsStaff && (
          <AnalyticsPage
            projects={projects} customers={customers} contracts={contracts}
            staffList={staffList}
          />
        )}
        {activeTab === 'masters' && isManagerLike && (
          <MasterPage
            templates={estimateTemplates}
            contractTemplates={contractTemplates}
            users={appUsers}
            vendors={vendors}
            currentUid={uid ?? ''}
            currentRole={currentRole}
            onShowToast={showToast}
            initialSubTab={masterSubTab}
          />
        )}
        {activeTab === 'help' && <HelpPage />}
      </AppErrorBoundary>
        </main>
      </div>{/* ── ボディ終了 ── */}

      {/* ─── 通知設定モーダル ─── */}
      {showNotifSettings && user && (
        <NotificationSettingsModal
          user={user}
          notifications={notifications}
          userId={uid ?? ''}
          onClose={() => setShowNotifSettings(false)}
          onSave={(settings) => {
            import('@/services/userService').then(({ updateNotificationSettings }) =>
              updateNotificationSettings(user.uid, settings)
                .then(() => { showToast('通知設定を保存しました'); setShowNotifSettings(false); })
                .catch(() => showToast('保存に失敗しました'))
            );
          }}
        />
      )}

      {/* 通知パネル外クリックで閉じる（z-20: ヘッダー z-30 未満にしてパネル内クリックを妨げない） */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-20" onClick={() => setShowNotifPanel(false)} />
      )}

      {/* ─── トースト通知 ─── */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#111A35] border border-[#C5A059]/40 text-white text-xs font-medium px-6 py-3 rounded-full shadow-2xl whitespace-nowrap">
          {toastMsg}
        </div>
      )}

      {/* ─── プロフィールモーダル ─── */}
      {showProfileModal && (
        <ProfileModal
          user={user}
          userId={uid ?? ''}
          onClose={() => setShowProfileModal(false)}
          onShowToast={showToast}
        />
      )}

      {/* ─── 初回オンボーディング（チュートリアル）モーダル ─── */}
      {uid && !user.hasSeenTutorial && (
        <TutorialOnboardingModal
          displayName={user.displayName}
          onFinish={() => { markTutorialSeen(uid).catch(console.error); }}
        />
      )}
    </div>
  );
}

// ─── 通知アイテム サブコンポーネント ────────────────────────

function NotificationItem({
  notification, userId, onRead,
}: {
  notification: AppNotification;
  userId: string;
  onRead: () => void;
}) {
  const isRead  = notification.readBy.includes(userId);
  const elapsed = (() => {
    const d = Date.now() - new Date(notification.createdAt).getTime();
    if (d < 60_000)          return 'たった今';
    if (d < 3_600_000)       return `${Math.floor(d / 60_000)}分前`;
    if (d < 86_400_000)      return `${Math.floor(d / 3_600_000)}時間前`;
    return `${Math.floor(d / 86_400_000)}日前`;
  })();
  const typeLabel: Record<AppNotification['type'], string> = {
    vendor_quote_submitted:      '業者見積回答',
    estimate_approval_requested: '見積承認依頼',
    contract_approval_requested: '契約承認依頼',
    project_approval_requested:  '案件登録 承認依頼',
  };

  return (
    <button
      onClick={onRead}
      className={`w-full text-left px-4 py-3 hover:bg-[#1C2C54]/60 transition ${isRead ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 shrink-0 ${isRead ? 'text-gray-600' : 'text-[#C5A059]'}`}>
          {isRead ? <LucideMailOpen size={13} /> : <LucideMail size={13} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] font-semibold ${isRead ? 'text-gray-500' : 'text-[#E6C687]'}`}>
              {typeLabel[notification.type]}
            </span>
            {!isRead && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{notification.body}</p>
          <p className="text-[10px] text-gray-600 mt-1">{elapsed}</p>
        </div>
      </div>
    </button>
  );
}

// ─── 通知設定・ログモーダル サブコンポーネント ───────────────

import { useState as useLocalState } from 'react';
import type { NotificationSettings } from '@/types';

type NotifSettingsTab = 'log' | 'email';

const NOTIF_TYPE_LABEL: Record<AppNotification['type'], string> = {
  vendor_quote_submitted:      '業者見積回答',
  estimate_approval_requested: '見積承認依頼',
  contract_approval_requested: '契約承認依頼',
  project_approval_requested:  '案件登録承認',
};

function NotificationSettingsModal({
  user, notifications, userId, onClose, onSave,
}: {
  user: { notificationSettings?: NotificationSettings };
  notifications: AppNotification[];
  userId: string;
  onClose: () => void;
  onSave: (s: NotificationSettings) => void;
}) {
  const [tab, setTab] = useLocalState<NotifSettingsTab>('log');
  const [emailOnVendorQuote, setEmailOnVendorQuote] = useLocalState(
    user.notificationSettings?.emailOnVendorQuote ?? true,
  );
  const [emailOnApproval, setEmailOnApproval] = useLocalState(
    user.notificationSettings?.emailOnApproval ?? true,
  );
  // ── 通知ログフィルター ──
  const [logDateFilter,  setLogDateFilter]  = useLocalState<'7d' | '30d' | 'all'>('30d');
  const [logTypeFilter,  setLogTypeFilter]  = useLocalState<AppNotification['type'] | 'all'>('all');

  const now = Date.now();
  const filteredLog = notifications
    .filter(n => {
      const age = now - new Date(n.createdAt).getTime();
      if (logDateFilter === '7d'  && age > 7  * 86_400_000) return false;
      if (logDateFilter === '30d' && age > 30 * 86_400_000) return false;
      if (logTypeFilter !== 'all' && n.type !== logTypeFilter) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#111A35] border border-gray-700 rounded-2xl max-w-md w-full shadow-2xl flex flex-col max-h-[85vh]">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideBell size={14} className="text-[#C5A059]" /> 通知管理
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition">
            <LucideX size={15} />
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-700 shrink-0">
          <button onClick={() => setTab('log')}
            className={`flex-1 py-2.5 text-xs font-bold transition ${tab === 'log' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
            📋 通知ログ ({notifications.length})
          </button>
          <button onClick={() => setTab('email')}
            className={`flex-1 py-2.5 text-xs font-bold transition ${tab === 'email' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}>
            ✉ メール設定
          </button>
        </div>

        {/* ── 通知ログタブ ── */}
        {tab === 'log' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* フィルター */}
            <div className="px-4 py-3 border-b border-gray-800 shrink-0 flex flex-wrap gap-2">
              {/* 日付フィルター */}
              <div className="flex bg-[#0B132B] border border-gray-700 rounded-md overflow-hidden text-[10px]">
                {([['7d', '7日'], ['30d', '30日'], ['all', '全期間']] as ['7d'|'30d'|'all', string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setLogDateFilter(v)}
                    className={`px-2.5 py-1.5 font-bold transition ${logDateFilter === v ? 'bg-[#C5A059]/20 text-[#E6C687]' : 'text-gray-400 hover:text-white'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {/* カテゴリフィルター */}
              <select
                value={logTypeFilter}
                onChange={e => setLogTypeFilter(e.target.value as AppNotification['type'] | 'all')}
                className="bg-[#0B132B] border border-gray-700 text-[10px] text-white rounded-md px-2 py-1.5 focus:outline-none focus:border-[#C5A059]"
              >
                <option value="all">全カテゴリ</option>
                {(Object.keys(NOTIF_TYPE_LABEL) as AppNotification['type'][]).map(t => (
                  <option key={t} value={t}>{NOTIF_TYPE_LABEL[t]}</option>
                ))}
              </select>
              <span className="text-[10px] text-gray-500 self-center ml-auto">{filteredLog.length}件</span>
            </div>

            {/* ログリスト */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-800/60">
              {filteredLog.length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-500">該当する通知はありません</div>
              ) : filteredLog.map(n => {
                const isRead = n.readBy.includes(userId);
                const elapsed = (() => {
                  const d = Date.now() - new Date(n.createdAt).getTime();
                  if (d < 3_600_000)  return `${Math.floor(d / 60_000)}分前`;
                  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}時間前`;
                  return new Date(n.createdAt).toLocaleDateString('ja-JP');
                })();
                return (
                  <div key={n.notificationId}
                    className={`px-4 py-3 flex items-start gap-2.5 ${isRead ? 'opacity-50' : ''}`}>
                    <div className={`mt-0.5 shrink-0 ${isRead ? 'text-gray-600' : 'text-[#C5A059]'}`}>
                      {isRead ? <LucideMailOpen size={13} /> : <LucideMail size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isRead ? 'bg-gray-800 text-gray-500' : 'bg-[#C5A059]/20 text-[#E6C687]'
                        }`}>
                          {NOTIF_TYPE_LABEL[n.type]}
                        </span>
                        {isRead && <span className="text-[9px] text-gray-600">既読</span>}
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{elapsed}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── メール設定タブ ── */}
        {tab === 'email' && (
          <div className="p-5 space-y-5 flex-1">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              各イベントのメール通知をON/OFFできます。<br />
              ※ Cloud Functions が設定済みの場合のみメールが届きます。
            </p>
            <div className="space-y-3">
              <ToggleRow
                label="業者見積回答"
                desc="業者がフォームから見積を回答したとき"
                value={emailOnVendorQuote}
                onChange={setEmailOnVendorQuote}
              />
              <ToggleRow
                label="承認依頼"
                desc="見積・契約の承認依頼が来たとき"
                value={emailOnApproval}
                onChange={setEmailOnApproval}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-600 text-gray-300 hover:border-gray-400 transition">
                キャンセル
              </button>
              <button onClick={() => onSave({ emailOnVendorQuote, emailOnApproval })}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] transition">
                保存する
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function ToggleRow({
  label, desc, value, onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#0B132B] rounded-lg px-3 py-2.5 border border-gray-800">
      <div>
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
          value ? 'bg-[#C5A059]' : 'bg-gray-700'
        }`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          value ? 'left-[18px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
}
