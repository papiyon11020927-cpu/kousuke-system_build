/**
 * VendorQuotePage — 業者向け見積回答フォーム（認証不要・公開）
 *
 * アクセス URL: /?token=<uuid>
 * ・ログイン不要で外部業者がアクセスできる
 * ・合計のみ / 明細入力 を業者が選択して送信
 * ・PDF / 画像アップロード対応（テキスト抽出で明細を自動補完）
 *   - デジタルPDF（テキスト埋め込みあり）: pdfjs-dist → parseItemsFromText
 *   - スキャンPDF / 画像: Gemini API でOCR → 明細をJSONで直接取得
 *
 * Gemini OCR: Cloud Functions (analyzeVendorDoc) 経由で実行
 * （APIキーはサーバー側の Firebase Secret Manager に保管・ブラウザには露出しない）
 */
import { useState, useEffect, useRef } from 'react';
import {
  LucideActivity, LucideCheckCircle2, LucideAlertCircle,
  LucidePlus, LucideTrash2, LucideClipboardList,
  LucideFileText, LucideUpload, LucideSparkles, LucideX,
  LucideCalendar, LucideRotateCcw, LucideImage, LucideCamera, LucideCheck,
  LucidePaperclip,
} from 'lucide-react';
import type { VendorQuoteRequest, VendorQuoteItem } from '@/types';
import {
  getVendorQuoteByToken, submitVendorQuote, uploadVendorQuotePdf,
  submitCompletionReport, recordVendorInvoice,
  uploadVendorPhoto, uploadVendorDoc, analyzeInvoiceAmount,
} from '@/services/vendorQuoteService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, fbFunctions } from '@/firebase/config';

/** 写真を WebP に圧縮して Firebase Storage にアップロード → URL を返す */
async function uploadCompletionPhoto(file: File, requestId: string, idx: number): Promise<string> {
  // 1. Canvas で WebP 圧縮（max 1280px, quality 0.75）
  const blob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = reject;
    img.onload = () => {
      const MAX_W = 1280;
      const scale = Math.min(1, MAX_W / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => {
        URL.revokeObjectURL(url);
        b ? resolve(b) : reject(new Error('toBlob failed'));
      }, 'image/webp', 0.75);
    };
    img.src = url;
  });
  // 2. Storage にアップロード
  const storageRef = ref(storage, `completion-reports/${requestId}/photo_${idx}_${Date.now()}.webp`);
  await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
  return getDownloadURL(storageRef);
}

