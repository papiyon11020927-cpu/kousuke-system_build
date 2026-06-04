import { useFirestoreCollection } from './useFirestoreCollection';
import type { ProjectComment } from '@/types';

export const useComments = (userId: string | null) =>
  useFirestoreCollection<ProjectComment>('project_comments', userId);
