/**
 * SettlementPanel
 * 精算タブ：入金管理（顧客→自社）/ 支払管理（自社→業者ワークフロー）
 */
import { useState } from 'react';
import {
  LucideCheck, LucideRefreshCw, LucideTrendingUp,
  LucideBuilding2, LucideClipboardList,
} from 'lucide-react';
import type { Project, Contract, VendorQuoteRequest, VendorQuoteItem, WorkspaceSection } from '@/types';
import { updatePaymentTerms } from '@/services/contractService';
import { updateProjectStatus } from '@/services/projectService';
import { openPrintPreview } from '@/services/documentService';
import VendorWorkflowCard from '@/components/VendorWorkflowCard';

export default function SettlementPanel({
  project, contracts, vendorQuoteRequests, onShowToast, onSectionChange, currentUserName,
}: {
  project:              Project;
  contracts:            Contract[];
  vendorQuoteRequests:  VendorQuoteRequest[];
  onShowToast:          (msg: string) => void;
  onSectionChange:      (s: WorkspaceSection) => void;
  currentUserName:      string;
}) {
  const [innerTab,   setInnerTab]   = useState<'income' | 'payment'>('income');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [payDateMap, setPayDateMap] = useState<Record<string, string>>({});

  const today = new Date().toISOString().split('T')[0];

  // ─── 入金操作 ─────────────────────────────────────────────
  const handleMarkTermPaid = async (ct: Contract, termIdx: number) => {
    const key = `${ct.contractId}-${termIdx}`;
    const paidAt = payDateMap[key] || today;
    setLoadingKey(key);
    try {
      const updated = (ct.paymentTerms ?? []).map((t, i) =>
        i === termIdx ? { ...t, isPaid: true, paidAt } : t,
      );
      await updatePaymentTerms(ct.contractId, updated);
      onShowToast(`「${ct.paymentTerms?.[termIdx]?.termName}」の入金を記録しました`);
    } catch { onShowToast('記録に失敗しました'); }
    finally { setLoadingKey(null); }
  };

  const handleCancelTermPaid = async (ct: Contract, termIdx: number) => {
    const key = `${ct.contractId}-${termIdx}-cancel`;
    setLoadingKey(key);
    try {
      const updated = (ct.paymentTerms ?? []).map((t, i) =>
        i === termIdx ? { ...t, isPaid: false, paidAt: undefined } : t,
      );
      await updatePaymentTerms(ct.contractId, updated);
      onShowToast('入金記録を取り消しました');
    } catch { onShowToast('操作に失敗しました'); }
    finally { setLoadingKey(null); }
  };

  // ─── 完工チェック ──────────────────────────────────────────
  const activeContracts = contracts.filter(c => c.approvalStatus === 'approved' && c.status === 'signed');
  const allTermsPaid    = activeContracts.length > 0 && activeContracts.every(c =>
    (c.paymentTerms ?? []).every(t => t.isPaid),
  );
  const targetVqs     = vendorQuoteRequests.filter(vq =>
    ['accepted', 'completed'].includes(vq.status ?? ''),
  );
  const allVendorPaid = targetVqs.length === 0 || targetVqs.every(vq => vq.vendorPaid);
  const canComplete   = allTermsPaid && allVendorPaid && project.status === 'construction';
  const canClose      = allTermsPaid && allVendorPaid && project.status === 'settlement';

  const handleMarkCompleted = async () => {
    if (!window.confirm('すべての入金・支払いが完了しました。\nステータスを「完工」に変更しますか？')) return;
    try {
      await updateProjectStatus(project.projectId, 'completed');
      onShowToast('案件ステータスを「完工」に変更しました');
    } catch { onShowToast('更新に失敗しました'); }
  };

  const handleMarkClosed = async () => {
    if (!window.confirm('精算がすべて完了しました。\nステータスを「クローズ」に変更しますか？')) return;
    try {
      await updateProjectStatus(project.projectId, 'closed');
      onShowToast('案件ステータスを「クローズ」に変更しました');
    } catch { onShowToast('更新に失敗しました'); }
  };

  // ─── 注文書プレビュー ──────────────────────────────────────
  const handleOrderForm = (vq: VendorQuoteRequest) => {
    const vendorName = vq.vendorName ?? '（業者名未設定）';
    const displayItems: VendorQuoteItem[] =
      (vq.items && vq.items.length > 0)
        ? vq.items
        : [{ itemName: `${vq.workScope || project.title}工事 一式`, quantity: 1, unit: '式', unitPrice: vq.totalAmount ?? 0, total: vq.totalAmount ?? 0 }];
    const itemsHtml = displayItems.map((item, i) => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:6px 8px;text-align:center">${i + 1}</td>
        <td style="padding:6px 8px">${item.itemName ?? ''}</td>
        <td style="padding:6px 8px;text-align:center">${item.quantity ?? 1}</td>
        <td style="padding:6px 8px">${item.unit ?? '式'}</td>
        <td style="padding:6px 8px;text-align:right">¥${(item.unitPrice ?? 0).toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:bold">¥${((item.total ?? 0) || (item.unitPrice ?? 0) * (item.quantity ?? 1)).toLocaleString()}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
    <title>注文書</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Hiragino Kaku Gothic ProN','ヒラギノ角ゴ ProN','Meiryo','メイリオ','MS PGothic','ＭＳ Ｐゴシック',sans-serif;color:#111;font-size:10pt;line-height:1.6;background:#c8c8c8;padding:20px 0 40px}
      @page{size:A4 portrait;margin:0}
      @media print{
        body{background:white;padding:0}
        .no-print{display:none!important}
        .page{box-shadow:none;border:none;margin:0;padding:18mm 20mm;width:100%;min-height:auto}
      }
      .no-print{text-align:center;margin-bottom:14px}
      .no-print button{background:#444;color:white;border:none;padding:7px 24px;border-radius:5px;cursor:pointer;font-size:10pt;letter-spacing:0.05em}
      .no-print button:hover{background:#222}
      .page{width:210mm;min-height:297mm;background:white;margin:0 auto;padding:18mm 20mm;box-shadow:0 4px 20px rgba(0,0,0,0.35);border:1px solid #aaa}
      h1{font-size:18pt;text-align:center;letter-spacing:0.35em;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:16px}
      .info{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
      .label{font-size:8pt;color:#666;margin-bottom:2px}
      .val{font-weight:bold;font-size:11pt}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;table-layout:fixed}
      th{background:#e8e8e8;padding:5px 8px;font-size:9pt;border:1px solid #555;font-weight:bold}
      td{padding:5px 8px;border:1px solid #ccc;word-break:break-word;font-size:10pt}
      .total{text-align:right;font-size:13pt;font-weight:bold;margin-top:10px;padding-top:8px;border-top:2px solid #111}
      .footer{margin-top:24px;font-size:8pt;color:#666;border-top:1px solid #ccc;padding-top:10px}
      .note{margin-top:12px;font-size:9pt}
    </style>
    </head><body>
    <div class="no-print"><button onclick="window.print()">🖨 PDF保存・印刷する</button></div>
    <div class="page">
      <h1>注　文　書</h1>
      <div class="info">
        <div><div class="label">発注先</div><div class="val">${vendorName} 御中</div></div>
        <div><div class="label">案件名</div><div class="val">${project.title}</div></div>
        <div><div class="label">発注日</div><div class="val">${new Date().toLocaleDateString('ja-JP')}</div></div>
        ${vq.vendorPaymentDueDate ? `<div><div class="label">支払予定日</div><div class="val">${vq.vendorPaymentDueDate}</div></div>` : ''}
      </div>
      <table>
        <thead><tr>
          <th style="text-align:center;width:36px">No.</th>
          <th style="text-align:left">品目・作業内容</th>
          <th style="text-align:center;width:52px">数量</th>
          <th style="text-align:center;width:36px">単位</th>
          <th style="text-align:right;width:88px">単価</th>
          <th style="text-align:right;width:88px">金額</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="total">合計金額：¥${(vq.totalAmount ?? 0).toLocaleString()}（税抜）</div>
      ${vq.requestNote ? `<p class="note">備考：${vq.requestNote}</p>` : ''}
      <div class="footer">本注文書に基づき、上記作業をご依頼申し上げます。</div>
    </div>
    </body></html>`;
    openPrintPreview(html);
  };

  // ─── バッジカウント ────────────────────────────────────────
  const pendingTermCount = activeContracts.reduce(
    (s, ct) => s + (ct.paymentTerms ?? []).filter(t => !t.isPaid).length, 0,
  );
  const pendingVqCount = targetVqs.filter(vq => !vq.vendorPaid).length;

  // ─── 表示 ─────────────────────────────────────────────────
  if (contracts.length === 0 && vendorQuoteRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-gray-600">
        <LucideClipboardList size={32} className="text-gray-700" />
        <p className="text-sm text-gray-500">まだ契約書・業者依頼がありません</p>
        <button onClick={() => onSectionChange('contracts')}
          className="text-xs text-[#C5A059] hover:text-[#E6C687] border border-[#C5A059]/40 px-3 py-1.5 rounded-lg transition-colors">
          契約タブへ →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── 完工バナー ── */}
      {canComplete && (
        <div className="mx-4 mt-3 bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-3 flex items-center justify-between gap-4 shrink-0">
          <div>
            <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <LucideCheck size={12} /> すべての入金・支払いが完了しました
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">案件ステータスを完工に変更できます</p>
          </div>
          <button onClick={handleMarkCompleted}
            className="shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
            <LucideCheck size={11} /> 完工にする
          </button>
        </div>
      )}

      {/* ── クローズバナー ── */}
      {canClose && (
        <div className="mx-4 mt-3 bg-teal-900/20 border border-teal-700/40 rounded-xl p-3 flex items-center justify-between gap-4 shrink-0">
          <div>
            <p className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
              <LucideCheck size={12} /> 精算がすべて完了しました
            </p>
            <p className="text-[10px] text-teal-600 mt-0.5">案件ステータスをクローズに変更できます</p>
          </div>
          <button onClick={handleMarkClosed}
            className="shrink-0 bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
            <LucideCheck size={11} /> クローズにする
          </button>
        </div>
      )}

      {/* ── サブタブ ── */}
      <div className="flex border-b border-gray-800 bg-[#0D1424] shrink-0">
        <button
          onClick={() => setInnerTab('income')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors
            ${innerTab === 'income' ? 'border-[#C5A059] text-[#C5A059]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
          <LucideTrendingUp size={12} /> 入金管理
          {pendingTermCount > 0 && (
            <span className="ml-0.5 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {pendingTermCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setInnerTab('payment')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors
            ${innerTab === 'payment' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
          <LucideBuilding2 size={12} /> 支払管理
          {pendingVqCount > 0 && (
            <span className="ml-0.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {pendingVqCount}
            </span>
          )}
        </button>
      </div>

      {/* ── コンテンツ ── */}
      <div className="overflow-y-auto flex-1 p-4 space-y-4">

        {innerTab === 'income' ? (
          <>
            {/* 入金管理（顧客からの入金）*/}
            {activeContracts.map(ct => {
              const terms    = ct.paymentTerms ?? [];
              const paidAmt  = terms.filter(t => t.isPaid).reduce((s, t) => s + (t.amount ?? 0), 0);
              const totalAmt = terms.reduce((s, t) => s + (t.amount ?? 0), 0);
              const pct      = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0;
              return (
                <div key={ct.contractId} className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <LucideTrendingUp size={12} className="text-[#C5A059]" /> 入金管理
                    </span>
                    <span className="text-[10px] text-gray-500">
                      ¥{paidAmt.toLocaleString()} / ¥{totalAmt.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="px-4 py-1.5 border-b border-gray-800/60">
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#C5A059] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {terms.length === 0 ? (
                    <p className="text-xs text-gray-600 px-4 py-3">支払条件が設定されていません</p>
                  ) : (
                    <div className="divide-y divide-gray-800/50">
                      {terms.map((term, ti) => {
                        const key = `${ct.contractId}-${ti}`;
                        const isLoading = loadingKey === key || loadingKey === `${key}-cancel`;
                        return (
                          <div key={ti} className={`px-4 py-3 flex flex-wrap items-center gap-2 ${term.isPaid ? 'bg-emerald-950/10' : ''}`}>
                            <div className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold
                              ${term.isPaid ? 'bg-emerald-900/60 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                              {term.isPaid ? <LucideCheck size={10} /> : ti + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white">{term.termName}</p>
                              <p className="text-[10px] text-gray-500">
                                {term.percentage}%
                                {term.scheduledDate && !term.isPaid && ` · 予定: ${new Date(term.scheduledDate).toLocaleDateString('ja-JP')}`}
                                {term.isPaid && term.paidAt && ` · 入金: ${new Date(term.paidAt).toLocaleDateString('ja-JP')}`}
                              </p>
                            </div>
                            <span className={`text-xs font-mono font-bold ${term.isPaid ? 'text-emerald-400' : 'text-white'}`}>
                              ¥{(term.amount ?? 0).toLocaleString()}
                            </span>
                            {term.isPaid ? (
                              <button onClick={() => handleCancelTermPaid(ct, ti)} disabled={isLoading}
                                className="text-[10px] text-gray-500 hover:text-red-400 underline transition-colors disabled:opacity-50">
                                取消
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <input type="date"
                                  value={payDateMap[key] ?? today}
                                  onChange={e => setPayDateMap(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="bg-[#0A0F1D] border border-gray-700 text-white text-[10px] rounded px-1.5 py-0.5"
                                />
                                <button onClick={() => handleMarkTermPaid(ct, ti)} disabled={isLoading}
                                  className="text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2 py-0.5 rounded transition-colors disabled:opacity-50 flex items-center gap-0.5">
                                  {isLoading ? <LucideRefreshCw size={9} className="animate-spin" /> : <LucideCheck size={9} />} 入金済み
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {activeContracts.length === 0 && contracts.length > 0 && (
              <div className="bg-[#111A35] border border-yellow-700/20 rounded-xl p-4 text-xs text-yellow-400">
                <p>契約書の署名完了後に入金管理が有効になります</p>
              </div>
            )}
            {activeContracts.length === 0 && contracts.length === 0 && (
              <div className="text-center py-10 text-gray-600 text-sm">
                <p>契約書がありません</p>
                <button onClick={() => onSectionChange('contracts')}
                  className="mt-2 text-xs text-[#C5A059] hover:text-[#E6C687] border border-[#C5A059]/40 px-3 py-1.5 rounded-lg transition-colors">
                  契約タブへ →
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 支払管理（業者への支払いワークフロー） */}
            {targetVqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-600">
                <LucideBuilding2 size={28} />
                <p className="text-sm text-gray-500">承認済みの業者依頼がありません</p>
                <button onClick={() => onSectionChange('estimates')}
                  className="text-xs text-[#C5A059] hover:text-[#E6C687] border border-[#C5A059]/40 px-3 py-1.5 rounded-lg transition-colors">
                  業者見積タブへ →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {targetVqs.map(vq => (
                  <VendorWorkflowCard
                    key={vq.requestId}
                    vq={vq}
                    project={project}
                    currentUserName={currentUserName}
                    onShowToast={onShowToast}
                    onOrderForm={handleOrderForm}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
