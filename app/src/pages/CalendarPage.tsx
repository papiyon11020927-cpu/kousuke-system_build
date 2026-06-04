import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  LucideCalendar, LucideChevronLeft, LucideChevronRight,
  LucideClock, LucideX, LucideCheck, LucideMic, LucidePencil,
  LucideTrash2, LucideAlertTriangle, LucideMapPin,
} from 'lucide-react';
import type { Customer, Project, Schedule, UserRole } from '@/types';
import { saveSchedule, deleteSchedule } from '@/services/scheduleService';

// ─────────────────────────────────────────────────────────────
// 型・定数
// ─────────────────────────────────────────────────────────────

type CalView = 'month' | 'week' | 'day';

const DAY_JA     = ['日', '月', '火', '水', '木', '金', '土'];
const HOUR_PX    = 64;
const HOURS      = Array.from({ length: 24 }, (_, i) => i);

// ─────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────

const pad    = (n: number)  => String(n).padStart(2, '0');
const fmtD   = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addD   = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };

const _today  = new Date();
const _todayS = fmtD(_today);

function weekSunday(d: Date): Date {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r;
}

const slotToTime = (s: number) => ({ h: Math.floor(s/2), m: (s%2)*30 });
const yToSlot    = (y: number) => Math.max(0, Math.min(47, Math.floor(y / (HOUR_PX/2))));
const slotTop    = (s: number) => (s/2) * HOUR_PX;

function schedsForDay(scheds: Schedule[], ds: string, staff: string) {
  return scheds.filter(s => {
    if (!s.startAt || s.startAt.split('T')[0] !== ds) return false;
    return staff === 'ALL' || s.assignees.includes(staff);
  });
}

function evStyle(s: Schedule) {
  const a  = new Date(s.startAt), b = new Date(s.endAt);
  const sm = a.getHours()*60 + a.getMinutes();
  const em = Math.max(b.getHours()*60 + b.getMinutes(), sm+30);
  return { top: (sm/60)*HOUR_PX, height: Math.max(((em-sm)/60)*HOUR_PX, 20) };
}

function evColor(s: Schedule) {
  if (s.isLtvTriggered)               return 'bg-purple-950 border-purple-500 text-purple-200';
  if (/工事|施工/.test(s.title))       return 'bg-emerald-950 border-emerald-500 text-emerald-200';
  return 'bg-blue-950 border-blue-500 text-blue-200';
}

// ─────────────────────────────────────────────────────────────
// 予定作成・編集ダイアログ
// ─────────────────────────────────────────────────────────────

interface FormInit  { date: string; startTime: string; endTime: string; }
interface FormState {
  title: string; date: string; startTime: string; endTime: string;
  assignees: string[]; customerId: string; projectId: string;
  notes: string; isLtvTriggered: boolean;
}

