import { useFirestoreCollection } from './useFirestoreCollection';
import type { InOutLog } from '@/types';

export const useLogs = (userId: string | null) =>
  useFirestoreCollection<InOutLog>('in_out_logs', userId);
