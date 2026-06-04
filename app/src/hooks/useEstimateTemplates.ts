import { useFirestoreCollection } from './useFirestoreCollection';
import type { EstimateTemplate } from '@/types';

export const useEstimateTemplates = (userId: string | null) =>
  useFirestoreCollection<EstimateTemplate>('estimate_templates', userId);
