import { useFirestoreCollection } from './useFirestoreCollection';
import type { Schedule } from '@/types';

export const useSchedules = (userId: string | null) =>
  useFirestoreCollection<Schedule>('schedules', userId);
