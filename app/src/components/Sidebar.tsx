import { useState, useRef, useEffect } from 'react';
import {
  LucideTrendingUp, LucideMic, LucideLayoutDashboard, LucideLayers,
  LucideUsers, LucideCalendar, LucideFileText, LucideTarget,
  LucideSettings, LucideClipboardList, LucideBuilding2,
  LucideLogOut, LucideChevronDown, LucideChevronRight,
  LucideChevronLeft, LucideMenu, LucidePalette, LucideUserCircle,
  LucidePencil, LucideShield,
} from 'lucide-react';
import type { UserRole, ColorTheme, MasterSubTab } from '@/types';
import type { AuthUser } from '@/hooks/useAuth';

// ─── 型 ─────────────────────────────────────────────────────────
type ActiveTab =
  | 'dashboard' | 'manager' | 'calendar' | 'database'
  | 'pipeline'  | 'workspace' | 'report' | 'goals'
  | 'daily_report' | 'masters';

export interface SidebarProps {
  activeTab:              ActiveTab;
  onTabChange:            (tab: ActiveTab) => void;
  masterSubTab:           MasterSubTab;
  onMasterSubTabChange:   (sub: MasterSubTab) => void;
  viewingAsStaff:         boolean;
  isManagerLike:          boolean;
  currentRole:            UserRole;
  user:                   AuthUser;
  theme:                  ColorTheme;
  onThemeChange:          (t: ColorTheme) => void;
  onLogout:               () => void;
  staffList:              string[];
  selectedStaff:          string;
  onStaffChange:          (s: string) => void;
  collapsed:              boolean;
  onCollapsedChange:      (c: boolean) => void;
  drawerOpen:             boolean;
  onDrawerClose:          () => void;
  onProfileOpen:          () => void;
}

// ─── テーマ定義 ──────────────────────────────────────────────────
const THEMES: { id: ColorTheme; label: string; dotBg: string; dotAccent: string }[] = [
  { id: 'navy-gold',  label: 'Navy × Gold',  dotBg: '#0A0F1D', dotAccent: '#C5A059' },
  { id: 'navy-white', label: 'Navy × White', dotBg: '#F8FAFB', dotAccent: '#1B3A6B' },
  { id: 'mint-teal',  label: 'Mint × Teal',  dotBg: '#F0F7F6', dotAccent: '#0D9488' },
];

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

// ─── ユーティリティ ──────────────────────────────────────────────

