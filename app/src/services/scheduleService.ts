import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { Schedule } from '@/types';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'schedules', id);

export const saveSchedule = async (schedule: Schedule): Promise<void> => {
  await setDoc(ref(schedule.scheduleId), schedule);
};

export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  await deleteDoc(ref(scheduleId));
};

/** OUT 報告後に AI が生成する次回アクション予定を自動登録 */
export const createAutoSchedule = async (
  base: Omit<Schedule, 'scheduleId'>,
): Promise<string> => {
  const id = 'SCH-AUTO-' + Date.now();
  await saveSchedule({ ...base, scheduleId: id });
  return id;
};
