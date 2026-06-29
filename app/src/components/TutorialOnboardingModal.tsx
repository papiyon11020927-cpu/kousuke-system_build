import { useState } from 'react';
import {
  LucideX, LucideArrowRight, LucideCheck, LucideUsers, LucideCalendar,
  LucideMic, LucideLayoutDashboard, LucideLayers, LucideTarget,
  LucideHelpCircle, LucideTrendingUp,
} from 'lucide-react';

interface Props {
  displayName: string;
  onFinish:    () => void;
}

const MENU_ITEMS = [
  { icon: <LucideTrendingUp size={14} />,      label: 'ダッシュボード',     note: '自分（または部下）の進捗を一目で確認できます' },
  { icon: <LucideMic size={14} />,             label: '現場報告',          note: '訪問後の報告を音声入力・AI解析で記録します' },
  { icon: <LucideLayoutDashboard size={14} />, label: 'パイプライン',       note: 'カンバン形式で案件の対応漏れを検知します' },
  { icon: <LucideLayers size={14} />,          label: '案件ワークスペース', note: '見積・契約・業者引合いを案件単位で一括管理します' },
  { icon: <LucideUsers size={14} />,           label: '顧客カルテ',        note: '顧客・案件の登録・編集を行います' },
  { icon: <LucideCalendar size={14} />,        label: 'スケジュール',       note: '訪問予定などをカレンダーに登録します' },
  { icon: <LucideTarget size={14} />,          label: '予算・目標管理',     note: '月間のKPI目標を設定・確認します' },
];

export default function TutorialOnboardingModal({ displayName, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const totalSteps = 3;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#111A35] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 shrink-0">
          <h3 className="text-sm font-bold text-white">
            {step === 0 ? `はじめまして、${displayName}さん` : 'ようこそ Genba-SFA へ'}
          </h3>
          <button onClick={onFinish} className="text-gray-500 hover:text-gray-300 transition" title="スキップ">
            <LucideX size={15} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-300 leading-relaxed">
                Genba-SFA は「顧客」と「案件」を中心に動く営業支援システムです。
              </p>
              <ul className="space-y-2">
                <OverviewBullet text="顧客・案件駆動：すべての情報が顧客・案件に紐づきます" />
                <OverviewBullet text="顧客のLTV（生涯価値）を最大化することがゴールです" />
                <OverviewBullet text="案件ワークスペースに見積・契約・業者引合いを集約します" />
                <OverviewBullet text="パイプライン（カンバン）で対応漏れを検知できます" />
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">サイドバーの主なメニューはこちらです。</p>
              <ul className="space-y-2">
                {MENU_ITEMS.map(item => (
                  <li key={item.label} className="flex items-start gap-2.5 bg-[#0B132B] border border-gray-800 rounded-lg px-3 py-2">
                    <span className="text-[#C5A059] mt-0.5 shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-white">{item.label}</p>
                      <p className="text-[10px] text-gray-500">{item.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-center py-4">
              <div className="h-12 w-12 rounded-full bg-[#C5A059]/15 flex items-center justify-center mx-auto">
                <LucideHelpCircle size={22} className="text-[#C5A059]" />
              </div>
              <p className="text-sm text-gray-200 font-medium">
                各機能の詳しい使い方やFAQは「ヘルプ／チュートリアル」からいつでも見返せます。
              </p>
              <p className="text-[11px] text-gray-500">
                サイドバー下部のメニューからアクセスできます。
              </p>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-700 shrink-0">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span key={i} className={`h-1.5 w-5 rounded-full transition ${i === step ? 'bg-[#C5A059]' : 'bg-gray-700'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onFinish} className="text-[11px] text-gray-500 hover:text-gray-300 transition px-2">
              スキップ
            </button>
            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold py-2 px-4 rounded-lg transition"
              >
                次へ<LucideArrowRight size={13} />
              </button>
            ) : (
              <button
                onClick={onFinish}
                className="flex items-center gap-1.5 bg-[#C5A059] hover:bg-[#E6C687] text-[#0A0F1D] text-xs font-bold py-2 px-4 rounded-lg transition"
              >
                <LucideCheck size={13} />はじめる
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewBullet({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-xs text-gray-300">
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#C5A059] shrink-0" />
      <span className="leading-relaxed">{text}</span>
    </li>
  );
}
