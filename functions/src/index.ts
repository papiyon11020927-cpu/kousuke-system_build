/**
 * Genba-SFA Cloud Functions
 *
 * ── 含まれる関数 ──────────────────────────────────────────────────
 * 1. onNotificationCreated  — Firestore通知作成時にメール送信
 *
 * ── 画像OCR について ─────────────────────────────────────────────
 * Gemini OCR はフロントエンドから直接呼び出します（Cloud Functions 不要）。
 * APIキーは .env.local の VITE_GEMINI_API_KEY を参照します。
 *
 * ── デプロイ前の設定 ──────────────────────────────────────────────
 *   # メール設定（Gmail アプリパスワード推奨）
 *   firebase functions:config:set \
 *     email.host="smtp.gmail.com" \
 *     email.port="465" \
 *     email.user="your@gmail.com" \
 *     email.password="your-app-password" \
 *     email.from_name="住良建設 SFA"
 *
 *   # アプリID（Firebase コンソールの APP_ID と一致させる）
 *   firebase functions:config:set app.id="YOUR_APP_ID"
 *
 * ── デプロイ ─────────────────────────────────────────────────────
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();
const db = admin.firestore();

// ─── アプリIDを環境変数から取得 ───────────────────────────────────
const APP_ID = functions.config().app?.id ?? 'default';

// ─── メールトランスポーター（遅延初期化）────────────────────────
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const cfg = functions.config().email ?? {};
  transporter = nodemailer.createTransport({
    host:   cfg.host   ?? 'smtp.gmail.com',
    port:   Number(cfg.port ?? 465),
    secure: true,
    auth: {
      user: cfg.user     ?? '',
      pass: cfg.password ?? '',
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

    const cfg      = functions.config().email ?? {};
    const fromName = cfg.from_name ?? 'Genba-SFA';
    const fromAddr = cfg.user ?? '';

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
              <h3 style="color:#C5A059;margin-top:0">${notification.title}</h3>
              <p style="font-size:14px;line-height:1.6">${notification.body}</p>
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

// ※ 画像OCR（Gemini）はフロントエンドから直接呼び出します。
//   .env.local の VITE_GEMINI_API_KEY を参照するため、
//   Cloud Functions での実装は不要です。
