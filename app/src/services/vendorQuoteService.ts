import {
  doc, setDoc, updateDoc, deleteDoc, getDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallableFromURL } from 'firebase/functions';
import { db, APP_ID, getCol, storage, fbFunctions } from '@/firebase/config';
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

// ─── 工事完了報告書の記録（業者 or スタッフ代理） ────────────
export const submitCompletionReport = async (
  requestId: string,
  report: {
    photoUrls:    string[];
    docUrls:      { name: string; url: string; sizeMb: number }[];
    notes:        string;
    submittedAt:  string;
    submittedVia: 'vendor' | 'staff';
  },
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

// ─── 請求書受領の記録（業者 or スタッフ代理） ──────────────────
export const recordVendorInvoice = async (
  requestId: string,
  invoice: {
    photoUrls:    string[];
    docUrls:      { name: string; url: string; sizeMb: number }[];
    amount?:      number;
    ocrAmount?:   number;
    notes:        string;
    receivedAt:   string;
    submittedVia: 'vendor' | 'staff';
  },
): Promise<void> => {
  await updateDoc(docRef(requestId), {
    vendorInvoice: stripUndefined(invoice),
    updatedAt: new Date().toISOString(),
  });
};

// ─── 写真を WebP に圧縮して Firebase Storage にアップロード → URL を返す ───
export const uploadVendorPhoto = async (file: File, folder: string, idx: number): Promise<string> => {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = reject;
    img.onload = () => {
      const MAX_W = 1280;
      const scale = Math.min(1, MAX_W / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => {
        URL.revokeObjectURL(url);
        b ? resolve(b) : reject(new Error('toBlob failed'));
      }, 'image/webp', 0.75);
    };
    img.src = url;
  });
  const ref = storageRef(storage, `${folder}/photo_${idx}_${Date.now()}.webp`);
  await uploadBytes(ref, blob, { contentType: 'image/webp' });
  return getDownloadURL(ref);
};

// ─── PDF を Firebase Storage にアップロード → {name, url, sizeMb} を返す ───
export const uploadVendorDoc = async (file: File, folder: string): Promise<{ name: string; url: string; sizeMb: number }> => {
  const ref = storageRef(storage, `${folder}/doc_${Date.now()}_${file.name}`);
  await uploadBytes(ref, file, { contentType: 'application/pdf' });
  const url = await getDownloadURL(ref);
  return { name: file.name, url, sizeMb: Math.round(file.size / 1024 / 1024 * 10) / 10 };
};

// ─── 請求書OCR: 添付ファイルから合計金額を抽出（注文金額との一致チェック用） ───
// Gemini が直接対応する画像形式
const GEMINI_SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png',
  'image/gif', 'image/webp', 'image/heic', 'image/heif',
]);

const fileToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });

/** BMP など Gemini 非対応の画像形式は PNG に変換してから base64 化 */
const normalizeImageForGemini = (file: File): Promise<{ data: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    if (GEMINI_SUPPORTED_IMAGE_TYPES.has(file.type)) {
      fileToBase64(file).then(data => resolve({ data, mimeType: file.type })).catch(reject);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('画像変換に失敗しました')); return; }
        fileToBase64(blob).then(data => resolve({ data, mimeType: 'image/png' })).catch(reject);
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像の読み込みに失敗しました')); };
    img.src = url;
  });

const analyzeVendorDocFn = httpsCallableFromURL<
  { base64: string; mimeType: string },
  { items: unknown[]; date: string | null; invoiceTotal: number | null }
>(fbFunctions, '/analyzeVendorDoc');

/** 請求書PDF・画像をGemini OCRで解析し、合計金額を抽出する（読み取れない場合は null） */
export const analyzeInvoiceAmount = async (file: File): Promise<number | null> => {
  try {
    let base64: string;
    let mimeType: string;
    if (file.type === 'application/pdf') {
      base64 = await fileToBase64(file);
      mimeType = 'application/pdf';
    } else if (file.type.startsWith('image/')) {
      ({ data: base64, mimeType } = await normalizeImageForGemini(file));
    } else {
      return null;
    }
    const result = await analyzeVendorDocFn({ base64, mimeType });
    return result.data.invoiceTotal ?? null;
  } catch {
    return null;
  }
};
