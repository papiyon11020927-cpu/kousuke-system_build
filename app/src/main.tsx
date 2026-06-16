import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import App from './App'
import VendorQuotePage from './pages/VendorQuotePage'
import VendorBasicContractPage from './pages/VendorBasicContractPage'
import CustomerContractSignPage from './pages/CustomerContractSignPage'

// ─── DEV ONLY: insertBefore インターセプター ──────────────────
// insertBefore が "referenceNode is not a child" エラーを起こす直前に
// スタックトレースをコンソールに出力する。本番ビルドでは完全に除去される。
if (import.meta.env.DEV) {
  const _origInsertBefore = Node.prototype.insertBefore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Node.prototype as any).insertBefore = function <T extends Node>(
    newNode: T,
    refNode: Node | null,
  ): T {
    if (refNode !== null && !this.contains(refNode)) {
      console.error(
        '🔴 [insertBefore VIOLATION] refNode は parent の子ではありません',
        '\n  parent  :', this,
        '\n  newNode :', newNode,
        '\n  refNode :', refNode,
        '\n  stack   :', new Error('insertBefore stack').stack,
      );
    }
    return _origInsertBefore.call(this, newNode, refNode) as T;
  };
  console.info('✅ insertBefore interceptor 有効 (DEV only)');
}
// ─────────────────────────────────────────────────────────────

// ─── 公開フォーム分岐（認証不要） ──────────────────────────────
// URL に ?token=<uuid> が付いている場合は業者向け公開フォームを表示。
// ログイン不要・社内アプリ全体のマウントを避けることでセキュリティとパフォーマンスを確保。
const params                 = new URLSearchParams(window.location.search);
const vendorToken            = params.get('token');
const basicContractVendorId  = params.get('basicContract');
const customerSignContractId = params.get('customerSign');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {vendorToken             ? <VendorQuotePage token={vendorToken} />
    : basicContractVendorId  ? <VendorBasicContractPage vendorId={basicContractVendorId} />
    : customerSignContractId ? <CustomerContractSignPage contractId={customerSignContractId} />
    : <App />}
  </StrictMode>,
)
