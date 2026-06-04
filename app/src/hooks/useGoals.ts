import { useFirestoreCollection } from './useFirestoreCollection';
import type { MonthlyGoal } from '@/types';

export const useGoals = (userId: string | null) =>
  useFirestoreCollection<MonthlyGoal>('goals', userId);
