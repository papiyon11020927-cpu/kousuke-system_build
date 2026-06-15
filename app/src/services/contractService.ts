import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, APP_ID, fbFunctions } from '@/firebase/config';
import type { Contract, PaymentTerm } from '@/types';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'contracts', id);

/** トップレベルの undefined フィールドを除去 */
const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/** ネストされた object/array を再帰的に undefined フィールド除去
 *  paymentTerms のような配列内オブジェクトに含まれる undefined が
 *  Firestore の invalid-argument を引き起こすため使用する */
function deepStrip<T>(value: T): T {
  if (Array.isArray(value)) return value.map(deepStrip) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as object)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, deepStrip(v)]),
    ) as T;
  }
  return value;
}

/** 契約書を1件取得（署名公開ページ用・認証不要） */
export const getContractById = async (contractId: string): Promise<Contract | null> => {
  const snap = await getDoc(ref(contractId));
  if (!snap.exists()) return null;
  return snap.data() as Contract;
};

export const saveContract = async (contract: Contract): Promise<void> => {
  // deepStrip で paymentTerms 内ネストの undefined も除去（Firestore invalid-argument 対策）
  await setDoc(ref(contract.contractId), deepStrip({
    ...contract,
    updatedAt: new Date().toISOString(),
  }));
};

/** 公開署名ページからの署名確定（Cloud Function 経由・admin権限）
 *  署名保存・案件ステータス更新・受注金額への契約金額自動反映（積算）をまとめて行う */
const signCustomerContractFn = httpsCallable<
  { contractId: string; signatureDataUrl: string },
  { success: boolean }
>(fbFunctions, 'signCustomerContract');

export const signCustomerContract = async (
  contractId:       string,
  signatureDataUrl: string,
): Promise<void> => {
  await signCustomerContractFn({ contractId, signatureDataUrl });
};

export const submitContractForApproval = async (contractId: string): Promise<void> => {
  await updateDoc(ref(contractId), {
    approvalStatus: 'pending_approval',
    updatedAt: new Date().toISOString(),
  });
};

export const approveContract = async (
  contractId: string,
  approvedBy: string,
  comment?: string,
): Promise<void> => {
  await updateDoc(ref(contractId), stripUndefined({
    approvalStatus:  'approved',
    approvedBy,
    approvedAt:      new Date().toISOString(),
    approvalComment: comment || undefined,
    updatedAt:       new Date().toISOString(),
  }));
};

export const rejectContract = async (
  contractId: string,
  rejectedBy: string,
  comment: string,
): Promise<void> => {
  await updateDoc(ref(contractId), {
    approvalStatus:  'rejected',
    approvedBy:      rejectedBy,
    approvedAt:      new Date().toISOString(),
    approvalComment: comment,
    updatedAt:       new Date().toISOString(),
  });
};

/** 承認依頼を取り下げて下書きに戻す（担当スタッフ用） */
export const revertContractToDraft = async (contractId: string): Promise<void> => {
  await updateDoc(ref(contractId), {
    approvalStatus:  'draft',
    approvedBy:      deleteField(),
    approvedAt:      deleteField(),
    approvalComment: deleteField(),
    updatedAt:       new Date().toISOString(),
  });
};

/** 契約書を削除する（draft または rejected のみ） */
export const deleteContract = async (contractId: string): Promise<void> => {
  await deleteDoc(ref(contractId));
};

/** 支払条件の入金状態を更新（配列全体を上書き）
 *  deepStrip で undefined フィールドを除去してから保存 */
export const updatePaymentTerms = async (
  contractId: string,
  updatedTerms: PaymentTerm[],
): Promise<void> => {
  await updateDoc(ref(contractId), {
    paymentTerms: deepStrip(updatedTerms),
    updatedAt: new Date().toISOString(),
  });
};

/** 契約書を廃止（signed 以外の場合に適用可能） */
export const voidContract = async (contractId: string, voidedBy: string): Promise<void> => {
  await updateDoc(ref(contractId), {
    approvalStatus: 'voided',
    approvedBy:     voidedBy,
    updatedAt:      new Date().toISOString(),
  });
};
