import { useMemo, useState } from 'react';
import {
  LucideBarChart3, LucideFilter, LucidePrinter, LucideTrendingUp,
} from 'lucide-react';
import type { Customer, Project, ProjectStatus, Contract } from '@/types';
import { STATUS_LABEL, PROJECT_CATEGORIES } from './DatabasePage';
import { openPrintPreview } from '@/services/documentService';

// ─────────────────────────────────────────────────────────────
// 定数・ユーティリティ
// ─────────────────────────────────────────────────────────────

/** 受注金額の集計対象とするステータス（失注・引き合い・見積中は除外） */
const REVENUE_STATUSES: ProjectStatus[] = ['contract', 'construction', 'completed', 'settlement', 'closed'];

const ALL_STATUSES: ProjectStatus[] = [
  'lead', 'estimate', 'contract', 'construction', 'completed', 'settlement', 'closed', 'lost',
];

const fmtYen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
const fmtMonth = (ds: string) => ds.slice(0, 7); // "2026-05-10" → "2026-05"

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const COLORS = ['#C5A059', '#60A5FA', '#34D399', '#F472B6', '#A78BFA', '#FBBF24', '#F87171', '#2DD4BF'];

// ─────────────────────────────────────────────────────────────
// SVG バーチャート（縦軸: ラベル、横棒）
// ─────────────────────────────────────────────────────────────

