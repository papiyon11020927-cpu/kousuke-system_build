import { useState, useEffect, useMemo } from 'react';
import { LucideTarget, LucideChevronLeft, LucideChevronRight, LucideSave, LucideCheck } from 'lucide-react';
import type { Project, Schedule, MonthlyGoal } from '@/types';
import { calcKpi, type KpiGoals } from '@/services/kpiService';
import { saveGoal, goalId as makeGoalId } from '@/services/goalService';

interface Props {
  goals:         MonthlyGoal[];
  projects:      Project[];
  schedules:     Schedule[];
  selectedStaff: string;
  onShowToast:   (msg: string) => void;
}

const CURRENT = new Date();

interface GoalRow {
  key:       keyof KpiGoals;
  label:     string;
  unit:      '円' | '件';
  isMoney:   boolean;
}

const ROWS: GoalRow[] = [
  { key: 'salesGoal',    label: '受注金額',  unit: '円', isMoney: true  },
  { key: 'profitGoal',   label: '粗利金額',  unit: '円', isMoney: true  },
  { key: 'surveyGoal',   label: '現調件数',  unit: '件', isMoney: false },
  { key: 'estimateGoal', label: '見積件数',  unit: '件', isMoney: false },
];

const getActual = (key: keyof KpiGoals, staffName: string, projects: Project[], schedules: Schedule[]): number => {
  const kpi = calcKpi(staffName, projects, schedules);
  const map: Record<keyof KpiGoals, number> = {
    salesGoal:    kpi.actualSales,
    profitGoal:   kpi.actualProfit,
    surveyGoal:   kpi.actualSurveyCount,
    estimateGoal: kpi.actualEstimateCount,
  };
  return map[key];
};

const pct = (actual: number, goal: number) =>
  goal > 0 ? Math.min(Math.round((actual / goal) * 100), 100) : 0;

const barColor = (rate: number) =>
  rate >= 100 ? 'bg-emerald-500' : rate >= 70 ? 'bg-[#C5A059]' : rate >= 40 ? 'bg-blue-500' : 'bg-gray-600';

export default function GoalPage({ goals, projects, schedules, selectedStaff, onShowToast }: Props) {
  const [year,  setYear]  = useState(CURRENT.getFullYear());
  const [month, setMonth] = useState(CURRENT.getMonth() + 1);
  const [saved, setSaved] = useState(false);

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const gid       = makeGoalId(selectedStaff, yearMonth);

  const existing = useMemo(
    () => goals.find(g => g.goalId === gid),
    [goals, gid],
  );

  // フォーム初期値（Firestore → ハードコードデフォルト の優先順）
  const [form, setForm] = useState<KpiGoals>(() => toForm(existing));

  useEffect(() => {
    setForm(toForm(existing));
    setSaved(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, existing?.salesGoal]);

  function toForm(g?: MonthlyGoal): KpiGoals {
    const kpi = calcKpi(selectedStaff, [], []);
    return g
      ? { salesGoal: g.salesGoal, profitGoal: g.profitGoal, surveyGoal: g.surveyGoal, estimateGoal: g.estimateGoal }
      : { salesGoal: kpi.salesGoal, profitGoal: kpi.profitGoal, surveyGoal: kpi.surveyGoal, estimateGoal: kpi.estimateGoal };
  }

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const handleSave = async () => {
    const goal: MonthlyGoal = {
      goalId: gid, staffName: selectedStaff, yearMonth,
      salesGoal:    form.salesGoal,
      profitGoal:   form.profitGoal,
      surveyGoal:   form.surveyGoal,
      estimateGoal: form.estimateGoal,
      contractGoal: 0,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveGoal(goal);
      setSaved(true);
      onShowToast(`${yearMonth} の目標を保存しました`);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      onShowToast('保存に失敗しました');
    }
  };

  const isCurrentMonth =
    year === CURRENT.getFullYear() && month === CURRENT.getMonth() + 1;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* ── ヘッダー ── */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <LucideTarget className="text-[#C5A059]" size={20} />
            月次目標管理
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">月ごとの KPI 目標値を設定し、実績と比較します</p>
        </div>

        {/* 月ナビゲーター */}
        <div className="flex items-center gap-1 bg-[#0B132B] border border-gray-800 rounded-lg px-2 py-1">
          <button onClick={prevMonth} className="text-gray-400 hover:text-white p-1">
            <LucideChevronLeft size={16} />
          </button>
          <span className="font-mono text-white text-sm font-bold px-2 min-w-[90px] text-center">
            {year}年{month}月
          </span>
          <button onClick={nextMonth} className="text-gray-400 hover:text-white p-1">
            <LucideChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── 担当者バッジ ── */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400">担当：</span>
        <span className="bg-[#C5A059]/20 text-[#E6C687] border border-[#C5A059]/40 px-3 py-1 rounded-full font-bold">
          {selectedStaff}
        </span>
        {isCurrentMonth && (
          <span className="bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            今月
          </span>
        )}
        {existing && (
          <span className="text-gray-500">
            最終更新: {new Date(existing.updatedAt).toLocaleDateString('ja-JP')}
          </span>
        )}
      </div>

      {/* ── KPI カード群 ── */}
      <div className="space-y-3">
        {ROWS.map(({ key, label, unit, isMoney }) => {
          const actual  = getActual(key, selectedStaff, projects, schedules);
          const goal    = form[key];
          const rate    = pct(actual, goal);
          const display = (v: number) => isMoney ? `¥${v.toLocaleString()}` : `${v} ${unit}`;

          return (
            <div key={key} className="bg-[#111A35] border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                {/* ラベル + 実績 */}
                <div>
                  <p className="text-xs text-gray-400 font-semibold">{label}</p>
                  <p className="text-xl font-black text-white mt-0.5">{display(actual)}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">実績</p>
                </div>

                {/* 達成率 */}
                <div className="text-right shrink-0">
                  <p className={`text-2xl font-black ${
                    rate >= 100 ? 'text-emerald-400' : rate >= 70 ? 'text-[#E6C687]' : 'text-gray-300'
                  }`}>
                    {rate}<span className="text-sm font-bold">%</span>
                  </p>
                  <p className="text-[11px] text-gray-500">達成率</p>
                </div>
              </div>

              {/* プログレスバー */}
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor(rate)}`}
                  style={{ width: `${rate}%` }}
                />
              </div>

              {/* 目標入力 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">目標：</span>
                <div className="relative flex-1">
                  {isMoney && (
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">¥</span>
                  )}
                  <input
                    type="number"
                    value={goal}
                    min={0}
                    onChange={e => {
                      const v = Number(e.target.value);
                      if (!isNaN(v) && v >= 0) setForm(prev => ({ ...prev, [key]: v }));
                    }}
                    className={`w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md ${isMoney ? 'pl-6' : 'pl-3'} pr-3 py-1.5 focus:outline-none focus:border-[#C5A059]`}
                  />
                </div>
                <span className="text-xs text-gray-500 shrink-0">{unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 保存ボタン ── */}
      <button
        onClick={handleSave}
        className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition text-sm ${
          saved
            ? 'bg-emerald-700 text-white'
            : 'bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D]'
        }`}
      >
        {saved
          ? <><LucideCheck size={18} /> 保存しました</>
          : <><LucideSave size={18} /> {yearMonth} の目標を保存</>
        }
      </button>
    </div>
  );
}
