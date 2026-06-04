import { useFirestoreCollection } from './useFirestoreCollection';
import type { Contract } from '@/types';

export const useContracts = (userId: string | null) =>
  useFirestoreCollection<Contract>('contracts', userId);
