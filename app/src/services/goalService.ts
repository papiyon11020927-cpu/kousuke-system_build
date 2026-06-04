import { doc, setDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { MonthlyGoal } from '@/types';

const ref = (id: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'goals', id);

export const goalId = (staffName: string, yearMonth: string) =>
  `${staffName}-${yearMonth}`;

export const saveGoal = async (goal: MonthlyGoal): Promise<void> => {
  await setDoc(ref(goal.goalId), { ...goal, updatedAt: new Date().toISOString() });
};
