import { useState, useEffect, useRef, useMemo } from 'react';
import {
  LucideMic, LucideMicOff, LucideMapPin, LucideLogIn, LucideLogOut,
  LucideSave, LucideMessageSquare, LucideCheckCircle2, LucideRotateCcw,
  LucideActivity, LucideSend, LucideUser2, LucideAlertCircle,
  LucideCamera, LucideX, LucideLoader2, LucideHistory, LucidePlusCircle,
  LucideChevronDown, LucideChevronUp, LucideFilter,
  LucideEdit2, LucideCalendarPlus, LucideCheckCircle, LucideTrash2,
} from 'lucide-react';
import type { Customer, Project, InOutLog, AiAnalysisResult, StructuredReportData, Schedule, ProjectStatus } from '@/types';
import { saveInLog, saveOutLog, uploadPhotos } from '@/services/reportService';
import { analyzeReport }  from '@/services/aiService';
import { saveProject }    from '@/services/projectService';
import { saveSchedule }   from '@/services/scheduleService';

// ─── 案件ステータス定数（ReportPage 内共用） ───────────────────

const PROJ_STATUSES: ProjectStatus[] = [
  'lead', 'estimate', 'contract', 'construction', 'completed', 'settlement', 'closed', 'lost',
];
const PROJ_STATUS_LABEL: Record<ProjectStatus, string> = {
  lead: '反響', estimate: '見積提出', contract: '契約済',
  construction: '施工中', completed: '完工',
  settlement: '精算中', closed: 'クローズ', lost: '失注',
};
const PROJ_STATUS_COLOR: Record<ProjectStatus, string> = {
  lead:         'bg-gray-700 text-gray-300',
  estimate:     'bg-yellow-900/60 text-yellow-300',
  contract:     'bg-blue-900/60 text-blue-300',
  construction: 'bg-emerald-900/60 text-emerald-300',
  completed:    'bg-gray-800 text-gray-400',
  settlement:   'bg-violet-900/60 text-violet-300',
  closed:       'bg-teal-900/60 text-teal-300',
  lost:         'bg-red-900/40 text-red-400',
};

/** 次回アクションが未設定 or 情報不足かどうか判定 */
const isNextActionMissing = (action: string) =>
  !action.trim() || /未設定|情報不足/.test(action);

// ─── 報告後アクション: 案件情報を更新 ────────────────────────

