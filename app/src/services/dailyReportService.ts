import { doc, setDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { DailyReport, InOutLog } from '@/types';
import { generateDailySummary } from './aiService';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'daily_reports', id);

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
