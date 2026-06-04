import type { AiAnalysisResult, InOutLog } from '@/types';

const GEMINI_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '';

const SYSTEM_PROMPT = `あなたは建築会社「住良建設」のマネージャーAIです。
営業が吹き込んだ音声から以下の情報を抽出し、JSON形式で回答してください。
{
  "customerIssue": "顧客の課題（具体的に）",
  "keymanReaction": "キーマンの反応（具体的に）",
  "budget": "予算感（金額・範囲。言及なければ空文字）",
  "nextAction": "次回アクション（日時・内容を含む具体的な行動計画）",
  "nextVisitDate": "次回訪問・フォロー予定日 YYYY-MM-DD 形式。相対表現は今日(${new Date().toISOString().split('T')[0]})から計算。不明はnull",
  "missingField": "budget" | "nextAction" | null,
  "followUpQuestion": "重要情報が不足している場合のみ自然な追加質問（ない場合はnull）"
}
missingField は budget・nextAction のどちらか1つのみ、または null。nextAction が不明なら必ず missingField を nextAction にすること。`;

export const analyzeReport = async (text: string): Promise<AiAnalysisResult> => {
  if (!GEMINI_KEY) return simulateAnalysis(text);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `営業報告: ${text}` }] }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini API ${res.status}`);
    const json = await res.json();
    return JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text) as AiAnalysisResult;
  } catch {
    return simulateAnalysis(text);
  }
};

// ─── 日報サマリー生成 ───────────────────────────────────────────

const DAILY_PROMPT = `あなたは建築会社「住良建設」の管理AIです。
営業担当の本日の活動ログを元に、管理者・本人向けの日報サマリーを200文字以内で生成してください。
訪問先の概要・商談進捗・翌日以降の重点事項を簡潔にまとめてください。`;

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

  if (!GEMINI_KEY) return simulateDailySummary(staffName, outLogs);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `担当者: ${staffName}\n本日の活動ログ:\n${logText}` }] }],
          systemInstruction: { parts: [{ text: DAILY_PROMPT }] },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini API ${res.status}`);
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || simulateDailySummary(staffName, outLogs);
  } catch {
    return simulateDailySummary(staffName, outLogs);
  }
};

const simulateDailySummary = (staffName: string, outLogs: InOutLog[]): Promise<string> => {
  const latest = outLogs[outLogs.length - 1];
  const nextAction = latest?.structuredData?.nextAction;
  return Promise.resolve(
    `${staffName}：本日は${outLogs.length}件の訪問を完了。` +
    (nextAction
      ? `最新の次回アクション「${nextAction}」に向けた準備を進める予定。`
      : '各顧客との商談を進め、見積提示の準備を継続中。') +
    '引き続き積極的なフォローアップを実施。',
  );
};

/** テキストから日本語日付表現を解析して YYYY-MM-DD を返す（なければ undefined） */
const parseJaDate = (text: string): string | undefined => {
  const now = new Date();

  // 絶対表現: XX月XX日
  const absMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (absMatch) {
    const month = parseInt(absMatch[1]) - 1;
    const day   = parseInt(absMatch[2]);
    const d     = new Date(now.getFullYear(), month, day);
    if (d <= now) d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
  // 相対表現
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
        result.followUpQuestion  = '報告ありがとうございます！次回のアクションとして、見積提示や再訪問の期日はお客様と合意できましたか？具体的な日時があれば教えてください。';
      } else if (!hasBudget) {
        result.missingField      = 'budget';
        result.followUpQuestion  = '次回提示日も設定できてバッチリです！ご希望工事の「予算感」について何か情報共有はありましたか？';
      }

      resolve(result);
    }, 1500);
  });
