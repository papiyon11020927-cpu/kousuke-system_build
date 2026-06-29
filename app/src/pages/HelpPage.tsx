import { useRef, useState } from 'react';
import {
  LucideBookOpen, LucideListChecks, LucideHelpCircle,
  LucideChevronDown, LucideChevronRight, LucideMonitor, LucideSmartphone,
  LucideUsers, LucideCalendar, LucideMic, LucideLayoutDashboard,
  LucideLayers, LucideTarget, LucideFileText, LucideBarChart3, LucideSettings,
  LucideCheckCircle2, LucideCircle, LucideInfo, LucideListOrdered, LucideUserCog,
  LucideWorkflow, LucideRefreshCw, LucideShield, LucideArrowRight,
} from 'lucide-react';
import { overviewSections, featureGuides, faqItems, initialSetupSteps, businessFlowSteps } from '@/data/tutorialContent';
import type { FeatureGuide, FlowStep } from '@/data/tutorialContent';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LucideUsers, LucideCalendar, LucideMic, LucideLayoutDashboard,
  LucideLayers, LucideTarget, LucideFileText, LucideBarChart3, LucideSettings, LucideShield,
};

type HelpTab = 'overview' | 'flow' | 'guides' | 'faq';

export default function HelpPage() {
  const [tab, setTab] = useState<HelpTab>('overview');
  const [guideOpenId, setGuideOpenId] = useState<string | null>(featureGuides[0]?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    requestAnimationFrame(() => {
      // ヘルプページ自身だけでなく、外側の <main> など祖先のスクロールも先頭に戻す
      let el: HTMLElement | null = scrollRef.current;
      while (el) {
        el.scrollTop = 0;
        el = el.parentElement;
      }
      window.scrollTo({ top: 0 });
    });
  };

  const changeTab = (next: HelpTab) => {
    setTab(next);
    scrollToTop();
  };

  const goToGuide = (guideId: string) => {
    setGuideOpenId(guideId);
    setTab('guides');
    scrollToTop();
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ヘッダー */}
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <LucideHelpCircle size={18} className="text-[#C5A059]" />
            ヘルプ／チュートリアル
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            本システムの概要・各機能の使い方・よくある質問をまとめています。
          </p>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-700">
          <HelpTabButton active={tab === 'overview'} icon={<LucideBookOpen size={13} />} label="概要" onClick={() => changeTab('overview')} />
          <HelpTabButton active={tab === 'flow'}     icon={<LucideListOrdered size={13} />} label="業務フロー" onClick={() => changeTab('flow')} />
          <HelpTabButton active={tab === 'guides'}   icon={<LucideListChecks size={13} />} label="機能ガイド" onClick={() => changeTab('guides')} />
          <HelpTabButton active={tab === 'faq'}      icon={<LucideHelpCircle size={13} />} label="FAQ" onClick={() => changeTab('faq')} />
        </div>

        {tab === 'overview' && <OverviewTab />}
        {tab === 'flow'     && <BusinessFlowTab onNavigateToGuide={goToGuide} />}
        {tab === 'guides'   && <GuidesTab openId={guideOpenId} onOpenChange={setGuideOpenId} />}
        {tab === 'faq'      && <FaqTab />}
      </div>
    </div>
  );
}

