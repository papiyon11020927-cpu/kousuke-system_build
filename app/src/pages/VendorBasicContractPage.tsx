/**
 * VendorBasicContractPage — 業者向け取引基本契約 電子署名ページ（認証不要・公開）
 *
 * アクセス URL: /?basicContract=<vendorId>
 * ・ログイン不要で外部業者がアクセスできる
 * ・契約内容の確認と電子署名を実施
 */
import { useEffect, useRef, useState } from 'react';
import { LucideBuilding2, LucideCalendar, LucideCheck, LucideFileText } from 'lucide-react';
import type { Vendor } from '@/types';
import { getVendorById, saveBasicContractSignature } from '@/services/vendorService';

const DEFAULT_TEMPLATE = `取引基本契約書

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

export default function VendorBasicContractPage({ vendorId }: { vendorId: string }) {
  const [vendor,    setVendor]    = useState<Vendor | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [agreed,    setAgreed]    = useState(false);
  const [signed,    setSigned]    = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const ctxRef     = useRef<CanvasRenderingContext2D | null>(null);
  const drawing    = useRef(false);
  const isEmptyRef = useRef(true);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    getVendorById(vendorId)
      .then(v => {
        if (!v) { setError('契約情報が見つかりません。URLを確認してください。'); return; }
        if (v.basicContract?.signedByVendor) { setSigned(true); }
        setVendor(v);
      })
      .catch(() => setError('読み込みに失敗しました。'))
      .finally(() => setLoading(false));
  }, [vendorId]);

  // 最初のタッチ/クリック時に DPR 対応で初期化（レイアウト確定後）
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
    const ctx = ctxRef.current!;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  // 同期描画 + stroke後にbeginPath/moveTo でO(1)パス長を維持
  const drawTo = (x: number, y: number) => {
    if (!drawing.current) return;
    if (isEmptyRef.current) { isEmptyRef.current = false; setIsEmpty(false); }
    const ctx = ctxRef.current!;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
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
    if (!vendor || isEmpty) return;
    setSubmitting(true);
    try {
      const dataUrl = canvasRef.current!.toDataURL('image/png');
      await saveBasicContractSignature(vendor.vendorId, dataUrl);
      setSigned(true);
    } catch {
      alert('署名の送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const bc = vendor?.basicContract;
  const contractText = bc?.templateText ?? DEFAULT_TEMPLATE.replace('[業者名]', vendor?.name ?? '');

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-sm">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow p-6 max-w-sm w-full text-center space-y-3">
        <p className="text-red-500 font-semibold">{error}</p>
        <p className="text-gray-500 text-sm">発注会社へお問い合わせください。</p>
      </div>
    </div>
  );

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
            取引基本契約書 電子締結
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* 締結情報 */}
        {vendor && (
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <LucideBuilding2 size={16} className="text-[#C5A059]" />
              業者情報
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">業者名</p>
                <p className="font-semibold text-gray-800">{vendor.name}</p>
              </div>
              {vendor.contactName && (
                <div>
                  <p className="text-xs text-gray-400">担当者</p>
                  <p className="font-semibold text-gray-800">{vendor.contactName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 flex items-center gap-1"><LucideCalendar size={10} /> 締結日</p>
                <p className="font-semibold text-gray-800">
                  {bc?.contractDate
                    ? new Date(bc.contractDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                    : new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {bc?.expiryDate && (
                <div>
                  <p className="text-xs text-gray-400">有効期限</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(bc.expiryDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 契約書本文 */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-gray-800">契約内容</h2>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans border border-gray-100 bg-gray-50 p-4 rounded-lg max-h-80 overflow-y-auto">
            {contractText}
          </pre>
        </div>

        {/* 署名済み表示 */}
        {signed && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold">
              <LucideCheck size={20} /> 電子署名が完了しています
            </div>
            {bc?.signatureAt && (
              <p className="text-sm text-emerald-600">
                署名日時: {new Date(bc.signatureAt).toLocaleString('ja-JP')}
              </p>
            )}
            {bc?.vendorSignature && (
              <img src={bc.vendorSignature} alt="署名" className="mx-auto max-h-20 bg-white rounded border border-gray-200" />
            )}
            <p className="text-xs text-gray-500">
              発注会社にて署名内容が確認されます。ありがとうございました。
            </p>
          </div>
        )}

        {/* 署名フォーム */}
        {!signed && (
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800">電子署名</h2>

            {/* 同意チェック */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#C5A059]"
              />
              <span className="text-sm text-gray-700">
                上記の取引基本契約の内容を確認し、同意します。
              </span>
            </label>

            {agreed && (
              <>
                <p className="text-sm text-gray-600">
                  下記に署名してください（代表者または担当者）。
                </p>
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
                  className="w-full bg-[#C5A059] hover:bg-[#D4AF37] text-white font-bold py-3 rounded-xl text-sm transition disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? '送信中...' : (
                    <><LucideCheck size={16} /> 上記内容に同意して署名を送信する</>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          © 住良建設株式会社 — このページは取引基本契約の電子締結専用です
        </p>
      </div>
    </div>
  );
}
