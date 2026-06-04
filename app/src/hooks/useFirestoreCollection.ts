import { useEffect, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { getCol } from '@/firebase/config';

/**
 * Firestore コレクションをリアルタイム購読する汎用フック
 *
 * パフォーマンス最適化:
 *  - docChanges() が 0 件（メタデータのみ更新）の場合は setState をスキップ
 *    → 自分の書き込みの「サーバー確認スナップショット」による二重レンダーを防止
 */
export function useFirestoreCollection<T>(
  collectionName: string,
  userId: string | null,
): { data: T[]; loading: boolean } {
  const [data, setData]       = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // userId が変わったとき初期化フラグをリセット
    initializedRef.current = false;
    if (!userId) { setLoading(false); return; }

    const unsub = onSnapshot(
      getCol(collectionName),
      (snap) => {
        const changes = snap.docChanges();
        if (initializedRef.current && changes.length === 0) {
          // 差分なし（メタデータのみ更新）→ 再レンダー不要
          return;
        }
        initializedRef.current = true;
        setData(snap.docs.map((d) => d.data() as T));
        setLoading(false);
      },
      (err) => {
        console.error(`[${collectionName}] snapshot error:`, err);
        setLoading(false);
      },
    );

    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, userId]);

  return { data, loading };
}
