/**
 * CustomerContractSignPage — 顧客向け工事請負契約書 電子署名ページ（認証不要・公開）
 *
 * アクセス URL: /?customerSign=<contractId>
 * ・ログイン不要でお客様がアクセス可能（別タブ・QRコード共有）
 * ・契約内容の確認と電子署名を実施
 */
import { useEffect, useRef, useState } from 'react';
import { LucideBuilding2, LucideCalendar, LucideCheck, LucideFileText, LucidePenLine } from 'lucide-react';
import type { Contract } from '@/types';
import { getContractById, saveSignature } from '@/services/contractService';
import { updateProjectStatus } from '@/services/projectService';

export default function CustomerContractSignPage({ contractId }: { contractId: string }) {
  const [contract,   setContract]   = useState<Contract | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [agreed,     setAgreed]     = useState(false);
  const [signed,     setSigned]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const ctxRef     = useRef<CanvasRenderingContext2D | null>(null);
  const drawing    = useRef(false);
  const isEmptyRef = useRef(true);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    getContractById(contractId)
      .then(c => {
        if (!c) { setError('契約情報が見つかりません。URLを確認してください。'); return; }
        if (c.signedByCustomer) { setSigned(true); }
        setContract(c);
      })
      .catch(() => setError('読み込みに失敗しました。担当者へお問い合わせください。'))
      .finally(() => setLoading(false));
  }, [contractId]);

  // ── Canvas（VendorBasicContractPage と同一ロジック）──────────
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.dataset.initialized) return;
    const dpr    = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctxRef.current  = ctx;
    canvas.dataset.initialized = '1';
  };
  const getPos = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };
  const startAt = (x: number, y: number) => {
    initCanvas();
    drawing.current = true;
    ctxRef.current!.beginPath();
    ctxRef.current!.moveTo(x, y);
  };
  const drawTo = (x: number, y: number) => {
    if (!drawing.current) return;
    if (isEmptyRef.current) { isEmptyRef.current = false; setIsEmpty(false); }
    const ctx = ctxRef.current!;
    ctx.lineTo(x, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const endDraw = () => { drawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current!;
    ctxRef.current?.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    delete canvas.dataset.initialized;
    ctxRef.current = null;
    initCanvas();
    isEmptyRef.current = true;
    setIsEmpty(true);
  };

  const handleSubmit = async () => {
    if (!contract || isEmpty) return;
    setSubmitting(true);
    try {
      const dataUrl = canvasRef.current!.toDataURL('image/png');
      await saveSignature(contract.contractId, dataUrl);
      // 署名完了 → 案件ステータスを「契約済」へ自動更新（失敗しても署名自体は保存済み）
      await updateProjectStatus(contract.projectId, 'contract').catch(() => {});
      setSigned(true);
    } catch {
      alert('署名の送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const fmtMoney = (n: number) => `¥${n.toLocaleString()}`;

  // ── ローディング / エラー ─────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-sm">読み込み中...</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow p-6 max-w-sm w-full text-center space-y-3">
        <p className="text-red-500 font-semibold">{error}</p>
        <p className="text-gray-500 text-sm">担当者へお問い合わせください。</p>
      </div>
    </div>
  );

  const ct = contract!;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">

      {/* ヘッダー */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-tr from-[#C5A059] to-[#E6C687] flex items-center justify-center">
          <span className="text-white font-extrabold text-xl">住</span>
        </div>
        <div>
          <p className="text-xs text-gray-400">住良建設株式会社</p>
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <LucideFileText size={16} className="text-[#C5A059]" />
            工事請負契約書 電子署名
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* お客様情報 */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <LucideBuilding2 size={16} className="text-[#C5A059]" />
            お客様・工事情報
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">お客様名</p>
              <p className="font-semibold text-gray-800">{ct.customerName}&ensp;様</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">担当</p>
              <p className="font-semibold text-gray-800">{ct.staffName}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400">工事名称</p>
              <p className="font-semibold text-gray-800">{ct.projectTitle}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 flex items-center gap-1"><LucideCalendar size={10} /> 契約日</p>
              <p className="font-semibold text-gray-800">{fmtDate(ct.createdAt)}</p>
            </div>
            {ct.warrantyMonths && (
              <div>
                <p className="text-xs text-gray-400">保証期間</p>
                <p className="font-semibold text-gray-800">{ct.warrantyMonths}ヶ月</p>
              </div>
            )}
            {ct.constructionStartDate && (
              <div>
                <p className="text-xs text-gray-400">着工予定</p>
                <p className="font-semibold text-gray-800">{fmtDate(ct.constructionStartDate)}</p>
              </div>
            )}
            {ct.constructionEndDate && (
              <div>
                <p className="text-xs text-gray-400">完工予定</p>
                <p className="font-semibold text-gray-800">{fmtDate(ct.constructionEndDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* 請負金額 */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-gray-800">請負金額</h2>
          <p className="text-2xl font-extrabold text-gray-900">{fmtMoney(ct.totalAmount)}<span className="text-sm font-normal text-gray-500 ml-1">（税込）</span></p>
          {ct.paymentTerms && ct.paymentTerms.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 border-t pt-2">お支払いスケジュール</p>
              {ct.paymentTerms.map((term, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">{term.termName}</p>
                    {term.scheduledDate && (
                      <p className="text-xs text-[#C5A059] font-medium mt-0.5">
                        🗓 {(() => { const [y,m] = term.scheduledDate!.split('-'); return `${y}年${parseInt(m)}月頃`; })()}
                      </p>
                    )}
                    {term.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{term.description}</p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0">{fmtMoney(term.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 特記事項 */}
        {ct.specialNotes && (
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-2">
            <h2 className="font-bold text-gray-800">特記事項</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ct.specialNotes}</p>
          </div>
        )}

        {/* 署名済み */}
        {signed && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold">
              <LucideCheck size={20} /> 電子署名が完了しています
            </div>
            {ct.signatureAt && (
              <p className="text-sm text-emerald-600">署名日時: {new Date(ct.signatureAt).toLocaleString('ja-JP')}</p>
            )}
            {ct.customerSignature && (
              <img src={ct.customerSignature} alt="署名" className="mx-auto max-h-20 bg-white rounded border border-gray-200" />
            )}
            <p className="text-xs text-gray-500">ありがとうございました。担当者が内容を確認いたします。</p>
          </div>
        )}

        {/* 署名フォーム */}
        {!signed && (
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <LucidePenLine size={16} className="text-[#C5A059]" />
              電子署名
            </h2>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#C5A059]"
              />
              <span className="text-sm text-gray-700">
                上記の工事請負契約の内容を確認し、同意します。
              </span>
            </label>

            {agreed && (
              <>
                <p className="text-sm text-gray-600">下記に署名してください。</p>
                <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
                  <div className="relative">
                    {isEmpty && (
                      <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none select-none">
                        ここにサインしてください
                      </span>
                    )}
                    <canvas
                      ref={canvasRef}
                      className="w-full block"
                      style={{ height: 160, cursor: 'crosshair', touchAction: 'none' }}
                      onMouseDown={e => { const p = getPos(e.clientX, e.clientY); startAt(p.x, p.y); }}
                      onMouseMove={e => { const p = getPos(e.clientX, e.clientY); drawTo(p.x, p.y); }}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={e => { const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); startAt(p.x, p.y); }}
                      onTouchMove={e => { const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); drawTo(p.x, p.y); }}
                      onTouchEnd={endDraw}
                    />
                  </div>
                  <div className="border-t border-gray-200 bg-gray-50 px-3 py-1.5 flex justify-between">
                    <span className="text-xs text-gray-500">指またはペンでサインしてください</span>
                    <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 underline">クリア</button>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isEmpty || submitting}
                  className="w-full bg-[#C5A059] hover:bg-[#D4AF37] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? '送信中...' : <><LucideCheck size={16} /> 上記内容に同意して署名を送信する</>}
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          © 住良建設株式会社 — このページは工事請負契約の電子署名専用です
        </p>
      </div>
    </div>
  );
}