function NavItem({
  icon, label, id, activeTab, collapsed, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  id: ActiveTab;
  activeTab: ActiveTab;
  collapsed: boolean;
  onClick: (id: ActiveTab) => void;
}) {
  const active = activeTab === id;
  return (
    <button
      title={collapsed ? label : undefined}
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all relative
        ${active
          ? 'bg-[#C5A059]/15 text-[#E6C687]'
          : 'text-gray-400 hover:text-white hover:bg-white/5'}
        ${collapsed ? 'justify-center px-0' : ''}
      `}
    >
      {active && (
        <span className="absolute right-0 top-1 bottom-1 w-0.5 rounded-l bg-[#C5A059]" />
      )}
      <span className="shrink-0 flex items-center">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-px bg-white/10 mx-2 my-2" />;
  return (
    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mt-4 mb-1">
      {label}
    </p>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────

export default function Sidebar({
  activeTab, onTabChange,
  masterSubTab, onMasterSubTabChange,
  viewingAsStaff, isManagerLike, currentRole,
  user, theme, onThemeChange, onLogout,
  staffList, selectedStaff, onStaffChange,
  collapsed, onCollapsedChange,
  drawerOpen, onDrawerClose,
  onProfileOpen,
}: SidebarProps) {

  const [masterOpen,  setMasterOpen]  = useState(activeTab === 'masters');
  const [userPopOpen, setUserPopOpen] = useState(false);
  const userPopRef = useRef<HTMLDivElement>(null);

  // マスタタブがアクティブになったらアコーディオンを開く
  useEffect(() => {
    if (activeTab === 'masters') setMasterOpen(true);
  }, [activeTab]);

  // ユーザーポップアップ外クリックで閉じる
  useEffect(() => {
    if (!userPopOpen) return;
    const handler = (e: MouseEvent) => {
      if (userPopRef.current && !userPopRef.current.contains(e.target as Node)) {
        setUserPopOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userPopOpen]);

  const handleTabClick = (id: ActiveTab) => {
    onTabChange(id);
    onDrawerClose();
  };

  const handleMasterSubClick = (sub: MasterSubTab) => {
    onMasterSubTabChange(sub);
    onTabChange('masters');
    onDrawerClose();
  };

  const initials = user.displayName
    ? user.displayName.split('').slice(0, 1).join('')
    : '?';

  // ─── ナビゲーション本体 ───────────────────────────────────────
  const navContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ─ 折りたたみボタン ─ */}
      <div className="flex items-center justify-end border-b border-[#C5A059]/10 shrink-0 px-2 py-1.5">
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className="hidden lg:flex h-6 w-6 rounded items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition shrink-0"
          title={collapsed ? 'メニューを展開' : 'メニューを折りたたむ'}
        >
          {collapsed
            ? <LucideChevronRight size={14} />
            : <LucideChevronLeft  size={14} />
          }
        </button>
      </div>

      {/* ─ ナビゲーション ─ */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1">

        {/* ── メイン ── */}
        <SectionLabel label="メイン" collapsed={collapsed} />
        <NavItem icon={<LucideTrendingUp   size={15} />} label="営業 TOP"       id="dashboard"    activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
        <NavItem icon={<LucideMic          size={15} />} label="現場報告"        id="report"       activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
        <NavItem icon={<LucideLayoutDashboard size={15} />} label="パイプライン" id="pipeline"     activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
        <NavItem icon={<LucideLayers       size={15} />} label="案件ワークスペース" id="workspace" activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
        <NavItem icon={<LucideUsers        size={15} />} label="顧客カルテ"      id="database"     activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />

        {/* ── スタッフ専用 ── */}
        {viewingAsStaff && (<>
          <SectionLabel label="スタッフ" collapsed={collapsed} />
          <NavItem icon={<LucideCalendar  size={15} />} label="カレンダー" id="calendar"     activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
          <NavItem icon={<LucideFileText  size={15} />} label="日報"       id="daily_report" activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
          <NavItem icon={<LucideTarget    size={15} />} label="目標管理"   id="goals"        activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
        </>)}

        {/* ── 管理者専用 ── */}
        {isManagerLike && !viewingAsStaff && (<>
          <SectionLabel label="管理" collapsed={collapsed} />
          <NavItem icon={<LucideUsers    size={15} />} label="リソース管理"   id="manager"      activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
          <NavItem icon={<LucideCalendar size={15} />} label="全員カレンダー" id="calendar"     activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
          <NavItem icon={<LucideFileText size={15} />} label="日報"           id="daily_report" activeTab={activeTab} collapsed={collapsed} onClick={handleTabClick} />
        </>)}

        {/* ── マスタ管理（アコーディオン） ── */}
        {isManagerLike && (<>
          <SectionLabel label="設定" collapsed={collapsed} />

          {collapsed ? (
            /* 折りたたみ時: アイコンのみ（クリックで展開＋masters遷移） */
            <button
              title="マスタ管理"
              onClick={() => { handleTabClick('masters'); }}
              className={`w-full flex justify-center py-2 transition
                ${activeTab === 'masters' ? 'text-[#E6C687]' : 'text-gray-400 hover:text-white'}`}
            >
              <LucideSettings size={15} />
            </button>
          ) : (
            <>
              <button
                onClick={() => setMasterOpen(o => !o)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition
                  ${activeTab === 'masters' ? 'text-[#E6C687]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <LucideSettings size={15} className="shrink-0" />
                <span className="flex-1 text-left">マスタ管理</span>
                {masterOpen
                  ? <LucideChevronDown  size={13} className="shrink-0" />
                  : <LucideChevronRight size={13} className="shrink-0" />
                }
              </button>

              {masterOpen && (
                <div>
                  <MasterSubItem
                    icon={<LucideClipboardList size={13} />}
                    label="テンプレート管理"
                    sub="templates"
                    activeTab={activeTab}
                    activeSub={masterSubTab}
                    onClick={handleMasterSubClick}
                  />
                  <MasterSubItem
                    icon={<LucideBuilding2 size={13} />}
                    label="外部業者管理"
                    sub="vendors"
                    activeTab={activeTab}
                    activeSub={masterSubTab}
                    onClick={handleMasterSubClick}
                  />
                  {currentRole === 'admin' && (
                    <MasterSubItem
                      icon={<LucideShield size={13} />}
                      label="ユーザー管理"
                      sub="users"
                      activeTab={activeTab}
                      activeSub={masterSubTab}
                      onClick={handleMasterSubClick}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </>)}
      </nav>

      {/* ─ ユーザーエリア ─ */}
      <div className="shrink-0 border-t border-[#C5A059]/10 relative" ref={userPopRef}>
        <button
          onClick={() => setUserPopOpen(o => !o)}
          className={`w-full flex items-center gap-2.5 p-3 transition hover:bg-white/5
            ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? user.displayName : undefined}
        >
          <div className="h-7 w-7 rounded-full bg-[#1C2C54] border border-[#C5A059]/30 flex items-center justify-center text-[11px] font-bold text-[#E6C687] shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] font-medium text-white truncate">{user.displayName}</p>
                <p className="text-[9px] text-gray-500 truncate">{ROLE_LABEL[currentRole]}</p>
              </div>
              <LucideSettings size={13} className="text-gray-600 shrink-0" />
            </>
          )}
        </button>

        {/* ユーザーポップアップ */}
        {userPopOpen && (
          <div className={`absolute bottom-full mb-1 z-50 w-52 bg-[#1C2C54] border border-[#C5A059]/20 rounded-xl shadow-2xl overflow-hidden
            ${collapsed ? 'left-14' : 'left-2 right-2 w-auto'}`}
          >
            {/* ヘッダー */}
            <div className="px-3 py-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-[#0D1530] border border-[#C5A059]/30 flex items-center justify-center text-[12px] font-bold text-[#E6C687]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{user.displayName}</p>
                  <p className="text-[10px] text-gray-400 truncate">{user.email ?? ''}</p>
                </div>
              </div>
              <span className={`mt-1.5 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded ${ROLE_BADGE[currentRole]}`}>
                {ROLE_LABEL[currentRole]}
              </span>
            </div>

            {/* アクション */}
            <div className="py-1">
              <PopupItem icon={<LucideUserCircle size={14} />} label="プロフィール閲覧・編集" onClick={() => { setUserPopOpen(false); onProfileOpen(); }} />

              {/* カラーテーマ */}
              <div className="px-3 pt-2 pb-1">
                <p className="text-[9px] text-gray-500 mb-1.5 flex items-center gap-1">
                  <LucidePalette size={11} /> カラーテーマ
                </p>
                <div className="flex gap-2">
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      title={t.label}
                      onClick={() => { onThemeChange(t.id); }}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition border
                        ${theme === t.id
                          ? 'border-[#C5A059]/60 bg-[#C5A059]/10 text-[#E6C687]'
                          : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}
                    >
                      <span className="flex gap-0.5">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.dotBg, border: '1px solid #4b5563', display: 'inline-block' }} />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.dotAccent, display: 'inline-block' }} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/10 my-1" />

              {/* SU: スタッフ切替 */}
              {currentRole === 'admin' && staffList.length > 0 && (
                <>
                  <div className="px-3 py-1.5">
                    <p className="text-[9px] text-gray-500 mb-1">ユーザー切替（SU）</p>
                    <select
                      value={selectedStaff}
                      onChange={e => { onStaffChange(e.target.value); setUserPopOpen(false); }}
                      className="w-full bg-[#0D1530] border border-[#C5A059]/20 text-white text-[10px] rounded px-2 py-1 focus:outline-none"
                    >
                      {staffList.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="h-px bg-white/10 my-1" />
                </>
              )}

              <PopupItem
                icon={<LucideLogOut size={14} />}
                label="ログアウト"
                danger
                onClick={() => { setUserPopOpen(false); onLogout(); }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── PC サイドバー（lg以上で常時表示） ── */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[#111A35] border-r border-[#C5A059]/10 transition-all duration-200 overflow-hidden min-h-0
          ${collapsed ? 'w-[60px]' : 'w-[210px]'}`}
      >
        {navContent}
      </aside>

      {/* ── モバイル ドロワー（lg未満でハンバーガーから展開） ── */}
      {drawerOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onDrawerClose}
          />
          {/* ドロワー本体 */}
          <div className="fixed top-0 right-0 bottom-0 z-50 w-64 bg-[#111A35] border-l border-[#C5A059]/10 flex flex-col lg:hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-xs text-gray-400 font-medium">メニュー</span>
              <button onClick={onDrawerClose} className="text-gray-500 hover:text-white transition">
                <LucideChevronRight size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {/* ドロワー内は collapsed=false で常に展開表示 */}
              <DrawerNav
                activeTab={activeTab}
                masterSubTab={masterSubTab}
                viewingAsStaff={viewingAsStaff}
                isManagerLike={isManagerLike}
                currentRole={currentRole}
                user={user}
                theme={theme}
                onThemeChange={onThemeChange}
                onLogout={onLogout}
                staffList={staffList}
                selectedStaff={selectedStaff}
                onStaffChange={onStaffChange}
                onTabChange={handleTabClick}
                onMasterSubClick={handleMasterSubClick}
                onProfileOpen={onProfileOpen}
                masterOpen={masterOpen}
                onMasterOpenChange={setMasterOpen}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─── マスタ サブアイテム ─────────────────────────────────────────

function MasterSubItem({
  icon, label, sub, activeTab, activeSub, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: MasterSubTab;
  activeTab: ActiveTab;
  activeSub: MasterSubTab;
  onClick: (sub: MasterSubTab) => void;
}) {
  const active = activeTab === 'masters' && activeSub === sub;
  return (
    <button
      onClick={() => onClick(sub)}
      className={`w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-[11px] transition relative
        ${active ? 'text-[#E6C687] bg-[#C5A059]/10' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`}
    >
      {active && <span className="absolute right-0 top-1 bottom-1 w-0.5 rounded-l bg-[#C5A059]" />}
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// ─── ポップアップ アイテム ───────────────────────────────────────

function PopupItem({
  icon, label, danger, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] transition
        ${danger
          ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
          : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── ドロワー内ナビゲーション（collapsed 固定 false） ────────────

interface DrawerNavProps {
  activeTab: ActiveTab;
  masterSubTab: MasterSubTab;
  viewingAsStaff: boolean;
  isManagerLike: boolean;
  currentRole: UserRole;
  user: AuthUser;
  theme: ColorTheme;
  onThemeChange: (t: ColorTheme) => void;
  onLogout: () => void;
  staffList: string[];
  selectedStaff: string;
  onStaffChange: (s: string) => void;
  onTabChange: (id: ActiveTab) => void;
  onMasterSubClick: (sub: MasterSubTab) => void;
  onProfileOpen: () => void;
  masterOpen: boolean;
  onMasterOpenChange: (o: boolean) => void;
}

function DrawerNav({
  activeTab, masterSubTab,
  viewingAsStaff, isManagerLike, currentRole,
  user, theme, onThemeChange, onLogout,
  staffList, selectedStaff, onStaffChange,
  onTabChange, onMasterSubClick,
  onProfileOpen, masterOpen, onMasterOpenChange,
}: DrawerNavProps) {
  const [userPopOpen, setUserPopOpen] = useState(false);
  const initials = user.displayName ? user.displayName.slice(0, 1) : '?';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <nav className="flex-1 overflow-y-auto py-1">
        <SectionLabel label="メイン" collapsed={false} />
        <NavItem icon={<LucideTrendingUp   size={15} />} label="営業 TOP"       id="dashboard"    activeTab={activeTab} collapsed={false} onClick={onTabChange} />
        <NavItem icon={<LucideMic          size={15} />} label="現場報告"        id="report"       activeTab={activeTab} collapsed={false} onClick={onTabChange} />
        <NavItem icon={<LucideLayoutDashboard size={15} />} label="パイプライン" id="pipeline"     activeTab={activeTab} collapsed={false} onClick={onTabChange} />
        <NavItem icon={<LucideLayers       size={15} />} label="案件ワークスペース" id="workspace" activeTab={activeTab} collapsed={false} onClick={onTabChange} />
        <NavItem icon={<LucideUsers        size={15} />} label="顧客カルテ"      id="database"     activeTab={activeTab} collapsed={false} onClick={onTabChange} />

        {viewingAsStaff && (<>
          <SectionLabel label="スタッフ" collapsed={false} />
          <NavItem icon={<LucideCalendar size={15} />} label="カレンダー" id="calendar"     activeTab={activeTab} collapsed={false} onClick={onTabChange} />
          <NavItem icon={<LucideFileText size={15} />} label="日報"       id="daily_report" activeTab={activeTab} collapsed={false} onClick={onTabChange} />
          <NavItem icon={<LucideTarget   size={15} />} label="目標管理"   id="goals"        activeTab={activeTab} collapsed={false} onClick={onTabChange} />
        </>)}

        {isManagerLike && !viewingAsStaff && (<>
          <SectionLabel label="管理" collapsed={false} />
          <NavItem icon={<LucideUsers    size={15} />} label="リソース管理"   id="manager"      activeTab={activeTab} collapsed={false} onClick={onTabChange} />
          <NavItem icon={<LucideCalendar size={15} />} label="全員カレンダー" id="calendar"     activeTab={activeTab} collapsed={false} onClick={onTabChange} />
          <NavItem icon={<LucideFileText size={15} />} label="日報"           id="daily_report" activeTab={activeTab} collapsed={false} onClick={onTabChange} />
        </>)}

        {isManagerLike && (<>
          <SectionLabel label="設定" collapsed={false} />
          <button
            onClick={() => onMasterOpenChange(!masterOpen)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition
              ${activeTab === 'masters' ? 'text-[#E6C687]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <LucideSettings size={15} className="shrink-0" />
            <span className="flex-1 text-left">マスタ管理</span>
            {masterOpen
              ? <LucideChevronDown  size={13} />
              : <LucideChevronRight size={13} />
            }
          </button>
          {masterOpen && (
            <div>
              <MasterSubItem icon={<LucideClipboardList size={13} />} label="テンプレート管理" sub="templates" activeTab={activeTab} activeSub={masterSubTab} onClick={onMasterSubClick} />
              <MasterSubItem icon={<LucideBuilding2     size={13} />} label="外部業者管理"     sub="vendors"   activeTab={activeTab} activeSub={masterSubTab} onClick={onMasterSubClick} />
              {currentRole === 'admin' && (
                <MasterSubItem icon={<LucideShield size={13} />} label="ユーザー管理" sub="users" activeTab={activeTab} activeSub={masterSubTab} onClick={onMasterSubClick} />
              )}
            </div>
          )}
        </>)}
      </nav>

      {/* ユーザーエリア */}
      <div className="shrink-0 border-t border-[#C5A059]/10">
        <button
          onClick={() => setUserPopOpen(o => !o)}
          className="w-full flex items-center gap-2.5 p-3 hover:bg-white/5 transition"
        >
          <div className="h-7 w-7 rounded-full bg-[#1C2C54] border border-[#C5A059]/30 flex items-center justify-center text-[11px] font-bold text-[#E6C687] shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-medium text-white truncate">{user.displayName}</p>
            <p className="text-[9px] text-gray-500">{ROLE_LABEL[currentRole]}</p>
          </div>
          <LucidePencil size={12} className="text-gray-600 shrink-0" />
        </button>

        {userPopOpen && (
          <div className="border-t border-white/10 bg-[#0D1530]">
            <button onClick={() => { onProfileOpen(); setUserPopOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-gray-300 hover:bg-white/5 hover:text-white transition">
              <LucideUserCircle size={14} />プロフィール閲覧・編集
            </button>
            <div className="px-3 py-2">
              <p className="text-[9px] text-gray-500 mb-1.5 flex items-center gap-1"><LucidePalette size={11} />カラーテーマ</p>
              <div className="flex gap-2">
                {THEMES.map(t => (
                  <button key={t.id} title={t.label} onClick={() => onThemeChange(t.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition
                      ${theme === t.id ? 'border-[#C5A059]/60 bg-[#C5A059]/10 text-[#E6C687]' : 'border-white/10 text-gray-500 hover:border-white/20'}`}>
                    <span className="flex gap-0.5">
                      <span style={{ width:8, height:8, borderRadius:'50%', background:t.dotBg, border:'1px solid #4b5563', display:'inline-block' }} />
                      <span style={{ width:8, height:8, borderRadius:'50%', background:t.dotAccent, display:'inline-block' }} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {currentRole === 'admin' && staffList.length > 0 && (
              <div className="px-3 py-2 border-t border-white/10">
                <p className="text-[9px] text-gray-500 mb-1">ユーザー切替（SU）</p>
                <select value={selectedStaff} onChange={e => onStaffChange(e.target.value)}
                  className="w-full bg-[#0D1530] border border-[#C5A059]/20 text-white text-[10px] rounded px-2 py-1 focus:outline-none">
                  {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <button onClick={() => { onLogout(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-400 hover:bg-red-900/20 hover:text-red-300 transition border-t border-white/10">
              <LucideLogOut size={14} />ログアウト
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ハンバーガーボタン（App.tsx の header 内で使用） ────────────

export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex lg:hidden items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
      aria-label="メニューを開く"
    >
      <LucideMenu size={18} />
    </button>
  );
}
