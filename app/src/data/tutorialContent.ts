/**
 * tutorialContent.ts
 * チュートリアル／ヘルプページ表示用コンテンツ定義。
 * 機能が増えたら featureGuides に項目を追加するだけで反映される。
 */

export interface OverviewSection {
  id:    string;
  title: string;
  body:  string;
}

export const overviewSections: OverviewSection[] = [
  {
    id: 'customer-project-driven',
    title: '顧客・案件駆動のシステムです',
    body: '本システムは「顧客」と「案件」を中心にすべての情報がつながっています。訪問報告・スケジュール・見積・契約は必ずどの顧客・どの案件に紐づくかを意識して登録してください。',
  },
  {
    id: 'ltv',
    title: '顧客のLTV（生涯価値）最大化を目指します',
    body: '1件の受注で終わらせず、顧客ごとの累計受注額（LTV）を増やすことが目的です。顧客カルテで過去の案件履歴を確認しながら、次の提案につなげましょう。',
  },
  {
    id: 'workspace',
    title: '案件ワークスペースをフル活用します',
    body: '見積・契約・外部業者への引合いなど、1つの案件に関する作業はすべて「案件ワークスペース」に集約されます。案件の進行状況はワークスペースを開けば一目で分かります。',
  },
  {
    id: 'pipeline',
    title: 'パイプラインで対応漏れを検知します',
    body: '案件はステータスごとにカンバン形式で並びます。長期間ステータスが動いていない案件は対応漏れの可能性があるため、パイプライン画面で定期的に確認してください。',
  },
];

export interface FlowStep {
  id:          string;
  order:       number;
  title:       string;
  who:         string;
  description: string;
  /** どの画面で行うか */
  location:    string;
  /** 一度だけで良いか、案件ごとに毎回必要か（表示用の自由記述） */
  frequency:   string;
  /** 必須ステップかどうか（false の場合は任意ルートとして表示） */
  required:    boolean;
  /**
   * このステップが直前のステップとの間でループする業務サイクルの開始/終了を表す。
   * 'loop-start' から 'loop-end' までを繰り返してから次のステップへ進む、という意味。
   */
  loop?:       'loop-start' | 'loop-end';
  /** 機能ガイド（featureGuides）の対応 id。指定すると「詳しい使い方を見る」リンクが表示される。 */
  guideId?:    string;
}

/**
 * 最初に一度（または業者が増えた時など低頻度に）行うマスタ登録・初期設定。
 * 日々の営業サイクルとは独立して、管理者が随時整えていくものが中心。
 */
export const initialSetupSteps: FlowStep[] = [
  {
    id: 'setup-users',
    order: 1,
    title: 'ユーザーを登録する',
    who: '管理者・スーパー管理者',
    description: '営業・現場メンバーのアカウントを作成します。ロール（営業・現場／管理者／スーパー管理者）に応じて操作できる範囲が変わるため、最初に正しいロールで登録してください。',
    location: 'マスタ管理 ＞ ユーザー管理',
    frequency: '初回のみ',
    required: true,
  },
  {
    id: 'setup-vendors',
    order: 2,
    title: '外部業者を登録する',
    who: '管理者・スーパー管理者',
    description: '見積依頼を出す外部業者（協力会社）の情報を登録します。新しい業者と取引を始めるたびに、その都度追加登録してください。',
    location: 'マスタ管理 ＞ 外部業者管理',
    frequency: '随時（業者が増えるたびに）',
    required: true,
  },
  {
    id: 'setup-templates',
    order: 3,
    title: '見積・契約テンプレートを登録する',
    who: '管理者・スーパー管理者',
    description: '見積書・契約書のフォーマットをテンプレートとして登録しておくと、案件ごとの見積・契約作成が効率化されます。',
    location: 'マスタ管理 ＞ テンプレート管理',
    frequency: '初回のみ（以降は随時更新）',
    required: true,
  },
  {
    id: 'setup-goals',
    order: 4,
    title: '月間目標（KPI）を設定する',
    who: '管理者・スーパー管理者（任意）',
    description: '営業金額・粗利・現調件数・見積件数などの月間目標を設定します。未設定でも他機能は利用できますが、ダッシュボードの達成率表示のために早めの設定を推奨します。',
    location: '予算・目標管理',
    frequency: '任意・随時設定',
    required: false,
  },
];

