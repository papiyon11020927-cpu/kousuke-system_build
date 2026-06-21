import type { Customer, Project, Schedule, Contract, VendorQuoteRequest, DashboardTodo } from '@/types';

// ============================================================
// KPI 計算（純粋関数 — 副作用なし）
// ============================================================

export interface KpiGoals {
  salesGoal: number;
  profitGoal: number;
  surveyGoal: number;
  estimateGoal: number;
}

export interface KpiResult extends KpiGoals {
  actualSales: number;
  actualProfit: number;
  actualSurveyCount: number;
  actualEstimateCount: number;
  salesRate: number;
  profitRate: number;
}

const STAFF_GOALS: Record<string, KpiGoals> = {
  '佐藤 営業マン':  { salesGoal: 2_000_000,  profitGoal: 800_000,   surveyGoal: 10, estimateGoal: 5 },
  '山本 営業主任': { salesGoal: 12_000_000, profitGoal: 4_800_000, surveyGoal: 10, estimateGoal: 5 },
};
const DEFAULT_GOALS: KpiGoals = { salesGoal: 5_000_000, profitGoal: 2_000_000, surveyGoal: 10, estimateGoal: 5 };

export const calcKpi = (
  staffName: string,
  projects: Project[],
  schedules: Schedule[],
  overrideGoals?: Partial<KpiGoals>,
): KpiResult => {
  const goals = { ...(STAFF_GOALS[staffName] ?? DEFAULT_GOALS), ...overrideGoals };
  const mine   = projects.filter((p) => p.assignee === staffName);

  const actualSales = mine
    .filter((p) => p.status === 'completed' || p.status === 'contract')
    .reduce((s, p) => s + (p.amount ?? 0), 0);

  const actualProfit = mine
    .filter((p) => p.status === 'completed' || p.status === 'contract')
    .reduce((s, p) => s + (p.profit ?? 0), 0);

  const actualSurveyCount = schedules.filter(
    (s) => s.assignees.includes(staffName) && /現調|調査|洗浄/.test(s.title),
  ).length;

  const actualEstimateCount = mine.filter((p) =>
    ['estimate', 'contract', 'completed'].includes(p.status),
  ).length;

  const pct = (actual: number, goal: number) =>
    goal > 0 ? Math.min(Math.round((actual / goal) * 100), 100) : 0;

  return {
    ...goals, actualSales, actualProfit, actualSurveyCount, actualEstimateCount,
    salesRate:  pct(actualSales,  goals.salesGoal),
    profitRate: pct(actualProfit, goals.profitGoal),
  };
};

// ============================================================
// 優先フォロー案件レコメンド
// ============================================================

export interface PriorityRec {
  type: 'stagnant' | 'ltv_trigger' | 'new_lead';
  title: string;
  desc: string;
  project: Project;
  customer: Customer;
  urgency: 'high' | 'medium';
}

const FALLBACK_CUSTOMER: Customer = {
  customerId: '', name: '不明な顧客', address: '住所未登録', totalLtv: 0,
};

export const calcPriorityRecs = (
  staffName: string,
  projects: Project[],
  customers: Customer[],
  schedules: Schedule[],
  today: Date = new Date(),
): PriorityRec[] => {
  const list: PriorityRec[] = [];
  const cust = (id: string) => customers.find((c) => c.customerId === id) ?? FALLBACK_CUSTOMER;

  for (const p of projects) {
    if (p.assignee !== staffName) continue;

    if (p.status === 'estimate') {
      const days = Math.floor((today.getTime() - new Date(p.lastActivityAt).getTime()) / 86_400_000);
      if (days >= 7) {
        list.push({
          type: 'stagnant', urgency: 'high', project: p, customer: cust(p.customerId),
          title: `【停滞追客】${p.title}`,
          desc:  `見積提出から${days}日が経過しています。連絡が途絶える前にアプローチが必要です。`,
        });
      }
    }

    if (p.status === 'completed') {
      const completedAt = new Date(p.lastActivityAt).getTime();
      const daysSinceCompletion = Math.floor((today.getTime() - completedAt) / 86_400_000);
      // 完工後すでにフォロー予定が組まれている場合は提案しない
      const hasFollowUpScheduled = schedules.some(
        (s) => s.projectId === p.projectId && new Date(s.startAt).getTime() > completedAt,
      );
      if (daysSinceCompletion >= 330 && !hasFollowUpScheduled) {
        list.push({
          type: 'ltv_trigger', urgency: 'medium', project: p, customer: cust(p.customerId),
          title: '【LTV掘り起こし】定期アフター点検',
          desc:  `「${p.title}」の完工から${Math.floor(daysSinceCompletion / 30)}ヶ月。点検を口実に外壁塗装提案へ繋げます。`,
        });
      }
    }

    if (p.status === 'lead' && !schedules.some((s) => s.projectId === p.projectId)) {
      list.push({
        type: 'new_lead', urgency: 'high', project: p, customer: cust(p.customerId),
        title: `【アプローチ未定】${p.title}`,
        desc:  '新規の反響案件ですが、次回のアクション予定が組まれていません。',
      });
    }
  }

  return list;
};

// ============================================================
// スタッフ稼働率統計（管理者ダッシュボード用）
// ============================================================

export interface StaffStats {
  totalSchedules: number;
  leadCount: number;
  estimateCount: number;
  constructionCount: number;
  workloadPercent: number;
}

