import { useFirestoreCollection } from './useFirestoreCollection';
import type { DailyReport } from '@/types';

export const useDailyReports = (userId: string | null) =>
  useFirestoreCollection<DailyReport>('daily_reports', userId);
