import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { Project, ProjectStatus } from '@/types';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', id);

/** undefined フィールドを除去してから保存（Firestore は undefined を受け付けない） */
const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const saveProject = async (project: Project): Promise<void> => {
  await setDoc(ref(project.projectId), stripUndefined({
    ...project,
    updatedAt: new Date().toISOString(),
  }));
};

/** 契約以降のステータスは確度を 100% に自動更新する */
const CONTRACT_AND_BEYOND: ProjectStatus[] = [
  'contract', 'construction', 'completed', 'settlement', 'closed',
];

export const updateProjectStatus = async (
  projectId: string,
  status: ProjectStatus,
): Promise<void> => {
  const now = new Date().toISOString();
  const extra = CONTRACT_AND_BEYOND.includes(status) ? { probability: 100 } : {};
  await updateDoc(ref(projectId), { status, lastActivityAt: now, updatedAt: now, ...extra });
};

export const touchLastActivity = async (projectId: string): Promise<void> => {
  const now = new Date().toISOString();
  await updateDoc(ref(projectId), { lastActivityAt: now });
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await deleteDoc(ref(projectId));
};

/** 失注理由を記録（ステータス変更と同時に呼ぶ） */
export const setLostReason = async (projectId: string, lostReason: string): Promise<void> => {
  const now = new Date().toISOString();
  await updateDoc(ref(projectId), { lostReason, updatedAt: now });
};

/** スタッフ作成案件を管理者が承認 */
export const approveProjectCreation = async (projectId: string): Promise<void> => {
  const now = new Date().toISOString();
  await updateDoc(ref(projectId), { projectApprovalStatus: 'approved', updatedAt: now });
};
