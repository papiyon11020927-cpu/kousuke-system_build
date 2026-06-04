// ============================================================
// データモデル型定義
// ============================================================

// --- 顧客 ---
export interface Customer {
  customerId: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  totalLtv: number;
  createdAt?: string;
  updatedAt?: string;
}

// --- 案件 ---
export type ProjectStatus =
  | 'lead'         // 反響・初回アプローチ
  | 'estimate'     // 見積提出済
  | 'contract'     // 契約締結済
  | 'construction' // 施工中
  | 'completed'    // 完工済
  | 'lost';        // 失注

/** 案件の複数担当者（按分比率付き） */
export interface ProjectAssignee {
  name:       string;   // スタッフ表示名
  percentage: number;   // 按分比率 0–100
}

export interface Project {
  projectId: string;
  customerId: string;
  title: string;
  status: ProjectStatus;
  amount: number;          // 受注金額（確定）
  profit?: number;
  assignee: string;        // 担当スタッフ名（後方互換・主担当）
  lastActivityAt: string;  // ISO 8601
  // ── 追加フィールド ──
  budgetAmount?: number;   // 顧客予算金額
  deadline?: string;       // 希望納期 (YYYY-MM-DD)
  issue?: string;          // 顧客課題メモ
  probability?: number;    // 見込み度 0–100 (%)
  notes?: string;          // 備考
  lostReason?: string;     // 失注理由（ステータス失注時に記録）
  // ── 複数担当者 ──
  assignees?: ProjectAssignee[];  // 複数担当（按分あり）
  // ── スタッフ作成案件の管理者承認 ──
  projectApprovalStatus?: 'needs_approval' | 'approved';  // 未設定は承認済み扱い
  createdByRole?: 'staff' | 'manager' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

// --- スケジュール ---
export interface Schedule {
  scheduleId: string;
  projectId: string;
  customerId: string;
  title: string;
  startAt: string; // ISO 8601
  endAt: string;
  assignees: string[];
  isLtvTriggered: boolean;
  notes?: string;
  createdAt?: string;
}

// --- In/Out ログ ---
export type LogType = 'in' | 'out';

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface StructuredReportData {
  customerIssue: string;
  keymanReaction: string;
  budget: string;
  nextAction: string;
}

export interface InOutLog {
  logId: string;
  projectId: string;
  customerId: string;
  userId: string;
  userName: string;
  type: LogType;
  timestamp: string;
  location?: GeoLocation;
  voiceText?: string;
  structuredData?: StructuredReportData;
  duration?: number;
  photoUrls?: string[];
}

// --- ユーザー ---
export type UserRole = 'staff' | 'manager' | 'admin';

/** メール通知 On/Off 設定（ユーザーマスタに保持） */
export interface NotificationSettings {
  emailOnVendorQuote: boolean;  // 業者見積回答時
  emailOnApproval:    boolean;  // 承認依頼時
}

export interface AppUser {
  userId:                 string;
  displayName:            string;
  email:                  string;
  role:                   UserRole;
  avatarInitials?:        string;
  notificationSettings?:  NotificationSettings;  // 未設定時は全ON扱い
  createdAt?:             string;
}

// --- アプリ内通知 ---
export type NotificationType =
  | 'vendor_quote_submitted'         // 業者見積回答
  | 'estimate_approval_requested'    // 見積承認依頼
  | 'contract_approval_requested'    // 契約承認依頼
  | 'project_approval_requested';    // 案件登録 承認依頼（スタッフ作成）

export interface AppNotification {
  notificationId:   string;
  type:             NotificationType;
  title:            string;
  body:             string;
  relatedId:        string;       // requestId / estimateId / contractId
  projectTitle:     string;
  createdAt:        string;
  readBy:           string[];     // 既読ユーザーID配列
  notifiedUserIds?: string[];     // 個別通知対象ユーザーID（manager/admin 以外）
}

// --- プロジェクトコメント（管理者指示） ---
export interface ProjectComment {
  commentId: string;
  projectId: string;
  userId: string;
  userName: string;
  commentText: string;
  createdAt: string;
}

// --- 見積 ---
export type EstimateStatus         = 'draft' | 'sent' | 'approved' | 'rejected';
export type EstimateApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

/** 見積書に紐づく外部業者コスト明細（原価管理用） */
export interface VendorCostEntry {
  entryId:      string;
  vendorId?:    string;    // undefined = 自社・その他
  vendorName:   string;    // 業者名 or '自社経費' など
  description?: string;    // 工事内容メモ
  amount:       number;
}

export interface EstimateItem {
  itemId?:   string;   // 行ユニークID
  itemName:  string;
  quantity:  number;
  unit:      string;
  unitPrice: number;
  total:     number;
  note?:     string;
}

export interface Estimate {
  estimateId:       string;
  projectId:        string;
  customerId:       string;
  projectTitle:     string;          // 非正規化コピー
  customerName:     string;          // 非正規化コピー
  createdBy:        string;
  status:           EstimateStatus;
  approvalStatus:   EstimateApprovalStatus;
  approvedBy?:      string;
  approvedAt?:      string;
  approvalComment?: string;
  totalAmount:      number;
  items:            EstimateItem[];
  validityDays?:    number;          // 有効期限（日数）
  pdfUrl?:          string;
  notes?:           string;
  version:          number;          // バージョン管理（1始まり）
  createdAt:        string;
  updatedAt?:       string;
  // ── 原価・粗利 ──
  vendorCosts?:     VendorCostEntry[];  // 外部業者コスト明細
  totalCost?:       number;             // 総原価
  grossProfit?:     number;             // 粗利 = totalAmount - totalCost
  grossProfitRate?: number;             // 粗利率 %
}

// --- 支払条件 ---
export interface PaymentTerm {
  termName:      string;   // e.g. "着工金"
  percentage:    number;   // e.g. 30
  amount:        number;   // 計算済み金額
  description?:  string;
  scheduledDate?: string;  // 入金予定月（任意）YYYY-MM 形式 e.g. "2026-03"
  // 入金管理
  dueDate?:      string;   // 入金予定日 YYYY-MM-DD
  invoicedAt?:   string;   // 請求書発行日 YYYY-MM-DD
  isPaid:        boolean;  // 入金済み
  paidAt?:       string;   // 実際の入金日 YYYY-MM-DD
}

// --- 契約書 ---
export type ContractStatus         = 'pending' | 'signed' | 'cancelled';
export type ContractApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'voided';

export interface Contract {
  contractId:             string;
  projectId:              string;
  customerId:             string;
  estimateId:             string;   // 紐づく見積書（必須）
  projectTitle:           string;   // 非正規化コピー
  customerName:           string;   // 非正規化コピー
  status:                 ContractStatus;
  approvalStatus:         ContractApprovalStatus;
  approvedBy?:            string;
  approvedAt?:            string;
  approvalComment?:       string;
  totalAmount:            number;   // 見積書から自動反映
  paymentTerms:           PaymentTerm[];
  customerSignature?:     string;   // base64 PNG
  signatureAt?:           string;
  signedByCustomer:       boolean;
  staffName:              string;
  constructionStartDate?: string;
  constructionEndDate?:   string;
  warrantyMonths?:        number;
  specialNotes?:          string;
  pdfUrl?:                string;
  createdAt:              string;
  updatedAt?:             string;
}

// --- 見積書テンプレート ---
export interface EstimateTemplate {
  templateId: string;
  name:        string;      // テンプレート名 e.g. "外壁塗装 標準"
  category?:   string;      // 分類 e.g. "塗装工事", "内装工事"
  items:        EstimateItem[];
  createdAt:   string;
  updatedAt?:  string;
}

// --- 契約書テンプレート ---
export interface ContractTemplate {
  templateId: string;
  name:        string;       // テンプレート名 e.g. "標準取引基本契約書"
  category?:   string;       // 分類
  text:        string;       // 契約書本文（[業者名]プレースホルダーを含む）
  createdAt:   string;
  updatedAt?:  string;
}

// --- 月次目標 ---
export interface MonthlyGoal {
  goalId:       string;  // "{staffName}-{yearMonth}"  e.g. "佐藤 営業マン-2025-01"
  staffName:    string;
  yearMonth:    string;  // "2025-01"
  salesGoal:    number;
  profitGoal:   number;
  surveyGoal:   number;
  estimateGoal: number;
  contractGoal: number;
  updatedAt:    string;
}

// --- AI 解析結果 ---
export interface AiAnalysisResult {
  customerIssue: string;
  keymanReaction: string;
  budget: string;
  nextAction: string;
  /** 次回訪問予定日 YYYY-MM-DD（AI が日時を抽出できた場合のみ） */
  nextVisitDate?: string;
  missingField: 'budget' | 'nextAction' | null;
  followUpQuestion: string | null;
}

// --- 外部業者 ---
export type VendorStatus = 'active' | 'inactive';

export interface VendorBasicContract {
  contractDate:      string;   // 締結日 YYYY-MM-DD
  expiryDate?:       string;   // 有効期限 YYYY-MM-DD
  signedByVendor:    boolean;  // 業者署名済み
  signedAt?:         string;   // 署名日 ISO
  contractNote?:     string;   // 備考
  // 電子締結
  token?:            string;   // 署名URL用トークン（crypto.randomUUID）
  templateText?:     string;   // 契約書本文（ひな形）
  vendorSignature?:  string;   // 業者電子署名 base64 PNG
  signatureAt?:      string;   // 電子署名日時 ISO
}

export interface Vendor {
  vendorId:       string;
  name:           string;        // 業者名
  contactName?:   string;        // 担当者名
  phone?:         string;
  email?:         string;
  address?:       string;
  specialty:      string[];      // 専門工種タグ
  notes?:         string;        // 備考
  status:         VendorStatus;  // active | inactive
  basicContract?: VendorBasicContract;
  createdAt:      string;
  updatedAt?:     string;
}

// --- 業者見積依頼 ---
export type VendorQuoteStatus = 'pending' | 'submitted' | 'reviewed' | 'accepted' | 'rejected';

export interface VendorQuoteItem {
  itemName:  string;
  quantity:  number;
  unit:      string;
  unitPrice: number;
  total:     number;
  note?:     string;
}

export interface VendorQuoteRequest {
  requestId:    string;
  token:        string;          // URLトークン（業者アクセス用）
  projectId:    string;
  projectTitle: string;          // 非正規化コピー
  customerId:   string;
  vendorId:     string;
  vendorName:   string;          // 非正規化コピー
  vendorEmail?: string;
  workScope:    string;          // 依頼内容・作業範囲
  dueDate?:     string;          // 回答期限 YYYY-MM-DD
  status:       VendorQuoteStatus;
  requestNote?: string;          // 依頼側メモ
  createdBy:       string;    // 担当者表示名
  createdByUserId?: string;   // 担当者 Firebase Auth UID（通知用）
  createdAt:    string;
  updatedAt?:   string;
  // 業者からの回答フィールド
  submittedAt?: string;
  quoteType?:   'total' | 'itemized';  // 合計のみ or 明細
  totalAmount?: number;
  items?:       VendorQuoteItem[];
  vendorNote?:  string;          // 業者メモ
  pdfUrl?:      string;          // 業者添付PDFのStorage URL
  // 業者支払い管理
  vendorPaymentDueDate?:    string;   // 業者支払い予定日 YYYY-MM-DD
  vendorPaid?:              boolean;  // 業者支払い済み
  vendorPaidAt?:            string;   // 業者支払い日 YYYY-MM-DD
  vendorReceiptSignature?:  string;   // 受領署名 base64 PNG
  vendorReceiptSignedAt?:   string;   // 受領署名日時 ISO
  // ── 精算ワークフロー（工事完了 → 検収 → 請求 → 支払） ──
  completionReport?: {
    photos:       string[];           // base64 JPEG（圧縮済み）
    notes:        string;
    submittedAt:  string;             // ISO 8601
    submittedVia: 'vendor' | 'staff'; // 業者提出 or スタッフ代理記録
  };
  inspectionResult?: {
    result:      'pass' | 'fail';
    notes:       string;
    inspectedAt: string;
    inspectedBy: string;
  };
  acceptanceCert?: {
    issuedAt: string;
    issuedBy: string;
  };
  vendorInvoice?: {
    photos:     string[];  // 請求書写真 base64
    amount?:    number;
    notes?:     string;
    receivedAt: string;
  };
}

// --- ダッシュボード TODO ---
export type TodoType =
  | 'collection_overdue'         // 入金期限超過（顧客）
  | 'collection_due_soon'        // 入金期限まで3日以内（顧客）
  | 'vendor_payment_pending'     // 業者への支払い未実施
  | 'ltv_followup'               // 完工後LTV再アプローチ推奨
  | 'estimate_followup'          // 見積提出後フォロー未対応
  | 'vendor_report_pending'      // 完了報告書 未受領
  | 'vendor_inspection_pending'  // 検収 未実施
  | 'vendor_invoice_pending';    // 請求書 未受領

export interface DashboardTodo {
  todoId:     string;
  type:       TodoType;
  title:      string;
  body:       string;
  urgency:    'high' | 'medium';
  amount?:    number;    // 関連金額
  dueDate?:   string;    // 期限日
  relatedId?: string;    // contractId / requestId / projectId / customerId
}

// --- ワークスペースタブ ---
/** 案件ワークスペースのタブセクション */
export type WorkspaceSection = 'overview' | 'estimates' | 'contracts' | 'settlement';

// --- 日報 ---
export interface DailyReport {
  reportId:      string;  // "{staffName}-{dateStr}"  e.g. "佐藤 営業マン-2026-05-29"
  staffName:     string;
  dateStr:       string;  // "2026-05-29"
  summary:       string;
  visitCount:    number;
  totalDuration: number;  // seconds
  logIds:        string[];
  generatedAt:   string;  // ISO 8601
}
