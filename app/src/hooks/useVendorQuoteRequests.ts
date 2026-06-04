import { useFirestoreCollection } from './useFirestoreCollection';
import type { VendorQuoteRequest } from '@/types';

/**
 * 全業者見積依頼をリアルタイム取得。
 * App.tsx で一度だけ呼び出し、props 経由で下位に渡す。
 */
export const useVendorQuoteRequests = (userId: string | null) =>
  useFirestoreCollection<VendorQuoteRequest>('vendor_quote_requests', userId);
