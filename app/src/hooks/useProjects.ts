import { useFirestoreCollection } from './useFirestoreCollection';
import type { Project } from '@/types';

export const useProjects = (userId: string | null) =>
  useFirestoreCollection<Project>('projects', userId);
