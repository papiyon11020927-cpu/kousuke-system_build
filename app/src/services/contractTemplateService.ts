import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { ContractTemplate } from '@/types';

const ref = (id: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'contract_templates', id);

export const saveContractTemplate = async (t: ContractTemplate): Promise<void> => {
  await setDoc(ref(t.templateId), { ...t, updatedAt: new Date().toISOString() });
};

export const deleteContractTemplate = async (id: string): Promise<void> => {
  await deleteDoc(ref(id));
};
