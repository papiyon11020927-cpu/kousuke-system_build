/**
 * Genba-SFA Cloud Functions
 *
 * ── 含まれる関数 ──────────────────────────────────────────────────
 * 1. onNotificationCreated  — Firestore通知作成時にメール送信
 * 2. analyzeVendorDoc       — 業者見積書OCR（Gemini・認証不要）
 * 3. geminiAnalyzeReport    — 音声日報解析（Gemini・認証必須）
 * 4. geminiDailySummary     — 日報サマリー生成（Gemini・認証必須）
 * 5. signCustomerContract   — 顧客契約電子署名（認証不要・admin権限で書き込み）
 *
 * ── Gemini APIキー設定（初回のみ実行） ───────────────────────────
 * firebase functions:secrets:set GEMINI_API_KEY
 * → プロンプトに Gemini APIキーを入力して Enter
 *
 * ── デプロイ前の設定（任意・.env または環境変数） ───────────────────
 *   functions.config() は v2 で廃止（呼び出すと起動時に例外で全関数が落ちる）のため、
 *   process.env を直接参照する。未設定でも動作する（メールは送信スキップ）。
 *     APP_ID            … フロントの VITE_APP_ID と一致させる（既定: sumiyoshi-genba-kpi）
 *     EMAIL_HOST/PORT   … 既定: smtp.gmail.com / 465
 *     EMAIL_USER/PASSWORD … Gmailアプリパスワード推奨
 *     EMAIL_FROM_NAME   … 既定: Genba-SFA
 *
 * ── デプロイ ─────────────────────────────────────────────────────
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';

admin.initializeApp();
const db = admin.firestore();

// ─── アプリIDを環境変数から取得 ───────────────────────────────────
// functions.config() は Cloud Functions for Firebase v2 で廃止されており、
// 呼び出すとモジュールロード時に例外を投げて全関数が起動不能になるため使用しない。
const APP_ID = process.env.APP_ID ?? 'sumiyoshi-genba-kpi';

// ─── HTML エスケープ（メール本文の XSS 防止） ────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ─── メールトランスポーター（遅延初期化）────────────────────────
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST ?? 'smtp.gmail.com',
    port:   Number(process.env.EMAIL_PORT ?? 465),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER     ?? '',
      pass: process.env.EMAIL_PASSWORD ?? '',
    },
  });
  return transporter;
}

// ═══════════════════════════════════════════════════════════════════
// 1. onNotificationCreated — Firestore通知作成時にメール送信
// ═══════════════════════════════════════════════════════════════════
export const onNotificationCreated = functions
  .region('asia-northeast1')
  .firestore
  .document(`artifacts/${APP_ID}/public/data/notifications/{notificationId}`)
  .onCreate(async (snap) => {
    const notification = snap.data() as {
      type:         string;
      title:        string;
      body:         string;
      projectTitle: string;
    };

    const usersSnap = await db
      .collection(`artifacts/${APP_ID}/public/data/users`)
      .get();

    const targets = usersSnap.docs
      .map(d => d.data() as {
        email?:       string;
        role?:        string;
        displayName?: string;
        notificationSettings?: {
          emailOnVendorQuote?: boolean;
          emailOnApproval?:    boolean;
        };
      })
      .filter(u => u.role === 'manager' || u.role === 'admin')
      .filter(u => {
        const s = u.notificationSettings;
        if (notification.type === 'vendor_quote_submitted') {
          return s?.emailOnVendorQuote !== false;
        }
        if (
          notification.type === 'estimate_approval_requested' ||
          notification.type === 'contract_approval_requested'
        ) {
          return s?.emailOnApproval !== false;
        }
        return false;
      })
      .filter(u => u.email);

    if (targets.length === 0) {
      functions.logger.info('通知メールの送信対象なし:', notification.type);
      return;
    }

    const fromName = process.env.EMAIL_FROM_NAME ?? 'Genba-SFA';
    const fromAddr = process.env.EMAIL_USER ?? '';

    const mailPromises = targets.map(u =>
      getTransporter().sendMail({
        from:    `"${fromName}" <${fromAddr}>`,
        to:      u.email!,
        subject: `【Genba-SFA】${notification.title}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <div style="background:#0B132B;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#E6C687;margin:0;font-size:16px">住良建設 Genba-SFA</h2>
            </div>
            <div style="background:#111A35;padding:24px;border-radius:0 0 8px 8px;color:#E2E8F0">
              <h3 style="color:#C5A059;margin-top:0">${escapeHtml(notification.title)}</h3>
              <p style="font-size:14px;line-height:1.6">${escapeHtml(notification.body)}</p>
              <hr style="border-color:#1C2C54;margin:16px 0"/>
              <p style="font-size:12px;color:#6B7280">
                このメールは Genba-SFA から自動送信されています。<br/>
                通知設定は SFA 画面のベルアイコン → 歯車から変更できます。
              </p>
            </div>
          </div>
        `,
      }).catch((err: Error) => {
        functions.logger.error(`メール送信失敗 ${u.email}:`, err.message);
      }),
    );

    await Promise.all(mailPromises);
    functions.logger.info(`通知メール送信完了: ${targets.length}件`);
  });

// ════════════════════════════════════════════════════════════════════
// Gemini API キー（Firebase Secret Manager で管理）
// 初回のみ: firebase functions:secrets:set GEMINI_API_KEY
// ════════════════════════════════════════════════════════════════════
const geminiSecret = defineSecret('GEMINI_API_KEY');

// ── 共通型定義 ────────────────────────────────────────────────────
interface VendorQuoteItem {
  itemName:  string;
  quantity:  number;
  unit:      string;
  unitPrice: number;
  total:     number;
}

// ════════════════════════════════════════════════════════════════════
// 2. analyzeVendorDoc — 業者見積書・請求書OCR（認証不要）
//    業者向け公開フォームから呼び出すため invoker: 'public'
// ════════════════════════════════════════════════════════════════════
export const analyzeVendorDoc = onCall(
  {
    region:       'asia-northeast1',
    secrets:      [geminiSecret],
    maxInstances: 5,
    invoker:      'public',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { base64, mimeType } = request.data as { base64?: string; mimeType?: string };
    if (!base64 || !mimeType) {
      throw new HttpsError('invalid-argument', 'base64 と mimeType は必須です');
    }
    if (base64.length > 14_000_000) {
      throw new HttpsError('invalid-argument', 'ファイルサイズが大きすぎます（10MB 以内にしてください）');
    }
    const allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','image/heic','image/heif','image/png','application/pdf'];
    if (!allowed.includes(mimeType)) {
      throw new HttpsError('invalid-argument', '対応していないファイル形式です');
    }

    const prompt = `この見積書・請求書・納品書を解析し、明細データ・発行日・請求合計金額を抽出してください。
以下のJSON形式のみで返答してください（説明文不要）:
{"items":[{"itemName":"品名","quantity":1,"unit":"式","unitPrice":120000,"total":120000}],"date":"2026年5月30日","invoiceTotal":1320000}
ルール:
- items: 明細・工事内容の行のみ（合計行・小計・消費税・ヘッダー行は含めない）
- unitPrice/total: 整数（¥マーク・カンマなし）
- date: "YYYY年M月D日" 形式。なければ null
- invoiceTotal: 「合計」「請求金額」「ご請求額」「お支払金額」など文書全体の最終金額（税込・整数・¥マークやカンマなし）。なければ null
- 品名が空または金額不明の行は除外。最大20行
JSONのみ返してください。`;

    const genAI = new GoogleGenerativeAI(geminiSecret.value());
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt },
        ],
      }],
    });

    const raw = result.response.text()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(raw) as {
        items?: Partial<VendorQuoteItem>[];
        date?: string | null;
        invoiceTotal?: number | null;
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
      const invoiceTotal = typeof parsed.invoiceTotal === 'number' && parsed.invoiceTotal > 0
        ? Math.round(parsed.invoiceTotal)
        : null;
      return { items, date: typeof parsed.date === 'string' ? parsed.date : null, invoiceTotal };
    } catch {
      return { items: [], date: null, invoiceTotal: null };
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 3. geminiAnalyzeReport — 音声日報解析（認証必須）
// ════════════════════════════════════════════════════════════════════
export const geminiAnalyzeReport = onCall(
  {
    region:       'asia-northeast1',
    secrets:      [geminiSecret],
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { text } = request.data as { text?: string };
    if (!text || typeof text !== 'string') throw new HttpsError('invalid-argument', 'text は必須です');
    if (text.length > 5000) throw new HttpsError('invalid-argument', 'text は5000文字以内にしてください');

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `あなたは建築会社のマネージャーAIです。
営業が吹き込んだ音声から以下の情報を抽出し、JSON形式で回答してください。
{"customerIssue":"顧客の課題（具体的に）","keymanReaction":"キーマンの反応（具体的に）","budget":"予算感（金額・範囲。言及なければ空文字）","nextAction":"次回アクション（日時・内容を含む具体的な行動計画）","nextVisitDate":"次回訪問・フォロー予定日 YYYY-MM-DD 形式。相対表現は今日(${today})から計算。不明はnull","missingField":"budget"|"nextAction"|null,"followUpQuestion":"重要情報が不足している場合のみ自然な追加質問（ない場合はnull）"}
missingField は budget・nextAction のどちらか1つのみ、または null。nextAction が不明なら必ず missingField を nextAction にすること。
JSONのみ返してください。`;

    const genAI = new GoogleGenerativeAI(geminiSecret.value());
    // systemInstruction はモデル初期化時に文字列で渡す（Content 型不要）
    const model  = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent({
      contents:        [{ role: 'user', parts: [{ text: `営業報告: ${text}` }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    return JSON.parse(result.response.text());
  },
);

// ════════════════════════════════════════════════════════════════════
// 4. geminiDailySummary — 日報サマリー生成（認証必須）
// ════════════════════════════════════════════════════════════════════
export const geminiDailySummary = onCall(
  {
    region:       'asia-northeast1',
    secrets:      [geminiSecret],
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { staffName, logText } = request.data as { staffName?: string; logText?: string };
    if (!staffName || !logText) throw new HttpsError('invalid-argument', 'staffName と logText は必須です');

    const systemPrompt = `あなたは建築会社の管理AIです。
営業担当の本日の活動ログを元に、管理者・本人向けの日報サマリーを200文字以内で生成してください。
訪問先の概要・商談進捗・翌日以降の重点事項を簡潔にまとめてください。`;

    const genAI = new GoogleGenerativeAI(geminiSecret.value());
    const model  = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(
      `担当者: ${staffName}\n本日の活動ログ:\n${logText}`,
    );

    return { summary: result.response.text().trim() };
  },
);

// ════════════════════════════════════════════════════════════════════
// 5. signCustomerContract — 顧客契約電子署名（認証不要・admin権限で書き込み）
//    公開署名ページから呼び出す。署名保存・案件ステータス更新・
//    受注金額への契約金額自動反映（積算）をまとめてサーバー側で行う。
// ════════════════════════════════════════════════════════════════════
const FLOW_ORDER: Record<string, number> = {
  lead: 0, estimate: 1, contract: 2, construction: 3,
  completed: 4, settlement: 5, closed: 6, lost: -1,
};

export const signCustomerContract = onCall(
  {
    region:       'asia-northeast1',
    maxInstances: 10,
    invoker:      'public',
    timeoutSeconds: 30,
  },
  async (request) => {
    const { contractId, signatureDataUrl } = request.data as { contractId?: string; signatureDataUrl?: string };
    if (!contractId || typeof contractId !== 'string') {
      throw new HttpsError('invalid-argument', 'contractId は必須です');
    }
    if (!signatureDataUrl || typeof signatureDataUrl !== 'string' || !signatureDataUrl.startsWith('data:image/')) {
      throw new HttpsError('invalid-argument', '署名データが不正です');
    }
    if (signatureDataUrl.length > 2_000_000) {
      throw new HttpsError('invalid-argument', '署名データが大きすぎます');
    }

    const contractRef  = db.doc(`artifacts/${APP_ID}/public/data/contracts/${contractId}`);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) {
      throw new HttpsError('not-found', '契約情報が見つかりません');
    }
    const contract = contractSnap.data() as {
      projectId:        string;
      approvalStatus:   string;
      signedByCustomer?: boolean;
      totalAmount?:     number;
    };
    if (contract.approvalStatus !== 'approved') {
      throw new HttpsError('failed-precondition', 'この契約書は署名できる状態ではありません');
    }
    if (contract.signedByCustomer) {
      throw new HttpsError('already-exists', 'この契約書は既に署名済みです');
    }

    const now = new Date().toISOString();
    await contractRef.update({
      customerSignature: signatureDataUrl,
      signatureAt:       now,
      signedByCustomer:  true,
      status:            'signed',
      updatedAt:         now,
    });

    // 案件への反映（既に契約フェーズ以降に進んでいる場合はステータスを変更しない）
    const projectRef  = db.doc(`artifacts/${APP_ID}/public/data/projects/${contract.projectId}`);
    const projectSnap = await projectRef.get();
    if (projectSnap.exists) {
      const currentStatus = (projectSnap.data()?.status as string) ?? 'lead';
      const projectUpdate: Record<string, unknown> = { updatedAt: now, lastActivityAt: now };
      if ((FLOW_ORDER[currentStatus] ?? 0) < FLOW_ORDER.contract) {
        projectUpdate.status      = 'contract';
        projectUpdate.probability = 100;
      }

      // 受注金額へ契約金額を自動反映（承認済み・署名済みの全契約を積算）
      const contractsSnap = await db
        .collection(`artifacts/${APP_ID}/public/data/contracts`)
        .where('projectId', '==', contract.projectId)
        .get();
      projectUpdate.amount = contractsSnap.docs.reduce((sum, d) => {
        const c = d.data() as { approvalStatus?: string; status?: string; totalAmount?: number };
        const status = d.id === contractId ? 'signed' : c.status;
        return (c.approvalStatus === 'approved' && status === 'signed')
          ? sum + (c.totalAmount ?? 0)
          : sum;
      }, 0);

      await projectRef.update(projectUpdate);
    }

    return { success: true };
  },
);