/** PDF を Firebase Storage にアップロード → URL を返す */
async function uploadCompletionDoc(file: File, requestId: string): Promise<{ name: string; url: string; sizeMb: number }> {
  const storageRef = ref(storage, `completion-reports/${requestId}/doc_${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
  const url = await getDownloadURL(storageRef);
  return { name: file.name, url, sizeMb: Math.round(file.size / 1024 / 1024 * 10) / 10 };
}

// ─── Gemini OCR（スキャン画像・写真専用） ─────────────────────
// Cloud Functions (analyzeVendorDoc) 経由で実行。APIキーはサーバー側のみ。
interface GeminiOcrResult {
  items: VendorQuoteItem[];
  date:  string | null;
}

/** Gemini レスポンスのテキストから JSON を安全に抽出 */
function parseGeminiJson(raw: string): GeminiOcrResult {
  // マークダウンコードブロックを除去してからパース
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      items?: Array<Partial<VendorQuoteItem>>;
      date?:  string | null;
    };
    const items: VendorQuoteItem[] = (parsed.items ?? [])
      .filter((it): it is Partial<VendorQuoteItem> => !!it && typeof it.itemName === 'string')
      .map(it => ({
        itemName:  String(it.itemName ?? '').slice(0, 50),
        quantity:  Number(it.quantity  ?? 1),
        unit:      String(it.unit      ?? '式'),
        unitPrice: Math.round(Number(it.unitPrice ?? 0)),
        total:     Math.round(Number(it.total     ?? 0)),
      }))
      .filter(it => it.itemName.length > 0 && it.unitPrice > 0)
      .slice(0, 20);
    return { items, date: typeof parsed.date === 'string' ? parsed.date : null };
  } catch {
    return { items: [], date: null };
  }
}

// Gemini がサポートする画像 MIME タイプ
const GEMINI_SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png',
  'image/gif', 'image/webp', 'image/heic', 'image/heif',
]);

/**
 * BMP など Gemini 非対応フォーマットを PNG に変換する
 * 対応済み形式はそのまま返す
 */
async function normalizeImageForGemini(file: File): Promise<{ data: string; mimeType: string }> {
  const needsConvert = !GEMINI_SUPPORTED_IMAGE_TYPES.has(file.type);

  if (!needsConvert) {
    // そのまま base64 化
    const buf = await file.arrayBuffer();
    const base64 = btoa(Array.from(new Uint8Array(buf), b => String.fromCharCode(b)).join(''));
    return { data: base64, mimeType: file.type };
  }

  // Canvas 経由で PNG に変換（BMP / TIFF 等の非対応形式に対応）
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('画像変換に失敗しました')); return; }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          // "data:image/png;base64,XXXXX" → "XXXXX"
          resolve({ data: dataUrl.split(',')[1], mimeType: 'image/png' });
        };
        reader.onerror = () => reject(new Error('画像読み込みに失敗しました'));
        reader.readAsDataURL(blob);
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像の読み込みに失敗しました')); };
    img.src = url;
  });
}

// Cloud Functions 経由で Gemini OCR を実行（APIキーはサーバー側のみ）
const analyzeVendorDocFn = httpsCallable<
  { base64: string; mimeType: string },
  GeminiOcrResult
>(fbFunctions, 'analyzeVendorDoc');

async function analyzeFileWithGemini(file: File): Promise<GeminiOcrResult> {
  // BMP など Gemini 非対応形式は PNG に変換してから送信
  const { data: base64, mimeType } = await normalizeImageForGemini(file);
  const result = await analyzeVendorDocFn({ base64, mimeType });
  return result.data;
}

interface Props {
  token: string;
}

// ─── PDF テキスト抽出ユーティリティ ────────────────────────────
// pdfjs-dist を動的インポートし、PDF からテキストを抽出する
async function extractTextFromPdf(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  // public/ に配置したワーカーを使用（CDN不要・バージョン完全一致）
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const texts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // アイテムを行単位で結合（Y座標でグループ化して行を再現）
    const lines: Map<number, string[]> = new Map();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round((item as { transform: number[] }).transform[5]);
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push((item as { str: string }).str);
    }
    // Y座標降順（上から下）に並べてテキスト化
    const sortedLines = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, words]) => words.join(' '));
    texts.push(sortedLines.join('\n'));
  }
  return texts.join('\n\n');
}

// ─── テキストから見積明細を解析 ──────────────────────────────
function parseItemsFromText(text: string): VendorQuoteItem[] {
  // NFKC 正規化: CJK互換漢字（⼯→工、⾒→見 等）を標準漢字に変換
  const normalized = text.normalize('NFKC');
  const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items: VendorQuoteItem[] = [];

  // スキップ判定はスペースを詰めた文字列で実施
  // （PDF抽出時に字間へスペースが入る場合：「発 行 日」→「発行日」）
  const compact = (l: string) => l.replace(/\s+/g, '');
  // YYYY/MM/DD や YYYY-MM-DD 形式の日付行（ブラウザPDFヘッダー等）もスキップ
  const skipRe = /合計|小計|消費税|税込|税抜|税率|値引|割引|有効期限|御見積|見積番号|発行日|担当|住所|電話|^※|^注|工事名称.品目|品名.工事|数量単位|単価金額|Powered|blob:|年\d+月\d+日|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/;

  // ¥付き金額パターン（最優先）
  const yenAmountRe = /[¥￥]([\d,]+)/g;
  // 数量＋単位パターン（スペース任意）
  const qtyUnitRe = /(\d+)\s*(式|個|本|台|枚|箱|袋|ｍ|m|㎡|㎥|組|セット|ヶ所|箇所|か所)/;

  for (const line of lines) {
    if (skipRe.test(compact(line))) continue;

    // ¥ 付き金額を抽出（表形式PDFは単価・合計の順に並ぶ）
    const yenAmounts: number[] = [];
    let m: RegExpExecArray | null;
    yenAmountRe.lastIndex = 0;
    while ((m = yenAmountRe.exec(line)) !== null) {
      const val = parseInt(m[1].replace(/,/g, ''), 10);
      if (!isNaN(val) && val >= 100) yenAmounts.push(val);
    }

    // ¥付き金額がない場合、数字のみのパターンを補助的に使用
    // ※ 閾値を10,000円以上に設定して年号（2026等）の誤検出を防止
    const amounts = yenAmounts.length > 0 ? yenAmounts : (() => {
      const re = /([\d,]{4,})/g;
      const nums: number[] = [];
      let n: RegExpExecArray | null;
      while ((n = re.exec(line)) !== null) {
        const v = parseInt(n[1].replace(/,/g, ''), 10);
        // 年号(1900-2099)を除外しつつ、3,000円以上を拾う
        if (!isNaN(v) && v >= 3000 && !(v >= 1900 && v <= 2099)) nums.push(v);
      }
      return nums;
    })();

    if (amounts.length === 0) continue;

    // 表形式PDF: 最後の金額 = 行合計（単価・合計が並ぶ場合）
    // 単一金額: そのまま使用
    const totalAmount = amounts[amounts.length - 1];

    // 数量・単位を抽出
    const qMatch = qtyUnitRe.exec(line);
    const quantity = qMatch ? parseInt(qMatch[1], 10) : 1;
    const unit     = qMatch ? qMatch[2] : '式';

    // 品名: ¥金額 → スペース付き数量+単位 → 残り空白を整理
    // ※ /\s+\d+\s*(式|台|...)\s*/ で " 1 式 " を丸ごと除去
    let itemName = line
      .replace(/[¥￥][\d,]+/g, '')  // ¥金額除去
      .replace(/\s+\d+\s*(式|個|本|台|枚|箱|袋|ｍ|m|㎡|㎥|組|セット|ヶ所|箇所|か所)\s*/g, ' ') // " 1 式 " 除去
      .replace(/\s+/g, ' ')
      .trim();

    if (!itemName || itemName.length < 2) continue;

    items.push({
      itemName:  itemName.slice(0, 50),
      quantity,
      unit,
      unitPrice: totalAmount,
      total:     quantity * totalAmount,
    });
  }

  return items.slice(0, 20); // 最大20行
}

// ─── PDF から発行日を抽出 ─────────────────────────────────────
// 見積書の発行日をテキストから読み取り、ファイル誤選択の気づきに使う
function extractDateFromText(text: string): string | null {
  const normalized = text.normalize('NFKC');
  // 「発行日：2026年5月30日」のような和暦パターンを優先
  const jpM = normalized.match(/発.{0,4}日[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/);
  if (jpM) return jpM[1];
  // フォールバック: テキスト内の最初の「YYYY年M月D日」
  const anyJp = normalized.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
  if (anyJp) return anyJp[1];
  // YYYY/MM/DD 形式
  const slash = normalized.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) return `${slash[1]}/${slash[2]}/${slash[3]}`;
  return null;
}

export default function VendorQuotePage({ token }: Props) {
  const [request,  setRequest]  = useState<VendorQuoteRequest | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ─── フォーム状態 ───────────────────────────────────────────
  const [quoteType,    setQuoteType]    = useState<'total' | 'itemized'>('total');
  const [totalInput,   setTotalInput]   = useState('');
  const [items,        setItems]        = useState<VendorQuoteItem[]>([emptyItem()]);
  const [vendorNote,   setVendorNote]   = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [submitError,  setSubmitError]  = useState('');

  // ─── PDF 状態 ────────────────────────────────────────────────
  const [pdfFile,         setPdfFile]         = useState<File | null>(null);
  const [pdfParsing,      setPdfParsing]       = useState(false);
  const [pdfParseMsg,     setPdfParseMsg]      = useState('');
  const [pdfDate,         setPdfDate]          = useState<string | null>(null); // 見積書発行日
  const [showClearConfirm, setShowClearConfirm] = useState(false);              // 明細一括クリア確認
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 送信後に表示する確認データ（金額0円バグ修正）──────────
  const [submittedData, setSubmittedData] = useState<{
    totalAmount: number;
    quoteType: 'total' | 'itemized';
  } | null>(null);

  // ─── 完了報告書フォーム（status=accepted の業者向け） ────────
  const [reportPhotoFiles, setReportPhotoFiles] = useState<{ file: File; preview: string }[]>([]);
  const [reportDocs,       setReportDocs]       = useState<File[]>([]);
  const [reportNotes,      setReportNotes]      = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportUploadProgress, setReportUploadProgress] = useState('');
  const [reportSubmitted,  setReportSubmitted]  = useState(false);
  const [reportError,      setReportError]      = useState('');

  // ─── 請求書提出フォーム（検収書発行後の業者向け） ────────────
  const [invoicePhotoFiles, setInvoicePhotoFiles] = useState<{ file: File; preview: string }[]>([]);
  const [invoiceDocs,       setInvoiceDocs]       = useState<File[]>([]);
  const [invoiceAmount,     setInvoiceAmount]     = useState('');
  const [invoiceNotes,      setInvoiceNotes]      = useState('');
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceUploadProgress, setInvoiceUploadProgress] = useState('');
  const [invoiceSubmitted,  setInvoiceSubmitted]  = useState(false);
  const [invoiceError,      setInvoiceError]      = useState('');
  // 請求書OCRによる金額自動チェック（注文書金額との一致確認）
  const [invoiceOcrAmount,  setInvoiceOcrAmount]  = useState<number | null>(null);
  const [invoiceOcrChecking, setInvoiceOcrChecking] = useState(false);

  // ─── トークンで依頼を取得 ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const req = await getVendorQuoteByToken(token);
        if (cancelled) return;
        if (!req) { setNotFound(true); }
        else {
          setRequest(req);
          if (req.status === 'submitted' || req.status === 'accepted' || req.status === 'rejected') {
            setSubmittedData({
              totalAmount: req.totalAmount ?? 0,
              quoteType:   req.quoteType ?? 'total',
            });
            setSubmitted(true);
          }
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('permission') || msg.includes('Missing')) {
          console.error('[VendorQuotePage] Firestore access error:', err);
        }
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [token]);

  // ─── 明細ヘルパー ────────────────────────────────────────────
  function emptyItem(): VendorQuoteItem {
    return { itemName: '', quantity: 1, unit: '式', unitPrice: 0, total: 0 };
  }
  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i: number) =>
    setItems(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  const updateItem = (i: number, patch: Partial<VendorQuoteItem>) =>
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      next.total = next.quantity * next.unitPrice;
      return next;
    }));

  const itemizedTotal = items.reduce((s, it) => s + it.total, 0);
  const displayTotal  = quoteType === 'itemized' ? itemizedTotal : Number(totalInput) || 0;

  // ─── ファイル種別判定 ─────────────────────────────────────────
  const ACCEPTED_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'image/heic', 'image/heif', 'image/tiff',
  ];
  const isImageFile = (f: File) => f.type.startsWith('image/');

  // ─── ファイル選択・テキスト抽出 ──────────────────────────────
  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      setPdfParseMsg('PDF または 画像ファイル（jpg/png/heic等）を選択してください。');
      return;
    }
    // 20MB 制限（画像は大きくなりやすいため緩和）
    if (file.size > 20 * 1024 * 1024) {
      setPdfParseMsg('ファイルサイズは20MB以下にしてください。');
      return;
    }
    setPdfFile(file);
    setPdfParsing(true);
    setPdfParseMsg('');
    setPdfDate(null);
    try {
      if (isImageFile(file)) {
        // ── 画像ファイル → Gemini OCR（構造化抽出）────────────────
        const geminiResult = await analyzeFileWithGemini(file);
        setPdfDate(geminiResult.date);
        if (geminiResult.items.length > 0) {
          setItems(geminiResult.items);
          setQuoteType('itemized');
          setPdfParseMsg(`${geminiResult.items.length}件の明細を読み取りました（Gemini AI）。内容を確認・修正してください。`);
        } else {
          setPdfParseMsg('明細を自動読み取りできませんでした。手動で入力してください。');
        }
      } else {
        // ── PDF → まずpdfjs-distでテキスト抽出（デジタルPDF高速）─
        const text = await extractTextFromPdf(file);

        if (text.trim().length >= 30) {
          // テキスト埋め込みあり → 既存パーサーで処理
          setPdfDate(extractDateFromText(text));
          const parsed = parseItemsFromText(text);
          if (parsed.length > 0) {
            setItems(parsed);
            setQuoteType('itemized');
            setPdfParseMsg(`${parsed.length}件の明細を読み取りました。内容を確認・修正してください。`);
          } else {
            setPdfParseMsg('明細を自動読み取りできませんでした。手動で入力してください。');
          }
        } else {
          // テキスト空 → スキャンPDF → Gemini OCR にフォールバック
          setPdfParseMsg('スキャンPDFを検出。Gemini AI で解析しています...');
          const geminiResult = await analyzeFileWithGemini(file);
          setPdfDate(geminiResult.date);
          if (geminiResult.items.length > 0) {
            setItems(geminiResult.items);
            setQuoteType('itemized');
            setPdfParseMsg(`${geminiResult.items.length}件の明細を読み取りました（Gemini AI）。内容を確認・修正してください。`);
          } else {
            setPdfParseMsg('明細を自動読み取りできませんでした。手動で入力してください。');
          }
        }
      }
    } catch (err) {
      console.error('File parse error:', err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('ocrImage') || msg.includes('Gemini') || msg.includes('INTERNAL')) {
        setPdfParseMsg('Gemini OCR に失敗しました。Cloud Functions が未デプロイの可能性があります。手動で入力してください。');
      } else {
        setPdfParseMsg('ファイルの読み取りに失敗しました。手動で入力してください。');
      }
    } finally {
      setPdfParsing(false);
    }
  };

  const clearPdf = () => {
    setPdfFile(null);
    setPdfParseMsg('');
    setPdfDate(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── 送信処理 ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!request) return;
    const amount = quoteType === 'total'
      ? Number(totalInput)
      : itemizedTotal;

    if (!amount || amount <= 0) {
      setSubmitError('金額を正しく入力してください。');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      // PDF があれば先にアップロード
      let pdfUrl: string | undefined;
      if (pdfFile) {
        pdfUrl = await uploadVendorQuotePdf(request.requestId, pdfFile);
      }

      await submitVendorQuote(
        request.requestId,
        quoteType,
        amount,
        quoteType === 'itemized' ? items : undefined,
        vendorNote || undefined,
        pdfUrl,
        request.vendorName,
        request.projectTitle,
      );

      // 送信後の確認画面用に金額を保持（Firestore 再取得不要）
      setSubmittedData({ totalAmount: amount, quoteType });
      setSubmitted(true);
    } catch {
      setSubmitError('送信に失敗しました。もう一度お試しください。');
      setSubmitting(false);
    }
  };

  // ─── ローディング ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center">
        <LucideActivity size={24} className="text-[#C5A059] animate-spin" />
      </div>
    );
  }

  // ─── 未発見 ──────────────────────────────────────────────────
  if (notFound || !request) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center p-6">
        <div className="bg-[#111A35] border border-red-700/40 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <LucideAlertCircle size={36} className="text-red-400 mx-auto" />
          <h2 className="text-base font-bold text-white">URLが無効または期限切れです</h2>
          <p className="text-xs text-gray-400">
            このリンクは存在しないか、既に無効化されています。<br />
            担当者にご確認ください。
          </p>
        </div>
      </div>
    );
  }

  // ─── 送信済み画面 ────────────────────────────────────────────
  if (submitted && submittedData) {
    const isAccepted = request.status === 'accepted';
    const alreadyReportedOnLoad = !!request.completionReport;
    const hasAcceptanceCert = !!request.acceptanceCert;
    const alreadyInvoicedOnLoad = !!request.vendorInvoice;

    // 完了報告書の送信ハンドラ
    const handleSubmitReport = async () => {
      if (!reportNotes.trim() && reportPhotoFiles.length === 0) {
        setReportError('写真またはメモを入力してください');
        return;
      }
      setReportSubmitting(true);
      setReportError('');
      try {
        // 写真を圧縮してアップロード
        setReportUploadProgress('写真をアップロード中...');
        const photoUrls = await Promise.all(
          reportPhotoFiles.map((p, i) => uploadCompletionPhoto(p.file, request.requestId, i))
        );
        // PDF をアップロード
        setReportUploadProgress('書類をアップロード中...');
        const docUrls = await Promise.all(
          reportDocs.map(f => uploadCompletionDoc(f, request.requestId))
        );
        setReportUploadProgress('送信中...');
        await submitCompletionReport(request.requestId, {
          photoUrls,
          docUrls,
          notes:        reportNotes,
          submittedAt:  new Date().toISOString(),
          submittedVia: 'vendor',
        });
        setReportSubmitted(true);
      } catch {
        setReportError('送信に失敗しました。時間をおいて再度お試しください。');
      } finally {
        setReportSubmitting(false);
        setReportUploadProgress('');
      }
    };

    const addReportPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const previews = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
      setReportPhotoFiles(prev => [...prev, ...previews].slice(0, 8));
      e.target.value = '';
    };

    const addReportDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf');
      if (files.some(f => f.size > 8 * 1024 * 1024)) {
        setReportError('PDFは8MB以内にしてください');
        return;
      }
      setReportDocs(prev => [...prev, ...files].slice(0, 3));
      e.target.value = '';
    };

    // 請求書の送信ハンドラ
    const handleSubmitInvoice = async () => {
      if (invoicePhotoFiles.length === 0 && invoiceDocs.length === 0) {
        setInvoiceError('請求書の写真またはPDFを添付してください');
        return;
      }
      setInvoiceSubmitting(true);
      setInvoiceError('');
      try {
        setInvoiceUploadProgress('写真をアップロード中...');
        const photoUrls = await Promise.all(
          invoicePhotoFiles.map((p, i) => uploadVendorPhoto(p.file, `vendor-invoices/${request.requestId}`, i))
        );
        setInvoiceUploadProgress('書類をアップロード中...');
        const docUrls = await Promise.all(
          invoiceDocs.map(f => uploadVendorDoc(f, `vendor-invoices/${request.requestId}`))
        );
        setInvoiceUploadProgress('送信中...');
        await recordVendorInvoice(request.requestId, {
          photoUrls,
          docUrls,
          amount:       invoiceAmount ? Number(invoiceAmount) : undefined,
          ocrAmount:    invoiceOcrAmount ?? undefined,
          notes:        invoiceNotes,
          receivedAt:   new Date().toISOString(),
          submittedVia: 'vendor',
        });
        setInvoiceSubmitted(true);
      } catch {
        setInvoiceError('送信に失敗しました。時間をおいて再度お試しください。');
      } finally {
        setInvoiceSubmitting(false);
        setInvoiceUploadProgress('');
      }
    };

    // 添付ファイルの金額をOCRで自動読み取りし、注文書の金額と照合する（最初の1ファイルのみ）
    const checkInvoiceAmount = async (file: File) => {
      setInvoiceOcrChecking(true);
      try {
        const amount = await analyzeInvoiceAmount(file);
        setInvoiceOcrAmount(amount);
        if (amount && !invoiceAmount) setInvoiceAmount(String(amount));
      } finally {
        setInvoiceOcrChecking(false);
      }
    };

    const addInvoicePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const previews = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
      setInvoicePhotoFiles(prev => [...prev, ...previews].slice(0, 8));
      if (!invoiceAmount && files[0]) checkInvoiceAmount(files[0]);
      e.target.value = '';
    };

    const addInvoiceDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf');
      if (files.some(f => f.size > 8 * 1024 * 1024)) {
        setInvoiceError('PDFは8MB以内にしてください');
        return;
      }
      setInvoiceDocs(prev => [...prev, ...files].slice(0, 3));
      if (!invoiceAmount && files[0]) checkInvoiceAmount(files[0]);
      e.target.value = '';
    };

    return (
      <div className="min-h-screen bg-[#0A0F1D] p-6 flex flex-col items-center gap-6">
        {/* 見積受付済みカード */}
        <div className="bg-[#111A35] border border-emerald-700/40 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <LucideCheckCircle2 size={40} className="text-emerald-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">見積を受け付けました</h2>
          <p className="text-xs text-gray-400">
            ご回答ありがとうございます。<br />
            内容を確認のうえ、担当者よりご連絡いたします。
          </p>
          <div className="bg-[#0B132B] rounded-lg p-4 text-left space-y-2 text-xs text-gray-300 border border-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-500">案件</span>
              <span className="font-medium text-white">{request.projectTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">業者名</span>
              <span className="font-medium">{request.vendorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">入力方式</span>
              <span>{submittedData.quoteType === 'itemized' ? '明細入力' : '合計のみ'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">見積金額</span>
              <span className="font-bold text-[#E6C687] text-base">
                ¥{submittedData.totalAmount.toLocaleString()}
              </span>
            </div>
            {pdfFile && (
              <div className="flex justify-between">
                <span className="text-gray-500">添付PDF</span>
                <span className="text-emerald-400">✓ アップロード済み</span>
              </div>
            )}
          </div>
          {!isAccepted && (
            <p className="text-[10px] text-gray-600">このページは閉じていただいて構いません。</p>
          )}
        </div>

        {/* 工事完了報告書フォーム（見積承認後のみ表示） */}
        {isAccepted && (
          alreadyReportedOnLoad || reportSubmitted ? (
            <div className="bg-[#111A35] border border-blue-700/30 rounded-xl p-6 max-w-md w-full text-center space-y-3">
              <LucideCheck size={32} className="text-blue-400 mx-auto" />
              <h3 className="text-base font-bold text-white">工事完了報告書を提出済みです</h3>
              <p className="text-xs text-gray-400">
                担当者が内容を確認後、検収を行います。<br />
                検収書の発行後、請求書をご提出ください。
              </p>
            </div>
          ) : (
            <div className="bg-[#111A35] border border-[#C5A059]/40 rounded-xl p-6 max-w-md w-full space-y-4">
              <div className="text-center">
                <h3 className="text-base font-bold text-white">工事完了報告書の提出</h3>
                <p className="text-xs text-gray-400 mt-1">
                  施工が完了しましたら、写真とメモを添えてご報告ください。<br />
                  担当者が確認後、検収書を発行いたします。
                </p>
              </div>

              {/* 現場写真 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#C5A059] flex items-center gap-1.5">
                    <LucideCamera size={14} /> 現場写真
                    <span className="text-[10px] text-gray-500 font-normal">（最大8枚・自動圧縮）</span>
                  </span>
                  {reportPhotoFiles.length < 8 && (
                    <label className="cursor-pointer text-xs text-[#C5A059] hover:text-[#E6C687] border border-[#C5A059]/40 px-2.5 py-1 rounded-lg transition-colors">
                      ＋ 写真を追加
                      <input type="file" accept="image/*" multiple className="hidden" onChange={addReportPhoto} />
                    </label>
                  )}
                </div>
                {reportPhotoFiles.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {reportPhotoFiles.map((p, pi) => (
                      <div key={pi} className="relative aspect-square">
                        <img src={p.preview} alt="" className="h-full w-full object-cover rounded-lg border border-gray-700" />
                        <button onClick={() => setReportPhotoFiles(prev => prev.filter((_, i) => i !== pi))}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold shadow">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 py-6 border border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-[#C5A059]/50 transition-colors">
                    <LucideImage size={24} className="text-gray-600" />
                    <span className="text-xs text-gray-500">タップして写真を選択</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={addReportPhoto} />
                  </label>
                )}
              </div>

              {/* 書類添付（PDF） */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-400 flex items-center gap-1.5">
                    <LucidePaperclip size={14} /> 書類添付
                    <span className="text-[10px] text-gray-500 font-normal">（PDF・最大3ファイル・8MB以内）</span>
                  </span>
                  {reportDocs.length < 3 && (
                    <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300 border border-blue-700/40 px-2.5 py-1 rounded-lg transition-colors">
                      ＋ PDF を追加
                      <input type="file" accept="application/pdf" multiple className="hidden" onChange={addReportDoc} />
                    </label>
                  )}
                </div>
                {reportDocs.length > 0 && (
                  <div className="space-y-1.5">
                    {reportDocs.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-blue-950/20 border border-blue-700/30 rounded-lg px-3 py-2">
                        <LucideFileText size={14} className="text-blue-400 shrink-0" />
                        <span className="flex-1 text-xs text-white truncate">{f.name}</span>
                        <span className="text-[10px] text-gray-500 shrink-0">{(f.size/1024/1024).toFixed(1)}MB</span>
                        <button onClick={() => setReportDocs(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-500 hover:text-red-400 transition-colors">
                          <LucideX size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* メモ */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">完了内容・特記事項</label>
                <textarea
                  value={reportNotes}
                  onChange={e => setReportNotes(e.target.value)}
                  placeholder="施工内容の概要、確認いただきたい点など"
                  rows={4}
                  className="w-full bg-[#0A0F1D] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 resize-none placeholder-gray-600 focus:outline-none focus:border-[#C5A059]/60"
                />
              </div>

              {reportError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <LucideAlertCircle size={12} /> {reportError}
                </p>
              )}

              <button
                onClick={handleSubmitReport}
                disabled={reportSubmitting}
                className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {reportSubmitting
                  ? <><LucideActivity size={14} className="animate-spin" /> {reportUploadProgress || '送信中...'}</>
                  : <><LucideCheck size={14} /> 工事完了報告書を提出する</>
                }
              </button>
            </div>
          )
        )}

        {/* 請求書提出フォーム（検収書発行後のみ表示） */}
        {hasAcceptanceCert && (
          alreadyInvoicedOnLoad || invoiceSubmitted ? (
            <div className="bg-[#111A35] border border-blue-700/30 rounded-xl p-6 max-w-md w-full text-center space-y-3">
              <LucideCheck size={32} className="text-blue-400 mx-auto" />
              <h3 className="text-base font-bold text-white">請求書を提出済みです</h3>
              <p className="text-xs text-gray-400">
                担当者が内容を確認後、お支払いを行います。
              </p>
              {(() => {
                const ocrAmount = request.vendorInvoice?.ocrAmount ?? (invoiceSubmitted ? invoiceOcrAmount : null);
                const orderAmount = request.totalAmount ?? 0;
                if (ocrAmount == null || orderAmount <= 0) return null;
                return ocrAmount === orderAmount ? (
                  <p className="text-xs text-emerald-400 flex items-center justify-center gap-1.5">
                    <LucideCheckCircle2 size={12} /> 注文書の金額（¥{orderAmount.toLocaleString()}）と一致しています
                  </p>
                ) : (
                  <p className="text-xs text-amber-400 flex items-center justify-center gap-1.5">
                    <LucideAlertCircle size={12} /> 注文書の金額（¥{orderAmount.toLocaleString()}）と異なります（読取金額: ¥{ocrAmount.toLocaleString()}）
                  </p>
                );
              })()}
            </div>
          ) : (
            <div className="bg-[#111A35] border border-[#C5A059]/40 rounded-xl p-6 max-w-md w-full space-y-4">
              <div className="text-center">
                <h3 className="text-base font-bold text-white">請求書のご提出</h3>
                <p className="text-xs text-gray-400 mt-1">
                  検収が完了しました。請求書の写真またはPDFをご提出ください。
                </p>
              </div>

              {/* 請求書写真 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#C5A059] flex items-center gap-1.5">
                    <LucideCamera size={14} /> 請求書写真
                    <span className="text-[10px] text-gray-500 font-normal">（最大8枚・自動圧縮）</span>
                  </span>
                  {invoicePhotoFiles.length < 8 && (
                    <label className="cursor-pointer text-xs text-[#C5A059] hover:text-[#E6C687] border border-[#C5A059]/40 px-2.5 py-1 rounded-lg transition-colors">
                      ＋ 写真を追加
                      <input type="file" accept="image/*" multiple className="hidden" onChange={addInvoicePhoto} />
                    </label>
                  )}
                </div>
                {invoicePhotoFiles.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {invoicePhotoFiles.map((p, pi) => (
                      <div key={pi} className="relative aspect-square">
                        <img src={p.preview} alt="" className="h-full w-full object-cover rounded-lg border border-gray-700" />
                        <button onClick={() => setInvoicePhotoFiles(prev => prev.filter((_, i) => i !== pi))}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold shadow">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 py-6 border border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-[#C5A059]/50 transition-colors">
                    <LucideImage size={24} className="text-gray-600" />
                    <span className="text-xs text-gray-500">タップして写真を選択</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={addInvoicePhoto} />
                  </label>
                )}
              </div>

              {/* 書類添付（PDF） */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-400 flex items-center gap-1.5">
                    <LucidePaperclip size={14} /> 書類添付
                    <span className="text-[10px] text-gray-500 font-normal">（PDF・最大3ファイル・8MB以内）</span>
                  </span>
                  {invoiceDocs.length < 3 && (
                    <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300 border border-blue-700/40 px-2.5 py-1 rounded-lg transition-colors">
                      ＋ PDF を追加
                      <input type="file" accept="application/pdf" multiple className="hidden" onChange={addInvoiceDoc} />
                    </label>
                  )}
                </div>
                {invoiceDocs.length > 0 && (
                  <div className="space-y-1.5">
                    {invoiceDocs.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-blue-950/20 border border-blue-700/30 rounded-lg px-3 py-2">
                        <LucideFileText size={14} className="text-blue-400 shrink-0" />
                        <span className="flex-1 text-xs text-white truncate">{f.name}</span>
                        <span className="text-[10px] text-gray-500 shrink-0">{(f.size/1024/1024).toFixed(1)}MB</span>
                        <button onClick={() => setInvoiceDocs(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-500 hover:text-red-400 transition-colors">
                          <LucideX size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 請求金額 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">請求金額（任意）</label>
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmount(e.target.value)}
                  placeholder="例: 500000"
                  className="w-full bg-[#0A0F1D] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-[#C5A059]/60"
                />
              </div>

              {/* 注文書金額との一致チェック（OCR自動読み取り） */}
              {invoiceOcrChecking && (
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <LucideActivity size={12} className="animate-spin" /> 請求書の金額を確認しています...
                </p>
              )}
              {!invoiceOcrChecking && invoiceOcrAmount != null && (request.totalAmount ?? 0) > 0 && (
                invoiceOcrAmount === request.totalAmount ? (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <LucideCheckCircle2 size={12} /> 注文書の金額（¥{(request.totalAmount ?? 0).toLocaleString()}）と一致しています
                  </p>
                ) : (
                  <p className="text-xs text-amber-400 flex items-center gap-1.5">
                    <LucideAlertCircle size={12} /> 注文書の金額（¥{(request.totalAmount ?? 0).toLocaleString()}）と読み取った金額（¥{invoiceOcrAmount.toLocaleString()}）が異なります。ご確認ください。
                  </p>
                )
              )}

              {/* メモ */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">備考</label>
                <textarea
                  value={invoiceNotes}
                  onChange={e => setInvoiceNotes(e.target.value)}
                  placeholder="請求内容に関する補足事項など"
                  rows={3}
                  className="w-full bg-[#0A0F1D] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 resize-none placeholder-gray-600 focus:outline-none focus:border-[#C5A059]/60"
                />
              </div>

              {invoiceError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <LucideAlertCircle size={12} /> {invoiceError}
                </p>
              )}

              <button
                onClick={handleSubmitInvoice}
                disabled={invoiceSubmitting}
                className="w-full bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {invoiceSubmitting
                  ? <><LucideActivity size={14} className="animate-spin" /> {invoiceUploadProgress || '送信中...'}</>
                  : <><LucideCheck size={14} /> 請求書を提出する</>
                }
              </button>
            </div>
          )
        )}
      </div>
    );
  }

  // 期限チェック
  const isOverdue = request.dueDate && new Date(request.dueDate) < new Date();

  // ─── フォーム画面 ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0F1D] text-[#E2E8F0]">

      {/* 明細一括クリア 確認ダイアログ */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-[#111A35] border border-red-700/50 rounded-2xl p-6 max-w-xs w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <LucideRotateCcw size={16} className="text-red-400" />
              <h3 className="text-sm font-bold text-white">明細を一括クリア</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              現在入力されている明細（{items.length}件）をすべて削除します。<br />
              この操作は元に戻せません。
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-600 text-gray-300 hover:border-gray-400 transition"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  setItems([emptyItem()]);
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-700 hover:bg-red-600 text-white transition"
              >
                クリアする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-[#0B132B]/95 border-b border-[#C5A059]/20 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-[#C5A059] to-[#E6C687] flex items-center justify-center shadow">
            <span className="text-white font-extrabold text-lg">住</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">住良建設</h1>
            <p className="text-[10px] text-gray-400">業者見積回答フォーム</p>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">

        {/* 依頼情報カード */}
        <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] text-[#C5A059] font-mono mb-0.5">見積依頼</p>
              <h2 className="text-base font-bold text-white">{request.projectTitle}</h2>
            </div>
            {isOverdue && (
              <span className="shrink-0 text-[10px] bg-red-900/40 text-red-300 border border-red-700/40 px-2 py-0.5 rounded-full">
                期限超過
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500 text-[10px]">宛先業者</span>
              <p className="font-medium text-white">{request.vendorName}</p>
            </div>
            {request.dueDate && (
              <div>
                <span className="text-gray-500 text-[10px]">回答期限</span>
                <p className={`font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>
                  {request.dueDate}
                </p>
              </div>
            )}
          </div>
          <div>
            <span className="text-gray-500 text-[10px]">依頼内容・作業範囲</span>
            <p className="mt-1 text-sm text-gray-200 bg-[#0B132B] rounded-lg p-3 border border-gray-800 whitespace-pre-wrap">
              {request.workScope}
            </p>
          </div>
          {request.requestNote && (
            <div>
              <span className="text-gray-500 text-[10px]">担当者メモ</span>
              <p className="mt-1 text-xs text-gray-400 italic">{request.requestNote}</p>
            </div>
          )}
        </div>

        {/* PDF アップロード */}
        <div className="bg-[#111A35] border border-gray-700 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideFileText size={14} className="text-blue-400" />
            見積書PDF（任意）
          </h3>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            PDFや写真を添付するとテキスト情報から明細を自動補完します。<br />
            <span className="text-yellow-500/80">
              ※ 単価・金額に <span className="font-bold">¥ マーク</span>が付いている明細が抽出対象です。
            </span>
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-600">
            <span className="flex items-center gap-1"><LucideFileText size={9} className="text-blue-500" /> デジタルPDF — テキスト直接抽出</span>
            <span className="flex items-center gap-1"><LucideImage size={9} className="text-emerald-500" /> スキャン/写真 — Gemini AI 解析</span>
          </div>

          {!pdfFile ? (
            <label className="flex items-center justify-center gap-2 border border-dashed border-blue-700/40 hover:border-blue-500 text-blue-400 hover:text-blue-300 text-xs font-bold py-3 rounded-lg transition cursor-pointer">
              <LucideUpload size={14} />
              <span>PDF または 画像を選択（最大20MB）</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handlePdfSelect}
              />
            </label>
          ) : (
            <div className="flex items-center gap-2 bg-[#0B132B] border border-blue-700/30 rounded-lg px-3 py-2">
              <LucideFileText size={14} className="text-blue-400 shrink-0" />
              <span className="text-xs text-white flex-1 truncate">{pdfFile.name}</span>
              <span className="text-[10px] text-gray-500 shrink-0">
                {(pdfFile.size / 1024).toFixed(0)}KB
              </span>
              <button
                onClick={clearPdf}
                className="text-gray-500 hover:text-red-400 transition shrink-0"
              >
                <LucideX size={13} />
              </button>
            </div>
          )}

          {pdfParsing && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <LucideActivity size={12} className="animate-spin" />
              <span>ファイルを解析中...</span>
            </div>
          )}

          {/* 見積書発行日 — ファイルの誤選択に気づけるよう表示 */}
          {pdfDate && !pdfParsing && (
            <div className="flex items-center gap-1.5 text-[11px] text-sky-400 bg-sky-950/30 border border-sky-700/30 rounded-lg px-3 py-1.5">
              <LucideCalendar size={11} />
              <span>見積書発行日：<span className="font-semibold">{pdfDate}</span></span>
              <span className="text-sky-600 ml-1">— 正しいファイルか確認してください</span>
            </div>
          )}

          {pdfParseMsg && !pdfParsing && (
            <p className={`text-[11px] flex items-center gap-1.5 ${
              pdfParseMsg.includes('読み取りました')
                ? 'text-emerald-400'
                : 'text-yellow-400'
            }`}>
              <LucideSparkles size={11} />
              {pdfParseMsg}
            </p>
          )}
        </div>

        {/* 見積入力フォーム */}
        <div className="bg-[#111A35] border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LucideClipboardList size={14} className="text-[#C5A059]" />
            見積金額の入力
          </h3>

          {/* 入力方式選択 */}
          <div className="flex gap-2">
            {(['total', 'itemized'] as const).map(t => (
              <button
                key={t}
                onClick={() => setQuoteType(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition border ${
                  quoteType === t
                    ? 'bg-[#C5A059]/15 text-[#E6C687] border-[#C5A059]/60'
                    : 'text-gray-400 border-gray-700 hover:border-gray-500'
                }`}
              >
                {t === 'total' ? '合計金額のみ' : '明細入力'}
              </button>
            ))}
          </div>

          {/* 合計入力 */}
          {quoteType === 'total' && (
            <div>
              <label className="text-[10px] text-gray-400">合計見積金額（税込）</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-500 text-sm">¥</span>
                <input
                  type="number"
                  min={0}
                  value={totalInput}
                  onChange={e => setTotalInput(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C5A059]/60"
                />
              </div>
            </div>
          )}

          {/* 明細入力 */}
          {quoteType === 'itemized' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-gray-400">明細（各行の数量 × 単価が自動計算されます）</label>
                {items.some(it => it.itemName || it.unitPrice > 0) && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-1 text-[10px] text-red-400/70 hover:text-red-400 transition"
                  >
                    <LucideRotateCcw size={10} />
                    一括クリア
                  </button>
                )}
              </div>

              {/* ヘッダー行 */}
              <div className="grid grid-cols-[1fr_60px_50px_90px_80px_28px] gap-1 px-1 text-[10px] text-gray-500">
                <span>品名・工事内容</span>
                <span className="text-right">数量</span>
                <span className="text-center">単位</span>
                <span className="text-right">単価</span>
                <span className="text-right">金額</span>
                <span />
              </div>

              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_50px_90px_80px_28px] gap-1 items-center">
                  <input
                    type="text"
                    value={it.itemName}
                    onChange={e => updateItem(i, { itemName: e.target.value })}
                    placeholder="項目名"
                    className="bg-[#0B132B] border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]/60"
                  />
                  <input
                    type="number"
                    min={0}
                    value={it.quantity}
                    onChange={e => updateItem(i, { quantity: Number(e.target.value) })}
                    className="bg-[#0B132B] border border-gray-700 rounded px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-[#C5A059]/60"
                  />
                  <input
                    type="text"
                    value={it.unit}
                    onChange={e => updateItem(i, { unit: e.target.value })}
                    className="bg-[#0B132B] border border-gray-700 rounded px-1 py-1.5 text-xs text-white text-center focus:outline-none focus:border-[#C5A059]/60"
                  />
                  <input
                    type="number"
                    min={0}
                    value={it.unitPrice}
                    onChange={e => updateItem(i, { unitPrice: Number(e.target.value) })}
                    className="bg-[#0B132B] border border-gray-700 rounded px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-[#C5A059]/60"
                  />
                  <span className="text-xs text-[#E6C687] text-right font-medium pr-1">
                    ¥{it.total.toLocaleString()}
                  </span>
                  <button
                    onClick={() => removeItem(i)}
                    className="text-gray-600 hover:text-red-400 transition flex items-center justify-center"
                  >
                    <LucideTrash2 size={13} />
                  </button>
                </div>
              ))}

              <button
                onClick={addItem}
                className="w-full flex items-center justify-center gap-1.5 border border-dashed border-gray-700 hover:border-[#C5A059]/60 text-gray-500 hover:text-[#C5A059] text-xs py-2 rounded-lg transition"
              >
                <LucidePlus size={12} /> 行を追加
              </button>

              {/* 明細合計 */}
              <div className="flex justify-between items-center px-1 pt-1 border-t border-gray-700">
                <span className="text-xs text-gray-400">合計（税込）</span>
                <span className="text-base font-bold text-[#E6C687]">
                  ¥{itemizedTotal.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* 業者メモ */}
          <div>
            <label className="text-[10px] text-gray-400">備考・メモ（任意）</label>
            <textarea
              value={vendorNote}
              onChange={e => setVendorNote(e.target.value)}
              rows={3}
              placeholder="施工条件、材料の前提、工期の目安など"
              className="mt-1 w-full bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]/60 resize-none"
            />
          </div>

          {/* エラー */}
          {submitError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <LucideAlertCircle size={12} /> {submitError}
            </p>
          )}

          {/* 送信ボタン */}
          <div className="bg-[#0B132B] rounded-lg p-3 border border-gray-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500">送信する見積金額</p>
              <p className="text-xl font-extrabold text-[#E6C687]">
                ¥{displayTotal.toLocaleString()}
              </p>
              {pdfFile && (
                <p className="text-[10px] text-blue-400 mt-0.5">
                  📎 PDF添付あり
                </p>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || displayTotal <= 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition ${
                submitting || displayTotal <= 0
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D]'
              }`}
            >
              <LucideActivity
                size={13}
                className="animate-spin"
                style={{ display: submitting ? 'inline-block' : 'none' }}
              />
              <span style={{ display: submitting ? 'inline' : 'none' }}>送信中…</span>
              <span style={{ display: submitting ? 'none' : 'inline' }}>この内容で送信する</span>
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-600 pb-4">
          Powered by 住良建設 Genba-SFA
        </p>
      </main>
    </div>
  );
}
