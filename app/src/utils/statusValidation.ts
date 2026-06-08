import type { ProjectStatus, Estimate, Contract } from '@/types';

/** 業務フローにおけるステータス順序（-1 はフロー外） */
const FLOW_ORDER: Record<ProjectStatus, number> = {
  lead:         0,
  estimate:     1,
  contract:     2,
  construction: 3,
  completed:    4,
  settlement:   5,
  closed:       6,
  lost:        -1,
};

export interface StatusValidation {
  ok:      boolean;
  reason?: string;
}

/**
 * ステータス遷移バリデーション
 *
 * ルール:
 *  - 後退（低いステータスへ）: 制限なし
 *  - estimate 前進: 見積書が1件以上必要
 *  - contract 前進: 契約書が1件以上必要（かつ見積提出を経由）
 *  - construction 以降: 直前のステータスを経由していること
 *  - lost: 引き合い・見積提出のみ可（契約済以降は不可）
 */
export function validateStatusTransition(
  newStatus:     ProjectStatus,
  currentStatus: ProjectStatus,
  estimates:     Pick<Estimate, 'estimateId'>[],
  contracts:     Pick<Contract, 'contractId'>[],
): StatusValidation {

  const currentOrder = FLOW_ORDER[currentStatus];
  const newOrder     = FLOW_ORDER[newStatus];

  /* ─── 失注 ─────────────────────────────────────────────────── */
  if (newStatus === 'lost') {
    if (currentOrder >= FLOW_ORDER['contract']) {
      return {
        ok:     false,
        reason: '契約済以降のステータスから失注へは変更できません（資金の動きが発生しています）',
      };
    }
    return { ok: true };
  }

  /* ─── 後退・同一ステータス: 制限なし ──────────────────────── */
  if (newOrder <= currentOrder) return { ok: true };

  /* ─── 前進チェック ──────────────────────────────────────────── */
  if (newStatus === 'estimate') {
    if (estimates.length === 0) {
      return {
        ok:     false,
        reason: '先に見積書を作成してください（ワークスペース → 見積タブ）',
      };
    }
  }

  if (newStatus === 'contract') {
    if (currentOrder < FLOW_ORDER['estimate']) {
      return { ok: false, reason: '見積提出を経てから契約済へ変更してください' };
    }
    if (contracts.length === 0) {
      return {
        ok:     false,
        reason: '先に契約書を作成してください（ワークスペース → 契約タブ）',
      };
    }
  }

  if (newStatus === 'construction' && currentOrder < FLOW_ORDER['contract']) {
    return { ok: false, reason: '契約済になってから施工中へ変更してください' };
  }

  if (newStatus === 'completed' && currentOrder < FLOW_ORDER['construction']) {
    return { ok: false, reason: '施工中になってから完工へ変更してください' };
  }

  if (newStatus === 'settlement' && currentOrder < FLOW_ORDER['completed']) {
    return { ok: false, reason: '完工になってから精算中へ変更してください' };
  }

  if (newStatus === 'closed' && currentOrder < FLOW_ORDER['settlement']) {
    return { ok: false, reason: '精算中になってからクローズへ変更してください' };
  }

  return { ok: true };
}
