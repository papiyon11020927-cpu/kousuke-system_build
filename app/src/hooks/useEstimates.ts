import { useFirestoreCollection } from './useFirestoreCollection';
import type { Estimate } from '@/types';

export const useEstimates = (userId: string | null) =>
  useFirestoreCollection<Estimate>('estimates', userId);
