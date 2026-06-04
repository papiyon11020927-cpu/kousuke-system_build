import {
  doc, setDoc, updateDoc, deleteDoc, getDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, APP_ID, getCol, storage } from '@/firebase/config';
import type { VendorQuoteRequest, VendorQuoteStatus, VendorQuoteItem } from '@/types';
import { createNotification } from './notificationService';

// 他サービスと同じ個別セグメント形式に統一
const docRef = (id: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'vendor_quote_requests', id);

// undefined を除去してから Firestore に書き込む
const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;

// ─── 依頼作成（社内スタッフ） ────────────────────────────────
export const createVendorQuoteRequest = async (
  params: Omit<VendorQuoteRequest,
    'requestId' | 'token' | 'createdAt' | 'status' |
    'submittedAt' | 'quoteType' | 'totalAmount' | 'items' | 'vendorNote'
  >,
): Promise<VendorQuoteRequest> => {
  const requestId = crypto.randomUUID();
  const token     = crypto.randomUUID();
  const now       = new Date().toISOString();

  const full: VendorQuoteRequest = {
    ...params,
    requestId,
    token,
    status:    'pending',
    createdAt: now,
  };

  await setDoc(docRef(requestId), stripUndefined(full));
  return full;
};

// ─── ステータス更新（社内スタッフ：確認済み・承認・却下） ───
export const updateVendorQuoteStatus = async (
  requestId: string,
  status:    VendorQuoteStatus,
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    status,
    updatedAt: new Date().toISOString(),
  });
};

// ─── 依頼削除 ────────────────────────────────────────────────
export const deleteVendorQuoteRequest = async (requestId: string): Promise<void> => {
  await deleteDoc(docRef(requestId));
};

// ─── トークンで取得（公開フォーム用：認証不要） ─────────────
export const getVendorQuoteByToken = async (
  token: string,
): Promise<VendorQuoteRequest | null> => {
  const q    = query(getCol('vendor_quote_requests'), where('token', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as VendorQuoteRequest;
};

// ─── PDF を Firebase Storage にアップロード ──────────────────
export const uploadVendorQuotePdf = async (
  requestId: string,
  file:       File,
): Promise<string> => {
  const path  = `vendor-quotes/${requestId}/vendor-quote.pdf`;
  const ref   = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: 'application/pdf' });
  return getDownloadURL(ref);
};

// ─── 業者からの回答送信（公開フォーム用） ───────────────────
export const submitVendorQuote = async (
  requestId:    string,
  quoteType:    'total' | 'itemized',
  totalAmount:  number,
  items:        VendorQuoteItem[] | undefined,
  vendorNote:   string | undefined,
  pdfUrl:       string | undefined,
  // 通知用メタ情報（公開フォームが保持している情報）
  vendorName:   string = '',
  projectTitle: string = '',
): Promise<void> => {
  const now = new Date().toISOString();
  await updateDoc(docRef(requestId), {
    status:      'submitted',
    submittedAt: now,
    quoteType,
    totalAmount,
    ...(items?.length      ? { items }      : {}),
    ...(vendorNote?.trim() ? { vendorNote } : {}),
    ...(pdfUrl             ? { pdfUrl }     : {}),
    updatedAt: now,
  });
  // 依頼者 userId を取得して通知に含める（担当者スタッフにも届けるため）
  const requestSnap = await getDoc(docRef(requestId)).catch(() => null);
  const createdByUserId = requestSnap?.data()?.createdByUserId as string | undefined;

  // 業者回答通知を作成（Cloud Function がメール送信）
  // ※ 公開フォームからの書き込みのため認証不要で作成できるよう Firestore ルールで許可
  await createNotification({
    type:             'vendor_quote_submitted',
    title:            '業者見積回答',
    body:             `${vendorName} から「${projectTitle}」の見積回答が届きました。金額: ¥${totalAmount.toLocaleString()}`,
    relatedId:        requestId,
    projectTitle,
    notifiedUserIds:  createdByUserId ? [createdByUserId] : [],
  }).catch(console.error); // 通知失敗でも主処理は止めない
};

// ─── 業者への支払い予定日を設定 ─────────────────────────────
export const setVendorPaymentDueDate = async (
  requestId: string,
  dueDate:   string,
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    vendorPaymentDueDate: dueDate,
    updatedAt: new Date().toISOString(),
  });
};

// ─── 業者支払い済みを記録（受領署名なし） ───────────────────
export const markVendorPaid = async (
  requestId: string,
  paidAt:    string,
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    vendorPaid:   true,
    vendorPaidAt: paidAt,
    updatedAt:    new Date().toISOString(),
  });
};

// ─── 業者支払い済みを取り消す ────────────────────────────────
export const unmarkVendorPaid = async (requestId: string): Promise<void> => {
  const { deleteField } = await import('firebase/firestore');
  await updateDoc(docRef(requestId), {
    vendorPaid:   false,
    vendorPaidAt: deleteField(),
    updatedAt:    new Date().toISOString(),
  });
};

// ─── 業者受領署名を記録（署名と同時に支払い済みにする） ─────
export const saveVendorReceiptSignature = async (
  requestId:        string,
  signatureDataUrl: string,
  paidAt:           string,
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    vendorReceiptSignature: signatureDataUrl,
    vendorReceiptSignedAt:  new Date().toISOString(),
    vendorPaid:             true,
    vendorPaidAt:           paidAt,
    updatedAt:              new Date().toISOString(),
  });
};

// ─── 工事完了報告書の記録（業者 or スタッフ代理） ────────────
export const submitCompletionReport = async (
  requestId: string,
  report: { photos: string[]; notes: string; submittedAt: string; submittedVia: 'vendor' | 'staff' },
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    completionReport: report,
    updatedAt: new Date().toISOString(),
  });
};

// ─── 完了検査・検収結果の記録 ──────────────────────────────────
export const recordInspectionResult = async (
  requestId: string,
  result: { result: 'pass' | 'fail'; notes: string; inspectedAt: string; inspectedBy: string },
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    inspectionResult: result,
    updatedAt: new Date().toISOString(),
  });
};

// ─── 検収書の発行記録 ─────────────────────────────────────────
export const issueAcceptanceCert = async (
  requestId: string,
  cert: { issuedAt: string; issuedBy: string },
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    acceptanceCert: cert,
    updatedAt: new Date().toISOString(),
  });
};

// ─── 請求書受領の記録 ─────────────────────────────────────────
export const recordVendorInvoice = async (
  requestId: string,
  invoice: { photos: string[]; amount?: number; notes?: string; receivedAt: string },
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    vendorInvoice: invoice,
    updatedAt: new Date().toISOString(),
  });
};