export const calcStaffStats = (
  staffName: string,
  projects: Project[],
  schedules: Schedule[],
): StaffStats => {
  const staffScheds = schedules.filter((s) => s.assignees.includes(staffName));
  return {
    totalSchedules:    staffScheds.length,
    leadCount:         projects.filter((p) => p.assignee === staffName && p.status === 'lead').length,
    estimateCount:     projects.filter((p) => p.assignee === staffName && p.status === 'estimate').length,
    constructionCount: projects.filter((p) => p.assignee === staffName && p.status === 'construction').length,
    workloadPercent:   Math.min(Math.round((staffScheds.length / 4) * 100), 100),
  };
};

// ============================================================
// ダッシュボード TODO エンジン
// ============================================================

export const calcDashboardTodos = (
  contracts:           Contract[],
  vendorQuoteRequests: VendorQuoteRequest[],
  projects:            Project[],
  customers:           Customer[],
  targetStaff:         string,    // 表示対象スタッフ名（manager時は'ALL'）
  isManager:           boolean,
  today:               Date = new Date(),
): DashboardTodo[] => {
  const todos: DashboardTodo[] = [];
  const todayStr  = today.toISOString().split('T')[0];
  const in3days   = new Date(today); in3days.setDate(today.getDate() + 3);
  const in3daysStr = in3days.toISOString().split('T')[0];

  const custName = (id: string) =>
    customers.find(c => c.customerId === id)?.name ?? id;

  const belongsToTarget = (assignee: string) =>
    isManager || assignee === targetStaff;

  // ── 顧客入金管理（未収金） ──────────────────────────────────
  for (const ct of contracts) {
    if (ct.approvalStatus !== 'approved') continue;
    const proj = projects.find(p => p.projectId === ct.projectId);
    if (!proj || !belongsToTarget(proj.assignee)) continue;

    for (const term of (ct.paymentTerms ?? [])) {
      if (term.isPaid || !term.dueDate) continue;

      if (term.dueDate < todayStr) {
        // 期限超過
        todos.push({
          todoId:     `col-over-${ct.contractId}-${term.termName}`,
          type:       'collection_overdue',
          title:      `【未収金】${ct.customerName} — ${term.termName}`,
          body:       `¥${term.amount.toLocaleString()} 入金期限 ${term.dueDate} 超過`,
          urgency:    'high',
          amount:     term.amount,
          dueDate:    term.dueDate,
          relatedId:  ct.contractId,
        });
      } else if (term.dueDate <= in3daysStr) {
        // 3日以内に期限到来
        todos.push({
          todoId:     `col-soon-${ct.contractId}-${term.termName}`,
          type:       'collection_due_soon',
          title:      `【入金予定】${ct.customerName} — ${term.termName}`,
          body:       `¥${term.amount.toLocaleString()} 入金予定日 ${term.dueDate}`,
          urgency:    'medium',
          amount:     term.amount,
          dueDate:    term.dueDate,
          relatedId:  ct.contractId,
        });
      }
    }
  }

  // ── 業者支払い管理 ──────────────────────────────────────────
  for (const req of vendorQuoteRequests) {
    if (req.vendorPaid) continue;
    if (!['submitted', 'reviewed', 'accepted'].includes(req.status)) continue;
    if (req.totalAmount == null) continue;

    const proj = projects.find(p => p.projectId === req.projectId);
    if (!proj || !belongsToTarget(proj.assignee)) continue;

    if (req.vendorPaymentDueDate && req.vendorPaymentDueDate <= todayStr) {
      todos.push({
        todoId:    `vp-${req.requestId}`,
        type:      'vendor_payment_pending',
        title:     `【業者支払い】${req.vendorName}`,
        body:      `「${req.projectTitle}」¥${req.totalAmount.toLocaleString()} 支払期限 ${req.vendorPaymentDueDate}`,
        urgency:   req.vendorPaymentDueDate < todayStr ? 'high' : 'medium',
        amount:    req.totalAmount,
        dueDate:   req.vendorPaymentDueDate,
        relatedId: req.requestId,
      });
    }
  }

  // ── 見積フォロー（7日超過） ─────────────────────────────────
  for (const p of projects) {
    if (!belongsToTarget(p.assignee) || p.status !== 'estimate') continue;
    const days = Math.floor((today.getTime() - new Date(p.lastActivityAt).getTime()) / 86_400_000);
    if (days >= 7) {
      todos.push({
        todoId:    `estf-${p.projectId}`,
        type:      'estimate_followup',
        title:     `【見積フォロー】${custName(p.customerId)}`,
        body:      `「${p.title}」見積提出から ${days} 日経過`,
        urgency:   days >= 14 ? 'high' : 'medium',
        relatedId: p.projectId,
      });
    }
  }

  // ── LTV再アプローチ（完工1年以上・フォロー未登録） ──────────
  for (const p of projects) {
    if (!belongsToTarget(p.assignee) || p.status !== 'completed') continue;
    const days = Math.floor((today.getTime() - new Date(p.lastActivityAt).getTime()) / 86_400_000);
    if (days >= 365) {
      const years = (days / 365).toFixed(1);
      todos.push({
        todoId:    `ltv-${p.projectId}`,
        type:      'ltv_followup',
        title:     `【LTV再アプローチ】${custName(p.customerId)}`,
        body:      `「${p.title}」完工から ${years} 年 — アフターフォロー推奨`,
        urgency:   days >= 730 ? 'high' : 'medium',
        relatedId: p.customerId,
      });
    }
  }

  // 緊急度（high → medium）→ dueDate 昇順でソート
  return todos.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'high' ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });
};
