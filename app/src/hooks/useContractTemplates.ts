import { useFirestoreCollection } from './useFirestoreCollection';
import type { ContractTemplate } from '@/types';

export const useContractTemplates = (userId: string | null) =>
  useFirestoreCollection<ContractTemplate>('contract_templates', userId);
