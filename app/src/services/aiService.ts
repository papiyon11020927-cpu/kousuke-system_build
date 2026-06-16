/**
 * aiService — Gemini API 呼び出しを Cloud Functions 経由で行う
 *
 * Gemini APIキーはサーバー側（Cloud Functions）のみに保持し、
 * ブラウザバンドルには含まれない。
 * VITE_GEMINI_API_KEY は不要になった。
 */
import { httpsCallableFromURL } from 'firebase/functions';
import { fbFunctions } from '@/firebase/config';
import type { AiAnalysisResult, InOutLog } from '@/types';

// ── Callable 関数の参照 ─────────────────────────────────────────
const analyzeReportFn    = httpsCallableFromURL<{ text: string }, AiAnalysisResult>(
  fbFunctions, '/geminiAnalyzeReport',
);
const dailySummaryFn     = httpsCallableFromURL<{ staffName: string; logText: string }, { summary: string }>(
  fbFunctions, '/geminiDailySummary',
);

// ─── 音声日報解析 ──────────────────────────────────────────────
export const analyzeReport = async (text: string): Promise<AiAnalysisResult> => {
  try {
    const result = await analyzeReportFn({ text });
    return result.data;
  } catch (err) {
    console.warn('[aiService] analyzeReport fallback to simulation:', err);
    return simulateAnalysis(text);
  }
};

// ─── 日報サマリー生成 ──────────────────────────────────────────
export const generateDailySummary = async (
  staffName: string,
  logs: InOutLog[],
): Promise<string> => {
  const outLogs = logs.filter(l => l.type === 'out');
  if (!outLogs.length) return `${staffName}：本日の訪問記録がありません。`;

  const logText = outLogs
    .map((l, i) => {
      const parts: string[] = [`[訪問${i + 1}]`];
      if (l.structuredData?.customerIssue)  parts.push(`課題: ${l.structuredData.customerIssue}`);
      if (l.structuredData?.keymanReaction) parts.push(`反応: ${l.structuredData.keymanReaction}`);
      if (l.structuredData?.nextAction)     parts.push(`次回: ${l.structuredData.nextAction}`);
      else if (l.voiceText)                 parts.push(l.voiceText.substring(0, 80));
      return parts.join(' / ');
    })
    .join('\n');

  try {
    const result = await dailySummaryFn({ staffName, logText });
    return result.data.summary || simulateDailySummary(staffName, outLogs);
  } catch (err) {
    console.warn('[aiService] generateDailySummary fallback to simulation:', err);
    return simulateDailySummary(staffName, outLogs);
  }
};

// ─── フォールバック（Functionsが未デプロイ・オフライン時） ──────
const simulateDailySummary = (staffName: string, outLogs: InOutLog[]): string => {
  const latest = outLogs[outLogs.length - 1];
  const nextAction = latest?.structuredData?.nextAction;
  return (
    `${staffName}：本日は${outLogs.length}件の訪問を完了。` +
    (nextAction
      ? `最新の次回アクション「${nextAction}」に向けた準備を進める予定。`
      : '各顧客との商談を進め、見積提示の準備を継続中。') +
    '引き続き積極的なフォローアップを実施。'
  );
};

/** テキストから日本語日付表現を解析して YYYY-MM-DD を返す（なければ undefined） */
const parseJaDate = (text: string): string | undefined => {
  const now = new Date();
  const absMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (absMatch) {
    const month = parseInt(absMatch[1]) - 1;
    const day   = parseInt(absMatch[2]);
    const d     = new Date(now.getFullYear(), month, day);
    if (d <= now) d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
  if (/(\d+)日後/.test(text)) {
    const m = text.match(/(\d+)日後/)!;
    const d = new Date(now); d.setDate(d.getDate() + parseInt(m[1]));
    return d.toISOString().split('T')[0];
  }
  if (/来週/.test(text)) {
    const d = new Date(now); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  if (/来月/.test(text)) {
    const d = new Date(now); d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  }
  if (/今月末/.test(text)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  }
  return undefined;
};

const simulateAnalysis = (text: string): Promise<AiAnalysisResult> =>
  new Promise((resolve) => {
    setTimeout(() => {
      const hasBudget   = /万|円|予算|コスト/.test(text);
      const hasNextDate = /日|月|週|来月|次回|アポ|提示|再訪|提出/.test(text);
      const nextVisitDate = parseJaDate(text);
      const result: AiAnalysisResult = {
        customerIssue:  '配管・設備の老朽化が判明。全面リフォームを検討されている。',
        keymanReaction: '決定権者のご夫婦ともに前向き。早期の見積提示を求めている。',
        budget:         hasBudget   ? `抽出: ${text.match(/(\d+万|\d+円)/)?.[0] ?? '予算想定あり'}` : '',
        nextAction:     hasNextDate ? `次回: ${text.match(/(\d+月\d+日|\d+日)/)?.[0] ?? '再訪問アポあり'}` : '',
        nextVisitDate,
        missingField:   null,
        followUpQuestion: null,
      };
      if (!hasNextDate) {
        result.missingField      = 'nextAction';
        result.followUpQuestion  = '報告ありがとうございます！次回のアクションとして、見積提示や再訪問の期日はお客様と合意できましたか？';
      } else if (!hasBudget) {
        result.missingField      = 'budget';
        result.followUpQuestion  = '次回提示日も設定できてバッチリです！ご希望工事の「予算感」について何か情報共有はありましたか？';
      }
      resolve(result);
    }, 1500);
  });
