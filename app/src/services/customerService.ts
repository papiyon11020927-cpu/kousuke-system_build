import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { Customer } from '@/types';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'customers', id);

const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const saveCustomer = async (customer: Customer): Promise<void> => {
  await setDoc(ref(customer.customerId), stripUndefined({
    ...customer,
    updatedAt: new Date().toISOString(),
  }));
};

export const updateLtv = async (customerId: string, newLtv: number): Promise<void> => {
  await updateDoc(ref(customerId), { totalLtv: newLtv, updatedAt: new Date().toISOString() });
};

export const deleteCustomer = async (customerId: string): Promise<void> => {
  await deleteDoc(ref(customerId));
};
