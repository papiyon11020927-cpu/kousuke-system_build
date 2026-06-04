import { useFirestoreCollection } from './useFirestoreCollection';
import type { Vendor } from '@/types';

export const useVendors = (userId: string | null) =>
  useFirestoreCollection<Vendor>('vendors', userId);