/**
 * 顧客登録から受注・精算まで、日々繰り返される業務サイクル。
 * 「スケジュール登録 → 訪問・現場報告」は案件が成約するまで何度も繰り返される。
 * 上から順に実施することを想定している。
 */
export const businessFlowSteps: FlowStep[] = [
  {
    id: 'flow-customer',
    order: 1,
    title: '顧客を登録する',
    who: '営業・現場、管理者',
    description: 'すべての案件は顧客に紐づきます。案件を作る前に、まず顧客（顧客名・住所が必須）を登録してください。',
    location: '顧客カルテ ＞ 顧客を登録する',
    frequency: '新規顧客ごと',
    required: true,
  },
  {
    id: 'flow-project',
    order: 2,
    title: '案件を登録する',
    who: '営業・現場、管理者',
    description: '顧客に対して具体的な案件（工事内容）を登録します。スタッフが登録した場合は管理者の承認が必要です。',
    location: '顧客カルテ ＞ 対象顧客 ＞ 案件を登録する',
    frequency: '案件ごと',
    required: true,
    guideId: 'project-register',
  },
  {
    id: 'flow-schedule',
    order: 3,
    title: '訪問スケジュールを登録する',
    who: '営業・現場',
    description: '現地調査や打ち合わせなどの訪問予定をカレンダーに登録します。案件に紐づけて登録すると、後の報告作業がスムーズになります。',
    location: 'スケジュール（カレンダー）',
    frequency: '訪問のたびに',
    required: true,
    loop: 'loop-start',
  },
  {
    id: 'flow-report',
    order: 4,
    title: '訪問後に現場報告を記録する',
    who: '営業・現場',
    description: '訪問後は現場報告で結果を記録します。音声入力＋AI解析で課題・キーマンの反応・予算感・次回アクションを整理できます。提案に十分な材料が集まるまで「スケジュール登録 → 訪問・現場報告」を繰り返します。',
    location: '現場報告',
    frequency: '訪問のたびに',
    required: true,
    loop: 'loop-end',
  },
  {
    id: 'flow-estimate',
    order: 5,
    title: '見積を作成する',
    who: '営業・現場、管理者',
    description: '訪問で得た情報をもとに見積書を作成します。テンプレートを使えば短時間で作成できます。提示後は案件のステータスを「見積提出」に進めます。',
    location: '案件ワークスペース ＞ 見積',
    frequency: '案件ごと',
    required: true,
    guideId: 'estimate',
  },
  {
    id: 'flow-contract',
    order: 6,
    title: '契約を作成・署名する',
    who: '営業・現場、管理者',
    description: '見積が合意に至ったら契約書を作成し、顧客の署名を依頼します（QR共有での電子署名に対応）。契約済みになると確度は自動で100%になります。',
    location: '案件ワークスペース ＞ 契約',
    frequency: '案件ごと',
    required: true,
    guideId: 'contract',
  },
  {
    id: 'flow-settlement',
    order: 7,
    title: '工事完了後に精算する',
    who: '営業・現場、管理者',
    description: '施工完了後、外部業者への支払いや顧客との最終金額を精算します。精算が完了すると案件はクローズとなり、顧客のLTV（生涯価値）に積み上がります。',
    location: '案件ワークスペース／パイプライン（精算中ステータス）',
    frequency: '案件ごと',
    required: true,
    guideId: 'settlement',
  },
];

export type DeviceStep = { pc: string; mobile: string };

export interface FeatureGuide {
  id:                 string;
  title:              string;
  /** lucide-react のアイコン名（HelpPage側でマッピング） */
  icon:               string;
  summary:            string;
  requiredFields:     string[];
  optionalFields:     string[];
  /** 登録後に自動更新・別作業で更新される項目とその説明 */
  laterUpdatedFields: { field: string; note: string }[];
  steps:              DeviceStep[];
  /** src/assets/tutorial/ 配下の画像ファイル名（任意） */
  screenshots?:       string[];
}

