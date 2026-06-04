import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/firebase/config';
import type { InOutLog, StructuredReportData } from '@/types';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'in_out_logs', id);

export const getGPSLocation = (): Promise<{ latitude: number; longitude: number }> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: 34.6937, longitude: 135.5023 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({
        latitude:  34.6937 + (Math.random() - 0.5) * 0.005,
        longitude: 135.5023 + (Math.random() - 0.5) * 0.005,
      }),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });

/** Canvas API でリサイズ＋JPEG圧縮 (最大1280px, 品質75%) */
export const compressImage = (file: File, maxPx = 1280, quality = 0.75): Promise<File> =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => resolve(
          blob
            ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
            : file,
        ),
        'image/jpeg', quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

export const uploadPhotos = async (logId: string, files: File[]): Promise<string[]> => {
  if (!files.length) return [];
  return Promise.all(files.map(async (file) => {
    const compressed = await compressImage(file);
    const path = `artifacts/${APP_ID}/photos/${logId}/${Date.now()}_${compressed.name}`;
    const r    = storageRef(storage, path);
    await uploadBytes(r, compressed);
    return getDownloadURL(r);
  }));
};

export const saveInLog = async (
  projectId: string, customerId: string,
  userId: string, userName: string,
): Promise<string> => {
  const loc = await getGPSLocation();
  const id  = 'LOG-' + Date.now();
  const log: InOutLog = {
    logId: id, projectId, customerId, userId, userName,
    type: 'in', timestamp: new Date().toISOString(),
    location: { lat: loc.latitude, lng: loc.longitude },
    voiceText: '',
  };
  await setDoc(ref(id), log);
  return id;
};

export const saveOutLog = async (
  projectId: string, customerId: string,
  userId: string, userName: string,
  voiceText: string,
  structuredData?: StructuredReportData,
  duration?: number,
  photoUrls?: string[],
  existingLogId?: string,      // 写真アップロード済みの場合は事前生成したIDを渡す
): Promise<string> => {
  const loc = await getGPSLocation();
  const id  = existingLogId ?? 'LOG-' + Date.now();
  const log: InOutLog = {
    logId: id, projectId, customerId, userId, userName,
    type: 'out', timestamp: new Date().toISOString(),
    location: { lat: loc.latitude, lng: loc.longitude },
    voiceText, structuredData, duration,
    ...(photoUrls?.length ? { photoUrls } : {}),
  };
  await setDoc(ref(id), log);
  return id;
};