function PostSaveProjectUpdate({
  project, structuredData, onSaved, onCancel,
}: {
  project:        Project;
  structuredData: StructuredReportData;
  onSaved:        (msg: string) => void;
  onCancel:       () => void;
}) {
  const [status,      setStatus]      = useState<ProjectStatus>(project.status);
  const [probability, setProbability] = useState(String(project.probability ?? 50));
  const [issue,       setIssue]       = useState(structuredData.customerIssue || project.issue || '');
  const [notes,       setNotes]       = useState(project.notes || '');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // 契約以降のステータスは確度を 100% に自動更新
  useEffect(() => {
    if (['contract', 'construction', 'completed', 'settlement', 'closed'].includes(status)) {
      setProbability('100');
    }
  }, [status]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await saveProject({
        ...project,
        status,
        probability:    Math.min(100, Math.max(0, parseInt(probability) || 0)),
        lastActivityAt: new Date().toISOString(),
        ...(issue.trim() ? { issue: issue.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onSaved('案件情報を更新しました');
    } catch (err: any) {
      setError(`更新に失敗しました（${err.code ?? 'unknown'}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#111A35] border border-[#C5A059]/30 rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-bold text-[#E6C687] flex items-center gap-1.5">
        <LucideEdit2 size={13} /> 案件情報を更新する
        <span className="text-gray-500 font-normal font-mono text-[10px] ml-1">{project.projectId}</span>
      </h4>

      {/* ステータス */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">ステータス</label>
        <div className="flex flex-wrap gap-1.5">
          {PROJ_STATUSES.map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition font-medium ${
                status === s ? PROJ_STATUS_COLOR[s] + ' border-current' : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {PROJ_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 確度 */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          確度: <span className="text-white font-bold">{probability}%</span>
        </label>
        <input type="range" min="0" max="100" step="5"
          value={probability} onChange={e => setProbability(e.target.value)}
          className="w-full accent-[#C5A059]" />
      </div>

      {/* 顧客課題 */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          顧客課題・ニーズ
          <span className="ml-1 text-[10px] text-[#C5A059]">（AI解析から自動入力）</span>
        </label>
        <textarea value={issue} onChange={e => setIssue(e.target.value)} rows={2}
          className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
      </div>

      {/* 備考 */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">備考</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
      </div>

      {error && <p className="text-xs text-red-400 bg-red-950/30 rounded px-2 py-1">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 border border-gray-700 text-gray-400 text-xs py-2 rounded-lg hover:border-gray-500 hover:text-white transition">
          キャンセル
        </button>
        <button onClick={handleSave} disabled={loading}
          className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-50">
          {loading ? <><LucideActivity size={13} className="animate-spin" /> 更新中...</> : '更新する'}
        </button>
      </div>
    </div>
  );
}

// ─── 報告後アクション: 次回訪問予定を登録 ────────────────────

function PostSaveScheduleAdd({
  project, customer, structuredData, selectedStaff, aiResult, onSaved, onCancel,
}: {
  project:        Project;
  customer:       Customer;
  structuredData: StructuredReportData;
  selectedStaff:  string;
  aiResult?:      AiAnalysisResult | null;
  onSaved:        (msg: string) => void;
  onCancel:       () => void;
}) {
  const defaultDate = aiResult?.nextVisitDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  })();

  const [date,       setDate]       = useState(defaultDate);
  const [startTime,  setStartTime]  = useState('10:00');
  const [endTime,    setEndTime]    = useState('11:00');
  const [title,      setTitle]      = useState(`次回訪問 — ${customer.name}`);
  const [notes,      setNotes]      = useState(structuredData.nextAction || '');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const handleSave = async () => {
    if (!date) { setError('日付を選択してください'); return; }
    if (!title.trim()) { setError('タイトルを入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      const startAt = new Date(`${date}T${startTime}:00`).toISOString();
      const endAt   = new Date(`${date}T${endTime}:00`).toISOString();
      const schedule: Schedule = {
        scheduleId:     'SCH-' + Date.now(),
        projectId:      project.projectId,
        customerId:     customer.customerId,
        title:          title.trim(),
        startAt,
        endAt,
        assignees:      [selectedStaff].filter(Boolean),
        isLtvTriggered: false,
        createdAt:      new Date().toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      await saveSchedule(schedule);
      onSaved(`次回訪問予定を登録しました（${date}）`);
    } catch (err: any) {
      setError(`登録に失敗しました（${err.code ?? 'unknown'}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#111A35] border border-blue-700/30 rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
        <LucideCalendarPlus size={13} /> 次回訪問予定を登録する
      </h4>

      {/* 日付 */}
      <div>
        <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
          訪問予定日 *
          {aiResult?.nextVisitDate && (
            <span className="text-[10px] text-[#C5A059]">（AI解析から自動設定）</span>
          )}
        </label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
      </div>

      {/* 時刻 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 block mb-1">開始時刻</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
            className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">終了時刻</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
        </div>
      </div>

      {/* タイトル */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">タイトル *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
      </div>

      {/* メモ（次回アクションから自動入力） */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          メモ
          {structuredData.nextAction && (
            <span className="ml-1 text-[10px] text-[#C5A059]">（AI解析の次回アクションから自動入力）</span>
          )}
        </label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
      </div>

      <div className="flex items-center gap-2 bg-blue-950/30 border border-blue-800/30 rounded px-3 py-1.5 text-[11px] text-blue-300">
        担当者: {selectedStaff || '未設定'} ／ 案件: {project.title}
      </div>

      {error && <p className="text-xs text-red-400 bg-red-950/30 rounded px-2 py-1">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 border border-gray-700 text-gray-400 text-xs py-2 rounded-lg hover:border-gray-500 hover:text-white transition">
          キャンセル
        </button>
        <button onClick={handleSave} disabled={loading}
          className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-50">
          {loading ? <><LucideActivity size={13} className="animate-spin" /> 登録中...</> : '予定を登録する'}
        </button>
      </div>
    </div>
  );
}

// ─── 状態定義 ─────────────────────────────────────────────────

type ReportStatus =
  | 'idle'        // 訪問先未選択 or 選択済み（IN前）
  | 'in_progress' // IN記録済・訪問中（タイマー稼働）
  | 'recording'   // 音声録音 or テキスト入力中（OUT後）
  | 'analyzing'   // AI解析中
  | 'chat'        // AI追加質問チャット
  | 'review'      // 構造化データ確認・編集・写真添付
  | 'saved';      // 保存完了

interface Props {
  customers:          Customer[];
  projects:           Project[];
  logs:               InOutLog[];   // 活動履歴ビュー用
  selectedStaff:      string;
  userId:             string;
  onShowToast:        (msg: string) => void;
  initialProjectId?:  string;
  initialCustomerId?: string;
  onMounted?:         () => void;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  idle:        '訪問先を選択',
  in_progress: '訪問中',
  recording:   '報告入力中',
  analyzing:   'AI解析中',
  chat:        'AI追加確認',
  review:      '内容確認',
  saved:       '保存完了',
};

const fmtTime = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

// ─── コンポーネント ───────────────────────────────────────────

// ─── 活動履歴ビュー ────────────────────────────────────────────

type HistoryFilter = '30d' | 'month' | 'all';

function HistoryView({
  logs, customers, projects, selectedStaff,
}: {
  logs: InOutLog[]; customers: Customer[]; projects: Project[]; selectedStaff: string;
}) {
  const [filter,       setFilter]       = useState<HistoryFilter>('30d');
  const [custFilter,   setCustFilter]   = useState('');
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set());

  const now = new Date();

  const filteredLogs = useMemo(() => {
    return logs
      .filter(l => {
        if (l.type !== 'out') return false;
        if (l.userName !== selectedStaff) return false;
        if (custFilter && l.customerId !== custFilter) return false;
        const d = new Date(l.timestamp);
        if (filter === '30d')   return (now.getTime() - d.getTime()) <= 30 * 86400_000;
        if (filter === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, selectedStaff, filter, custFilter]);

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      {/* フィルターバー */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <LucideFilter size={13} className="text-gray-500 shrink-0" />
        <div className="flex bg-[#0B132B] border border-gray-700 rounded-md overflow-hidden">
          {([['30d', '直近30日'], ['month', '今月'], ['all', '全期間']] as [HistoryFilter, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 text-xs font-bold transition ${filter === v ? 'bg-[#C5A059]/20 text-[#E6C687]' : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={custFilter} onChange={e => setCustFilter(e.target.value)}
          className="bg-[#0B132B] border border-gray-700 text-xs text-white rounded-md px-2 py-1.5 focus:outline-none focus:border-[#C5A059]">
          <option value="">顧客: すべて</option>
          {customers.map(c => <option key={c.customerId} value={c.customerId}>{c.name}</option>)}
        </select>
        <span className="text-[11px] text-gray-500 ml-auto">{filteredLogs.length}件</span>
      </div>

      {/* ログリスト */}
      {filteredLogs.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">該当する報告がありません</div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map(log => {
            const cust = customers.find(c => c.customerId === log.customerId);
            const proj = projects.find(p => p.projectId  === log.projectId);
            const expanded = expandedIds.has(log.logId);
            return (
              <div key={log.logId} className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 flex items-start gap-3 cursor-pointer hover:bg-[#1C284D]/30 transition"
                  onClick={() => toggleExpand(log.logId)}>
                  <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{cust?.name ?? '—'}</p>
                        {proj && <p className="text-xs text-gray-400 truncate">{proj.title}</p>}
                      </div>
                      <div className="text-right shrink-0 text-xs text-gray-400">
                        <p>{new Date(log.timestamp).toLocaleDateString('ja-JP')}</p>
                        <p className="font-mono">{new Date(log.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</p>
                        {log.duration != null && (
                          <p className="text-gray-500">{Math.floor(log.duration / 60)}分</p>
                        )}
                      </div>
                    </div>
                    {/* 次回アクション プレビュー */}
                    {!expanded && log.structuredData?.nextAction && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        次回: {log.structuredData.nextAction}
                      </p>
                    )}
                  </div>
                  {expanded ? <LucideChevronUp size={14} className="text-gray-500 shrink-0 mt-1" />
                            : <LucideChevronDown size={14} className="text-gray-500 shrink-0 mt-1" />}
                </div>

                {/* 展開コンテンツ */}
                {expanded && (
                  <div className="border-t border-gray-800 p-4 space-y-3">
                    {log.structuredData ? (
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['顧客の課題',    log.structuredData.customerIssue],
                          ['キーマンの反応', log.structuredData.keymanReaction],
                          ['予算感',        log.structuredData.budget],
                          ['次回アクション', log.structuredData.nextAction],
                        ] as [string, string][]).map(([label, val]) => val ? (
                          <div key={label} className="bg-[#0B132B] p-2 rounded border border-gray-800 text-xs">
                            <span className="text-gray-500 block text-[10px]">{label}</span>
                            <span className="text-gray-200">{val}</span>
                          </div>
                        ) : null)}
                      </div>
                    ) : log.voiceText ? (
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{log.voiceText}</p>
                    ) : null}

                    {/* 写真（遅延ロード: 各ログ内で独立展開） */}
                    {log.photoUrls && log.photoUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {log.photoUrls.map((url, pi) => (
                          <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`写真${pi + 1}`}
                              className="h-14 w-14 object-cover rounded border border-gray-700 hover:brightness-110 transition" />
                          </a>
                        ))}
                      </div>
                    )}
                    {/* GPS地図ボタン */}
                    {log.location && (
                      <a
                        href={`https://maps.google.com/?q=${log.location.lat},${log.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/30 border border-blue-700/30 rounded-lg px-3 py-1.5 transition"
                      >
                        <LucideMapPin size={12} /> 訪問地点を地図で確認
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

export default function ReportPage({
  customers, projects, logs, selectedStaff, userId, onShowToast,
  initialProjectId, initialCustomerId, onMounted,
}: Props) {
  const [subView, setSubView] = useState<'new' | 'history'>('new');
  const [status,             setStatus]             = useState<ReportStatus>('idle');
  const [selectedCustomerId, setSelectedCustomerId]  = useState('');
  const [selectedProjectId,  setSelectedProjectId]   = useState('');
  const [inTime,             setInTime]              = useState<Date | null>(null);
  const [elapsed,            setElapsed]             = useState(0);
  const [transcript,         setTranscript]          = useState('');
  const [interimText,        setInterimText]         = useState('');
  const [hasSpeechAPI,       setHasSpeechAPI]        = useState(false);
  const [isRecognizing,      setIsRecognizing]       = useState(false);
  const [aiResult,           setAiResult]            = useState<AiAnalysisResult | null>(null);
  const [chatHistory,        setChatHistory]         = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [chatInput,          setChatInput]           = useState('');
  const [structuredData,     setStructuredData]      = useState<StructuredReportData>({
    customerIssue: '', keymanReaction: '', budget: '', nextAction: '',
  });
  // 写真
  const [selectedPhotos,    setSelectedPhotos]      = useState<File[]>([]);
  const [photoPreviewUrls,  setPhotoPreviewUrls]    = useState<string[]>([]);
  const [isSaving,          setIsSaving]            = useState(false);
  const [gpsStatus,         setGpsStatus]           = useState<'idle' | 'getting' | 'ok' | 'approx'>('idle');
  // ── 報告後アクション ──
  const [postSaveView,         setPostSaveView]         = useState<null | 'project' | 'schedule'>(null);
  const [postSaveProjectDone,  setPostSaveProjectDone]  = useState(false);
  const [postSaveScheduleDone, setPostSaveScheduleDone] = useState(false);
  // ── クリア確認 / チャット再解析ローディング ──
  const [showClearConfirm,     setShowClearConfirm]     = useState(false);
  const [chatLoading,          setChatLoading]          = useState(false);

  // PC 判定（タッチデバイスでなければ PC）
  const isPC = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;

  const recogRef          = useRef<any>(null);
  const shouldRestartRef  = useRef(false);   // 音声認識の自動再起動フラグ
  const chatRecogRef      = useRef<any>(null);
  const [isChatRecognizing, setIsChatRecognizing] = useState(false);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef  = useRef<HTMLDivElement>(null);

  // ── 音声API検出 ──
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setHasSpeechAPI(!!SR);
  }, []);

  // ── カレンダーからの遷移：案件を事前選択 ──
  // 通常の報告タブと同じフロー。顧客・案件が初期選択されているだけの違い。
  useEffect(() => {
    if (initialCustomerId) setSelectedCustomerId(initialCustomerId);
    if (initialProjectId)  setSelectedProjectId(initialProjectId);
    onMounted?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId, initialCustomerId]);

  // ── 訪問タイマー ──
  useEffect(() => {
    if (status !== 'in_progress' || !inTime) return;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - inTime.getTime()) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [status, inTime]);

  // ── チャット自動スクロール ──
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // ── ObjectURL クリーンアップ ──
  useEffect(() => {
    return () => { photoPreviewUrls.forEach(URL.revokeObjectURL); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 派生データ ──
  const filteredProjects = projects.filter(
    p => p.customerId === selectedCustomerId && p.status !== 'completed' && p.status !== 'lost',
  );
  const selectedCustomer = customers.find(c => c.customerId === selectedCustomerId);
  const selectedProject  = projects.find(p => p.projectId === selectedProjectId);

  /** 失注でない案件で次回アクションが未設定かどうか */
  const needsFollowUp = !!selectedProject &&
    !['lost', 'completed'].includes(selectedProject.status) &&
    isNextActionMissing(structuredData.nextAction);

  // ─────────────────────────── ハンドラ ────────────────────────

  const handleIn = async () => {
    if (!selectedProjectId || !selectedCustomerId) return;
    setGpsStatus('getting');
    try {
      // GPS取得を試みてからIN記録
      const hasGeo = !!navigator.geolocation;
      await saveInLog(selectedProjectId, selectedCustomerId, userId, selectedStaff);
      setGpsStatus(hasGeo ? 'ok' : 'approx');
      setInTime(new Date());
      setElapsed(0);
      setStatus('in_progress');
      onShowToast(isPC ? 'IN記録完了 — PC操作として記録' : 'IN記録完了 — GPS位置情報取得済み');
    } catch {
      setGpsStatus('idle');
      onShowToast('IN記録に失敗しました');
    }
  };

  // ── 音声録音の開始 ──
  // ・自動再起動: Chrome の沈黙タイムアウト後も shouldRestartRef が true なら再起動
  // ・重複除去: processedIdx で処理済み resultIndex を管理
  // ・セッション跨ぎ: accumulated で各セッションの finals を引き継ぐ
  const startRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    shouldRestartRef.current = true;
    const capturedBase = transcript; // 録音開始時点のテキスト（以降のセッションでも変わらない）
    let accumulated = '';           // 全セッションの finals の蓄積

    const launch = () => {
      const recog = new SR();
      recog.continuous     = true;
      recog.interimResults = true;
      recog.lang           = 'ja-JP';

      let sessionFinals = '';
      const processedIdx = new Set<number>(); // 同一 resultIndex の重複処理を防ぐ

      recog.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal && !processedIdx.has(i)) {
            sessionFinals += e.results[i][0].transcript;
            processedIdx.add(i);
          } else if (!e.results[i].isFinal) {
            interim += e.results[i][0].transcript;
          }
        }
        setTranscript(capturedBase + accumulated + sessionFinals);
        setInterimText(interim);
      };

      recog.onerror = (e: any) => {
        // no-speech は沈黙検知で onend が来るので無視
        if (e.error === 'no-speech') return;
        if (e.error !== 'aborted') {
          shouldRestartRef.current = false;
          setIsRecognizing(false);
        }
        setInterimText('');
      };

      recog.onend = () => {
        setInterimText('');
        accumulated += sessionFinals; // このセッションの結果を次のセッションに引き継ぐ
        if (shouldRestartRef.current) {
          // 沈黙タイムアウト後に自動再起動（話しながら考える時間を確保）
          setTimeout(() => {
            if (shouldRestartRef.current) launch();
            else setIsRecognizing(false);
          }, 300);
        } else {
          setIsRecognizing(false);
        }
      };

      try {
        recog.start();
      } catch {
        shouldRestartRef.current = false;
        setIsRecognizing(false);
        return;
      }
      recogRef.current = recog;
    };

    launch();
    setIsRecognizing(true);
  };

  const stopRecognition = () => {
    shouldRestartRef.current = false; // 自動再起動を停止
    if (recogRef.current) {
      try { recogRef.current.stop(); } catch {}
      recogRef.current = null;
    }
    setInterimText('');
    setIsRecognizing(false);
  };

  // ── チャット追加質問への音声入力 ──
  const startChatRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recog.continuous     = false;
    recog.interimResults = false;
    recog.lang           = 'ja-JP';
    recog.onresult = (e: any) => {
      const text = Array.from<any>(e.results).map((r: any) => r[0].transcript).join('');
      setChatInput(prev => prev + text);
    };
    recog.onerror = () => setIsChatRecognizing(false);
    recog.onend   = () => setIsChatRecognizing(false);
    try {
      recog.start();
      chatRecogRef.current = recog;
      setIsChatRecognizing(true);
    } catch { setIsChatRecognizing(false); }
  };

  const stopChatRecognition = () => {
    if (chatRecogRef.current) {
      try { chatRecogRef.current.stop(); } catch {}
      chatRecogRef.current = null;
    }
    setIsChatRecognizing(false);
  };

  const handleStartOut = () => {
    setStatus('recording');
    if (hasSpeechAPI) startRecognition();
  };

  // ── AI 解析 ──
  const runAnalysis = async (text: string) => {
    stopRecognition();
    if (!text.trim()) {
      onShowToast('報告内容が空です。テキストを入力してください');
      return;
    }
    setStatus('analyzing');
    try {
      const result = await analyzeReport(text);
      setAiResult(result);
      setStructuredData({
        customerIssue:  result.customerIssue,
        keymanReaction: result.keymanReaction,
        budget:         result.budget,
        nextAction:     result.nextAction,
      });
      if (result.followUpQuestion) {
        setChatHistory([{ role: 'ai', text: result.followUpQuestion }]);
        setStatus('chat');
      } else {
        setStatus('review');
      }
    } catch {
      onShowToast('AI解析に失敗しました');
      setStatus('recording');
    }
  };

  // ── チャット送信（補足情報でAI再解析し対象フィールドを正確に更新）──
  const handleChatSend = async () => {
    if (!chatInput.trim() || !aiResult?.missingField || chatLoading) return;
    const userMsg   = chatInput.trim();
    const fieldName = aiResult.missingField; // async 前にキャプチャ
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);
    try {
      // 補足情報を付加して再解析 → 対象フィールドのみ更新（他フィールドは初回解析を維持）
      const supplemented =
        `${transcript}\n【補足 - ${fieldName === 'nextAction' ? '次回アクション' : '予算感'}について】${userMsg}`;
      const newResult  = await analyzeReport(supplemented);
      const extracted  = fieldName === 'nextAction' ? newResult.nextAction : newResult.budget;
      setStructuredData(prev => ({ ...prev, [fieldName]: extracted || userMsg }));
      // 日付が新たに抽出できた場合は aiResult も更新
      if (newResult.nextVisitDate) {
        setAiResult(prev => prev ? { ...prev, nextVisitDate: newResult.nextVisitDate } : newResult);
      }
      setChatHistory(prev => [
        ...prev,
        { role: 'ai', text: '情報を整理しました。内容をご確認のうえ保存してください。' },
      ]);
      setStatus('review');
    } catch {
      // フォールバック: 生の回答をそのままセット
      setStructuredData(prev => ({ ...prev, [fieldName]: userMsg }));
      setChatHistory(prev => [
        ...prev,
        { role: 'ai', text: '情報を整理しました。内容をご確認のうえ保存してください。' },
      ]);
      setStatus('review');
    } finally {
      setChatLoading(false);
    }
  };

  // ── 音声テキストのクリア ──
  const handleClearTranscript = () => {
    stopRecognition();
    setTranscript('');
    setInterimText('');
    setShowClearConfirm(false);
  };

  // ── 写真選択 ──
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setSelectedPhotos(prev => [...prev, ...files]);
    setPhotoPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviewUrls[idx]);
    setSelectedPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== idx));
  };

  // ── 保存 ──
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const logId    = 'LOG-' + Date.now();
      const duration = inTime ? Math.floor((Date.now() - inTime.getTime()) / 1000) : undefined;
      const urls     = await uploadPhotos(logId, selectedPhotos);
      await saveOutLog(
        selectedProjectId, selectedCustomerId, userId, selectedStaff,
        transcript, structuredData, duration, urls, logId,
      );
      setStatus('saved');
      onShowToast('活動報告を保存しました！');
    } catch {
      onShowToast('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // ── リセット ──
  const handleReset = () => {
    stopRecognition();
    photoPreviewUrls.forEach(URL.revokeObjectURL);
    setStatus('idle');
    setSelectedCustomerId('');
    setSelectedProjectId('');
    setInTime(null);
    setElapsed(0);
    setTranscript('');
    setInterimText('');
    setAiResult(null);
    setChatHistory([]);
    setChatInput('');
    setStructuredData({ customerIssue: '', keymanReaction: '', budget: '', nextAction: '' });
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    setPostSaveView(null);
    setPostSaveProjectDone(false);
    setPostSaveScheduleDone(false);
    setShowClearConfirm(false);
  };

  // ─────────────────────────── UI ──────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── ヘッダー + サブビュー切替 ── */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 md:p-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <LucideMic className="text-[#C5A059]" size={20} />
              現場報告ツール（音声 + AI）
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">訪問先を選択 → IN → 音声/テキスト報告 → AI整理 → 保存</p>
          </div>
          {subView === 'new' && (
            <div className="flex items-center gap-2 shrink-0">
              <span className={`h-2 w-2 rounded-full ${
                status === 'in_progress' ? 'bg-emerald-500 animate-pulse' :
                status === 'recording'   ? 'bg-red-500 animate-pulse' :
                status === 'analyzing'   ? 'bg-yellow-500 animate-pulse' :
                status === 'saved'       ? 'bg-emerald-500' :
                status === 'idle'        ? 'bg-gray-500' : 'bg-blue-500'
              }`} />
              <span className="text-xs text-gray-300">{STATUS_LABEL[status]}</span>
            </div>
          )}
        </div>

        {/* サブビューナビ */}
        <div className="flex border-t border-gray-800">
          <button onClick={() => setSubView('new')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition ${
              subView === 'new' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'
            }`}>
            <LucidePlusCircle size={13} /> 新規報告
          </button>
          <button onClick={() => setSubView('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition ${
              subView === 'history' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'
            }`}>
            <LucideHistory size={13} /> 活動履歴
          </button>
        </div>
      </div>

      {/* ── 活動履歴ビュー ── */}
      {subView === 'history' && (
        <HistoryView
          logs={logs} customers={customers} projects={projects}
          selectedStaff={selectedStaff}
        />
      )}

      {/* ── 新規報告ビュー（以降は subView === 'new' のみ表示） ── */}
      {/* ── IDLE: 訪問先選択 ── */}
      {subView === 'new' && status === 'idle' && (
        <div className="bg-[#111A35] border border-gray-800 rounded-xl p-5 space-y-4">
          <p className="text-sm font-bold text-[#E6C687]">① 訪問先を選択してください</p>

          <div>
            <label className="text-xs text-gray-400 block mb-1">顧客</label>
            <select
              value={selectedCustomerId}
              onChange={e => { setSelectedCustomerId(e.target.value); setSelectedProjectId(''); }}
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059]"
            >
              <option value="">-- 顧客を選択 --</option>
              {customers.map(c => (
                <option key={c.customerId} value={c.customerId}>{c.name}</option>
              ))}
            </select>
          </div>

          {selectedCustomerId && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">案件</label>
              {filteredProjects.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                  <LucideAlertCircle size={12} /> 進行中の案件がありません
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProjects.map(p => (
                    <button
                      key={p.projectId}
                      onClick={() => setSelectedProjectId(p.projectId)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                        selectedProjectId === p.projectId
                          ? 'border-[#C5A059] bg-[#C5A059]/10 text-white'
                          : 'border-gray-700 bg-[#0B132B] text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{p.status} · ¥{p.amount.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PC操作の場合は注意表示 */}
          {isPC && (
            <div className="flex items-center gap-2 bg-blue-950/40 border border-blue-700/30 rounded-lg px-3 py-2 text-xs text-blue-300">
              <LucideMapPin size={12} className="shrink-0" />
              <span><span className="font-bold">PC操作</span>として記録されます（GPS精度が低い場合は近似座標を使用）</span>
            </div>
          )}

          {selectedProjectId && (
            <button
              onClick={handleIn}
              disabled={gpsStatus === 'getting'}
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-70"
            >
              {gpsStatus === 'getting'
                ? <><LucideActivity size={18} className="animate-spin" /> GPS取得中...</>
                : <><LucideLogIn size={18} /> IN — 訪問開始を記録</>}
            </button>
          )}
        </div>
      )}

      {/* ── IN_PROGRESS: 訪問中タイマー ── */}
      {subView === 'new' && status === 'in_progress' && (
        <div className="bg-[#111A35] border border-emerald-700/50 rounded-xl p-5 space-y-5">
          <div className="bg-emerald-950/40 border border-emerald-700/30 rounded-lg p-3 flex items-center gap-3">
            <LucideMapPin className="text-emerald-400 shrink-0" size={16} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{selectedCustomer?.name}</div>
              <div className="text-xs text-gray-400 truncate">{selectedProject?.title}</div>
              {isPC && (
                <div className="text-[10px] text-blue-400 mt-0.5 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                  PC操作として記録中
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-2xl text-emerald-300 font-bold">{fmtTime(elapsed)}</div>
              <div className="text-[10px] text-gray-500">訪問経過時間</div>
            </div>
          </div>
          <button
            onClick={handleStartOut}
            className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <LucideLogOut size={18} /> OUT — 報告を入力して退場
          </button>
        </div>
      )}

      {/* ── RECORDING: テキスト + 音声入力（両立）── */}
      {subView === 'new' && status === 'recording' && (
        <div className="bg-[#111A35] border border-red-700/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-sm font-bold text-red-300">報告を入力してください</h3>
            </div>
            {/* 音声 ON/OFF トグル */}
            {hasSpeechAPI && (
              <button
                onClick={isRecognizing ? stopRecognition : startRecognition}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition font-semibold ${
                  isRecognizing
                    ? 'bg-red-900/40 border-red-500/60 text-red-300 mic-pulse'
                    : 'bg-[#0B132B] border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {isRecognizing ? <LucideMicOff size={13} /> : <LucideMic size={13} />}
                {isRecognizing ? '音声認識中' : '音声入力'}
              </button>
            )}
          </div>

          {/* ★ 常に編集可能な textarea ── 音声認識も手入力も受け付ける */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              報告内容
              {isRecognizing && <span className="ml-2 text-red-400 text-[10px]">● 音声認識中</span>}
            </label>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={6}
              placeholder="訪問内容を話すか、直接入力してください..."
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none leading-relaxed"
              autoFocus={!hasSpeechAPI}
            />
            {/* 認識中のインテリム表示 */}
            {interimText && (
              <p className="text-xs text-gray-500 mt-1 italic px-1">
                認識中: <span className="text-gray-400">{interimText}</span>
              </p>
            )}

            {/* クリアボタン（確認ポップアップ付き） */}
            {transcript && (
              <div className="flex justify-end mt-1.5">
                {!showClearConfirm ? (
                  <button type="button" onClick={() => setShowClearConfirm(true)}
                    className="text-[11px] text-gray-600 hover:text-red-400 flex items-center gap-1 transition">
                    <LucideTrash2 size={11} /> 入力内容をクリア
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-1.5">
                    <span className="text-[11px] text-red-300">入力内容を削除しますか？</span>
                    <button type="button" onClick={handleClearTranscript}
                      className="text-[11px] text-red-400 font-bold hover:text-red-300 transition">削除する</button>
                    <button type="button" onClick={() => setShowClearConfirm(false)}
                      className="text-[11px] text-gray-400 hover:text-white transition">キャンセル</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => runAnalysis(transcript)}
            disabled={!transcript.trim()}
            className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-40 text-sm"
          >
            <LucideActivity size={16} />
            AI解析を開始
          </button>
        </div>
      )}

      {/* ── ANALYZING: AI解析中 ── */}
      {subView === 'new' && status === 'analyzing' && (
        <div className="bg-[#111A35] border border-yellow-700/40 rounded-xl p-10 flex flex-col items-center gap-4">
          <LucideActivity className="text-[#C5A059] animate-spin" size={36} />
          <div className="text-center">
            <p className="text-white font-bold">AIが報告内容を解析しています...</p>
            <p className="text-xs text-gray-400 mt-1">顧客課題・反応・予算・次回アクションを抽出中</p>
          </div>
        </div>
      )}

      {/* ── CHAT: AI追加質問 ── */}
      {subView === 'new' && status === 'chat' && (
        <div className="bg-[#111A35] border border-blue-700/40 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-blue-300 flex items-center gap-2">
            <LucideMessageSquare size={15} /> AIマネージャーより確認
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                  msg.role === 'ai' ? 'bg-[#C5A059] text-[#0A0F1D]' : 'bg-[#1C2C54] text-white'
                }`}>
                  {msg.role === 'ai' ? 'AI' : <LucideUser2 size={12} />}
                </div>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'ai'
                    ? 'bg-[#1C2C54] text-white rounded-tl-none'
                    : 'bg-[#C5A059]/20 text-[#E6C687] rounded-tr-none border border-[#C5A059]/30'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          {/* AI再解析中インジケータ */}
          {chatLoading && (
            <div className="flex gap-2 items-center">
              <div className="h-7 w-7 rounded-full bg-[#C5A059] text-[#0A0F1D] flex items-center justify-center text-[10px] font-bold shrink-0">AI</div>
              <div className="bg-[#1C2C54] text-gray-400 text-sm px-3 py-2 rounded-xl rounded-tl-none flex items-center gap-2">
                <LucideLoader2 size={13} className="animate-spin" /> 補足情報を解析中...
              </div>
            </div>
          )}
          {aiResult?.missingField && !chatLoading && (
            <div className="space-y-2">
              {isChatRecognizing && (
                <p className="text-[11px] text-red-400 flex items-center gap-1.5 animate-pulse">
                  <LucideMic size={11} /> 音声入力中... 話し終わったら自動で入力されます
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !chatLoading) handleChatSend(); }}
                  placeholder="回答を入力、または🎙で音声入力..."
                  className="flex-1 bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
                  autoFocus={!hasSpeechAPI}
                />
                {hasSpeechAPI && (
                  <button
                    type="button"
                    onClick={isChatRecognizing ? stopChatRecognition : startChatRecognition}
                    title={isChatRecognizing ? '音声入力停止' : '音声で回答する'}
                    className={`px-3 rounded-lg border transition ${
                      isChatRecognizing
                        ? 'bg-red-900/40 border-red-500/60 text-red-300'
                        : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                    }`}
                  >
                    {isChatRecognizing ? <LucideMicOff size={14} /> : <LucideMic size={14} />}
                  </button>
                )}
                <button onClick={handleChatSend} disabled={!chatInput.trim() || chatLoading}
                  className="bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] px-4 py-2 rounded-lg font-bold disabled:opacity-40 transition">
                  <LucideSend size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REVIEW: 構造化データ確認 + 写真添付 ── */}
      {subView === 'new' && status === 'review' && (
        <div className="bg-[#111A35] border border-purple-700/40 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-purple-300">② 活動報告の内容確認</h3>
            <p className="text-xs text-gray-400 mt-0.5">修正してから保存できます。写真は任意で添付できます。</p>
          </div>

          {/* ⚠️ 次回アクション未設定警告 */}
          {needsFollowUp && (
            <div className="bg-amber-950/40 border border-amber-600/40 rounded-lg p-3 text-[11px] flex items-start gap-2">
              <LucideAlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <span className="text-amber-200">
                <span className="font-bold text-amber-300 block">次回アクションが未設定です</span>
                失注ではない案件は「次回アクション」欄に次回のフォロー計画（いつ・何をするか）を入力してください。
              </span>
            </div>
          )}

          {/* 4フィールド */}
          {([
            { key: 'customerIssue',  label: '顧客の課題' },
            { key: 'keymanReaction', label: 'キーマンの反応' },
            { key: 'budget',         label: '予算感' },
            { key: 'nextAction',     label: '次回アクション' },
          ] as { key: keyof StructuredReportData; label: string }[]).map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 block mb-1">{label}</label>
              <textarea
                value={structuredData[key]}
                onChange={e => setStructuredData(prev => ({ ...prev, [key]: e.target.value }))}
                rows={2}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none"
              />
            </div>
          ))}

          {/* ── 写真添付 ── */}
          <div>
            <label className="text-xs text-gray-400 block mb-2">現場写真（任意）</label>

            {/* サムネイルグリッド */}
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photoPreviewUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-700">
                    <img src={url} alt={`写真${i+1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/70 hover:bg-black/90 text-white rounded-full h-5 w-5 flex items-center justify-center transition"
                    >
                      <LucideX size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 写真追加ボタン */}
            <label className="flex items-center gap-2 cursor-pointer bg-[#0B132B] border border-dashed border-gray-600 hover:border-[#C5A059]/60 rounded-lg px-4 py-3 text-sm text-gray-400 hover:text-gray-200 transition">
              <LucideCamera size={16} className="text-[#C5A059] shrink-0" />
              写真を追加（複数選択可）
              <input
                type="file" accept="image/*" multiple className="hidden"
                onChange={handlePhotoSelect}
              />
            </label>
          </div>

          {/* 保存ボタン */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            {isSaving ? (
              <><LucideLoader2 size={18} className="animate-spin" /> 保存中...</>
            ) : (
              <><LucideSave size={18} /> Firestore に保存して完了</>
            )}
          </button>
        </div>
      )}

      {/* ── SAVED: 保存完了 ── */}
      {subView === 'new' && status === 'saved' && (
        <div className="bg-[#111A35] border border-emerald-700/40 rounded-xl p-8 flex flex-col items-center gap-5">
          <LucideCheckCircle2 className="text-emerald-400" size={52} />
          <div className="text-center">
            <p className="text-white font-bold text-lg">活動報告を保存しました！</p>
            <p className="text-xs text-gray-400 mt-1">
              {selectedCustomer?.name} — {selectedProject?.title}
            </p>
          </div>

          <div className="bg-[#0B132B] border border-gray-700 rounded-lg p-4 w-full space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0 w-24">訪問時間</span>
              <span className="text-white font-mono">{fmtTime(elapsed)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0 w-24">顧客の課題</span>
              <span className="text-white">{structuredData.customerIssue}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0 w-24">次回アクション</span>
              <span className="text-white">{structuredData.nextAction}</span>
            </div>
            {photoPreviewUrls.length > 0 && (
              <div>
                <span className="text-gray-400 block mb-1.5">添付写真 {photoPreviewUrls.length}枚</span>
                <div className="flex gap-2 flex-wrap">
                  {photoPreviewUrls.map((url, i) => (
                    <img key={i} src={url} alt="" className="h-12 w-12 object-cover rounded border border-gray-600" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 報告後アクション ── */}
          <div className="w-full space-y-2">
            <p className="text-[11px] text-gray-500 text-center tracking-wide">── 報告後アクション ──</p>

            {/* アクション選択（サブフォーム非表示中のみ表示） */}
            {!postSaveView && (
              <div className="space-y-2">
                {/* 次回アクション未設定の場合は強調警告 */}
                {needsFollowUp && !postSaveScheduleDone && (
                  <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-700/40 rounded-lg px-3 py-2 text-[11px] text-amber-300">
                    <LucideAlertCircle size={12} className="shrink-0" />
                    次回アクション未設定 — 失注でない案件は次回のフォローアップ計画を立ててください
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setPostSaveView('project')}
                    disabled={postSaveProjectDone}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg border transition ${
                      postSaveProjectDone
                        ? 'border-emerald-700/40 text-emerald-400 bg-emerald-950/20 cursor-default'
                        : 'border-[#C5A059]/40 text-[#E6C687] hover:bg-[#C5A059]/10'
                    }`}
                  >
                    {postSaveProjectDone
                      ? <><LucideCheckCircle size={13} /> 案件情報 更新済み</>
                      : <><LucideEdit2 size={13} /> 案件情報を更新する</>}
                  </button>
                  <button
                    onClick={() => setPostSaveView('schedule')}
                    disabled={postSaveScheduleDone}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg border transition ${
                      postSaveScheduleDone
                        ? 'border-emerald-700/40 text-emerald-400 bg-emerald-950/20 cursor-default'
                        : needsFollowUp
                          ? 'border-amber-600/50 text-amber-300 bg-amber-950/20 hover:bg-amber-950/40'
                          : 'border-blue-700/40 text-blue-300 hover:bg-blue-950/30'
                    }`}
                  >
                    {postSaveScheduleDone
                      ? <><LucideCheckCircle size={13} /> 次回予定 登録済み</>
                      : needsFollowUp
                        ? <><LucideAlertCircle size={13} /> 次回フォローを計画する</>
                        : <><LucideCalendarPlus size={13} /> 次回訪問予定を登録</>}
                  </button>
                </div>
              </div>
            )}

            {/* 案件情報更新フォーム */}
            {postSaveView === 'project' && selectedProject && (
              <PostSaveProjectUpdate
                project={selectedProject}
                structuredData={structuredData}
                onSaved={msg => { onShowToast(msg); setPostSaveView(null); setPostSaveProjectDone(true); }}
                onCancel={() => setPostSaveView(null)}
              />
            )}

            {/* 次回訪問予定登録フォーム */}
            {postSaveView === 'schedule' && selectedProject && selectedCustomer && (
              <PostSaveScheduleAdd
                project={selectedProject}
                customer={selectedCustomer}
                structuredData={structuredData}
                selectedStaff={selectedStaff}
                aiResult={aiResult}
                onSaved={msg => { onShowToast(msg); setPostSaveView(null); setPostSaveScheduleDone(true); }}
                onCancel={() => setPostSaveView(null)}
              />
            )}
          </div>

          <button onClick={handleReset}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
            <LucideRotateCcw size={14} /> 別の訪問を記録する
          </button>
        </div>
      )}
    </div>
  );
}
