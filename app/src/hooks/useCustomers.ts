import { useFirestoreCollection } from './useFirestoreCollection';
import type { Customer } from '@/types';

export const useCustomers = (userId: string | null) =>
  useFirestoreCollection<Customer>('customers', userId);
