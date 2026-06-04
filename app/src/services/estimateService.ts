import { doc, setDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { Estimate } from '@/types';
import { createNotification } from './notificationService';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'estimates', id);

const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const saveEstimate = async (estimate: Estimate): Promise<void> => {
  await setDoc(ref(estimate.estimateId), stripUndefined({
    ...estimate,
    updatedAt: new Date().toISOString(),
  }));
};

export const submitForApproval = async (
  estimateId:   string,
  projectTitle: string,
  createdBy:    string,
): Promise<void> => {
  await updateDoc(ref(estimateId), {
    approvalStatus: 'pending_approval',
    updatedAt: new Date().toISOString(),
  });
  // 承認依頼通知を作成（Cloud Function がメール送信）
  await createNotification({
    type:         'estimate_approval_requested',
    title:        '見積承認依頼',
    body:         `${createdBy} さんが「${projectTitle}」の見積書を承認依頼しました。`,
    relatedId:    estimateId,
    projectTitle,
  }).catch(console.error); // 通知失敗でも主処理は止めない
};

export const approveEstimate = async (
  estimateId: string,
  approvedBy: string,
  comment?: string,
): Promise<void> => {
  const now = new Date().toISOString();
  await updateDoc(ref(estimateId), {
    approvalStatus: 'approved',
    approvedBy,
    approvedAt: now,
    ...(comment?.trim() ? { approvalComment: comment.trim() } : {}),
    updatedAt: now,
  });
};

export const rejectEstimate = async (
  estimateId: string,
  rejectedBy: string,
  comment: string,
): Promise<void> => {
  const now = new Date().toISOString();
  await updateDoc(ref(estimateId), {
    approvalStatus: 'rejected',
    approvedBy: rejectedBy,
    approvedAt: now,
    approvalComment: comment,
    updatedAt: now,
  });
};

/** 見積書を削除する（draft または rejected のみ） */
export const deleteEstimate = async (estimateId: string): Promise<void> => {
  await deleteDoc(ref(estimateId));
};

/** 承認依頼を取り下げて下書きに戻す（起案者用） */
export const revertEstimateToDraft = async (estimateId: string): Promise<void> => {
  await updateDoc(ref(estimateId), {
    approvalStatus:  'draft',
    approvedBy:      deleteField(),
    approvedAt:      deleteField(),
    approvalComment: deleteField(),
    updatedAt:       new Date().toISOString(),
  });
};