function ScheduleDialog({
  init = { date: _todayS, startTime: '09:00', endTime: '10:00' },
  existing, customers, projects, staffList, onSave, onClose,
}: {
  init?: FormInit;
  existing?: Schedule;
  customers: Customer[]; projects: Project[];
  staffList: string[];
  onSave: (f: FormState, existingId?: string) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<FormState>(() => {
    if (existing) {
      return {
        title:          existing.title,
        date:           existing.startAt.split('T')[0],
        startTime:      existing.startAt.split('T')[1]?.substring(0, 5) ?? '09:00',
        endTime:        existing.endAt.split('T')[1]?.substring(0, 5)   ?? '10:00',
        assignees:      [...existing.assignees],
        customerId:     existing.customerId ?? '',
        projectId:      existing.projectId  ?? '',
        notes:          existing.notes      ?? '',
        isLtvTriggered: existing.isLtvTriggered,
      };
    }
    return {
      title: '', date: init.date, startTime: init.startTime, endTime: init.endTime,
      assignees: staffList.length > 0 ? [staffList[0]] : [], customerId: '', projectId: '', notes: '', isLtvTriggered: false,
    };
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(p => ({ ...p, [k]: v }));
  const custProjects = projects.filter(p => p.customerId === f.customerId);

  const toggleAssignee = (name: string) => setF(p => ({
    ...p, assignees: p.assignees.includes(name) ? p.assignees.filter(a => a !== name) : [...p.assignees, name],
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-md shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white">{existing ? '予定を変更' : '予定を追加'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); if (f.title.trim()) onSave(f, existing?.scheduleId); }} className="p-5 space-y-3">
          <input
            type="text" required value={f.title} onChange={e => set('title', e.target.value)}
            placeholder="予定タイトル *" autoFocus
            className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
          />

          <div className="grid grid-cols-3 gap-2">
            {([
              { label: '日付', type: 'date', val: f.date,      key: 'date'      },
              { label: '開始', type: 'time', val: f.startTime, key: 'startTime' },
              { label: '終了', type: 'time', val: f.endTime,   key: 'endTime'   },
            ] as const).map(({ label, type, val, key }) => (
              <div key={key}>
                <label className="text-[10px] text-gray-400 block mb-0.5">{label}</label>
                <input type={type} value={val}
                  onChange={e => set(key as keyof FormState, e.target.value as FormState[keyof FormState])}
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C5A059]" />
              </div>
            ))}
          </div>

          <div>
            <label className="text-[10px] text-gray-400 block mb-1">担当者</label>
            <div className="flex gap-2">
              {staffList.map(name => (
                <button key={name} type="button" onClick={() => toggleAssignee(name)}
                  className={`flex-1 text-xs py-1.5 rounded border transition ${
                    f.assignees.includes(name)
                      ? 'bg-[#C5A059]/20 border-[#C5A059]/60 text-[#E6C687]'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">顧客</label>
              <select value={f.customerId}
                onChange={e => { set('customerId', e.target.value); set('projectId', ''); }}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C5A059]">
                <option value="">選択なし</option>
                {customers.map(c => <option key={c.customerId} value={c.customerId}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">案件</label>
              <select value={f.projectId} onChange={e => set('projectId', e.target.value)}
                disabled={!f.customerId}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C5A059] disabled:opacity-40">
                <option value="">選択なし</option>
                {custProjects.map(p => <option key={p.projectId} value={p.projectId}>{p.title}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
            <input type="checkbox" checked={f.isLtvTriggered} onChange={e => set('isLtvTriggered', e.target.checked)} className="accent-[#C5A059]" />
            LTV点検スケジュール（アフターフォロー）
          </label>

          <textarea value={f.notes} onChange={e => set('notes', e.target.value)}
            placeholder="メモ（任意）" rows={2}
            className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none"
          />

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition">
              キャンセル
            </button>
            <button type="submit"
              className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition">
              <LucideCheck size={14} /> {existing ? '更新' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 予定アクションダイアログ（選択 → 変更/削除/報告）
// ─────────────────────────────────────────────────────────────

function EventActionDialog({
  schedule, customers, projects, canReport, onEdit, onDelete, onReport, onClose,
}: {
  schedule:  Schedule;
  customers: Customer[];
  projects:  Project[];
  canReport: boolean;
  onEdit:    () => void;
  onDelete:  () => void;
  onReport:  () => void;
  onClose:   () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const customer = customers.find(c => c.customerId === schedule.customerId);
  const project  = projects.find(p => p.projectId  === schedule.projectId);

  const startT = schedule.startAt.split('T')[1]?.substring(0, 5) ?? '';
  const endT   = schedule.endAt.split('T')[1]?.substring(0, 5)   ?? '';
  const dateStr = schedule.startAt.split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-sm shadow-2xl">
        {/* ヘッダー */}
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white truncate pr-2">{schedule.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white shrink-0"><LucideX size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* 予定詳細 */}
          <div className="bg-[#0B132B] rounded-lg p-3 space-y-1.5 text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <LucideClock size={12} className="text-[#C5A059] shrink-0" />
              {dateStr}　{startT}〜{endT}
            </div>
            {schedule.assignees.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">担当:</span>
                {schedule.assignees.join('、')}
              </div>
            )}
            {customer && (
              <div className="flex items-center gap-2">
                <LucideMapPin size={12} className="text-[#C5A059] shrink-0" />
                {customer.name}
                {project && <span className="text-gray-500">— {project.title}</span>}
              </div>
            )}
            {schedule.notes && (
              <div className="text-gray-400 italic border-t border-gray-800 pt-1.5 mt-1.5">
                {schedule.notes}
              </div>
            )}
          </div>

          {/* アクションボタン */}
          <div className="space-y-2">
            {canReport && (
              <button onClick={onReport}
                className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition">
                <LucideMic size={15} /> 現場報告を開始
              </button>
            )}

            <button onClick={onEdit}
              className="w-full bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 border border-blue-700/40 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition">
              <LucidePencil size={14} /> 予定を変更
            </button>

            {confirmDelete ? (
              <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
                  <LucideAlertTriangle size={13} /> 本当に削除しますか？
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 border border-gray-700 text-gray-400 text-xs py-1.5 rounded hover:border-gray-500 transition">
                    キャンセル
                  </button>
                  <button onClick={onDelete}
                    className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs font-bold py-1.5 rounded transition">
                    削除する
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-700/30 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition">
                <LucideTrash2 size={14} /> 予定を削除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 時間グリッド 1日カラム
// ─────────────────────────────────────────────────────────────

interface ColProps {
  date:         Date;
  schedules:    Schedule[];
  onSlotSelect: (dateStr: string, startSlot: number, endSlot: number) => void;
  onEventClick: (s: Schedule) => void;
}

function TimeGridColumn({ date, schedules, onSlotSelect, onEventClick }: ColProps) {
  const ref         = useRef<HTMLDivElement>(null);
  const dragging    = useRef(false);
  const startSlot_  = useRef(0);
  const touchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPress   = useRef(false);
  const touchStartY = useRef(0);

  const dateRef          = useRef(date);         dateRef.current = date;
  const onSlotSelectRef  = useRef(onSlotSelect); onSlotSelectRef.current = onSlotSelect;

  const [sel, setSel] = useState<{ s: number; e: number } | null>(null);

  const getSlot = useCallback((clientY: number) => {
    if (!ref.current) return 0;
    return yToSlot(clientY - ref.current.getBoundingClientRect().top);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-event]')) return;
    e.preventDefault();
    const slot = getSlot(e.clientY);
    dragging.current   = true;
    startSlot_.current = slot;
    setSel({ s: slot, e: slot });
  }, [getSlot]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setSel({ s: startSlot_.current, e: yToSlot(e.clientY - (ref.current?.getBoundingClientRect().top ?? 0)) });
    };
    const onUp = (e: MouseEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const slot = yToSlot(e.clientY - (ref.current?.getBoundingClientRect().top ?? 0));
      const [lo, hi] = startSlot_.current <= slot ? [startSlot_.current, slot] : [slot, startSlot_.current];
      setSel(null);
      onSlotSelectRef.current(fmtD(dateRef.current), lo, Math.min(hi + 1, 47));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-event]')) return;
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    longPress.current   = false;
    const slot = getSlot(touch.clientY);
    startSlot_.current  = slot;

    touchTimer.current = setTimeout(() => {
      longPress.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      setSel({ s: slot, e: slot });
    }, 500);
  }, [getSlot]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (!longPress.current) {
      if (dy > 10 && touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
      return;
    }
    e.preventDefault();
    setSel({ s: startSlot_.current, e: getSlot(e.touches[0].clientY) });
  }, [getSlot]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    const touch = e.changedTouches[0];
    const dy    = Math.abs(touch.clientY - touchStartY.current);

    if (longPress.current) {
      const endSlot = getSlot(touch.clientY);
      const [lo, hi] = startSlot_.current <= endSlot ? [startSlot_.current, endSlot] : [endSlot, startSlot_.current];
      setSel(null);
      onSlotSelectRef.current(fmtD(dateRef.current), lo, Math.min(hi + 1, 47));
    } else if (dy < 10) {
      onSlotSelectRef.current(fmtD(dateRef.current), startSlot_.current, Math.min(startSlot_.current + 2, 47));
    }
    longPress.current = false;
  }, [getSlot]);

  const selStyle = useMemo(() => {
    if (!sel) return null;
    const [lo, hi] = sel.s <= sel.e ? [sel.s, sel.e] : [sel.e, sel.s];
    return { top: slotTop(lo), height: slotTop(hi + 1) - slotTop(lo) };
  }, [sel]);

  const isToday = fmtD(date) === _todayS;

  return (
    <div
      ref={ref}
      className="relative select-none touch-pan-y"
      style={{ height: 24 * HOUR_PX }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {Array.from({ length: 48 }, (_, i) => (
        <div key={i} className={`absolute left-0 right-0 border-t pointer-events-none ${i%2===0 ? 'border-gray-700/70' : 'border-gray-800/50'}`}
          style={{ top: slotTop(i) }} />
      ))}

      {isToday && <div className="absolute inset-0 bg-[#C5A059]/3 pointer-events-none" />}

      {selStyle && (
        <div className="absolute left-0.5 right-0.5 bg-[#C5A059]/25 border border-[#C5A059]/60 rounded pointer-events-none z-10"
          style={selStyle} />
      )}

      {schedules.map(s => {
        const { top, height } = evStyle(s);
        return (
          <div key={s.scheduleId} data-event="1"
            onClick={() => onEventClick(s)}
            style={{ top: top+1, height: height-2, left: 2, right: 2 }}
            className={`absolute rounded border-l-2 px-1 py-0.5 text-[10px] leading-tight overflow-hidden cursor-pointer z-20 hover:brightness-125 transition ${evColor(s)}`}
          >
            <div className="font-bold truncate">{s.title}</div>
            {height > 28 && (
              <div className="opacity-70 flex items-center gap-0.5 mt-0.5">
                <LucideClock size={7} /> {s.startAt.split('T')[1]?.substring(0,5)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 時間ラベル列
// ─────────────────────────────────────────────────────────────

function TimeLabels() {
  return (
    <div className="relative shrink-0 w-12 border-r border-gray-800" style={{ height: 24 * HOUR_PX }}>
      {HOURS.map(h => (
        <div key={h} className="absolute right-1.5 text-[10px] text-gray-500 font-mono -translate-y-1/2 select-none"
          style={{ top: h * HOUR_PX }}>
          {pad(h)}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 週ビュー
// ─────────────────────────────────────────────────────────────

function WeekView({ weekBase, schedules, filterStaff, onSlotSelect, onEventClick }: {
  weekBase: Date; schedules: Schedule[]; filterStaff: string;
  onSlotSelect: ColProps['onSlotSelect']; onEventClick: ColProps['onEventClick'];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: 7 }, (_, i) => addD(weekBase, i));

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX; }, []);

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex border-b border-gray-700 bg-[#0A0F1D]">
        <div className="w-12 shrink-0 border-r border-gray-800" />
        {days.map((d, i) => {
          const isToday = fmtD(d) === _todayS;
          return (
            <div key={i} className={`flex-1 py-2 text-center text-xs border-r border-gray-800 last:border-0 ${isToday ? 'bg-[#C5A059]/10' : ''}`}>
              <div className={`font-bold ${i===0 ? 'text-red-400' : i===6 ? 'text-blue-400' : 'text-gray-300'}`}>{DAY_JA[d.getDay()]}</div>
              <div className={`mt-0.5 mx-auto font-mono text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[#C5A059] text-[#0A0F1D] font-extrabold' : 'text-gray-400'}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '600px' }}>
        <div className="flex">
          <TimeLabels />
          {days.map((d, i) => (
            <div key={i} className="flex-1 min-w-0 border-r border-gray-800 last:border-0">
              <TimeGridColumn
                date={d}
                schedules={schedsForDay(schedules, fmtD(d), filterStaff)}
                onSlotSelect={onSlotSelect}
                onEventClick={onEventClick}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 日ビュー
// ─────────────────────────────────────────────────────────────

function DayView({ date, schedules, filterStaff, onSlotSelect, onEventClick }: {
  date: Date; schedules: Schedule[]; filterStaff: string;
  onSlotSelect: ColProps['onSlotSelect']; onEventClick: ColProps['onEventClick'];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX; }, []);

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex border-b border-gray-700 bg-[#0A0F1D]">
        <div className="w-12 shrink-0 border-r border-gray-800" />
        <div className="flex-1 py-2 text-center">
          <span className={`text-sm font-bold ${date.getDay()===0 ? 'text-red-400' : date.getDay()===6 ? 'text-blue-400' : 'text-gray-200'}`}>
            {date.getFullYear()}年{pad(date.getMonth()+1)}月{pad(date.getDate())}日（{DAY_JA[date.getDay()]}）
          </span>
          {fmtD(date) === _todayS && (
            <span className="ml-2 text-[10px] bg-[#C5A059]/20 text-[#E6C687] px-2 py-0.5 rounded-full border border-[#C5A059]/40">今日</span>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '600px' }}>
        <div className="flex">
          <TimeLabels />
          <div className="flex-1 min-w-0">
            <TimeGridColumn
              date={date}
              schedules={schedsForDay(schedules, fmtD(date), filterStaff)}
              onSlotSelect={onSlotSelect}
              onEventClick={onEventClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 月ビュー
// ─────────────────────────────────────────────────────────────

function MonthView({ current, schedules, filterStaff, onDayClick, onEventClick }: {
  current: Date; schedules: Schedule[]; filterStaff: string;
  onDayClick: (ds: string) => void; onEventClick: ColProps['onEventClick'];
}) {
  const cells = useMemo(() => {
    const y = current.getFullYear(), m = current.getMonth();
    const first = new Date(y, m, 1).getDay(), last = new Date(y, m+1, 0).getDate();
    const prevLast = new Date(y, m, 0).getDate();
    const arr: { d: Date; cur: boolean }[] = [];
    for (let i = first-1; i >= 0; i--) arr.push({ d: new Date(y, m-1, prevLast-i), cur: false });
    for (let d = 1; d <= last; d++) arr.push({ d: new Date(y, m, d), cur: true });
    while (arr.length < 42) arr.push({ d: new Date(y, m+1, arr.length-first-last+1), cur: false });
    return arr;
  }, [current]);

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-800 rounded-lg overflow-hidden">
      {DAY_JA.map((w, i) => (
        <div key={i} className={`text-center py-2 text-xs font-bold bg-[#0A0F1D] ${i===0 ? 'text-red-400' : i===6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
      ))}
      {cells.map((cell, idx) => {
        const ds        = fmtD(cell.d);
        const dayScheds = schedsForDay(schedules, ds, filterStaff);
        const isToday   = ds === _todayS;
        return (
          <div key={idx} onClick={() => onDayClick(ds)}
            className={`min-h-[90px] bg-[#111A35] p-1 flex flex-col cursor-pointer hover:bg-[#1C284D]/50 transition
              ${!cell.cur ? 'opacity-30' : ''}
              ${isToday ? 'ring-2 ring-inset ring-[#C5A059]' : ''}`}>
            <span className={`text-[11px] font-mono font-bold self-start leading-none ${
              isToday ? 'bg-[#C5A059] text-[#0A0F1D] h-5 w-5 rounded-full flex items-center justify-center' : 'text-gray-400'
            }`}>
              {cell.d.getDate()}
            </span>
            <div className="mt-0.5 space-y-0.5 overflow-hidden flex-1">
              {dayScheds.slice(0, 3).map((s, si) => (
                <div key={si} data-event="1"
                  onClick={e => { e.stopPropagation(); onEventClick(s); }}
                  className={`px-1 py-0.5 rounded text-[9px] font-medium leading-tight truncate cursor-pointer hover:brightness-125 border-l-2 ${evColor(s)}`}>
                  {s.startAt.split('T')[1]?.substring(0,5)} {s.title}
                </div>
              ))}
              {dayScheds.length > 3 && <div className="text-[9px] text-gray-500 pl-1">+{dayScheds.length-3}件</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

interface Props {
  customers:           Customer[];
  projects:            Project[];
  schedules:           Schedule[];
  staffList:           string[];
  currentRole:         UserRole;
  selectedStaff:       string;
  onShowToast:         (msg: string) => void;
  onNavigateToReport?: (projectId: string, customerId: string) => void;
}

export default function CalendarPage({
  customers, projects, schedules,
  staffList, currentRole, selectedStaff,
  onShowToast, onNavigateToReport,
}: Props) {
  // 初期表示: 週ビュー
  const [view,             setView]             = useState<CalView>('week');
  // スタッフ初期フィルター: staff ロールは自分の担当のみ
  const [filterStaff,      setFilterStaff]       = useState(
    () => currentRole === 'staff' ? selectedStaff : 'ALL',
  );
  const [current,          setCurrent]           = useState<Date>(() => weekSunday(_today));
  const [formInit,         setFormInit]          = useState<FormInit | null>(null);
  // 選択した予定（アクションダイアログ用）
  const [selectedSchedule, setSelectedSchedule]  = useState<Schedule | null>(null);
  // 編集中の予定
  const [editingSchedule,  setEditingSchedule]   = useState<Schedule | null>(null);

  // スタッフ切り替え時にフィルターを追従（staff ロールのみ）
  useEffect(() => {
    if (currentRole === 'staff') setFilterStaff(selectedStaff);
  }, [currentRole, selectedStaff]);

  // ── ナビゲーション ──────────────────────────────────────────

  const prev = () => {
    if (view === 'month')      setCurrent(new Date(current.getFullYear(), current.getMonth()-1, 1));
    else if (view === 'week')  setCurrent(addD(current, -7));
    else                       setCurrent(addD(current, -1));
  };
  const next = () => {
    if (view === 'month')      setCurrent(new Date(current.getFullYear(), current.getMonth()+1, 1));
    else if (view === 'week')  setCurrent(addD(current, 7));
    else                       setCurrent(addD(current, 1));
  };
  const goToday = () => setCurrent(
    view === 'month' ? new Date(_today.getFullYear(), _today.getMonth(), 1)
    : view === 'week' ? weekSunday(_today) : new Date(_today),
  );

  const switchView = (v: CalView) => {
    setView(v);
    if (v === 'week')      setCurrent(weekSunday(current));
    else if (v === 'day' && view !== 'day') setCurrent(new Date(_today));
    else if (v === 'month') setCurrent(new Date(current.getFullYear(), current.getMonth(), 1));
  };

  // ── 期間ラベル ────────────────────────────────────────────

  const periodLabel = useMemo(() => {
    if (view === 'month') return `${current.getFullYear()}年 ${current.getMonth()+1}月`;
    if (view === 'week')  {
      const ws = weekSunday(current), we = addD(ws, 6);
      return `${ws.getMonth()+1}/${ws.getDate()} 〜 ${we.getMonth()+1}/${we.getDate()}`;
    }
    return `${current.getFullYear()}年${current.getMonth()+1}月${current.getDate()}日（${DAY_JA[current.getDay()]}）`;
  }, [view, current]);

  // ── スロット選択 → フォーム ───────────────────────────────

  const onSlotSelect = useCallback((dateStr: string, startSlot: number, endSlot: number) => {
    const { h: sh, m: sm } = slotToTime(startSlot);
    const { h: eh, m: em } = slotToTime(Math.min(endSlot, 47));
    setFormInit({ date: dateStr, startTime: `${pad(sh)}:${pad(sm)}`, endTime: `${pad(eh)}:${pad(em)}` });
  }, []);

  const onDayClick = useCallback((dateStr: string) => {
    setFormInit({ date: dateStr, startTime: '09:00', endTime: '10:00' });
  }, []);

  // ── イベントクリック → アクションダイアログ ──────────────

  const onEventClick = useCallback((s: Schedule) => {
    setSelectedSchedule(s);
  }, []);

  // ── 保存（新規 / 更新） ──────────────────────────────────

  const handleSave = async (f: FormState, existingId?: string) => {
    try {
      const base = schedules.find(s => s.scheduleId === existingId);
      await saveSchedule({
        scheduleId:     existingId ?? 'SCH-' + Date.now(),
        title:          f.title,
        customerId:     f.customerId,
        projectId:      f.projectId,
        startAt:        `${f.date}T${f.startTime}:00`,
        endAt:          `${f.date}T${f.endTime}:00`,
        assignees:      f.assignees,
        isLtvTriggered: f.isLtvTriggered,
        notes:          f.notes,
        createdAt:      base?.createdAt ?? new Date().toISOString(),
      });
      setFormInit(null);
      setEditingSchedule(null);
      onShowToast(existingId ? '予定を更新しました' : '予定を保存しました');
    } catch {
      onShowToast('保存に失敗しました');
    }
  };

  // ── 削除 ──────────────────────────────────────────────────

  const handleDelete = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      setSelectedSchedule(null);
      onShowToast('予定を削除しました');
    } catch {
      onShowToast('削除に失敗しました');
    }
  };

  const weekBase = weekSunday(current);

  return (
    <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-6 shadow-xl space-y-4">

      {/* ── ヘッダーコントロール ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <LucideCalendar className="text-[#C5A059]" size={18} />
            案件連動型カレンダー
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {view === 'month' ? 'クリックで予定作成' : 'ドラッグ(PC) / 長押し+スワイプ(モバイル) で時間帯指定'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* スタッフフィルター（管理者のみ全員表示可） */}
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
            className="bg-[#0B132B] border border-gray-700 text-xs text-white rounded-md px-2 py-1.5 focus:outline-none">
            {currentRole !== 'staff' && <option value="ALL">👤 全員分</option>}
            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* ビュー切替 */}
          <div className="flex bg-[#0B132B] border border-gray-700 rounded-md overflow-hidden">
            {(['month', 'week', 'day'] as CalView[]).map(v => (
              <button key={v} onClick={() => switchView(v)}
                className={`px-3 py-1.5 text-xs font-bold transition ${view===v ? 'bg-[#C5A059]/20 text-[#E6C687]' : 'text-gray-400 hover:text-white'}`}>
                {v === 'month' ? '月' : v === 'week' ? '週' : '日'}
              </button>
            ))}
          </div>

          {/* 期間ナビゲーター */}
          <div className="flex items-center gap-0.5 bg-[#0B132B] border border-gray-800 rounded-md px-1">
            <button onClick={prev} className="text-gray-400 hover:text-white p-1.5"><LucideChevronLeft size={14} /></button>
            <span className="text-xs font-mono font-bold text-white px-1.5 min-w-[120px] text-center">{periodLabel}</span>
            <button onClick={next} className="text-gray-400 hover:text-white p-1.5"><LucideChevronRight size={14} /></button>
          </div>

          <button onClick={goToday}
            className="text-xs px-3 py-1.5 bg-[#0B132B] border border-gray-700 text-gray-300 hover:text-white rounded-md transition">
            今日
          </button>
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400 bg-[#0B132B] p-2.5 rounded border border-gray-800">
        <span className="font-bold text-white">色分け：</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-blue-950 border-l-2 border-blue-500" /> 営業予定</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-emerald-950 border-l-2 border-emerald-500" /> 施工・現場</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-purple-950 border-l-2 border-purple-500" /> LTV点検</span>
      </div>

      {/* ── ビュー本体 ── */}
      {view === 'month' && (
        <MonthView current={current} schedules={schedules} filterStaff={filterStaff}
          onDayClick={onDayClick} onEventClick={onEventClick} />
      )}
      {view === 'week' && (
        <WeekView weekBase={weekBase} schedules={schedules} filterStaff={filterStaff}
          onSlotSelect={onSlotSelect} onEventClick={onEventClick} />
      )}
      {view === 'day' && (
        <DayView date={current} schedules={schedules} filterStaff={filterStaff}
          onSlotSelect={onSlotSelect} onEventClick={onEventClick} />
      )}

      {/* ── 予定作成ダイアログ ── */}
      {formInit && (
        <ScheduleDialog init={formInit} customers={customers} projects={projects}
          staffList={staffList} onSave={handleSave} onClose={() => setFormInit(null)} />
      )}

      {/* ── 予定編集ダイアログ ── */}
      {editingSchedule && (
        <ScheduleDialog existing={editingSchedule} customers={customers} projects={projects}
          staffList={staffList} onSave={handleSave} onClose={() => setEditingSchedule(null)} />
      )}

      {/* ── 予定アクションダイアログ ── */}
      {selectedSchedule && (
        <EventActionDialog
          schedule={selectedSchedule}
          customers={customers}
          projects={projects}
          canReport={
            !!(onNavigateToReport &&
              selectedSchedule.projectId &&
              selectedSchedule.customerId)
          }
          onEdit={() => {
            setEditingSchedule(selectedSchedule);
            setSelectedSchedule(null);
          }}
          onDelete={() => handleDelete(selectedSchedule.scheduleId)}
          onReport={() => {
            if (onNavigateToReport && selectedSchedule.projectId && selectedSchedule.customerId) {
              onNavigateToReport(selectedSchedule.projectId, selectedSchedule.customerId);
            }
            setSelectedSchedule(null);
          }}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
    </div>
  );
}
