import { doc, setDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { DailyReport, InOutLog } from '@/types';
import { generateDailySummary, generateTeamDailySummary } from './aiService';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'daily_reports', id);

/** 全社サマリーの staffName 兼 reportId 接頭辞（実在するスタッフ名と衝突しない予約名） */
export const TEAM_REPORT_STAFF_NAME = '__TEAM__';

export const saveDailyReport = async (report: DailyReport): Promise<void> => {
  await setDoc(ref(report.reportId), report);
};

export const createDailyReport = async (
  staffName: string,
  dateStr: string,
  outLogs: InOutLog[],
): Promise<DailyReport> => {
  const summary = await generateDailySummary(staffName, outLogs);
  const report: DailyReport = {
    reportId:      `${staffName}-${dateStr}`,
    staffName,
    dateStr,
    summary,
    visitCount:    outLogs.length,
    totalDuration: outLogs.reduce((acc, l) => acc + (l.duration ?? 0), 0),
    logIds:        outLogs.map(l => l.logId),
    generatedAt:   new Date().toISOString(),
  };
  await saveDailyReport(report);
  return report;
};

/** 管理者向け：その日の全スタッフ活動を1件のAIサマリーに統合して生成・保存する */
export const createTeamDailyReport = async (
  dateStr: string,
  logsByStaff: { staffName: string; logs: InOutLog[] }[],
): Promise<DailyReport> => {
  const summary = await generateTeamDailySummary(logsByStaff);
  const allOutLogs = logsByStaff.flatMap(({ logs }) => logs.filter(l => l.type === 'out'));
  const report: DailyReport = {
    reportId:      `${TEAM_REPORT_STAFF_NAME}-${dateStr}`,
    staffName:     TEAM_REPORT_STAFF_NAME,
    dateStr,
    summary,
    visitCount:    allOutLogs.length,
    totalDuration: allOutLogs.reduce((acc, l) => acc + (l.duration ?? 0), 0),
    logIds:        allOutLogs.map(l => l.logId),
    generatedAt:   new Date().toISOString(),
  };
  await saveDailyReport(report);
  return report;
};
