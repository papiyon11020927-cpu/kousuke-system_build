import { useFirestoreCollection } from './useFirestoreCollection';
import type { AppUser } from '@/types';

export const useUsers = (userId: string | null) =>
  useFirestoreCollection<AppUser>('users', userId);