export const featureGuides: FeatureGuide[] = [
  {
    id: 'project-register',
    title: '案件の登録方法',
    icon: 'LucideUsers',
    summary: '顧客カルテから新しい案件を登録します。',
    requiredFields: ['案件名', '案件ID（自動生成・管理者は編集可）'],
    optionalFields: [
      'ステータス（引き合い／見積提出／契約済／施工中／完工／精算中／クローズ／失注）',
      '工事種別カテゴリ（外壁塗装・屋根工事・太陽光・リフォーム・内装工事・設備工事・新築・増改築・その他）',
      '確度（0〜100%スライダー）',
      '受注金額・顧客予算',
      '希望納期',
      '顧客課題・ニーズ',
      '担当者（複数・按分配分）',
      '備考',
    ],
    laterUpdatedFields: [
      { field: '確度', note: '契約済みステータス以降は自動で100%になります。' },
      { field: 'ステータス', note: 'パイプライン画面でカード移動するだけで更新されます。' },
      { field: '承認状態', note: 'スタッフが作成した案件は「承認待ち」として登録され、管理者の承認後に確定します。' },
    ],
    steps: [
      {
        pc: '顧客カルテ画面で対象顧客を開き、「案件を登録する」ボタンを押します。',
        mobile: '顧客カルテ画面で対象顧客をタップし、画面下の「案件を登録する」ボタンをタップします。',
      },
      {
        pc: '案件名を入力し、必要に応じてステータスや金額などのオプション項目を入力します。',
        mobile: '案件名を入力し、必要な項目をスクロールしながら入力します。',
      },
      {
        pc: '「登録する」ボタンを押して保存します（スタッフが登録した場合は「承認依頼として登録」になります）。',
        mobile: '画面下部の「登録する」ボタンをタップして保存します。',
      },
    ],
  },
  {
    id: 'schedule-register',
    title: 'スケジュールの登録方法',
    icon: 'LucideCalendar',
    summary: 'カレンダー画面、または案件ワークスペースから訪問予定などを登録します。',
    requiredFields: ['予定タイトル', '日付', '開始時間・終了時間'],
    optionalFields: ['担当者（複数選択可）', '紐づける案件', 'メモ'],
    laterUpdatedFields: [
      { field: '案件の紐付け', note: '案件ワークスペースから予定を作成した場合、案件は自動で固定（ロック）され変更できません。' },
    ],
    steps: [
      {
        pc: 'カレンダー画面で日付セルをクリックすると「予定を追加」モーダルが開きます。',
        mobile: 'カレンダー画面で日付を長押しすると「予定を追加」モーダルが開きます。',
      },
      {
        pc: 'タイトル・時間を入力し、必要なら担当者や案件を選択します。',
        mobile: 'タイトル・時間を入力し、必要なら担当者や案件を選択します。',
      },
      {
        pc: '既存の予定はクリック→ドラッグで時間帯を調整できます。',
        mobile: '既存の予定は長押し後にスワイプで時間帯を調整できます（通常のスワイプは画面スクロールです）。',
      },
    ],
    screenshots: [],
  },
  {
    id: 'report',
    title: '報告機能の使い方',
    icon: 'LucideMic',
    summary: '現場訪問後の報告を音声入力・AI解析で効率的に記録します。',
    requiredFields: ['報告内容（テキストまたは音声入力）'],
    optionalFields: ['現場写真（複数添付・個別削除可）', '顧客の課題・キーマンの反応・予算感・次回アクション'],
    laterUpdatedFields: [
      { field: '顧客の課題／キーマンの反応／予算感／次回アクション', note: '「AI解析を開始」ボタンで音声・テキストから自動抽出されます。不足情報はAIマネージャーが追加質問するので、チャット形式で回答してください。' },
    ],
    steps: [
      {
        pc: '現場報告画面でマイクボタンを押して話すか、テキストエリアに直接入力します。',
        mobile: '現場報告画面でマイクボタンをタップして話すか、テキストエリアに直接入力します。',
      },
      {
        pc: '入力後「AI解析を開始」ボタンを押すと、課題・反応・予算感・次回アクションが自動抽出されます。',
        mobile: '入力後「AI解析を開始」ボタンをタップすると同様に自動抽出されます。',
      },
      {
        pc: '抽出結果を確認・修正し、必要であれば現場写真を添付して保存します。',
        mobile: '抽出結果を確認・修正し、カメラで撮影した写真を添付して保存します。',
      },
    ],
  },
  {
    id: 'pipeline',
    title: 'パイプライン（対応漏れ検知）',
    icon: 'LucideLayoutDashboard',
    summary: '案件をステータス別のカンバンで一覧表示し、停滞している案件を見つけます。',
    requiredFields: [],
    optionalFields: [],
    laterUpdatedFields: [
      { field: 'ステータス', note: 'カードをドラッグ＆ドロップすると案件のステータスが更新されます。' },
    ],
    steps: [
      { pc: 'パイプライン画面でカードをドラッグして別のステータス列に移動します。', mobile: 'パイプライン画面でカードを長押しして別のステータス列に移動します。' },
    ],
  },
  {
    id: 'workspace',
    title: '案件ワークスペース',
    icon: 'LucideLayers',
    summary: '見積・契約・外部業者への引合いなど、案件に関する作業を1か所に集約します。',
    requiredFields: [],
    optionalFields: ['見積作成', '契約書面の作成・署名依頼', '外部業者への見積依頼'],
    laterUpdatedFields: [],
    steps: [
      { pc: '案件ワークスペースを開き、タブで見積・契約・業者引合いを切り替えます。', mobile: '案件ワークスペースを開き、タブを横スクロールして切り替えます。' },
    ],
  },
  {
    id: 'estimate',
    title: '見積の作成方法',
    icon: 'LucideFileText',
    summary: '案件ワークスペースから見積書を作成し、顧客への提示まで進めます。',
    requiredFields: ['見積項目・金額'],
    optionalFields: ['見積・契約テンプレートからの読み込み', '備考'],
    laterUpdatedFields: [
      { field: '承認状態', note: 'スタッフが作成した見積は管理者の承認が必要です。承認依頼の通知が管理者に届きます。' },
      { field: '案件ステータス', note: '見積提出後は、パイプライン画面でカードを「見積提出」列に移動して進捗を反映してください。' },
    ],
    steps: [
      {
        pc: '案件ワークスペースの「見積」タブを開き、「見積を作成」ボタンを押します。',
        mobile: '案件ワークスペースの「見積」タブを開き、画面下の「見積を作成」ボタンをタップします。',
      },
      {
        pc: 'テンプレートを選択するか、見積項目・金額を直接入力します。',
        mobile: 'テンプレートを選択するか、見積項目・金額を直接入力します。',
      },
      {
        pc: '保存すると見積が登録されます（スタッフ作成時は管理者の承認待ちになります）。',
        mobile: '保存すると見積が登録されます（スタッフ作成時は管理者の承認待ちになります）。',
      },
    ],
  },
  {
    id: 'contract',
    title: '契約の作成・署名方法',
    icon: 'LucideShield',
    summary: '見積が合意に至った案件の契約書を作成し、顧客の署名を依頼します。',
    requiredFields: ['契約金額', '契約日'],
    optionalFields: ['契約書テンプレートからの読み込み', '備考'],
    laterUpdatedFields: [
      { field: '承認状態', note: 'スタッフが作成した契約も管理者の承認が必要です。' },
      { field: '確度', note: '契約済みステータスになると案件の確度は自動で100%になります。' },
      { field: '顧客署名', note: 'QRコードを顧客に共有し、顧客側の画面で電子署名してもらう運用です。' },
    ],
    steps: [
      {
        pc: '案件ワークスペースの「契約」タブを開き、「契約書を作成」ボタンを押します。',
        mobile: '案件ワークスペースの「契約」タブを開き、画面下の「契約書を作成」ボタンをタップします。',
      },
      {
        pc: 'テンプレートを選択し、契約金額・契約日を入力して保存します。',
        mobile: 'テンプレートを選択し、契約金額・契約日を入力して保存します。',
      },
      {
        pc: '顧客に署名用QRコードを共有し、署名が完了すると契約が確定します。',
        mobile: '顧客に署名用QRコードを共有し、署名が完了すると契約が確定します。',
      },
    ],
  },
  {
    id: 'settlement',
    title: '精算の方法',
    icon: 'LucideLayers',
    summary: '工事完了後、外部業者への支払いと顧客との最終金額を精算し、案件をクローズします。',
    requiredFields: ['受領金額（顧客からの最終金額）'],
    optionalFields: ['外部業者への支払金額', '精算メモ'],
    laterUpdatedFields: [
      { field: '案件ステータス', note: '精算が完了すると案件は「クローズ」になります。' },
      { field: '顧客のLTV', note: '精算完了後、受注金額が顧客の累計LTV（生涯価値）に積み上がります。' },
    ],
    steps: [
      {
        pc: '案件ワークスペースの精算パネルを開き、受領金額・業者への支払金額を入力します。',
        mobile: '案件ワークスペースの精算パネルを開き、受領金額・業者への支払金額を入力します。',
      },
      {
        pc: '内容を確認し、「精算を確定」ボタンを押します。',
        mobile: '内容を確認し、画面下の「精算を確定」ボタンをタップします。',
      },
    ],
  },
  {
    id: 'goals',
    title: '予算・目標管理',
    icon: 'LucideTarget',
    summary: '月間の営業金額・粗利・現調件数・見積件数などのKPI目標を設定・確認します。',
    requiredFields: [],
    optionalFields: ['月間目標値（営業金額・粗利・現調件数・見積件数）'],
    laterUpdatedFields: [
      { field: '実績値', note: '案件・報告の登録に応じて自動集計されます。' },
    ],
    steps: [
      { pc: '予算・目標管理画面で対象月を選び、目標値を入力します。', mobile: '予算・目標管理画面で対象月を選び、目標値を入力します。' },
    ],
  },
  {
    id: 'daily-report',
    title: '日報',
    icon: 'LucideFileText',
    summary: 'IN/OUTの訪問ログと時間集計を確認できます。',
    requiredFields: [],
    optionalFields: [],
    laterUpdatedFields: [
      { field: '訪問ログ', note: '現場報告画面でのIN/OUT操作に応じて自動反映されます。' },
    ],
    steps: [
      { pc: '日報画面で対象日・対象スタッフの訪問ログを確認します。', mobile: '日報画面で対象日・対象スタッフの訪問ログを確認します。' },
    ],
  },
  {
    id: 'analytics',
    title: '分析レポート（管理者）',
    icon: 'LucideBarChart3',
    summary: '受注金額やカテゴリ別の集計をグラフで確認できます。',
    requiredFields: [],
    optionalFields: [],
    laterUpdatedFields: [],
    steps: [
      { pc: '分析レポート画面で期間・対象を選択しグラフを確認します。', mobile: '分析レポート画面で期間・対象を選択しグラフを確認します。' },
    ],
  },
  {
    id: 'masters',
    title: 'マスタ管理（テンプレート・業者・ユーザー）',
    icon: 'LucideSettings',
    summary: '見積・契約テンプレート、外部業者、ユーザーの登録・編集を行います（管理者・スーパー管理者）。',
    requiredFields: [],
    optionalFields: [],
    laterUpdatedFields: [],
    steps: [
      { pc: 'サイドバーの「マスタ管理」を開き、テンプレート管理／外部業者管理／ユーザー管理から編集します。', mobile: 'メニューの「マスタ管理」を開き、各サブメニューから編集します。' },
    ],
  },
];

