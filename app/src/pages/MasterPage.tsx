import { useState } from 'react';
import {
  LucideSettings, LucideClipboardList, LucideUsers,
  LucidePlusCircle, LucideTrash2, LucidePencil, LucideX,
  LucidePlus, LucideActivity, LucideCheck, LucideTag,
  LucideChevronDown, LucideChevronUp,
  LucideBuilding2, LucidePhone, LucideMail, LucideMapPin,
  LucideShieldCheck, LucideShieldAlert, LucideShield,
  LucideSearch, LucideFileSignature, LucideInfo, LucideLink, LucideFileText,
} from 'lucide-react';
import type { AppUser, UserRole, EstimateTemplate, EstimateItem, Vendor, VendorBasicContract, ContractTemplate } from '@/types';
import { saveEstimateTemplate, deleteEstimateTemplate } from '@/services/estimateTemplateService';
import { saveContractTemplate, deleteContractTemplate } from '@/services/contractTemplateService';
import { saveVendor, deleteVendor } from '@/services/vendorService';
import {
  createAppUser, updateUserRole, removeAppUser, updateUserDisplayName,
} from '@/services/authService';

// ─────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  const d    = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${date}${rand}`;
}

const formatAmt = (n: number) => `¥${n.toLocaleString()}`;

// ─────────────────────────────────────────────────────────────
// ユーザー管理定数
// ─────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  staff:   '営業・現場',
  manager: '管理者',
  admin:   'スーパー管理者',
};

const ROLE_COLOR: Record<UserRole, string> = {
  staff:   'bg-blue-900/40 text-blue-300 border-blue-700/40',
  manager: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  admin:   'bg-purple-900/40 text-purple-300 border-purple-700/40',
};

// ─────────────────────────────────────────────────────────────
// テンプレート編集ダイアログ
// ─────────────────────────────────────────────────────────────

