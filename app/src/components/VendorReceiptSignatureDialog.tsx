/**
 * VendorReceiptSignatureDialog
 * 業者受領署名パッド + 支払済み記録ダイアログ
 */
import { useState, useRef } from 'react';
import { LucideX } from 'lucide-react';
import type { VendorQuoteRequest } from '@/types';
import { saveVendorReceiptSignature } from '@/services/vendorQuoteService';

export default function VendorReceiptSignatureDialog({ req, onClose, onSaved }: {
  req:     VendorQuoteRequest;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const ctxRef     = useRef<CanvasRenderingContext2D | null>(null);
  const drawing    = useRef(false);
  const isEmptyRef = useRef(true);
  const [isEmpty,  setIsEmpty]  = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [paidAt,   setPaidAt]   = useState(new Date().toISOString().split('T')[0]);

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

  const handleSave = async () => {
    if (isEmpty) return;
    setLoading(true);
    try {
      const dataUrl = canvasRef.current!.toDataURL('image/png');
      await saveVendorReceiptSignature(req.requestId, dataUrl, paidAt);
      onSaved(`${req.vendorName} の受領署名を記録し、支払済にしました`);
    } catch { onSaved('保存に失敗しました'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-md shadow-2xl">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl">
          <h3 className="text-sm font-bold text-white">
            受領署名取得 — {req.vendorName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-[#0B132B] rounded-lg p-3 text-xs text-gray-300 space-y-1">
            <div className="flex justify-between">
              <span>案件</span>
              <span className="text-white font-semibold">{req.projectTitle}</span>
            </div>
            <div className="flex justify-between">
              <span>支払い金額</span>
              <span className="text-[#E6C687] font-bold">¥{(req.totalAmount ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>支払日</span>
              <input
                type="date"
                value={paidAt}
                onChange={e => setPaidAt(e.target.value)}
                className="bg-[#111A35] border border-gray-700 text-white text-xs rounded px-2 py-0.5 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            受取業者（{req.vendorName}）の担当者にサインをお願いします。
          </p>

          <div className="border-2 border-gray-500 rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
            <div className="relative">
              {isEmpty && (
                <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none select-none">
                  業者担当者にサインしてもらってください
                </span>
              )}
              <canvas
                ref={canvasRef}
                className="w-full block"
                style={{ height: 140, cursor: 'crosshair', touchAction: 'none', display: 'block' }}
                onMouseDown={e => { const p = getPos(e.clientX, e.clientY); startAt(p.x, p.y); }}
                onMouseMove={e => { const p = getPos(e.clientX, e.clientY); drawTo(p.x, p.y); }}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={e => { const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); startAt(p.x, p.y); }}
                onTouchMove={e => { const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); drawTo(p.x, p.y); }}
                onTouchEnd={endDraw}
              />
            </div>
            <div className="border-t border-gray-200 bg-gray-50 px-3 py-1.5 flex justify-between items-center">
              <span className="text-xs text-gray-500">指またはペンでサインしてください</span>
              <button onClick={clear} className="text-xs text-gray-500 hover:text-red-600 underline transition-colors">クリア</button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:border-gray-500 hover:text-white transition-colors">
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isEmpty || loading}
              className="flex-1 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-40"
            >
              {loading ? '保存中...' : '署名確定・支払済にする'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
