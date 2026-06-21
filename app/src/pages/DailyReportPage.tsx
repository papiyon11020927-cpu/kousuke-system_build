import { useState, useMemo } from 'react';
import {
  LucideFileText, LucideChevronLeft, LucideChevronRight,
  LucideSparkles, LucideActivity, LucideClock, LucideUser2,
  LucideChevronDown, LucideChevronUp, LucideRefreshCw,
} from 'lucide-react';
import type { Customer, DailyReport, InOutLog, Project, UserRole } from '@/types';
import { createDailyReport, createTeamDailyReport, TEAM_REPORT_STAFF_NAME } from '@/services/dailyReportService';

// ─────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDay = (ds: string, n: number): string => {
  const d = new Date(ds + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};

const localDateOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fmtDuration = (s: number): string => {
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return `${m}分${sec > 0 ? sec + '秒' : ''}`;
  return `${Math.floor(m / 60)}時間${m % 60}分`;
};

// ─────────────────────────────────────────────────────────────
// 訪問ログカード（1件）
// ─────────────────────────────────────────────────────────────

function LogCard({
  log, customers, projects,
}: {
  log: InOutLog; customers: Customer[]; projects: Project[];
}) {
  const customer = customers.find(c => c.customerId === log.customerId);
  const project  = projects.find(p => p.projectId  === log.projectId);
  const time     = new Date(log.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-[#0B132B] border border-gray-800 rounded-lg p-3 text-xs space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="font-bold text-white truncate">{customer?.name ?? '—'}</div>
          {project && <div className="text-gray-400 truncate">{project.title}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[#E6C687]">{time}</div>
          {log.duration != null && (
            <div className="text-gray-500">{fmtDuration(log.duration)}</div>
          )}
        </div>
      </div>

      {log.structuredData && typeof log.structuredData === 'object' ? (
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ['顧客の課題',    log.structuredData.customerIssue],
            ['キーマンの反応', log.structuredData.keymanReaction],
            ['予算感',        log.structuredData.budget],
            ['次回アクション', log.structuredData.nextAction],
          ] as [string, unknown][]).map(([label, val]) => (
            val != null && val !== '' ? (
              <div key={label} className="bg-[#111A35] p-1.5 rounded border border-gray-800">
                <span className="text-[9px] text-gray-500 block">{label}</span>
                <span className="text-gray-200 leading-snug">{String(val)}</span>
              </div>
            ) : null
          ))}
        </div>
      ) : log.voiceText ? (
        <p className="text-gray-400 italic whitespace-pre-wrap leading-relaxed">
          {log.voiceText.substring(0, 200)}{log.voiceText.length > 200 && '...'}
        </p>
      ) : null}

      {log.photoUrls && log.photoUrls.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {log.photoUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={`写真${i + 1}`}
                className="h-10 w-10 object-cover rounded border border-gray-700 hover:brightness-110 transition" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// スタッフ別日報カード（管理者ビュー用）
// ─────────────────────────────────────────────────────────────

function StaffDailyCard({
  staffName, dateStr, outLogs, report, customers, projects, onGenerate, isGenerating,
}: {
  staffName:   string;
  dateStr:     string;
  outLogs:     InOutLog[];
  report:      DailyReport | null;
  customers:   Customer[];
  projects:    Project[];
  onGenerate:  () => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalDuration = outLogs.reduce((acc, l) => acc + (l.duration ?? 0), 0);

  return (
    <div className="bg-[#0B132B] border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        {/* スタッフ名 + 統計 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[#1C2C54] flex items-center justify-center shrink-0">
              <LucideUser2 size={14} className="text-[#C5A059]" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{staffName}</div>
              <div className="text-[10px] text-gray-400">{dateStr}</div>
            </div>
          </div>
          <div className="text-right text-xs text-gray-300 shrink-0">
            <div className="font-mono font-bold text-[#E6C687]">{outLogs.length}件</div>
            {totalDuration > 0 && <div className="text-gray-500">{fmtDuration(totalDuration)}</div>}
          </div>
        </div>

        {/* AI日報サマリー */}
        {report ? (
          <div className="bg-[#111A35] border border-gray-700 rounded-lg p-3 text-xs text-gray-200 leading-relaxed">
            <div className="flex items-center gap-1.5 text-[#C5A059] text-[10px] font-bold mb-1">
              <LucideSparkles size={10} /> AI 日報サマリー
            </div>
            {String(report.summary ?? '')}</div>
        ) : outLogs.length > 0 ? (
          <button onClick={onGenerate} disabled={isGenerating}
            className="w-full bg-[#C5A059]/10 hover:bg-[#C5A059]/20 border border-[#C5A059]/30 text-[#E6C687] text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50">
            {isGenerating
              ? <><LucideActivity size={12} className="animate-spin" /> 生成中...</>
              : <><LucideSparkles size={12} /> AI日報を生成</>}
          </button>
        ) : (
          <p className="text-xs text-gray-500 italic">本日の訪問記録がありません</p>
        )}

        {/* 展開トグル */}
        {outLogs.length > 0 && (
          <button onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1 text-[11px] text-gray-400 hover:text-white transition py-1">
            {expanded ? <><LucideChevronUp size={12} /> 折りたたむ</> : <><LucideChevronDown size={12} /> ログ詳細 ({outLogs.length}件)</>}
          </button>
        )}
      </div>

      {/* ログ一覧 */}
      {expanded && outLogs.length > 0 && (
        <div className="border-t border-gray-800 p-4 space-y-2 bg-[#0A0F1D]/40">
          {outLogs.map(log => (
            <LogCard key={log.logId} log={log} customers={customers} projects={projects} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

interface Props {
  logs:          InOutLog[];
  dailyReports:  DailyReport[];
  customers:     Customer[];
  projects:      Project[];
  staffList:     string[];
  currentRole:   UserRole;
  selectedStaff: string;
  onShowToast:   (msg: string) => void;
}

export default function DailyReportPage({
  logs, dailyReports, customers, projects,
  staffList, currentRole, selectedStaff, onShowToast,
}: Props) {
  const [selectedDate,  setSelectedDate]  = useState(() => fmtDate(new Date()));
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  // 選択日のアウトログ
  const outLogsForDate = useMemo(() =>
    logs.filter(l => l.type === 'out' && localDateOf(l.timestamp) === selectedDate),
    [logs, selectedDate],
  );

  // スタッフ別ログ
  const logsByStaff = useMemo(() => {
    const map = new Map<string, InOutLog[]>();
    staffList.forEach(s => map.set(s, []));
    outLogsForDate.forEach(l => {
      const arr = map.get(l.userName) ?? [];
      arr.push(l);
      map.set(l.userName, arr);
    });
    return map;
  }, [outLogsForDate, staffList]);

  // 日報レポート（保存済み）
  const getReport = (staffName: string): DailyReport | null =>
    dailyReports.find(r => r.staffName === staffName && r.dateStr === selectedDate) ?? null;

  // 自分のログ（staff ロール用）
  const myOutLogs = useMemo(() =>
    outLogsForDate.filter(l => l.userName === selectedStaff),
    [outLogsForDate, selectedStaff],
  );
  const myReport = getReport(selectedStaff);

  const totalDuration = myOutLogs.reduce((acc, l) => acc + (l.duration ?? 0), 0);

  // AI 日報生成
  const handleGenerate = async (staffName: string) => {
    setGeneratingFor(staffName);
    try {
      const targetLogs = logsByStaff.get(staffName) ?? [];
      await createDailyReport(staffName, selectedDate, targetLogs);
      onShowToast(`${staffName} の日報を生成しました`);
    } catch {
      onShowToast('日報の生成に失敗しました');
    } finally {
      setGeneratingFor(null);
    }
  };

  // AI 全員サマリー生成（管理者向け：全スタッフの活動を1件に統合）
  const handleGenerateTeam = async () => {
    setGeneratingFor(TEAM_REPORT_STAFF_NAME);
    try {
      const entries = staffList.map(s => ({ staffName: s, logs: logsByStaff.get(s) ?? [] }));
      await createTeamDailyReport(selectedDate, entries);
      onShowToast('全員サマリーを生成しました');
    } catch {
      onShowToast('全員サマリーの生成に失敗しました');
    } finally {
      setGeneratingFor(null);
    }
  };

  const teamReport = getReport(TEAM_REPORT_STAFF_NAME);

  const isToday = selectedDate === fmtDate(new Date());

  return (
    <div className="space-y-4">

      {/* ── ヘッダー ── */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <LucideFileText className="text-[#C5A059]" size={18} />
              {currentRole === 'manager' ? '日報管理（管理者）' : `日報 — ${selectedStaff}`}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              1日の活動をAIが自動要約。管理者は全スタッフの日報を確認できます。
            </p>
          </div>

          {/* 日付ナビゲーター */}
          <div className="flex items-center gap-1 bg-[#0B132B] border border-gray-800 rounded-lg px-2 py-1">
            <button onClick={() => setSelectedDate(d => addDay(d, -1))}
              className="text-gray-400 hover:text-white p-1">
              <LucideChevronLeft size={14} />
            </button>
            <input type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-white text-center focus:outline-none cursor-pointer" />
            <button onClick={() => setSelectedDate(d => addDay(d, 1))}
              disabled={isToday}
              className="text-gray-400 hover:text-white p-1 disabled:opacity-30">
              <LucideChevronRight size={14} />
            </button>
            {/* DOM常駐 — display:none で insertBefore を防ぐ */}
            <button
              onClick={() => setSelectedDate(fmtDate(new Date()))}
              style={{ display: isToday ? 'none' : 'inline-flex' }}
              className="text-[10px] text-[#C5A059] border border-[#C5A059]/40 px-2 py-0.5 rounded hover:bg-[#C5A059]/10 transition ml-1">
              今日
            </button>
          </div>
        </div>
      </div>

      {/* ── 管理者ビュー ── */}
      {currentRole !== 'staff' && (
        <div className="space-y-3">

          {/* AI 全員サマリー */}
          <div className="bg-[#131F3F] border border-[#C5A059]/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#E6C687] flex items-center gap-1.5">
                <LucideSparkles size={14} /> AI 全員サマリー
              </h3>
              <button
                onClick={handleGenerateTeam}
                disabled={generatingFor === TEAM_REPORT_STAFF_NAME || outLogsForDate.length === 0}
                className="flex items-center gap-1.5 text-[11px] text-[#0A0F1D] bg-[#C5A059] hover:bg-[#E6C687] font-bold px-3 py-1.5 rounded-full transition disabled:opacity-40"
              >
                {generatingFor === TEAM_REPORT_STAFF_NAME
                  ? <><LucideActivity size={11} className="animate-spin" /> 生成中...</>
                  : teamReport
                    ? <><LucideRefreshCw size={11} /> 再生成</>
                    : <><LucideSparkles size={11} /> 生成する</>}
              </button>
            </div>
            {teamReport ? (
              <div className="bg-[#0B132B] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 leading-relaxed">
                {String(teamReport.summary ?? '')}
                <div className="text-[10px] text-gray-500 mt-2 border-t border-gray-800 pt-2 flex items-center justify-between">
                  <span>対象: {staffList.length}名 / 訪問 {teamReport.visitCount}件</span>
                  <span>生成: {new Date(teamReport.generatedAt).toLocaleString('ja-JP')}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">
                {outLogsForDate.length === 0 ? 'この日の訪問記録がありません' : 'ボタンを押すと全スタッフの活動をAIが1件に要約します'}
              </p>
            )}
          </div>

          {staffList.map(staffName => (
            <StaffDailyCard
              key={staffName}
              staffName={staffName}
              dateStr={selectedDate}
              outLogs={logsByStaff.get(staffName) ?? []}
              report={getReport(staffName)}
              customers={customers}
              projects={projects}
              onGenerate={() => handleGenerate(staffName)}
              isGenerating={generatingFor === staffName}
            />
          ))}
        </div>
      )}

      {/* ── 営業・現場スタッフビュー ──
           key={selectedDate} で日付変更時に完全再マウント→ reconciliation を全回避 */}
      {currentRole === 'staff' && (
        <div key={selectedDate} className="space-y-4">
          {/* サマリーカード */}
          <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-[#0B132B] border border-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-[#E6C687]">{myOutLogs.length}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">訪問件数</div>
              </div>
              <div className="bg-[#0B132B] border border-gray-800 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-white font-mono">
                  {totalDuration > 0 ? fmtDuration(totalDuration) : '—'}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                  <LucideClock size={9} /> 合計訪問時間
                </div>
              </div>
              <div className="bg-[#0B132B] border border-gray-800 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                <div className="text-sm font-bold text-white">
                  {myOutLogs.filter(l => l.structuredData).length}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">AI解析済み</div>
              </div>
            </div>

            {/* AI 日報 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#E6C687] flex items-center gap-1.5">
                  <LucideSparkles size={12} /> AI 日報サマリー
                </span>
                <button
                  onClick={() => handleGenerate(selectedStaff)}
                  disabled={generatingFor === selectedStaff || myOutLogs.length === 0}
                  className="flex items-center gap-1.5 text-[11px] text-[#C5A059] border border-[#C5A059]/40 px-2.5 py-1 rounded-full hover:bg-[#C5A059]/10 transition disabled:opacity-40"
                >
                  {generatingFor === selectedStaff
                    ? <><LucideActivity size={11} className="animate-spin" /> 生成中...</>
                    : myReport
                      ? <><LucideRefreshCw size={11} /> 再生成</>
                      : <><LucideSparkles size={11} /> AI日報を生成</>}
                </button>
              </div>

              {/* レポートあり / なし — 両方 DOM 常駐、CSS で切替 */}
              <div
                className="bg-[#0B132B] border border-[#C5A059]/20 rounded-lg p-4 text-sm text-gray-200 leading-relaxed"
                style={{ display: myReport ? 'block' : 'none' }}
              >
                {myReport ? String(myReport.summary ?? '') : ''}
                <div className="text-[10px] text-gray-500 mt-2 border-t border-gray-800 pt-2">
                  生成: {myReport?.generatedAt ? new Date(myReport.generatedAt).toLocaleString('ja-JP') : '—'}
                </div>
              </div>
              <div
                className="bg-[#0B132B] border border-dashed border-gray-700 rounded-lg p-4 text-xs text-gray-500 text-center"
                style={{ display: myReport ? 'none' : 'block' }}
              >
                {myOutLogs.length === 0
                  ? 'この日の訪問記録がありません'
                  : 'ボタンを押してAIが本日の活動を要約します'}
              </div>
            </div>
          </div>

          {/* 訪問ログ一覧 — DOM 常駐、CSS で表示切替 */}
          <div
            className="bg-[#111A35] border border-gray-800 rounded-xl p-4 space-y-3"
            style={{ display: myOutLogs.length > 0 ? 'block' : 'none' }}
          >
            <h3 className="text-xs font-bold text-[#E6C687] flex items-center gap-1.5 border-l-2 border-[#C5A059] pl-2">
              本日の訪問ログ（{myOutLogs.length}件）
            </h3>
            <div className="space-y-2">
              {[...myOutLogs]
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map(log => (
                  <LogCard key={log.logId} log={log} customers={customers} projects={projects} />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
