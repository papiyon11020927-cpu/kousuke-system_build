/**
 * VendorWorkflowCard
 *
 * 精算タブ › 支払管理 で使用する業者ワークフローカード。
 * 工事完了報告書受領 → 完了検査・検収 → 検収書発行 → 請求書受領 → 支払い完了
 * の5ステップをインタラクティブに管理する。
 */
import { useState } from 'react';
import {
  LucideCheck, LucideBuilding2, LucideFileText, LucideRefreshCw,
  LucideChevronDown, LucideCamera, LucideLink, LucidePaperclip, LucideX,
  LucideAlertCircle, LucideCheckCircle2,
} from 'lucide-react';
import type { VendorQuoteRequest, Project } from '@/types';
import {
  markVendorPaid, unmarkVendorPaid,
  submitCompletionReport, recordInspectionResult,
  issueAcceptanceCert, recordVendorInvoice,
  uploadVendorPhoto, uploadVendorDoc, analyzeInvoiceAmount,
} from '@/services/vendorQuoteService';
import { openPrintPreview } from '@/services/documentService';

// ─── 画像圧縮ユーティリティ ─────────────────────────────────
async function compressImageToBase64(
  file: File,
  maxWidth = 800,
  quality  = 0.65,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale  = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── 検収書 HTML ジェネレーター ─────────────────────────────
export function buildAcceptanceCertHtml(
  vq:       VendorQuoteRequest,
  project:  Project,
  issuedBy: string,
): string {
  const today = new Date().toLocaleDateString('ja-JP');
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
  <title>検収書</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Hiragino Kaku Gothic ProN','ヒラギノ角ゴ ProN','Meiryo','メイリオ','MS PGothic','ＭＳ Ｐゴシック',sans-serif;color:#111;font-size:10pt;line-height:1.6;background:#c8c8c8;padding:20px 0 40px}
    @page{size:A4 portrait;margin:0}
    @media print{body{background:white;padding:0}.no-print{display:none!important}.page{box-shadow:none;border:none;margin:0;padding:18mm 20mm;width:100%;min-height:auto}}
    .no-print{text-align:center;margin-bottom:14px}
    .no-print button{background:#444;color:white;border:none;padding:7px 24px;border-radius:5px;cursor:pointer;font-size:10pt;letter-spacing:0.05em}
    .no-print button:hover{background:#222}
    .page{width:210mm;min-height:297mm;background:white;margin:0 auto;padding:18mm 20mm;box-shadow:0 4px 20px rgba(0,0,0,0.35);border:1px solid #aaa}
    h1{font-size:18pt;text-align:center;letter-spacing:0.35em;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:20px}
    .info-grid{display:grid;grid-template-columns:130px 1fr;gap:7px 16px;margin-bottom:20px}
    .info-grid .lbl{color:#666;font-size:9pt}
    .info-grid .val{font-weight:600}
    .box{border:1px solid #ccc;padding:12px 16px;border-radius:4px;margin-bottom:14px}
    .box-lbl{font-size:8.5pt;color:#666;margin-bottom:4px}
    .box-val{font-size:10pt;font-weight:bold}
    .result-badge{display:inline-block;padding:5px 22px;border-radius:4px;font-weight:bold;font-size:12pt;background:#d1fae5;color:#065f46;border:1px solid #6ee7b7}
    .sig-grid{margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .sig-box{border:1px solid #ccc;border-radius:4px;padding:12px;height:80px}
    .sig-box-lbl{font-size:8pt;color:#666;margin-bottom:4px}
    .footer{margin-top:24px;font-size:8pt;color:#888;border-top:1px solid #ccc;padding-top:8px}
  </style>
  </head><body>
  <div class="no-print"><button onclick="window.print()">🖨 PDF保存・印刷する</button></div>
  <div class="page">
    <h1>検　収　書</h1>
    <div class="info-grid">
      <div class="lbl">発行日</div><div class="val">${today}</div>
      <div class="lbl">宛先（受注者）</div><div class="val">${vq.vendorName ?? ''}　御中</div>
      <div class="lbl">案件名</div><div class="val">${project.title}</div>
      <div class="lbl">発行者</div><div class="val">${issuedBy}</div>
    </div>
    <div class="box">
      <div class="box-lbl">検収内容・作業範囲</div>
      <div class="box-val">${vq.workScope || '上記案件に関する施工一式'}</div>
    </div>
    <div class="box">
      <div class="box-lbl">契約金額（税抜）</div>
      <div class="box-val" style="font-size:13pt">¥${(vq.totalAmount ?? 0).toLocaleString()}</div>
    </div>
    <div class="box">
      <div class="box-lbl">検収結果</div>
      <div style="margin-top:6px"><span class="result-badge">合　格</span></div>
    </div>
    <p style="margin-top:14px;font-size:9pt;line-height:1.9;color:#444">
      上記の工事・サービスについて完了を確認し、検収を行いました。<br>
      本書をもって検収完了の証といたします。<br>
      なお、請求書の提出をお願いいたします。
    </p>
    <div class="sig-grid">
      <div class="sig-box">
        <div class="sig-box-lbl">発注者（検収者）署名</div>
        <div style="font-size:9pt;margin-top:4px">${issuedBy}</div>
      </div>
      <div class="sig-box">
        <div class="sig-box-lbl">受注者（業者）確認欄</div>
      </div>
    </div>
    <div class="footer">本書は完了確認書・検収書として有効です。</div>
  </div>
  </body></html>`;
}

// ─── ワークフローステップ計算 ────────────────────────────────
export function getVendorWorkflowStep(vq: VendorQuoteRequest): 0 | 1 | 2 | 3 | 4 | 5 {
  if (vq.vendorPaid)       return 5;
  if (vq.vendorInvoice)    return 4;
  if (vq.acceptanceCert)   return 3;
  if (vq.inspectionResult) return 2;
  if (vq.completionReport) return 1;
  return 0;
}

export const WORKFLOW_STEPS = [
  { label: '完了報告書受領',  sublabel: '業者から工事完了の報告を受領' },
  { label: '完了検査・検収',  sublabel: '発注者による施工確認の実施' },
  { label: '検収書発行',      sublabel: '業者に検収完了を通知・発行' },
  { label: '請求書受領',      sublabel: '業者から請求書を受領' },
  { label: '支払い完了',      sublabel: '業者への支払いを実行' },
];

// ─── サブコンポーネント: 写真行 ─────────────────────────────
function PhotoRow({ photos, onRemove }: { photos: string[]; onRemove: (i: number) => void }) {
  return (
    <div className="flex gap-2 flex-wrap mt-1.5">
      {photos.map((p, pi) => (
        <div key={pi} className="relative">
          <img src={p} alt="" className="h-14 w-14 object-cover rounded-lg border border-gray-700" />
          <button onClick={() => onRemove(pi)}
            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px] leading-none">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────────────────
export default function VendorWorkflowCard({
  vq, project, currentUserName, onShowToast, onOrderForm,
}: {
  vq:              VendorQuoteRequest;
  project:         Project;
  currentUserName: string;
  onShowToast:     (msg: string) => void;
  onOrderForm:     (vq: VendorQuoteRequest) => void;
}) {
  const step = getVendorWorkflowStep(vq);
  const [openStep, setOpenStep] = useState<number | null>(step < 5 ? step : null);
  const [loading,  setLoading]  = useState(false);

  // フォーム状態
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [reportNotes,  setReportNotes]  = useState('');
  const [inspResult,   setInspResult]   = useState<'pass' | 'fail'>('pass');
  const [inspNotes,    setInspNotes]    = useState('');
  const [invPhotoFiles, setInvPhotoFiles] = useState<{ file: File; preview: string }[]>([]);
  const [invDocs,        setInvDocs]      = useState<File[]>([]);
  const [invAmount,      setInvAmount]    = useState('');
  const [invNotes,       setInvNotes]     = useState('');
  const [invUploadProgress, setInvUploadProgress] = useState('');
  // 請求書OCRによる金額自動チェック（注文書金額との一致確認）
  const [invOcrAmount,   setInvOcrAmount]   = useState<number | null>(null);
  const [invOcrChecking, setInvOcrChecking] = useState(false);
  const [payDate,      setPayDate]      = useState(new Date().toISOString().split('T')[0]);

  const vendorUrl = `${window.location.origin}/?token=${vq.token}`;

  const addPhotos = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    try {
      const compressed = await Promise.all(files.map(f => compressImageToBase64(f)));
      setter(prev => [...prev, ...compressed].slice(0, 3));
    } catch { onShowToast('写真の処理に失敗しました'); }
    e.target.value = '';
  };

  const copyVendorUrl = () => {
    navigator.clipboard.writeText(vendorUrl).then(() => onShowToast('業者用URLをコピーしました'));
  };

  // 添付ファイルの金額をOCRで自動読み取りし、注文書の金額と照合する（最初の1ファイルのみ）
  const checkInvoiceAmount = async (file: File) => {
    setInvOcrChecking(true);
    try {
      const amount = await analyzeInvoiceAmount(file);
      setInvOcrAmount(amount);
      if (amount && !invAmount) setInvAmount(String(amount));
    } finally {
      setInvOcrChecking(false);
    }
  };

  const addInvoicePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const previews = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setInvPhotoFiles(prev => [...prev, ...previews].slice(0, 5));
    if (!invAmount && files[0]) checkInvoiceAmount(files[0]);
    e.target.value = '';
  };

  const addInvoiceDocs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf');
    if (files.some(f => f.size > 8 * 1024 * 1024)) { onShowToast('PDFは8MB以内にしてください'); return; }
    setInvDocs(prev => [...prev, ...files].slice(0, 3));
    if (!invAmount && files[0]) checkInvoiceAmount(files[0]);
    e.target.value = '';
  };

  // ── アクションハンドラ ──────────────────────────────────────
  const doRecordReport = async () => {
    if (!reportNotes.trim() && reportPhotos.length === 0) { onShowToast('メモまたは写真を入力してください'); return; }
    setLoading(true);
    try {
      await submitCompletionReport(vq.requestId, {
        photoUrls: reportPhotos, // スタッフ代理は base64 でも可（簡易）
        docUrls: [],
        notes: reportNotes,
        submittedAt: new Date().toISOString(), submittedVia: 'staff',
      });
      onShowToast('完了報告書を記録しました');
      setOpenStep(1); setReportPhotos([]); setReportNotes('');
    } catch { onShowToast('記録に失敗しました'); }
    finally { setLoading(false); }
  };

  const doRecordInspection = async () => {
    setLoading(true);
    try {
      await recordInspectionResult(vq.requestId, {
        result: inspResult, notes: inspNotes,
        inspectedAt: new Date().toISOString(), inspectedBy: currentUserName,
      });
      onShowToast(`検収「${inspResult === 'pass' ? '合格' : '不合格'}」を記録しました`);
      setOpenStep(2);
    } catch { onShowToast('記録に失敗しました'); }
    finally { setLoading(false); }
  };

  const doIssueAcceptanceCert = async () => {
    setLoading(true);
    try {
      await issueAcceptanceCert(vq.requestId, {
        issuedAt: new Date().toISOString(), issuedBy: currentUserName,
      });
      openPrintPreview(buildAcceptanceCertHtml(vq, project, currentUserName));
      onShowToast('検収書を発行しました');
      setOpenStep(3);
    } catch { onShowToast('発行に失敗しました'); }
    finally { setLoading(false); }
  };

  const doRecordInvoice = async () => {
    if (invPhotoFiles.length === 0 && invDocs.length === 0) { onShowToast('請求書の写真またはPDFを追加してください'); return; }
    setLoading(true);
    try {
      setInvUploadProgress('写真をアップロード中...');
      const photoUrls = await Promise.all(
        invPhotoFiles.map((p, i) => uploadVendorPhoto(p.file, `vendor-invoices/${vq.requestId}`, i))
      );
      setInvUploadProgress('書類をアップロード中...');
      const docUrls = await Promise.all(
        invDocs.map(f => uploadVendorDoc(f, `vendor-invoices/${vq.requestId}`))
      );
      await recordVendorInvoice(vq.requestId, {
        photoUrls, docUrls,
        amount: invAmount ? Number(invAmount.replace(/,/g, '')) : undefined,
        ocrAmount: invOcrAmount ?? undefined,
        notes: invNotes, receivedAt: new Date().toISOString(), submittedVia: 'staff',
      });
      onShowToast('請求書を受領記録しました');
      setOpenStep(4); setInvPhotoFiles([]); setInvDocs([]); setInvAmount(''); setInvNotes(''); setInvOcrAmount(null);
    } catch { onShowToast('記録に失敗しました'); }
    finally { setLoading(false); setInvUploadProgress(''); }
  };

  const doMarkPaid = async () => {
    setLoading(true);
    try {
      await markVendorPaid(vq.requestId, payDate);
      onShowToast(`${vq.vendorName ?? '業者'} への支払いを記録しました`);
      setOpenStep(null);
    } catch { onShowToast('記録に失敗しました'); }
    finally { setLoading(false); }
  };

  const doUnmarkPaid = async () => {
    setLoading(true);
    try {
      await unmarkVendorPaid(vq.requestId);
      onShowToast('支払い記録を取り消しました');
    } catch { onShowToast('操作に失敗しました'); }
    finally { setLoading(false); }
  };

  return (
    <div className={`bg-[#111A35] border ${step === 5 ? 'border-blue-700/30' : 'border-gray-800'} rounded-xl overflow-hidden`}>

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-800/60 flex items-center gap-2 flex-wrap">
        <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center
          ${step === 5 ? 'bg-blue-900/60 text-blue-300' : 'bg-gray-800 text-gray-400'}`}>
          {step === 5 ? <LucideCheck size={12} /> : <LucideBuilding2 size={10} />}
        </div>
        <p className="text-sm font-bold text-white flex-1 min-w-0 truncate">{vq.vendorName ?? '業者'}</p>
        <span className="text-sm font-mono font-bold text-white">¥{(vq.totalAmount ?? 0).toLocaleString()}</span>
        <button onClick={() => onOrderForm(vq)}
          className="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-700/30 hover:border-blue-700/60 px-2 py-0.5 rounded transition-colors flex items-center gap-0.5">
          <LucideFileText size={9} /> 注文書
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-gray-800/60 flex items-center gap-1">
        {WORKFLOW_STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors
            ${i < step ? 'bg-[#C5A059]' : i === step && step < 5 ? 'bg-blue-500' : 'bg-gray-800'}`} />
        ))}
        <span className="ml-2 text-[9px] text-gray-500 shrink-0">{step}/5</span>
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-800/40">
        {WORKFLOW_STEPS.map((s, i) => {
          const isDone   = i < step;
          const isActive = i === step && step < 5;
          const isFuture = i > step;
          const isOpen   = openStep === i;

          return (
            <div key={i} className={isDone ? 'bg-emerald-950/5' : isActive ? 'bg-blue-950/10' : ''}>
              <button
                className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-white/5 transition-colors disabled:cursor-not-allowed"
                onClick={() => !isFuture && setOpenStep(isOpen ? null : i)}
                disabled={isFuture}
              >
                <div className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold
                  ${isDone ? 'bg-[#C5A059]/20 text-[#C5A059]' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                  {isDone ? <LucideCheck size={9} /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isDone ? 'text-[#C5A059]' : isActive ? 'text-white' : 'text-gray-600'}`}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{s.sublabel}</p>
                </div>
                {isDone   && <span className="text-[9px] text-[#C5A059] shrink-0">完了</span>}
                {isActive && <span className="text-[9px] text-blue-400 shrink-0 animate-pulse">対応中</span>}
                {!isFuture && <LucideChevronDown size={12} className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-0.5 border-t border-gray-800/40">

                  {/* Step 0: 完了報告書受領 */}
                  {i === 0 && isDone && vq.completionReport && (
                    <div className="space-y-2 py-2">
                      <p className="text-[10px] text-gray-400">
                        {vq.completionReport.submittedVia === 'vendor' ? '業者が提出' : 'スタッフが記録'}
                        {' · '}{new Date(vq.completionReport.submittedAt).toLocaleDateString('ja-JP')}
                      </p>
                      {vq.completionReport.notes && (
                        <p className="text-[11px] text-gray-300 bg-gray-900/50 rounded-lg px-3 py-2">{vq.completionReport.notes}</p>
                      )}
                      {/* 現場写真 */}
                      {(vq.completionReport.photoUrls?.length ?? 0) > 0 && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {vq.completionReport.photoUrls!.map((url, pi) => (
                            <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="" className="h-16 w-full object-cover rounded-lg border border-gray-700 hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      )}
                      {/* 添付書類 */}
                      {(vq.completionReport.docUrls?.length ?? 0) > 0 && (
                        <div className="space-y-1">
                          {vq.completionReport.docUrls!.map((doc, di) => (
                            <a key={di} href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-blue-950/20 border border-blue-700/30 rounded-lg px-3 py-1.5 hover:border-blue-500/50 transition-colors">
                              <LucideFileText size={12} className="text-blue-400 shrink-0" />
                              <span className="flex-1 text-[11px] text-white truncate">{doc.name}</span>
                              <span className="text-[10px] text-gray-500 shrink-0">{doc.sizeMb}MB</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {i === 0 && !isDone && (
                    <div className="space-y-3 py-2">
                      <div className="bg-blue-950/20 border border-blue-700/20 rounded-lg px-3 py-2.5">
                        <p className="text-[10px] text-blue-300 mb-1.5 font-medium">業者がフォームから直接提出できます</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-[9px] text-gray-400 truncate">{vendorUrl}</code>
                          <button onClick={copyVendorUrl}
                            className="shrink-0 text-[10px] text-blue-400 hover:text-blue-300 border border-blue-700/40 px-2 py-0.5 rounded transition-colors flex items-center gap-1">
                            <LucideLink size={9} /> コピー
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500">または手動で記録する：</p>
                      <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                        <LucideCamera size={11} className="text-blue-400" /> 写真を追加（最大3枚）
                        <input type="file" accept="image/*" multiple className="hidden"
                          onChange={e => addPhotos(e, setReportPhotos)} />
                      </label>
                      {reportPhotos.length > 0 && (
                        <PhotoRow photos={reportPhotos} onRemove={i2 => setReportPhotos(p => p.filter((_, idx) => idx !== i2))} />
                      )}
                      <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)}
                        placeholder="完了報告のメモ（施工内容・確認事項など）" rows={2}
                        className="w-full bg-[#0A0F1D] border border-gray-700 text-white text-[11px] rounded-lg px-3 py-2 resize-none placeholder-gray-600" />
                      <button onClick={doRecordReport} disabled={loading}
                        className="w-full text-[11px] bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loading ? <LucideRefreshCw size={10} className="animate-spin" /> : <LucideCheck size={10} />} 完了報告を記録する
                      </button>
                    </div>
                  )}

                  {/* Step 1: 完了検査・検収 */}
                  {i === 1 && isDone && vq.inspectionResult && (
                    <div className="space-y-2 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full
                        ${vq.inspectionResult.result === 'pass' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                        {vq.inspectionResult.result === 'pass' ? '✓ 合格' : '✗ 不合格'}
                      </span>
                      <p className="text-[10px] text-gray-400">
                        {vq.inspectionResult.inspectedBy} · {new Date(vq.inspectionResult.inspectedAt).toLocaleDateString('ja-JP')}
                      </p>
                      {vq.inspectionResult.notes && (
                        <p className="text-[11px] text-gray-300 bg-gray-900/50 rounded-lg px-3 py-2">{vq.inspectionResult.notes}</p>
                      )}
                    </div>
                  )}
                  {i === 1 && !isDone && (
                    <div className="space-y-2 py-2">
                      <div className="flex gap-2">
                        {(['pass', 'fail'] as const).map(r => (
                          <button key={r} onClick={() => setInspResult(r)}
                            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-colors
                              ${inspResult === r
                                ? r === 'pass' ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-red-700 border-red-600 text-white'
                                : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                            {r === 'pass' ? '✓ 合格' : '✗ 不合格'}
                          </button>
                        ))}
                      </div>
                      <textarea value={inspNotes} onChange={e => setInspNotes(e.target.value)}
                        placeholder="検収メモ（確認内容・指摘事項など）" rows={2}
                        className="w-full bg-[#0A0F1D] border border-gray-700 text-white text-[11px] rounded-lg px-3 py-2 resize-none placeholder-gray-600" />
                      <button onClick={doRecordInspection} disabled={loading}
                        className="w-full text-[11px] bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loading ? <LucideRefreshCw size={10} className="animate-spin" /> : <LucideCheck size={10} />} 検収結果を記録する
                      </button>
                    </div>
                  )}

                  {/* Step 2: 検収書発行 */}
                  {i === 2 && isDone && vq.acceptanceCert && (
                    <div className="space-y-2 py-2">
                      <p className="text-[10px] text-gray-400">
                        {vq.acceptanceCert.issuedBy} が発行 · {new Date(vq.acceptanceCert.issuedAt).toLocaleDateString('ja-JP')}
                      </p>
                      <button onClick={() => openPrintPreview(buildAcceptanceCertHtml(vq, project, vq.acceptanceCert!.issuedBy))}
                        className="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-700/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                        <LucideFileText size={10} /> 検収書を再表示・印刷
                      </button>
                    </div>
                  )}
                  {i === 2 && !isDone && (
                    <div className="space-y-2 py-2">
                      <p className="text-[10px] text-gray-400">発行と同時に検収書のPDFプレビューが開きます。業者に送付してください。</p>
                      <button onClick={doIssueAcceptanceCert} disabled={loading}
                        className="w-full text-[11px] bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loading ? <LucideRefreshCw size={10} className="animate-spin" /> : <LucideFileText size={10} />} 検収書を発行する
                      </button>
                    </div>
                  )}

                  {/* Step 3: 請求書受領 */}
                  {i === 3 && isDone && vq.vendorInvoice && (
                    <div className="space-y-2 py-2">
                      <p className="text-[10px] text-gray-400">
                        {vq.vendorInvoice.submittedVia === 'vendor' ? '業者が提出' : 'スタッフが記録'}
                        {' · '}{new Date(vq.vendorInvoice.receivedAt).toLocaleDateString('ja-JP')}
                        {vq.vendorInvoice.amount && ` · ¥${vq.vendorInvoice.amount.toLocaleString()}`}
                      </p>
                      {vq.vendorInvoice.ocrAmount != null && (vq.totalAmount ?? 0) > 0 && (
                        vq.vendorInvoice.ocrAmount === vq.totalAmount ? (
                          <p className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                            <LucideCheckCircle2 size={11} /> 注文書の金額（¥{(vq.totalAmount ?? 0).toLocaleString()}）と一致しています
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
                            <LucideAlertCircle size={11} /> 注文書の金額（¥{(vq.totalAmount ?? 0).toLocaleString()}）と異なります（読取金額: ¥{vq.vendorInvoice.ocrAmount.toLocaleString()}）
                          </p>
                        )
                      )}
                      {vq.vendorInvoice.notes && (
                        <p className="text-[11px] text-gray-300 bg-gray-900/50 rounded-lg px-3 py-2">{vq.vendorInvoice.notes}</p>
                      )}
                      {(vq.vendorInvoice.photoUrls?.length ?? 0) > 0 && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {vq.vendorInvoice.photoUrls!.map((url, pi) => (
                            <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="" className="h-16 w-full object-cover rounded-lg border border-gray-700 hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      )}
                      {(vq.vendorInvoice.docUrls?.length ?? 0) > 0 && (
                        <div className="space-y-1">
                          {vq.vendorInvoice.docUrls!.map((doc, di) => (
                            <a key={di} href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-blue-950/20 border border-blue-700/30 rounded-lg px-3 py-1.5 hover:border-blue-500/50 transition-colors">
                              <LucideFileText size={12} className="text-blue-400 shrink-0" />
                              <span className="flex-1 text-[11px] text-white truncate">{doc.name}</span>
                              <span className="text-[10px] text-gray-500 shrink-0">{doc.sizeMb}MB</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {i === 3 && !isDone && (
                    <div className="space-y-3 py-2">
                      <div className="bg-blue-950/20 border border-blue-700/20 rounded-lg px-3 py-2.5">
                        <p className="text-[10px] text-blue-300 mb-1.5 font-medium">業者がフォームから直接提出できます</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-[9px] text-gray-400 truncate">{vendorUrl}</code>
                          <button onClick={copyVendorUrl}
                            className="shrink-0 text-[10px] text-blue-400 hover:text-blue-300 border border-blue-700/40 px-2 py-0.5 rounded transition-colors flex items-center gap-1">
                            <LucideLink size={9} /> コピー
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500">または手動で記録する：</p>
                      <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                        <LucideCamera size={11} className="text-blue-400" /> 請求書の写真を追加（最大5枚）
                        <input type="file" accept="image/*" multiple className="hidden" onChange={addInvoicePhotos} />
                      </label>
                      {invPhotoFiles.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {invPhotoFiles.map((p, pi) => (
                            <div key={pi} className="relative">
                              <img src={p.preview} alt="" className="h-14 w-14 object-cover rounded-lg border border-gray-700" />
                              <button onClick={() => setInvPhotoFiles(prev => prev.filter((_, idx) => idx !== pi))}
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px] leading-none">
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                        <LucidePaperclip size={11} className="text-blue-400" /> PDFを追加（最大3ファイル・8MB以内）
                        <input type="file" accept="application/pdf" multiple className="hidden" onChange={addInvoiceDocs} />
                      </label>
                      {invDocs.length > 0 && (
                        <div className="space-y-1">
                          {invDocs.map((f, di) => (
                            <div key={di} className="flex items-center gap-2 bg-blue-950/20 border border-blue-700/30 rounded-lg px-3 py-1.5">
                              <LucideFileText size={12} className="text-blue-400 shrink-0" />
                              <span className="flex-1 text-[11px] text-white truncate">{f.name}</span>
                              <span className="text-[10px] text-gray-500 shrink-0">{(f.size/1024/1024).toFixed(1)}MB</span>
                              <button onClick={() => setInvDocs(prev => prev.filter((_, idx) => idx !== di))}
                                className="text-gray-500 hover:text-red-400 transition-colors">
                                <LucideX size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <input type="text" value={invAmount} onChange={e => setInvAmount(e.target.value)}
                        placeholder="請求金額（任意・確認用）"
                        className="w-full bg-[#0A0F1D] border border-gray-700 text-white text-[11px] rounded-lg px-3 py-2 placeholder-gray-600" />
                      {/* 注文書金額との一致チェック（OCR自動読み取り） */}
                      {invOcrChecking && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                          <LucideRefreshCw size={10} className="animate-spin" /> 請求書の金額を確認しています...
                        </p>
                      )}
                      {!invOcrChecking && invOcrAmount != null && (vq.totalAmount ?? 0) > 0 && (
                        invOcrAmount === vq.totalAmount ? (
                          <p className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                            <LucideCheckCircle2 size={11} /> 注文書の金額（¥{(vq.totalAmount ?? 0).toLocaleString()}）と一致しています
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
                            <LucideAlertCircle size={11} /> 注文書の金額（¥{(vq.totalAmount ?? 0).toLocaleString()}）と読み取った金額（¥{invOcrAmount.toLocaleString()}）が異なります。ご確認ください。
                          </p>
                        )
                      )}
                      <textarea value={invNotes} onChange={e => setInvNotes(e.target.value)}
                        placeholder="メモ（請求内容・支払条件など）" rows={2}
                        className="w-full bg-[#0A0F1D] border border-gray-700 text-white text-[11px] rounded-lg px-3 py-2 resize-none placeholder-gray-600" />
                      <button onClick={doRecordInvoice} disabled={loading}
                        className="w-full text-[11px] bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loading ? <LucideRefreshCw size={10} className="animate-spin" /> : <LucideCheck size={10} />} {invUploadProgress || '請求書受領を記録する'}
                      </button>
                    </div>
                  )}

                  {/* Step 4: 支払い完了 */}
                  {i === 4 && isDone && vq.vendorPaid && (
                    <div className="space-y-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-blue-300 flex items-center gap-0.5">
                          <LucideCheck size={9} /> 支払済 {vq.vendorPaidAt ?? ''}
                        </span>
                        <button onClick={doUnmarkPaid} disabled={loading}
                          className="text-[10px] text-gray-500 hover:text-red-400 underline transition-colors disabled:opacity-50">
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                  {i === 4 && !isDone && (
                    <div className="space-y-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                          className="bg-[#0A0F1D] border border-gray-700 text-white text-[10px] rounded px-1.5 py-0.5" />
                        <button onClick={doMarkPaid} disabled={loading}
                          className="text-[10px] bg-blue-700 hover:bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-0.5">
                          {loading ? <LucideRefreshCw size={9} className="animate-spin" /> : <LucideCheck size={9} />} 支払済みにする
                        </button>
                      </div>
                      {vq.vendorPaymentDueDate && (
                        <p className="text-[10px] text-gray-500">支払予定日: {vq.vendorPaymentDueDate}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