function HelpTabButton({ active, icon, label, onClick }: {
  active: boolean; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition
        ${active
          ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5'
          : 'text-gray-400 hover:text-white'}`}
    >
      {icon}{label}
    </button>
  );
}

// ─── 概要タブ ───────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-3">
      {overviewSections.map(s => (
        <div key={s.id} className="bg-[#111A35] border border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-bold text-[#E6C687] mb-1.5">{s.title}</h3>
          <p className="text-xs text-gray-300 leading-relaxed">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─── 業務フロータブ ──────────────────────────────────────────

function getFrequencyBadgeClass(s: FlowStep): string {
  if (!s.required) return 'bg-amber-600 text-white border border-amber-400';
  if (s.frequency === '初回のみ') return 'bg-blue-600 text-white border border-blue-400';
  return 'bg-emerald-600 text-white border border-emerald-400';
}

type FlowView = 'list' | 'flowchart';

function BusinessFlowTab({ onNavigateToGuide }: { onNavigateToGuide: (guideId: string) => void }) {
  const [view, setView] = useState<FlowView>('list');

  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        <ViewToggle active={view === 'list'}       icon={<LucideListOrdered size={11} />} label="リスト表示"      onClick={() => setView('list')} />
        <ViewToggle active={view === 'flowchart'}  icon={<LucideWorkflow size={11} />}    label="フローチャート表示" onClick={() => setView('flowchart')} />
      </div>

      <FlowSection
        title="初期設定（管理者）"
        description="最初に一度（または業者が増えた時など低頻度に）行うマスタ登録です。日々の営業作業の前提になります。"
        steps={initialSetupSteps}
        view={view}
        onNavigateToGuide={onNavigateToGuide}
      />

      <FlowSection
        title="営業の業務サイクル"
        description="顧客登録から見積・契約・精算まで、案件ごとに繰り返す日常業務です。「訪問スケジュール登録」と「現場報告」は、案件が成約するまで何度も繰り返されます。"
        steps={businessFlowSteps}
        view={view}
        onNavigateToGuide={onNavigateToGuide}
      />
    </div>
  );
}

function FlowSection({ title, description, steps, view, onNavigateToGuide }: {
  title: string;
  description: string;
  steps: FlowStep[];
  view: FlowView;
  onNavigateToGuide: (guideId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-[#E6C687]">{title}</h2>
        <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">{description}</p>
      </div>
      {view === 'list' ? (
        <FlowListView steps={steps} onNavigateToGuide={onNavigateToGuide} />
      ) : (
        <FlowChartView steps={steps} onNavigateToGuide={onNavigateToGuide} />
      )}
    </div>
  );
}

function GuideLinkButton({ guideId, onNavigateToGuide }: { guideId: string; onNavigateToGuide: (guideId: string) => void }) {
  return (
    <button
      onClick={() => onNavigateToGuide(guideId)}
      className="flex items-center gap-1 text-[10px] font-semibold text-[#E6C687] hover:text-white transition pt-1"
    >
      詳しい使い方を見る<LucideArrowRight size={11} />
    </button>
  );
}

function ViewToggle({ active, icon, label, onClick }: {
  active: boolean; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition border
        ${active
          ? 'border-[#C5A059]/60 bg-[#C5A059]/10 text-[#E6C687]'
          : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}
    >
      {icon}{label}
    </button>
  );
}

function FlowListView({ steps, onNavigateToGuide }: { steps: FlowStep[]; onNavigateToGuide: (guideId: string) => void }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s) => (
        <li key={s.id} className="bg-[#111A35] border border-gray-700 rounded-xl p-4 flex gap-3">
          <span className="shrink-0 h-7 w-7 rounded-full bg-[#C5A059]/15 text-[#E6C687] text-xs font-bold flex items-center justify-center">
            {s.order}
          </span>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white">{s.title}</p>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${getFrequencyBadgeClass(s)}`}>
                {s.frequency}
              </span>
              {!s.required && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 border border-gray-600">
                  任意
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">{s.description}</p>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <LucideUserCog size={11} />{s.who}
              </span>
              <span className="text-[10px] text-[#C5A059] flex items-center gap-1">
                <LucideChevronRight size={11} />{s.location}
              </span>
            </div>
            {s.loop === 'loop-end' && (
              <p className="text-[10px] text-emerald-300 flex items-center gap-1 pt-1">
                <LucideRefreshCw size={11} />
                成約に十分な情報が集まるまで「訪問スケジュール登録」と「現場報告」を繰り返します
              </p>
            )}
            {s.guideId && <GuideLinkButton guideId={s.guideId} onNavigateToGuide={onNavigateToGuide} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

// フローチャート表示：必須ステップは縦の本流、任意ステップは点線枠で区別する。
// 「訪問スケジュール登録 → 現場報告」はループとして表現し、成約まで繰り返すことを示す。
function FlowChartView({ steps, onNavigateToGuide }: { steps: FlowStep[]; onNavigateToGuide: (guideId: string) => void }) {
  return (
    <div className="bg-[#0B132B] border border-gray-700 rounded-xl p-4 sm:p-6 overflow-x-auto">
      <div className="flex flex-col items-center min-w-[280px]">
        {steps.map((s, i) => (
          <div key={s.id} className="flex flex-col items-center w-full max-w-sm">
            {i > 0 && (
              <div className="flex flex-col items-center py-1">
                <div className="w-px h-4 bg-gray-600" />
                <LucideChevronDown size={14} className="text-gray-600 -mt-1" />
              </div>
            )}
            <div
              className={`w-full rounded-xl p-3.5 transition
                ${!s.required
                  ? 'border border-dashed border-amber-500/50 bg-[#111A35]'
                  : 'border border-[#C5A059]/40 bg-[#111A35]'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`shrink-0 h-6 w-6 rounded-full text-[11px] font-bold flex items-center justify-center
                  ${!s.required ? 'bg-amber-600 text-white' : 'bg-[#C5A059]/20 text-[#E6C687]'}`}
                >
                  {s.order}
                </span>
                <p className="text-xs font-bold text-white flex-1 truncate">{s.title}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap pl-8">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${getFrequencyBadgeClass(s)}`}>
                  {s.frequency}
                </span>
                {!s.required && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 border border-gray-600">
                    任意
                  </span>
                )}
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <LucideUserCog size={10} />{s.who}
                </span>
              </div>
              <p className="text-[10px] text-[#C5A059] pl-8 mt-1 flex items-center gap-1">
                <LucideChevronRight size={10} />{s.location}
              </p>
              {s.guideId && (
                <div className="pl-8 mt-1.5">
                  <GuideLinkButton guideId={s.guideId} onNavigateToGuide={onNavigateToGuide} />
                </div>
              )}
            </div>

            {s.loop === 'loop-end' && (
              <div className="flex flex-col items-center py-2">
                <div className="flex items-center gap-1.5 bg-emerald-900/30 border border-dashed border-emerald-600/50 rounded-full px-3 py-1">
                  <LucideRefreshCw size={11} className="text-emerald-300" />
                  <span className="text-[10px] font-semibold text-emerald-200">成約まで繰り返す</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-4 flex items-center justify-center gap-3 flex-wrap">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-px bg-gray-500" />実線＝必須の流れ</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-px border-t border-dashed border-amber-500" />点線＝任意のステップ</span>
        <span className="flex items-center gap-1"><LucideRefreshCw size={10} className="text-emerald-300" />＝繰り返しサイクル</span>
      </p>
    </div>
  );
}

// ─── 機能ガイドタブ ──────────────────────────────────────────

function GuidesTab({ openId, onOpenChange }: { openId: string | null; onOpenChange: (id: string | null) => void }) {
  return (
    <div className="space-y-2">
      {featureGuides.map(g => (
        <GuideCard
          key={g.id}
          guide={g}
          open={openId === g.id}
          onToggle={() => onOpenChange(openId === g.id ? null : g.id)}
        />
      ))}
    </div>
  );
}

function GuideCard({ guide, open, onToggle }: { guide: FeatureGuide; open: boolean; onToggle: () => void }) {
  const [device, setDevice] = useState<'pc' | 'mobile'>('pc');
  const Icon = ICON_MAP[guide.icon] ?? LucideInfo;

  return (
    <div className="bg-[#111A35] border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
      >
        <Icon size={16} className="text-[#C5A059] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{guide.title}</p>
          <p className="text-[11px] text-gray-500 truncate">{guide.summary}</p>
        </div>
        {open ? <LucideChevronDown size={15} className="text-gray-500 shrink-0" /> : <LucideChevronRight size={15} className="text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-3">

          {(guide.requiredFields.length > 0 || guide.optionalFields.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {guide.requiredFields.length > 0 && (
                <FieldList
                  title="登録必須項目"
                  items={guide.requiredFields}
                  icon={<LucideCheckCircle2 size={12} className="text-red-400" />}
                  badgeClass="bg-red-900/30 text-red-300 border border-red-700/40"
                  badgeLabel="必須"
                />
              )}
              {guide.optionalFields.length > 0 && (
                <FieldList
                  title="任意項目"
                  items={guide.optionalFields}
                  icon={<LucideCircle size={12} className="text-gray-500" />}
                  badgeClass="bg-gray-700/40 text-gray-300 border border-gray-600/40"
                  badgeLabel="任意"
                />
              )}
            </div>
          )}

          {guide.laterUpdatedFields.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <LucideInfo size={12} /> あとから自動更新・別作業で更新される項目
              </p>
              {guide.laterUpdatedFields.map(f => (
                <p key={f.field} className="text-[12px] text-amber-50 leading-relaxed">
                  <span className="font-bold text-amber-200">{f.field}</span> — {f.note}
                </p>
              ))}
            </div>
          )}

          {/* PC/モバイル切り替え */}
          <div>
            <div className="flex gap-1 mb-2">
              <DeviceToggle active={device === 'pc'}     icon={<LucideMonitor size={11} />}    label="PC版"     onClick={() => setDevice('pc')} />
              <DeviceToggle active={device === 'mobile'} icon={<LucideSmartphone size={11} />} label="モバイル版" onClick={() => setDevice('mobile')} />
            </div>
            <ol className="space-y-1.5">
              {guide.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-300">
                  <span className="shrink-0 h-5 w-5 rounded-full bg-[#C5A059]/15 text-[#E6C687] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="leading-relaxed pt-0.5">{device === 'pc' ? s.pc : s.mobile}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceToggle({ active, icon, label, onClick }: {
  active: boolean; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition border
        ${active
          ? 'border-[#C5A059]/60 bg-[#C5A059]/10 text-[#E6C687]'
          : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}
    >
      {icon}{label}
    </button>
  );
}

function FieldList({ title, items, icon, badgeClass, badgeLabel }: {
  title: string; items: string[]; icon: React.ReactNode; badgeClass: string; badgeLabel: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 mb-1.5 flex items-center gap-1">
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${badgeClass}`}>{badgeLabel}</span>
        {title}
      </p>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item} className="flex items-start gap-1.5 text-[11px] text-gray-300">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── FAQタブ ────────────────────────────────────────────────

function FaqTab() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {faqItems.map(f => {
        const open = openId === f.id;
        return (
          <div key={f.id} className="bg-[#111A35] border border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenId(open ? null : f.id)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition"
            >
              <span className="text-[#C5A059] text-xs font-bold shrink-0">Q.</span>
              <span className="flex-1 text-xs font-medium text-white">{f.question}</span>
              {open ? <LucideChevronDown size={14} className="text-gray-500 shrink-0" /> : <LucideChevronRight size={14} className="text-gray-500 shrink-0" />}
            </button>
            {open && (
              <div className="px-4 pb-3 flex items-start gap-2 border-t border-gray-800 pt-2.5">
                <span className="text-emerald-400 text-xs font-bold shrink-0">A.</span>
                <p className="text-xs text-gray-300 leading-relaxed">{f.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