export interface FaqItem {
  id:       string;
  question: string;
  answer:   string;
}

export const faqItems: FaqItem[] = [
  {
    id: 'add-user',
    question: '新しいユーザーを追加するにはどうすればいいですか？',
    answer: 'マスタ管理＞ユーザー管理（管理者のみ）から「ユーザーを追加」を選び、担当者名・メールアドレス・初期パスワード（6文字以上）・ロール（営業・現場／管理者／スーパー管理者）を入力してください。',
  },
  {
    id: 'delete-user',
    question: 'ユーザーを削除するにはどうすればいいですか？',
    answer: 'マスタ管理＞ユーザー管理の一覧から対象ユーザーを選び、削除を実行してください。確認ポップアップ後、Firebase Authアカウントとユーザー情報が同時に削除されます。',
  },
  {
    id: 'password-rule',
    question: 'パスワードの条件は何ですか？',
    answer: '6文字以上で設定してください。既に使われているメールアドレスは登録できません。',
  },
  {
    id: 'permission-error',
    question: '「権限エラー」と表示されました。どうすればいいですか？',
    answer: 'ロール（営業・現場／管理者／スーパー管理者）によって操作できる範囲が異なります。権限が必要な操作の場合は管理者に依頼するか、Firestoreのセキュリティルールを確認してください。',
  },
  {
    id: 'reopen-tutorial',
    question: 'チュートリアルをもう一度見たいです。',
    answer: 'サイドバーの「ヘルプ／チュートリアル」からいつでもこのページに戻れます。',
  },
  {
    id: 'project-approval',
    question: 'スタッフが登録した案件はすぐに反映されますか？',
    answer: 'スタッフが登録した案件は「承認待ち」状態になり、管理者が承認するまでパイプライン等には確定表示されません。',
  },
];
