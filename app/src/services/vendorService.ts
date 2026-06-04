import { doc, setDoc, deleteDoc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, APP_ID, getCol } from '@/firebase/config';
import type { Vendor } from '@/types';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'vendors', id);

const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const saveVendor = async (vendor: Vendor): Promise<void> => {
  await setDoc(ref(vendor.vendorId), stripUndefined({
    ...vendor,
    updatedAt: new Date().toISOString(),
  }));
};

export const deleteVendor = async (vendorId: string): Promise<void> => {
  await deleteDoc(ref(vendorId));
};

/** 業者IDで直接取得（公開署名ページ用・インデックス不要） */
export const getVendorById = async (
  vendorId: string,
): Promise<Vendor | null> => {
  const snap = await getDoc(ref(vendorId));
  if (!snap.exists()) return null;
  return snap.data() as Vendor;
};

/** 業者が電子署名した結果を保存 */
export const saveBasicContractSignature = async (
  vendorId:         string,
  signatureDataUrl: string,
): Promise<void> => {
  const now = new Date().toISOString();
  await updateDoc(ref(vendorId), {
    'basicContract.vendorSignature': signatureDataUrl,
    'basicContract.signatureAt':     now,
    'basicContract.signedByVendor':  true,
    'basicContract.signedAt':        now,
    updatedAt: now,
  });
};
