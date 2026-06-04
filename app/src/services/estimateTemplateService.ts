import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { EstimateTemplate } from '@/types';

const ref = (id: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'estimate_templates', id);

export const saveEstimateTemplate = async (t: EstimateTemplate): Promise<void> => {
  await setDoc(ref(t.templateId), { ...t, updatedAt: new Date().toISOString() });
};

export const deleteEstimateTemplate = async (id: string): Promise<void> => {
  await deleteDoc(ref(id));
};