function TemplateEditDialog({
  initial, onClose, onSaved,
}: {
  initial?:  EstimateTemplate;
  onClose:   () => void;
  onSaved:   (msg: string) => void;
}) {
  const [name,     setName]     = useState(initial?.name     ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [items,    setItems]    = useState<EstimateItem[]>(
    initial?.items.length
      ? initial.items
      : [
          { itemId: 'item-1', itemName: '材料費', quantity: 1, unit: '式', unitPrice: 0, total: 0 },
          { itemId: 'item-2', itemName: '施工費', quantity: 1, unit: '式', unitPrice: 0, total: 0 },
          { itemId: 'item-3', itemName: '諸経費', quantity: 1, unit: '式', unitPrice: 0, total: 0 },
        ],
  );
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const totalAmount = items.reduce((s, it) => s + it.total, 0);

  const updateItem = (idx: number, updates: Partial<EstimateItem>) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[idx], ...updates };
      if ('quantity' in updates || 'unitPrice' in updates) {
        item.total = Math.round((item.quantity || 0) * (item.unitPrice || 0));
      }
      next[idx] = item;
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, {
    itemId:    `item-${Date.now()}`,
    itemName:  '',
    quantity:  1,
    unit:      '式',
    unitPrice: 0,
    total:     0,
  }]);

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) { setError('テンプレート名を入力してください'); return; }
    const validItems = items.filter(it => it.itemName.trim());
    if (!validItems.length) { setError('明細行を1つ以上入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      const template: EstimateTemplate = {
        templateId: initial?.templateId ?? genId('TPL'),
        name:        name.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
        items: validItems.map(it => ({
          ...it,
          itemId: it.itemId || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        })),
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      };
      await saveEstimateTemplate(template);
      onSaved(initial ? `テンプレート「${name}」を更新しました` : `テンプレート「${name}」を作成しました`);
      onClose();
    } catch (err: unknown) {
      const e = err as { code?: string };
      setError(`保存に失敗しました（${e.code ?? 'unknown'}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* ヘッダー */}
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideClipboardList size={15} className="text-[#C5A059]" />
            {initial ? 'テンプレートを編集' : '新規テンプレートを作成'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* 名前・分類 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">テンプレート名 <span className="text-red-400">*</span></label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="例: 外壁塗装 標準"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">分類（任意）</label>
              <input
                type="text" value={category} onChange={e => setCategory(e.target.value)}
                placeholder="例: 塗装工事"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          {/* 明細テーブル */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-300">明細行</label>
              <button onClick={addItem}
                className="flex items-center gap-1 text-[11px] text-[#C5A059] hover:text-[#E6C687] transition">
                <LucidePlus size={11} /> 行を追加
              </button>
            </div>
            <div className="rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0A0F1D] text-gray-500">
                    <th className="px-2 py-1.5 text-left font-normal w-[38%]">項目名</th>
                    <th className="px-2 py-1.5 text-right font-normal w-[12%]">数量</th>
                    <th className="px-2 py-1.5 text-left font-normal w-[10%]">単位</th>
                    <th className="px-2 py-1.5 text-right font-normal w-[20%]">単価（円）</th>
                    <th className="px-2 py-1.5 text-right font-normal w-[16%]">小計</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.itemId ?? idx} className="border-t border-gray-800">
                      <td className="px-1 py-1">
                        <input
                          type="text" value={it.itemName}
                          onChange={e => updateItem(idx, { itemName: e.target.value })}
                          placeholder="例: 外壁塗装工事"
                          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-[#C5A059]"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number" min="0" value={it.quantity}
                          onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-1.5 py-1 text-right focus:outline-none focus:border-[#C5A059]"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="text" value={it.unit}
                          onChange={e => updateItem(idx, { unit: e.target.value })}
                          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-1.5 py-1 focus:outline-none focus:border-[#C5A059]"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number" min="0" value={it.unitPrice}
                          onChange={e => updateItem(idx, { unitPrice: parseInt(e.target.value) || 0 })}
                          className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded px-1.5 py-1 text-right focus:outline-none focus:border-[#C5A059]"
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-[#E6C687] font-mono whitespace-nowrap">
                        {formatAmt(it.total)}
                      </td>
                      <td className="px-1 py-1 text-center">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)}
                            className="text-gray-600 hover:text-red-400 transition">
                            <LucideTrash2 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#C5A059]/30 bg-[#0A0F1D]">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-300">合計（税抜）</td>
                    <td className="px-2 py-2 text-right text-base font-extrabold text-[#E6C687]">
                      {formatAmt(totalAmount)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              ※ 金額は参考値です。見積書作成時に各現場に合わせて変更できます。
            </p>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3.5 border-t border-gray-800 flex gap-2 shrink-0 bg-[#0B132B] rounded-b-xl">
          <button onClick={onClose}
            className="border border-gray-700 text-gray-400 text-sm py-2 px-4 rounded-lg hover:border-gray-500 hover:text-white transition">
            キャンセル
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50">
            {loading
              ? <><LucideActivity size={13} className="animate-spin" /> 保存中…</>
              : <><LucideCheck size={13} /> {initial ? '更新する' : 'テンプレートを作成'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// テンプレート管理パネル
// ─────────────────────────────────────────────────────────────

function TemplateMasterPanel({
  templates, contractTemplates, onShowToast,
}: {
  templates:         EstimateTemplate[];
  contractTemplates: ContractTemplate[];
  onShowToast:       (msg: string) => void;
}) {
  const [subTab, setSubTab] = useState<'estimates' | 'contracts'>('estimates');

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setSubTab('estimates')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition ${subTab === 'estimates' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}
          >
            <LucideClipboardList size={12} /> 見積書テンプレート
          </button>
          <button
            onClick={() => setSubTab('contracts')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition ${subTab === 'contracts' ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5' : 'text-gray-400 hover:text-white'}`}
          >
            <LucideFileText size={12} /> 契約書テンプレート
          </button>
        </div>
      </div>

      {subTab === 'estimates' && (
        <EstimateTemplateMasterPanel templates={templates} onShowToast={onShowToast} />
      )}
      {subTab === 'contracts' && (
        <ContractTemplateMasterPanel contractTemplates={contractTemplates} onShowToast={onShowToast} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 見積書テンプレート管理パネル（旧 TemplateMasterPanel）
// ─────────────────────────────────────────────────────────────

function EstimateTemplateMasterPanel({
  templates, onShowToast,
}: {
  templates:   EstimateTemplate[];
  onShowToast: (msg: string) => void;
}) {
  const [showCreate,    setShowCreate]    = useState(false);
  const [editTarget,    setEditTarget]    = useState<EstimateTemplate | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<EstimateTemplate | null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEstimateTemplate(deleteTarget.templateId);
      onShowToast(`テンプレート「${deleteTarget.name}」を削除しました`);
      setDeleteTarget(null);
    } catch {
      onShowToast('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  // カテゴリ別にグループ化
  const categories = Array.from(new Set(templates.map(t => t.category ?? '未分類'))).sort();

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <LucideClipboardList className="text-[#C5A059]" size={18} />
            見積書テンプレート
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            施工種別ごとに明細テンプレートを登録。見積書作成時に選択して読み込めます。
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold px-4 py-2 rounded-lg transition whitespace-nowrap">
          <LucidePlusCircle size={14} /> テンプレートを追加
        </button>
      </div>

      {/* テンプレート一覧 */}
      {templates.length === 0 ? (
        <div className="bg-[#111A35] border border-gray-800 rounded-xl py-14 text-center text-gray-500 text-sm">
          <LucideClipboardList size={28} className="mx-auto mb-3 text-gray-700" />
          <p>テンプレートがまだ登録されていません</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-3 text-[#C5A059] text-xs underline underline-offset-2 hover:text-[#E6C687]">
            最初のテンプレートを作成する
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const catTemplates = templates.filter(t => (t.category ?? '未分類') === cat);
            return (
              <div key={cat} className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
                {/* カテゴリヘッダー */}
                <div className="px-4 py-2.5 bg-[#0B132B] border-b border-gray-800 flex items-center gap-2">
                  <LucideTag size={12} className="text-[#C5A059]" />
                  <span className="text-xs font-bold text-[#E6C687]">{cat}</span>
                  <span className="text-[10px] text-gray-500">{catTemplates.length} 件</span>
                </div>

                {/* テンプレート行 */}
                <div className="divide-y divide-gray-800">
                  {catTemplates.map(tpl => {
                    const isExpanded = expandedId === tpl.templateId;
                    const tplItems   = tpl.items ?? [];
                    const totalAmt   = tplItems.reduce((s, it) => s + (it.total ?? 0), 0);
                    return (
                      <div key={tpl.templateId}>
                        <div className="px-4 py-3 flex items-center gap-3">
                          {/* 展開ボタン */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : tpl.templateId)}
                            className="text-gray-500 hover:text-white transition shrink-0"
                          >
                            {isExpanded ? <LucideChevronUp size={14} /> : <LucideChevronDown size={14} />}
                          </button>

                          {/* テンプレート名 */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{tpl.name}</p>
                            <p className="text-[10px] text-gray-500">
                              {tplItems.length} 項目
                              {totalAmt > 0 && <span className="ml-2 text-[#E6C687]">{formatAmt(totalAmt)}</span>}
                            </p>
                          </div>

                          {/* 操作ボタン */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setEditTarget(tpl)}
                              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#E6C687] border border-gray-700 hover:border-[#C5A059]/50 rounded-md px-2.5 py-1 transition"
                            >
                              <LucidePencil size={10} /> 編集
                            </button>
                            <button
                              onClick={() => setDeleteTarget(tpl)}
                              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-700/50 rounded-md px-2.5 py-1 transition"
                            >
                              <LucideTrash2 size={10} /> 削除
                            </button>
                          </div>
                        </div>

                        {/* 展開: 明細行プレビュー */}
                        {isExpanded && (
                          <div className="px-4 pb-3 bg-[#0A0F1D]/50">
                            <table className="w-full text-xs border border-gray-800 rounded-lg overflow-hidden">
                              <thead>
                                <tr className="bg-[#0A0F1D] text-gray-500">
                                  <th className="px-3 py-1.5 text-left font-normal w-[42%]">項目名</th>
                                  <th className="px-2 py-1.5 text-right font-normal w-[12%]">数量</th>
                                  <th className="px-2 py-1.5 text-left font-normal w-[10%]">単位</th>
                                  <th className="px-2 py-1.5 text-right font-normal w-[18%]">単価</th>
                                  <th className="px-2 py-1.5 text-right font-normal">小計</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tplItems.map((it, i) => (
                                  <tr key={it.itemId ?? i} className="border-t border-gray-800">
                                    <td className="px-3 py-1.5 text-gray-300">{it.itemName}</td>
                                    <td className="px-2 py-1.5 text-right text-gray-400">{it.quantity}</td>
                                    <td className="px-2 py-1.5 text-gray-400">{it.unit}</td>
                                    <td className="px-2 py-1.5 text-right text-gray-400">{formatAmt(it.unitPrice)}</td>
                                    <td className="px-2 py-1.5 text-right text-[#E6C687] font-mono">{formatAmt(it.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              {totalAmt > 0 && (
                                <tfoot>
                                  <tr className="border-t-2 border-[#C5A059]/30 bg-[#0A0F1D]">
                                    <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-gray-400 font-bold">合計（税抜）</td>
                                    <td className="px-2 py-1.5 text-right font-bold text-[#E6C687]">{formatAmt(totalAmt)}</td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 作成ダイアログ */}
      {showCreate && (
        <TemplateEditDialog
          onClose={() => setShowCreate(false)}
          onSaved={msg => { onShowToast(msg); setShowCreate(false); }}
        />
      )}

      {/* 編集ダイアログ */}
      {editTarget && (
        <TemplateEditDialog
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={msg => { onShowToast(msg); setEditTarget(null); }}
        />
      )}

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111A35] border border-red-700/40 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <LucideTrash2 size={15} className="text-red-400" />
              テンプレートを削除
            </h3>
            <p className="text-xs text-gray-400">
              「<span className="text-white font-semibold">{deleteTarget.name}</span>」を削除します。この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:text-white transition">
                キャンセル
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-lg transition disabled:opacity-50">
                {deleting ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 契約書テンプレート管理パネル
// ─────────────────────────────────────────────────────────────

function ContractTemplateEditDialog({
  initial, onClose, onSaved,
}: {
  initial?:  ContractTemplate;
  onClose:   () => void;
  onSaved:   (msg: string) => void;
}) {
  const [name,     setName]     = useState(initial?.name     ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [text,     setText]     = useState(initial?.text     ?? DEFAULT_BC_TEMPLATE);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('テンプレート名を入力してください'); return; }
    if (!text.trim()) { setError('契約書本文を入力してください'); return; }
    setLoading(true);
    try {
      const t: ContractTemplate = {
        templateId: initial?.templateId ?? `CTPL${Date.now()}`,
        name: name.trim(),
        category: category.trim() || undefined,
        text: text.trim(),
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      };
      await saveContractTemplate(t);
      onSaved(initial ? `「${name}」を更新しました` : `「${name}」を作成しました`);
    } catch {
      setError('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideFileText size={14} className="text-[#C5A059]" />
            {initial ? '契約書テンプレートを編集' : '契約書テンプレートを作成'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">テンプレート名 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例: 標準取引基本契約書"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">カテゴリ（任意）</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="例: 外注、塗装"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              契約書本文 <span className="text-red-400">*</span>
              <span className="ml-2 text-gray-500 font-normal">※ [業者名] と記述すると業者名に自動置換されます</span>
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={14}
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none font-mono leading-relaxed"
            />
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 flex gap-2 bg-[#0B132B] rounded-b-xl shrink-0">
          <button onClick={onClose}
            className="border border-gray-700 text-gray-400 text-sm py-2 px-4 rounded-lg hover:border-gray-500 hover:text-white transition">
            キャンセル
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading ? <><LucideActivity size={13} className="animate-spin" /> 保存中…</> : <><LucideCheck size={13} /> 保存する</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractTemplateMasterPanel({
  contractTemplates, onShowToast,
}: {
  contractTemplates: ContractTemplate[];
  onShowToast:       (msg: string) => void;
}) {
  const [showCreate,   setShowCreate]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<ContractTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteContractTemplate(deleteTarget.templateId);
      onShowToast(`テンプレート「${deleteTarget.name}」を削除しました`);
      setDeleteTarget(null);
    } catch {
      onShowToast('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <LucideFileText className="text-[#C5A059]" size={18} />
            契約書テンプレート
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            業者取引基本契約書のひな形を管理します。業者カードから呼び出して個別に微修正できます。
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold px-4 py-2 rounded-lg transition whitespace-nowrap">
          <LucidePlusCircle size={14} /> テンプレートを追加
        </button>
      </div>

      {/* 一覧 */}
      {contractTemplates.length === 0 ? (
        <div className="bg-[#111A35] border border-gray-800 rounded-xl py-14 text-center text-gray-500 text-sm">
          <LucideFileText size={28} className="mx-auto mb-3 text-gray-700" />
          <p>契約書テンプレートがまだ登録されていません</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-3 text-[#C5A059] text-xs underline underline-offset-2 hover:text-[#E6C687]">
            最初のテンプレートを作成する
          </button>
        </div>
      ) : (
        <div className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
          {contractTemplates.map(tpl => {
            const isExpanded = expandedId === tpl.templateId;
            return (
              <div key={tpl.templateId}>
                <div className="px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : tpl.templateId)}
                    className="text-gray-500 hover:text-white transition shrink-0"
                  >
                    {isExpanded ? <LucideChevronUp size={14} /> : <LucideChevronDown size={14} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{tpl.name}</p>
                    {tpl.category && (
                      <p className="text-[10px] text-[#C5A059] flex items-center gap-1">
                        <LucideTag size={9} /> {tpl.category}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditTarget(tpl)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#E6C687] border border-gray-700 hover:border-[#C5A059]/50 rounded-md px-2.5 py-1 transition"
                    >
                      <LucidePencil size={10} /> 編集
                    </button>
                    <button
                      onClick={() => setDeleteTarget(tpl)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-700/50 rounded-md px-2.5 py-1 transition"
                    >
                      <LucideTrash2 size={10} /> 削除
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 bg-[#0A0F1D]/50">
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono bg-[#0B132B] border border-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed">
                      {tpl.text}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <ContractTemplateEditDialog
          onClose={() => setShowCreate(false)}
          onSaved={msg => { onShowToast(msg); setShowCreate(false); }}
        />
      )}
      {editTarget && (
        <ContractTemplateEditDialog
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={msg => { onShowToast(msg); setEditTarget(null); }}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111A35] border border-red-700/40 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <LucideTrash2 size={15} className="text-red-400" />
              テンプレートを削除
            </h3>
            <p className="text-xs text-gray-400">
              「<span className="text-white font-semibold">{deleteTarget.name}</span>」を削除します。この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:text-white transition">
                キャンセル
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-lg transition disabled:opacity-50">
                {deleting ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ユーザー追加ダイアログ
// ─────────────────────────────────────────────────────────────

function AddUserDialog({
  onClose, onCreated,
}: {
  onClose:   () => void;
  onCreated: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [role,        setRole]        = useState<UserRole>('staff');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError('担当者名を入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      await createAppUser(email, password, displayName.trim(), role);
      onCreated(`${displayName} を追加しました`);
      onClose();
    } catch (err: any) {
      const code: string = err.code ?? '';
      if (code.includes('email-already-in-use'))
        setError('このメールアドレスはすでに使用されています');
      else if (code.includes('weak-password'))
        setError('パスワードは6文字以上にしてください');
      else
        setError(`エラー: ${code || '不明なエラー'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-md shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideUsers size={14} className="text-[#C5A059]" /> 新規ユーザーを追加
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">担当者名 <span className="text-red-400">*</span></label>
            <input
              type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">メールアドレス <span className="text-red-400">*</span></label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="yamada@example.com"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">パスワード <span className="text-red-400">*</span></label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="6文字以上"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-[#C5A059]"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">権限</label>
            <select value={role} onChange={e => setRole(e.target.value as UserRole)}
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]">
              <option value="staff">営業・現場（staff）</option>
              <option value="manager">管理者（manager）</option>
              <option value="admin">スーパー管理者（admin）</option>
            </select>
          </div>
          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:text-white transition">
              キャンセル
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-50">
              {loading ? <><LucideActivity size={13} className="animate-spin" /> 追加中…</> : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ユーザー管理パネル
// ─────────────────────────────────────────────────────────────

function UserMasterPanel({
  users, currentUid, onShowToast,
}: {
  users:       AppUser[];
  currentUid:  string;
  onShowToast: (msg: string) => void;
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editName,      setEditName]      = useState('');
  const [updatingId,    setUpdatingId]    = useState<string | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<AppUser | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  const sortedUsers = [...users].sort((a, b) => {
    const order: Record<UserRole, number> = { admin: 0, manager: 1, staff: 2 };
    return order[a.role] - order[b.role];
  });

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, newRole);
      onShowToast('ロールを更新しました');
    } catch {
      onShowToast('ロール変更に失敗しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleNameSave = async (userId: string) => {
    if (!editName.trim()) return;
    setUpdatingId(userId);
    try {
      await updateUserDisplayName(userId, editName.trim());
      onShowToast('担当者名を更新しました');
      setEditingId(null);
    } catch {
      onShowToast('名前変更に失敗しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.userId);
    try {
      await removeAppUser(deleteTarget.userId);
      onShowToast(`${deleteTarget.displayName} を削除しました`);
      setDeleteTarget(null);
    } catch {
      onShowToast('削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <LucideUsers className="text-[#C5A059]" size={18} />
            ユーザー管理
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            スタッフの追加・名前変更・ロール変更・削除（スーパー管理者専用）
          </p>
        </div>
        <button onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold px-4 py-2 rounded-lg transition">
          <LucidePlusCircle size={14} /> ユーザーを追加
        </button>
      </div>

      {/* ロール凡例 */}
      <div className="flex flex-wrap gap-3 text-[11px] text-gray-400 bg-[#111A35] border border-gray-800 rounded-xl px-4 py-3">
        {(['staff', 'manager', 'admin'] as UserRole[]).map(r => (
          <span key={r} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${ROLE_COLOR[r]}`}>
            {ROLE_LABEL[r]}
          </span>
        ))}
        <span className="text-gray-500 self-center text-[10px]">
          ※ スーパー管理者のみユーザー管理にアクセスできます
        </span>
      </div>

      {/* ユーザーリスト */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
        {sortedUsers.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            ユーザーが登録されていません
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {sortedUsers.map(u => (
              <div key={u.userId} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                {/* アバター */}
                <div className="h-9 w-9 rounded-full bg-[#1C2C54] flex items-center justify-center text-sm font-bold text-[#E6C687] shrink-0">
                  {u.displayName.charAt(0)}
                </div>

                {/* 名前・メール */}
                <div className="flex-1 min-w-[140px]">
                  {editingId === u.userId ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text" value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="bg-[#0B132B] border border-[#C5A059]/60 text-white text-sm rounded px-2 py-0.5 focus:outline-none w-36"
                      />
                      <button onClick={() => handleNameSave(u.userId)} disabled={updatingId === u.userId}
                        className="text-[#C5A059] hover:text-[#E6C687] text-[11px] font-bold disabled:opacity-50">
                        保存
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="text-gray-500 hover:text-gray-300 text-[11px]">
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-white">{u.displayName}</p>
                      <button
                        onClick={() => { setEditingId(u.userId); setEditName(u.displayName); }}
                        className="text-gray-600 hover:text-gray-400 transition">
                        <LucidePencil size={11} />
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500">{u.email}</p>
                </div>

                {/* ロール選択 */}
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.userId, e.target.value as UserRole)}
                  disabled={updatingId === u.userId || u.userId === currentUid}
                  className={`bg-[#0B132B] border text-xs rounded-md px-2 py-1 focus:outline-none disabled:opacity-50 shrink-0 ${ROLE_COLOR[u.role]}`}
                >
                  <option value="staff">営業・現場</option>
                  <option value="manager">管理者</option>
                  <option value="admin">スーパー管理者</option>
                </select>

                {/* 削除 */}
                <button
                  onClick={() => setDeleteTarget(u)}
                  disabled={u.userId === currentUid || deletingId === u.userId}
                  className="text-gray-600 hover:text-red-400 transition disabled:opacity-30 shrink-0"
                  title={u.userId === currentUid ? '自分自身は削除できません' : '削除'}
                >
                  <LucideTrash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 追加ダイアログ */}
      {showAddDialog && (
        <AddUserDialog
          onClose={() => setShowAddDialog(false)}
          onCreated={msg => { onShowToast(msg); setShowAddDialog(false); }}
        />
      )}

      {/* 削除確認 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111A35] border border-red-700/40 rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">ユーザーを削除しますか？</h3>
            <p className="text-xs text-gray-400">
              「<span className="text-white font-semibold">{deleteTarget.displayName}</span>」を削除します。<br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:text-white transition">
                キャンセル
              </button>
              <button onClick={handleDeleteConfirm} disabled={!!deletingId}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-lg transition disabled:opacity-50">
                {deletingId ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 外部業者マスタ — 定数
// ─────────────────────────────────────────────────────────────

const SPECIALTY_PRESETS = [
  '塗装工事', '防水工事', '内装工事', '外壁工事', '屋根工事',
  '電気工事', '給排水工事', '解体工事', '造園・外構', '大工工事',
  '足場工事', 'クリーニング', '左官工事', 'サッシ・板金',
];

/** 取引基本契約ステータス計算 */
function getContractStatus(bc?: VendorBasicContract): 'none' | 'unsigned' | 'valid' | 'expiring' | 'expired' {
  if (!bc) return 'none';
  if (!bc.signedByVendor) return 'unsigned';
  if (!bc.expiryDate) return 'valid';
  const today  = new Date();
  const expiry = new Date(bc.expiryDate);
  if (expiry < today) return 'expired';
  const days30 = new Date(today); days30.setDate(days30.getDate() + 30);
  if (expiry <= days30) return 'expiring';
  return 'valid';
}

const CONTRACT_STATUS_BADGE: Record<ReturnType<typeof getContractStatus>, { label: string; className: string; icon: React.ReactNode }> = {
  none:     { label: '未締結',       className: 'bg-gray-800 text-gray-400',                icon: <LucideShield size={10} /> },
  unsigned: { label: '未署名',       className: 'bg-amber-900/50 text-amber-300 border border-amber-700/40', icon: <LucideShieldAlert size={10} /> },
  valid:    { label: '有効',         className: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40', icon: <LucideShieldCheck size={10} /> },
  expiring: { label: '期限近い',     className: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/40', icon: <LucideShieldAlert size={10} /> },
  expired:  { label: '期限切れ',     className: 'bg-red-900/50 text-red-400 border border-red-700/40', icon: <LucideShieldAlert size={10} /> },
};

// ─────────────────────────────────────────────────────────────
// 取引基本契約 登録/更新ダイアログ
// ─────────────────────────────────────────────────────────────

const DEFAULT_BC_TEMPLATE = `取引基本契約書

甲（発注者）: 住良建設株式会社
乙（受注者）: [業者名]

甲乙間の取引に際し、以下の条件を基本とした取引基本契約を締結する。

第1条（目的）
本契約は、甲乙間で行う工事・サービス等の個別取引に適用する基本的事項を定めることを目的とする。

第2条（個別発注）
個別取引は甲が発行する発注書（または口頭・電話・メール等の指示）により成立し、乙はこれを承諾した時点で契約が成立するものとする。

第3条（代金の支払い）
甲は乙が発行する請求書に基づき、請求月の翌月末日までに乙の指定口座へ支払うものとする。

第4条（瑕疵担保）
引き渡し後1年以内に施工上の瑕疵が発見された場合、乙は甲の指示に従い無償にて補修を行う。

第5条（秘密保持）
甲乙双方は、本契約を通じて知り得た相手方の業務上の秘密情報を第三者に開示しないものとする。

第6条（契約期間）
本契約の有効期間は契約締結日より1年間とし、期間満了の1ヶ月前までに双方より異議がない場合は自動更新する。

以上、本契約成立の証として電子署名の上、本契約を締結する。`;

function VendorBasicContractDialog({
  vendor, contractTemplates, onClose, onSaved,
}: {
  vendor:             Vendor;
  contractTemplates:  ContractTemplate[];
  onClose:            () => void;
  onSaved:            (msg: string) => void;
}) {
  const existing = vendor.basicContract;

  const [contractDate,   setContractDate]   = useState(existing?.contractDate   ?? new Date().toISOString().slice(0, 10));
  const [expiryDate,     setExpiryDate]     = useState(existing?.expiryDate     ?? '');
  const [signedByVendor, setSignedByVendor] = useState(existing?.signedByVendor ?? false);
  const [contractNote,   setContractNote]   = useState(existing?.contractNote   ?? '');
  const [templateText,   setTemplateText]   = useState(
    existing?.templateText ?? DEFAULT_BC_TEMPLATE.replace('[業者名]', vendor.name),
  );
  const [showTemplate,   setShowTemplate]   = useState(false);
  const [showPreview,    setShowPreview]    = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');

  // 署名URLは常に vendorId ベース（Firestoreクエリ不要・直接読み込み）
  const signingUrl = `${window.location.origin}/?basicContract=${vendor.vendorId}`;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(signingUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // テンプレートから読み込む
  const handleLoadTemplate = (templateId: string) => {
    const tpl = contractTemplates.find(t => t.templateId === templateId);
    if (!tpl) return;
    setTemplateText(tpl.text.replace('[業者名]', vendor.name));
    setShowTemplate(true);
  };

  const handleSave = async () => {
    if (!contractDate.trim()) { setError('締結日を入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      const bc: VendorBasicContract = {
        contractDate: contractDate.trim(),
        signedByVendor,
        templateText: templateText.trim() || undefined,
        ...(expiryDate.trim()   ? { expiryDate:   expiryDate.trim()   } : {}),
        ...(contractNote.trim() ? { contractNote: contractNote.trim() } : {}),
        ...(signedByVendor && !existing?.signedAt  ? { signedAt: new Date().toISOString() } : {}),
        ...(existing?.signedAt                     ? { signedAt: existing.signedAt }         : {}),
        ...(existing?.vendorSignature ? { vendorSignature: existing.vendorSignature, signatureAt: existing.signatureAt } : {}),
      };
      await saveVendor({ ...vendor, basicContract: bc });
      onSaved(`${vendor.name} の取引基本契約を更新しました`);
    } catch { setError('保存に失敗しました'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideFileSignature size={15} className="text-[#C5A059]" />
            取引基本契約
            <span className="text-[11px] text-gray-400 font-normal">— {vendor.name}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* 締結日・有効期限 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">締結日 <span className="text-red-400">*</span></label>
              <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">有効期限</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
          </div>

          {/* 電子締結URL */}
          <div className="bg-[#0B132B] border border-gray-700 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-[#E6C687] flex items-center gap-1">
              <LucideFileSignature size={11} /> 電子署名URL（業者に送付）
            </p>
            {existing?.vendorSignature && (
              <div className="bg-emerald-950/40 border border-emerald-700/40 rounded p-2 space-y-1">
                <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <LucideCheck size={10} /> 電子署名済み ({existing.signatureAt?.split('T')[0]})
                </p>
                <img src={existing.vendorSignature} alt="署名" className="max-h-12 bg-white rounded border border-gray-200" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 flex-1 truncate font-mono bg-[#111A35] border border-gray-700 rounded px-2 py-1">
                {signingUrl}
              </span>
              <button
                onClick={handleCopyUrl}
                className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded transition flex items-center gap-1 ${
                  copied ? 'bg-emerald-900/40 text-emerald-400' : 'bg-[#C5A059]/20 text-[#C5A059] hover:bg-[#C5A059]/30'
                }`}
              >
                {copied ? <><LucideCheck size={10} /> コピー済み</> : <><LucideLink size={10} /> URLコピー</>}
              </button>
            </div>
          </div>

          {/* 契約書本文（ひな形） */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <button
                onClick={() => setShowTemplate(p => !p)}
                className="text-xs text-gray-400 hover:text-[#E6C687] flex items-center gap-1.5 transition"
              >
                <LucideInfo size={12} /> 契約書本文（ひな形）を{showTemplate ? '折りたたむ' : '編集する'}
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className="text-xs text-[#C5A059] hover:text-[#E6C687] flex items-center gap-1.5 border border-[#C5A059]/30 hover:border-[#C5A059] px-2 py-1 rounded-md transition"
              >
                <LucideFileText size={11} /> 業者向けプレビュー
              </button>
              {contractTemplates.length > 0 && (
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) handleLoadTemplate(e.target.value); }}
                  className="text-[10px] bg-[#0B132B] border border-gray-700 text-[#C5A059] rounded px-2 py-1 focus:outline-none"
                >
                  <option value="">テンプレートから読み込む…</option>
                  {contractTemplates.map(t => (
                    <option key={t.templateId} value={t.templateId}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
            {showTemplate && (
              <textarea
                value={templateText}
                onChange={e => setTemplateText(e.target.value)}
                rows={10}
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none font-mono"
              />
            )}
          </div>

          {/* 署名フラグ */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={signedByVendor} onChange={e => setSignedByVendor(e.target.checked)}
              className="w-4 h-4 rounded accent-[#C5A059]" />
            <span className="text-sm text-white">業者署名済み（紙面・原本受領済み）</span>
          </label>
          {signedByVendor && existing?.signedAt && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1">
              <LucideCheck size={10} /> 署名確認日: {new Date(existing.signedAt).toLocaleDateString('ja-JP')}
            </p>
          )}

          {/* 備考 */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">備考</label>
            <textarea value={contractNote} onChange={e => setContractNote(e.target.value)} rows={2}
              placeholder="例: 1年更新・自動更新条項あり"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 flex gap-2 bg-[#0B132B] rounded-b-xl shrink-0">
          <button onClick={onClose}
            className="border border-gray-700 text-gray-400 text-sm py-2 px-4 rounded-lg hover:border-gray-500 hover:text-white transition">
            キャンセル
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading ? <><LucideActivity size={13} className="animate-spin" /> 保存中…</> : <><LucideCheck size={13} /> 保存する</>}
          </button>
        </div>
      </div>

      {/* ─── 業者向けプレビューモーダル ─── */}
      {showPreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-gray-50 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* プレビューヘッダー */}
            <div className="bg-white border-b px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-[#C5A059] to-[#E6C687] flex items-center justify-center">
                  <span className="text-white font-extrabold text-sm">住</span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">住良建設株式会社</p>
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <LucideFileText size={13} className="text-[#C5A059]" />
                    取引基本契約書 電子締結
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-700 transition bg-gray-100 rounded-full p-1">
                <LucideX size={15} />
              </button>
            </div>
            <div className="text-[10px] text-center text-amber-700 bg-amber-50 border-b border-amber-200 px-4 py-1.5 font-semibold shrink-0">
              ⚠ これは管理者向けプレビューです。業者に表示される画面イメージです。
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* 業者情報 */}
              <div className="bg-white rounded-xl border shadow-sm p-4 space-y-2">
                <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <LucideBuilding2 size={14} className="text-[#C5A059]" />
                  業者情報
                </h2>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-400">業者名</p>
                    <p className="font-semibold text-gray-800">{vendor.name}</p>
                  </div>
                  {vendor.contactName && (
                    <div>
                      <p className="text-gray-400">担当者</p>
                      <p className="font-semibold text-gray-800">{vendor.contactName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400">締結日</p>
                    <p className="font-semibold text-gray-800">
                      {contractDate
                        ? new Date(contractDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                        : new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  {expiryDate && (
                    <div>
                      <p className="text-gray-400">有効期限</p>
                      <p className="font-semibold text-gray-800">
                        {new Date(expiryDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 契約書本文 */}
              <div className="bg-white rounded-xl border shadow-sm p-4 space-y-2">
                <h2 className="font-bold text-gray-800 text-sm">契約内容</h2>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans border border-gray-100 bg-gray-50 p-3 rounded-lg max-h-64 overflow-y-auto">
                  {templateText}
                </pre>
              </div>

              {/* 署名フォームプレビュー */}
              <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
                <h2 className="font-bold text-gray-800 text-sm">電子署名（業者入力）</h2>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded border-2 border-gray-300 shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-600">上記の取引基本契約の内容を確認し、同意します。</span>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-400 text-xs">
                  ここに署名が入ります（指またはペンで入力）
                </div>
                <div className="w-full bg-gray-200 text-gray-500 font-bold py-2.5 rounded-xl text-xs text-center">
                  上記内容に同意して署名を送信する
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 外部業者 登録/編集ダイアログ
// ─────────────────────────────────────────────────────────────

function VendorEditDialog({
  initial, onClose, onSaved,
}: {
  initial?:  Vendor;
  onClose:   () => void;
  onSaved:   (msg: string) => void;
}) {
  const isEditMode = !!initial;

  const [name,           setName]           = useState(initial?.name           ?? '');
  const [contactName,    setContactName]    = useState(initial?.contactName    ?? '');
  const [phone,          setPhone]          = useState(initial?.phone          ?? '');
  const [email,          setEmail]          = useState(initial?.email          ?? '');
  const [address,        setAddress]        = useState(initial?.address        ?? '');
  const [specialty,      setSpecialty]      = useState<string[]>(initial?.specialty ?? []);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [notes,          setNotes]          = useState(initial?.notes          ?? '');
  const [status,         setStatus]         = useState<'active' | 'inactive'>(initial?.status ?? 'active');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !specialty.includes(t)) setSpecialty(prev => [...prev, t]);
    setSpecialtyInput('');
  };
  const removeTag = (tag: string) => setSpecialty(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    if (!name.trim()) { setError('業者名を入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      const vendor: Vendor = {
        vendorId:  initial?.vendorId  ?? genId('VN'),
        name:      name.trim(),
        specialty,
        status,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
        ...(phone.trim()       ? { phone:       phone.trim()       } : {}),
        ...(email.trim()       ? { email:       email.trim()       } : {}),
        ...(address.trim()     ? { address:     address.trim()     } : {}),
        ...(notes.trim()       ? { notes:       notes.trim()       } : {}),
        ...(initial?.basicContract ? { basicContract: initial.basicContract } : {}),
      };
      await saveVendor(vendor);
      onSaved(`${vendor.name} を${isEditMode ? '更新' : '登録'}しました`);
    } catch { setError('保存に失敗しました'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideBuilding2 size={15} className="text-[#C5A059]" />
            {isEditMode ? '業者情報を編集' : '外部業者を登録'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* 基本情報 */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">業者名 <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="例: 山田塗装工業 株式会社"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">担当者名</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                  placeholder="例: 山田 太郎"
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">電話番号</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="090-0000-0000"
                  className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vendor@example.com"
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">住所</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                placeholder="例: 大阪府大阪市西区..."
                className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
            </div>
          </div>

          {/* 専門工種タグ */}
          <div>
            <label className="text-xs text-gray-400 block mb-2">専門工種</label>
            {/* 選択済みタグ */}
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
              {specialty.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E6C687] text-[11px] px-2 py-0.5 rounded-full">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-[#C5A059]/60 hover:text-red-400 transition ml-0.5">
                    <LucideX size={9} />
                  </button>
                </span>
              ))}
              {specialty.length === 0 && <span className="text-[11px] text-gray-600">未選択</span>}
            </div>
            {/* プリセット */}
            <div className="flex flex-wrap gap-1 mb-2">
              {SPECIALTY_PRESETS.filter(p => !specialty.includes(p)).map(p => (
                <button key={p} onClick={() => addTag(p)}
                  className="text-[10px] border border-gray-700 text-gray-400 hover:border-[#C5A059]/50 hover:text-[#E6C687] px-2 py-0.5 rounded-full transition">
                  + {p}
                </button>
              ))}
            </div>
            {/* カスタム入力 */}
            <div className="flex gap-2">
              <input type="text" value={specialtyInput}
                onChange={e => setSpecialtyInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(specialtyInput); }}}
                placeholder="その他の工種を入力"
                className="flex-1 bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]" />
              <button onClick={() => addTag(specialtyInput)} disabled={!specialtyInput.trim()}
                className="border border-[#C5A059]/40 text-[#C5A059] text-xs px-3 rounded-lg hover:bg-[#C5A059]/10 disabled:opacity-30 transition">
                <LucidePlus size={13} />
              </button>
            </div>
          </div>

          {/* 備考 */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="振込先・特記事項など"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059] resize-none" />
          </div>

          {/* ステータス */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">ステータス</label>
            <div className="flex gap-2">
              {(['active', 'inactive'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                    status === s
                      ? s === 'active'
                        ? 'bg-emerald-900/50 border-emerald-700/60 text-emerald-300'
                        : 'bg-gray-800 border-gray-600 text-gray-400'
                      : 'border-gray-700 text-gray-500 hover:border-gray-500'
                  }`}>
                  {s === 'active' ? '取引中' : '取引停止'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 flex gap-2 shrink-0 bg-[#0B132B] rounded-b-xl">
          <button onClick={onClose}
            className="border border-gray-700 text-gray-400 text-sm py-2 px-4 rounded-lg hover:border-gray-500 hover:text-white transition">
            キャンセル
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading ? <><LucideActivity size={13} className="animate-spin" /> 保存中…</> : <><LucideCheck size={13} /> {isEditMode ? '更新する' : '登録する'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 外部業者 マスタパネル
// ─────────────────────────────────────────────────────────────

function VendorMasterPanel({
  vendors, contractTemplates, onShowToast,
}: {
  vendors:             Vendor[];
  contractTemplates:   ContractTemplate[];
  onShowToast:         (msg: string) => void;
}) {
  const [search,          setSearch]          = useState('');
  const [filterStatus,    setFilterStatus]    = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreate,      setShowCreate]      = useState(false);
  const [editTarget,      setEditTarget]      = useState<Vendor | null>(null);
  const [contractTarget,  setContractTarget]  = useState<Vendor | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<Vendor | null>(null);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);
  const [deleting,        setDeleting]        = useState(false);

  const filtered = vendors
    .filter(v => filterStatus === 'all' || v.status === filterStatus)
    .filter(v => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return v.name.toLowerCase().includes(q) ||
             (v.contactName?.toLowerCase().includes(q) ?? false) ||
             v.specialty.some(s => s.toLowerCase().includes(q));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVendor(deleteTarget.vendorId);
      onShowToast(`${deleteTarget.name} を削除しました`);
      setDeleteTarget(null);
    } catch { onShowToast('削除に失敗しました'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-3">
      {/* 新規登録ボタン */}
      <button onClick={() => setShowCreate(true)}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C5A059]/40 hover:border-[#C5A059] text-[#C5A059] hover:text-[#E6C687] text-sm font-bold py-2.5 rounded-lg transition">
        <LucidePlusCircle size={14} /> 外部業者を新規登録する
      </button>

      {/* 検索・フィルター */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LucideSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="業者名・担当者・工種で検索"
            className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-[#C5A059]" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-[#0B132B] border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C5A059]">
          <option value="all">全て</option>
          <option value="active">取引中</option>
          <option value="inactive">取引停止</option>
        </select>
      </div>

      {/* 件数サマリー */}
      <div className="flex gap-3 text-[10px] text-gray-500">
        <span>{vendors.filter(v => v.status === 'active').length} 社 取引中</span>
        <span>|</span>
        <span>{vendors.filter(v => !v.basicContract?.signedByVendor).length} 社 基本契約未締結</span>
        <span>|</span>
        <span>{vendors.filter(v => getContractStatus(v.basicContract) === 'expired').length} 社 期限切れ</span>
      </div>

      {/* 業者カードリスト */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-10">
          {vendors.length === 0 ? '業者が登録されていません' : '条件に合う業者が見つかりません'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(vendor => {
            const cs    = getContractStatus(vendor.basicContract);
            const badge = CONTRACT_STATUS_BADGE[cs];
            const isExp = expandedId === vendor.vendorId;

            return (
              <div key={vendor.vendorId}
                className={`bg-[#0A0F1D] rounded-xl border ${vendor.status === 'inactive' ? 'border-gray-800 opacity-60' : 'border-gray-700/80'} overflow-hidden`}>
                {/* カードヘッダー（クリックで展開） */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#0F1A30] transition"
                  onClick={() => setExpandedId(isExp ? null : vendor.vendorId)}
                >
                  <LucideBuilding2 size={16} className="text-[#C5A059] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{vendor.name}</span>
                      {vendor.status === 'inactive' && (
                        <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">取引停止</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold ${badge.className}`}>
                        {badge.icon} {badge.label}
                        {cs === 'valid' && vendor.basicContract?.expiryDate &&
                          <span className="font-normal ml-0.5">
                            ～{new Date(vendor.basicContract.expiryDate).toLocaleDateString('ja-JP', { year: '2-digit', month: 'short', day: 'numeric' })}
                          </span>
                        }
                        {cs === 'expiring' && vendor.basicContract?.expiryDate &&
                          <span className="font-normal ml-0.5">
                            {new Date(vendor.basicContract.expiryDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}まで
                          </span>
                        }
                        {cs === 'expired' && vendor.basicContract?.expiryDate &&
                          <span className="font-normal ml-0.5">
                            {new Date(vendor.basicContract.expiryDate).toLocaleDateString('ja-JP', { year: '2-digit', month: 'short', day: 'numeric' })}
                          </span>
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {vendor.contactName && <span className="text-[11px] text-gray-400">{vendor.contactName}</span>}
                      {vendor.phone && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <LucidePhone size={9} /> {vendor.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 専門工種タグ（最大3つ） */}
                  <div className="hidden sm:flex gap-1 flex-wrap justify-end">
                    {vendor.specialty.slice(0, 3).map(s => (
                      <span key={s} className="text-[10px] bg-[#1C2C54] text-gray-400 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                    {vendor.specialty.length > 3 && (
                      <span className="text-[10px] text-gray-600">+{vendor.specialty.length - 3}</span>
                    )}
                  </div>
                  {isExp
                    ? <LucideChevronUp size={13} className="text-gray-500 shrink-0" />
                    : <LucideChevronDown size={13} className="text-gray-500 shrink-0" />}
                </div>

                {/* 展開コンテンツ */}
                {isExp && (
                  <div className="border-t border-gray-800 px-4 py-3 space-y-3 bg-[#111A35]">
                    {/* 連絡先詳細 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {vendor.email && (
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <LucideMail size={11} className="shrink-0" />
                          <a href={`mailto:${vendor.email}`} className="hover:text-white transition truncate">{vendor.email}</a>
                        </div>
                      )}
                      {vendor.address && (
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <LucideMapPin size={11} className="shrink-0" />
                          <span className="truncate">{vendor.address}</span>
                        </div>
                      )}
                    </div>

                    {/* 専門工種（全表示） */}
                    {vendor.specialty.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {vendor.specialty.map(s => (
                          <span key={s} className="text-[10px] bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#E6C687] px-2 py-0.5 rounded-full">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 備考 */}
                    {vendor.notes && (
                      <p className="text-[11px] text-gray-400 bg-[#0A0F1D] px-3 py-2 rounded-lg border border-gray-800">
                        <LucideInfo size={10} className="inline mr-1" />{vendor.notes}
                      </p>
                    )}

                    {/* 取引基本契約詳細 */}
                    {vendor.basicContract && (
                      <div className={`rounded-lg border px-3 py-2 text-[11px] space-y-0.5 ${
                        cs === 'expired'  ? 'bg-red-950/20 border-red-700/30 text-red-400' :
                        cs === 'expiring' ? 'bg-yellow-950/20 border-yellow-700/30 text-yellow-400' :
                                            'bg-emerald-950/20 border-emerald-700/30 text-emerald-300'
                      }`}>
                        <div className="font-semibold flex items-center gap-1">
                          <LucideFileSignature size={10} /> 取引基本契約
                        </div>
                        <div className="text-gray-400">
                          締結日: {vendor.basicContract.contractDate}
                          {vendor.basicContract.expiryDate && ` ～ ${vendor.basicContract.expiryDate}`}
                        </div>
                        {vendor.basicContract.contractNote && (
                          <div className="text-gray-500">{vendor.basicContract.contractNote}</div>
                        )}
                      </div>
                    )}

                    {/* アクションボタン */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditTarget(vendor)}
                        className="flex items-center gap-1 text-[11px] border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white px-3 py-1.5 rounded-lg transition">
                        <LucidePencil size={11} /> 編集
                      </button>
                      <button onClick={() => setContractTarget(vendor)}
                        className="flex items-center gap-1 text-[11px] border border-[#C5A059]/40 text-[#C5A059] hover:bg-[#C5A059]/10 px-3 py-1.5 rounded-lg transition">
                        <LucideFileSignature size={11} /> 取引基本契約
                      </button>
                      <button onClick={() => setDeleteTarget(vendor)}
                        className="flex items-center gap-1 text-[11px] border border-red-700/30 text-red-400/60 hover:text-red-400 hover:border-red-700/60 px-3 py-1.5 rounded-lg transition ml-auto">
                        <LucideTrash2 size={11} /> 削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 登録ダイアログ */}
      {showCreate && (
        <VendorEditDialog
          onClose={() => setShowCreate(false)}
          onSaved={msg => { onShowToast(msg); setShowCreate(false); }}
        />
      )}
      {/* 編集ダイアログ */}
      {editTarget && (
        <VendorEditDialog
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={msg => { onShowToast(msg); setEditTarget(null); }}
        />
      )}
      {/* 取引基本契約ダイアログ */}
      {contractTarget && (
        <VendorBasicContractDialog
          vendor={contractTarget}
          contractTemplates={contractTemplates}
          onClose={() => setContractTarget(null)}
          onSaved={msg => { onShowToast(msg); setContractTarget(null); }}
        />
      )}
      {/* 削除確認 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111A35] border border-red-700/40 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <LucideTrash2 size={15} className="text-red-400" /> 業者を削除
            </h3>
            <p className="text-xs text-gray-400">
              「<span className="text-white font-semibold">{deleteTarget.name}</span>」を削除します。<br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:text-white transition">
                キャンセル
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-lg transition disabled:opacity-50">
                {deleting ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// MasterPage — メインコンポーネント
// ─────────────────────────────────────────────────────────────

type MasterSubTab = 'templates' | 'users' | 'vendors';

interface MasterPageProps {
  templates:         EstimateTemplate[];
  contractTemplates: ContractTemplate[];
  users:             AppUser[];
  vendors:           Vendor[];
  currentUid:        string;
  currentRole:       UserRole;
  onShowToast:       (msg: string) => void;
}

export default function MasterPage({
  templates, contractTemplates, users, vendors, currentUid, currentRole, onShowToast,
}: MasterPageProps) {
  const isAdmin       = currentRole === 'admin';
  const isManagerLike = currentRole === 'manager' || currentRole === 'admin';

  const [activeSubTab, setActiveSubTab] = useState<MasterSubTab>('templates');

  const TAB_CONFIG = [
    { key: 'templates' as const, label: 'テンプレート管理', icon: <LucideClipboardList size={13} />, visible: isManagerLike },
    { key: 'vendors'   as const, label: '外部業者管理',     icon: <LucideBuilding2 size={13} />,     visible: isManagerLike },
    { key: 'users'     as const, label: 'ユーザー管理',     icon: <LucideUsers size={13} />,         visible: isAdmin },
  ];

  const ACCESS_HINT: Record<MasterSubTab, string> = {
    templates: '管理者・スーパー管理者が編集できます',
    vendors:   '管理者・スーパー管理者が編集できます',
    users:     'スーパー管理者のみ操作できます',
  };

  return (
    <div className="space-y-4">

      {/* タブバー */}
      <div className="bg-[#111A35] border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-800">
          {TAB_CONFIG.filter(t => t.visible).map(t => (
            <button key={t.key}
              onClick={() => setActiveSubTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition ${
                activeSubTab === t.key
                  ? 'text-[#E6C687] border-b-2 border-[#C5A059] bg-[#C5A059]/5'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 bg-[#0A0F1D]/60 border-b border-gray-800/50 flex items-center gap-2 text-[10px] text-gray-500">
          <LucideSettings size={10} />
          <span>{ACCESS_HINT[activeSubTab]}</span>
        </div>
      </div>

      {/* パネル */}
      {activeSubTab === 'templates' && isManagerLike && (
        <TemplateMasterPanel templates={templates} contractTemplates={contractTemplates} onShowToast={onShowToast} />
      )}
      {activeSubTab === 'vendors' && isManagerLike && (
        <VendorMasterPanel vendors={vendors} contractTemplates={contractTemplates} onShowToast={onShowToast} />
      )}
      {activeSubTab === 'users' && isAdmin && (
        <UserMasterPanel users={users} currentUid={currentUid} onShowToast={onShowToast} />
      )}
    </div>
  );
}