function HBarChart({ data, valueFmt = (v: number) => v.toLocaleString() }: {
  data: { label: string; value: number; color?: string }[];
  valueFmt?: (v: number) => string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  if (data.length === 0) {
    return <p className="text-xs text-gray-600 text-center py-6">データがありません</p>;
  }
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="text-gray-300 truncate">{d.label}</span>
            <span className="font-mono font-bold text-white shrink-0 ml-2">{valueFmt(d.value)}</span>
          </div>
          <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? COLORS[i % COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SVG 折れ線/エリアチャート（月別推移）
// ─────────────────────────────────────────────────────────────

function TrendChart({ data, valueFmt = (v: number) => v.toLocaleString() }: {
  data: { label: string; value: number }[];
  valueFmt?: (v: number) => string;
}) {
  const W = 600, H = 180, PAD = 28;
  const max = Math.max(...data.map(d => d.value), 1);
  const n   = data.length;

  if (n === 0) {
    return <p className="text-xs text-gray-600 text-center py-6">データがありません</p>;
  }

  const x = (i: number) => n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`).join(' ');
  const areaPath = `${linePath} L ${x(n - 1)} ${H - PAD} L ${x(0)} ${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#374151" strokeWidth="1" />
      <path d={areaPath} fill="#C5A059" opacity="0.12" />
      <path d={linePath} fill="none" stroke="#C5A059" strokeWidth="2" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={x(i)} cy={y(d.value)} r="3" fill="#E6C687" />
          <text x={x(i)} y={H - PAD + 14} fontSize="9" fill="#9CA3AF" textAnchor="middle">{d.label}</text>
          <text x={x(i)} y={y(d.value) - 8} fontSize="9" fill="#E6C687" textAnchor="middle" fontWeight="bold">
            {valueFmt(d.value)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// メインページ
// ─────────────────────────────────────────────────────────────

interface Props {
  projects:  Project[];
  customers: Customer[];
  contracts: Contract[];
  staffList: string[];
}

export default function AnalyticsPage({ projects, customers, contracts, staffList }: Props) {
  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(() => fmtDate(monthStart(today)));
  const [dateTo,   setDateTo]   = useState(() => fmtDate(today));
  const [assignee, setAssignee] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // ── フィルタ適用後の案件 ──────────────────────────────────
  const filtered = useMemo(() => {
    return projects.filter(p => {
      const ds = p.lastActivityAt?.slice(0, 10);
      if (!ds || ds < dateFrom || ds > dateTo) return false;
      if (assignee !== 'ALL' && p.assignee !== assignee) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && (p.category ?? '未設定') !== categoryFilter) return false;
      return true;
    });
  }, [projects, dateFrom, dateTo, assignee, statusFilter, categoryFilter]);

  const revenueProjects = useMemo(
    () => filtered.filter(p => REVENUE_STATUSES.includes(p.status)),
    [filtered],
  );

  // ── KPI サマリ ────────────────────────────────────────────
  const totalAmount = revenueProjects.reduce((s, p) => s + (p.amount ?? 0), 0);
  const totalProfit = revenueProjects.reduce((s, p) => s + (p.profit ?? 0), 0);
  const profitRate  = totalAmount > 0 ? Math.round((totalProfit / totalAmount) * 1000) / 10 : 0;
  const lostCount   = filtered.filter(p => p.status === 'lost').length;

  // ── ステータス別件数 ───────────────────────────────────────
  const byStatus = useMemo(() => {
    return ALL_STATUSES
      .map(st => ({ label: STATUS_LABEL[st], value: filtered.filter(p => p.status === st).length, color: undefined }))
      .filter(d => d.value > 0);
  }, [filtered]);

  // ── 担当者別 受注金額 ─────────────────────────────────────
  const byAssignee = useMemo(() => {
    const names = assignee === 'ALL' ? staffList : [assignee];
    return names
      .map(name => ({
        label: name,
        value: revenueProjects.filter(p => p.assignee === name).reduce((s, p) => s + (p.amount ?? 0), 0),
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [revenueProjects, staffList, assignee]);

  // ── カテゴリ別 受注金額 ────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    revenueProjects.forEach(p => {
      const key = p.category ?? '未設定';
      map.set(key, (map.get(key) ?? 0) + (p.amount ?? 0));
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [revenueProjects]);

  // ── 月別推移（受注金額） ───────────────────────────────────
  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    revenueProjects.forEach(p => {
      const m = fmtMonth(p.lastActivityAt);
      map.set(m, (map.get(m) ?? 0) + (p.amount ?? 0));
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label: label.slice(5), value }));
  }, [revenueProjects]);

  const custName = (id: string) => customers.find(c => c.customerId === id)?.name ?? '不明';

  // ── レポート出力（印刷用HTML） ────────────────────────────
  const handlePrint = () => {
    const rows = filtered
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .map(p => `
        <tr>
          <td>${p.lastActivityAt.slice(0, 10)}</td>
          <td>${custName(p.customerId)}</td>
          <td>${p.title}</td>
          <td>${p.category ?? '—'}</td>
          <td>${p.assignee}</td>
          <td>${STATUS_LABEL[p.status]}</td>
          <td style="text-align:right">${fmtYen(p.amount ?? 0)}</td>
          <td style="text-align:right">${fmtYen(p.profit ?? 0)}</td>
        </tr>`).join('');

    const html = `
      <html><head><meta charset="utf-8"><title>営業分析レポート ${dateFrom}〜${dateTo}</title>
      <style>
        body { font-family: 'Hiragino Sans', sans-serif; padding: 24px; color: #1a1a1a; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p.meta { font-size: 11px; color: #555; margin-bottom: 16px; }
        .kpis { display: flex; gap: 16px; margin-bottom: 20px; }
        .kpi { border: 1px solid #ccc; border-radius: 8px; padding: 10px 16px; }
        .kpi .label { font-size: 10px; color: #777; }
        .kpi .value { font-size: 16px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; }
        th { background: #f0f0f0; text-align: left; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <h1>営業分析レポート</h1>
        <p class="meta">対象期間: ${dateFrom} 〜 ${dateTo} ／ 担当: ${assignee === 'ALL' ? '全員' : assignee} ／ ステータス: ${statusFilter === 'ALL' ? '全件' : STATUS_LABEL[statusFilter]} ／ カテゴリ: ${categoryFilter === 'ALL' ? '全件' : categoryFilter} ／ 出力日時: ${new Date().toLocaleString('ja-JP')}</p>
        <div class="kpis">
          <div class="kpi"><div class="label">対象案件数</div><div class="value">${filtered.length}件</div></div>
          <div class="kpi"><div class="label">受注金額合計</div><div class="value">${fmtYen(totalAmount)}</div></div>
          <div class="kpi"><div class="label">粗利合計</div><div class="value">${fmtYen(totalProfit)}</div></div>
          <div class="kpi"><div class="label">粗利率</div><div class="value">${profitRate}%</div></div>
          <div class="kpi"><div class="label">失注件数</div><div class="value">${lostCount}件</div></div>
        </div>
        <table>
          <thead><tr><th>活動日</th><th>顧客名</th><th>案件名</th><th>カテゴリ</th><th>担当</th><th>ステータス</th><th>受注金額</th><th>粗利</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#999">対象データがありません</td></tr>'}</tbody>
        </table>
      </body></html>`;
    openPrintPreview(html);
  };

  return (
    <div className="space-y-4">

      {/* ── ヘッダー + フィルタ ── */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <LucideBarChart3 className="text-[#C5A059]" size={18} />
              分析レポート
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">条件を指定して営業状況を集計・可視化します</p>
          </div>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold px-3 py-2 rounded-lg transition">
            <LucidePrinter size={13} /> レポート出力
          </button>
        </div>

        {/* フィルタ行 */}
        <div className="flex flex-wrap items-end gap-3 bg-[#0B132B] border border-gray-800 rounded-lg p-3">
          <span className="text-[10px] text-gray-500 flex items-center gap-1 pb-1.5"><LucideFilter size={11} /> 条件:</span>

          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">期間（活動日）</label>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-[#16223F] border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C5A059]" />
              <span className="text-gray-500 text-xs">〜</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-[#16223F] border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C5A059]" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">担当</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)}
              className="bg-[#16223F] border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C5A059]">
              <option value="ALL">全員</option>
              {staffList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">ステータス</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ProjectStatus | 'ALL')}
              className="bg-[#16223F] border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C5A059]">
              <option value="ALL">全件</option>
              {ALL_STATUSES.map(st => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">案件カテゴリ</label>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="bg-[#16223F] border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C5A059]">
              <option value="ALL">全件</option>
              {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="未設定">未設定</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI サマリ ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '対象案件数', value: `${filtered.length}件`, accent: false },
          { label: '受注金額合計', value: fmtYen(totalAmount), accent: true },
          { label: '粗利合計', value: fmtYen(totalProfit), accent: true },
          { label: '粗利率', value: `${profitRate}%`, accent: false },
          { label: '失注件数', value: `${lostCount}件`, accent: false },
        ].map(card => (
          <div key={card.label} className="bg-[#111A35] border border-gray-800 rounded-xl p-3.5 text-center">
            <p className="text-[10px] text-gray-500">{card.label}</p>
            <p className={`text-base font-black mt-1 ${card.accent ? 'text-[#E6C687]' : 'text-white'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── グラフ群 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
            <LucideBarChart3 size={13} className="text-[#C5A059]" /> ステータス別 件数
          </h3>
          <HBarChart data={byStatus} valueFmt={v => `${v}件`} />
        </div>

        <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
            <LucideBarChart3 size={13} className="text-[#C5A059]" /> 担当者別 受注金額
          </h3>
          <HBarChart data={byAssignee} valueFmt={fmtYen} />
        </div>

        <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
            <LucideBarChart3 size={13} className="text-[#C5A059]" /> 案件カテゴリ別 受注金額
          </h3>
          <HBarChart data={byCategory} valueFmt={fmtYen} />
        </div>

        <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 lg:col-span-2">
          <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
            <LucideTrendingUp size={13} className="text-[#C5A059]" /> 月別 受注金額推移
          </h3>
          <TrendChart data={byMonth} valueFmt={fmtYen} />
        </div>
      </div>
    </div>
  );
}
