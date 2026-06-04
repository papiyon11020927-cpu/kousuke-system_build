import type { Customer, Project, Schedule, InOutLog, ProjectComment, EstimateTemplate, Vendor } from '@/types';

export const MOCK_CUSTOMERS: Customer[] = [
  { customerId: 'CUST-001', name: '佐藤 健二 様',         address: '大阪府大阪市北区梅田3-1',       phone: '06-1234-5678', totalLtv: 3_200_000 },
  { customerId: 'CUST-002', name: '高橋 玲子 様',         address: '兵庫県神戸市中央区三宮町1-2',   phone: '078-987-6543', totalLtv: 150_000 },
  { customerId: 'CUST-003', name: '株式会社 谷口興産 様', address: '京都府京都市下京区烏丸通',     phone: '075-555-6666', totalLtv: 8_500_000 },
  { customerId: 'CUST-004', name: '渡辺 裕太 様',         address: '大阪府吹田市江坂町2-4',         phone: '06-8888-9999', totalLtv: 0 },
];

export const MOCK_PROJECTS: Project[] = [
  { projectId: 'PJ-202605-001', customerId: 'CUST-001', title: '浴室タイル補修及び給湯器交換',          status: 'completed',  amount: 1_200_000, profit: 480_000,   assignee: '山本 営業主任', lastActivityAt: '2026-05-10T10:00:00Z' },
  { projectId: 'PJ-202605-002', customerId: 'CUST-002', title: '高圧配管洗浄＆トイレ部分リフォーム工事', status: 'estimate',   amount: 350_000,   profit: 140_000,   assignee: '佐藤 営業マン',  lastActivityAt: '2026-05-19T15:00:00Z' },
  { projectId: 'PJ-202605-003', customerId: 'CUST-003', title: '和モダン居酒屋 店舗設計・全面改修',      status: 'contract',   amount: 8_500_000, profit: 3_400_000, assignee: '山本 営業主任', lastActivityAt: '2026-05-25T11:00:00Z' },
  { projectId: 'PJ-202605-004', customerId: 'CUST-004', title: 'キッチン配管高圧洗浄（フック商材）',     status: 'lead',       amount: 15_000,    profit: 8_000,     assignee: '佐藤 営業マン',  lastActivityAt: '2026-05-27T09:00:00Z' },
];

export const MOCK_SCHEDULES: Schedule[] = [
  {
    scheduleId: 'SCH-001', projectId: 'PJ-202605-004', customerId: 'CUST-004',
    title: 'キッチン配管現調・高圧洗浄作業',
    startAt: '2026-05-27T10:00:00', endAt: '2026-05-27T11:30:00',
    assignees: ['佐藤 営業マン'], isLtvTriggered: false,
    notes: '初回アプローチ。配管詰まりの状況を確認する。',
  },
  {
    scheduleId: 'SCH-002', projectId: 'PJ-202605-003', customerId: 'CUST-003',
    title: '店舗改修工事 設計最終打ち合わせ',
    startAt: '2026-05-28T14:00:00', endAt: '2026-05-28T16:00:00',
    assignees: ['山本 営業主任'], isLtvTriggered: false,
    notes: '店舗レイアウトの微調整、木材サンプルの確認。',
  },
  {
    scheduleId: 'SCH-003', projectId: 'PJ-202605-001', customerId: 'CUST-001',
    title: '【LTV自動生成】施工1年後 定期アフター点検',
    startAt: '2026-05-29T10:00:00', endAt: '2026-05-29T11:00:00',
    assignees: ['山本 営業主任'], isLtvTriggered: true,
    notes: '施工から1年経過。給湯器の稼働状態チェック。外壁塗装リフォームへの足がかりとする。',
  },
  {
    scheduleId: 'SCH-004', projectId: 'PJ-202605-002', customerId: 'CUST-002',
    title: '配管洗浄後の状況お伺い＆追加見積もり提出',
    startAt: '2026-05-20T11:00:00', endAt: '2026-05-20T12:00:00',
    assignees: ['佐藤 営業マン'], isLtvTriggered: false,
    notes: '追加リフォームのご要望をヒアリングする予定であったが、未実施',
  },
];

export const MOCK_IN_OUT_LOGS: InOutLog[] = [
  {
    logId: 'LOG-001', projectId: 'PJ-202605-004', customerId: 'CUST-004',
    userId: 'sato-01', userName: '佐藤 営業マン', type: 'in',
    timestamp: '2026-05-27T09:55:00Z',
    location: { lat: 34.7592, lng: 135.4962 }, voiceText: '',
  },
  {
    logId: 'LOG-002', projectId: 'PJ-202605-004', customerId: 'CUST-004',
    userId: 'sato-01', userName: '佐藤 営業マン', type: 'out',
    timestamp: '2026-05-27T11:20:00Z',
    location: { lat: 34.7592, lng: 135.4962 },
    voiceText: 'キッチンのシンク下蛇腹ホースに油汚れの強固な詰まりを確認。高圧洗浄にてクリア。洗面所の流れも気にされている様子。次回6月5日に洗面所現調で訪問予約を仮受領。',
  },
];

export const MOCK_COMMENTS: ProjectComment[] = [
  {
    commentId: 'COM-001', projectId: 'PJ-202605-002',
    userId: 'admin-01', userName: '管理者（住吉社長）',
    commentText: '見積提出から1週間経過していますが、お客様の反応はどうですか？高圧洗浄のアフターフォローとして一度お電話するか、直接ご様子を伺いに行ってください。',
    createdAt: '2026-05-26T08:30:00Z',
  },
];

// ─────────────────────────────────────────────────────────────
// 見積書テンプレート サンプルデータ
// ─────────────────────────────────────────────────────────────

export const MOCK_ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  // ── 塗装工事 ────────────────────────────────────────────────
  {
    templateId: 'TPL-PAINT-001',
    name:       '外壁塗装 標準',
    category:   '塗装工事',
    items: [
      { itemId: 'p1-1', itemName: '仮設工事（足場設置・解体）', quantity: 1, unit: '式', unitPrice: 180_000, total: 180_000 },
      { itemId: 'p1-2', itemName: '外壁高圧洗浄',               quantity: 1, unit: '式', unitPrice:  30_000, total:  30_000 },
      { itemId: 'p1-3', itemName: '外壁塗装 下塗り（シーラー）', quantity: 1, unit: '式', unitPrice:  60_000, total:  60_000 },
      { itemId: 'p1-4', itemName: '外壁塗装 中塗り',             quantity: 1, unit: '式', unitPrice:  70_000, total:  70_000 },
      { itemId: 'p1-5', itemName: '外壁塗装 上塗り',             quantity: 1, unit: '式', unitPrice:  70_000, total:  70_000 },
      { itemId: 'p1-6', itemName: '付帯部塗装（雨戸・軒天・幕板等）', quantity: 1, unit: '式', unitPrice: 50_000, total: 50_000 },
      { itemId: 'p1-7', itemName: '養生・清掃費',                quantity: 1, unit: '式', unitPrice:  20_000, total:  20_000 },
      { itemId: 'p1-8', itemName: '諸経費',                      quantity: 1, unit: '式', unitPrice:  20_000, total:  20_000 },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    templateId: 'TPL-PAINT-002',
    name:       '屋根塗装 標準',
    category:   '塗装工事',
    items: [
      { itemId: 'p2-1', itemName: '仮設工事（足場設置・解体）', quantity: 1, unit: '式', unitPrice: 150_000, total: 150_000 },
      { itemId: 'p2-2', itemName: '屋根高圧洗浄',               quantity: 1, unit: '式', unitPrice:  25_000, total:  25_000 },
      { itemId: 'p2-3', itemName: '屋根塗装 下塗り（シーラー）', quantity: 1, unit: '式', unitPrice:  40_000, total:  40_000 },
      { itemId: 'p2-4', itemName: '屋根塗装 中塗り',             quantity: 1, unit: '式', unitPrice:  45_000, total:  45_000 },
      { itemId: 'p2-5', itemName: '屋根塗装 上塗り',             quantity: 1, unit: '式', unitPrice:  45_000, total:  45_000 },
      { itemId: 'p2-6', itemName: '棟板金塗装・補修',            quantity: 1, unit: '式', unitPrice:  20_000, total:  20_000 },
      { itemId: 'p2-7', itemName: '養生・清掃費',                quantity: 1, unit: '式', unitPrice:  15_000, total:  15_000 },
      { itemId: 'p2-8', itemName: '諸経費',                      quantity: 1, unit: '式', unitPrice:  15_000, total:  15_000 },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    templateId: 'TPL-PAINT-003',
    name:       '外壁・屋根 セット塗装',
    category:   '塗装工事',
    items: [
      { itemId: 'p3-1', itemName: '仮設工事（足場設置・解体）',       quantity: 1, unit: '式', unitPrice: 200_000, total: 200_000 },
      { itemId: 'p3-2', itemName: '外壁・屋根 高圧洗浄',              quantity: 1, unit: '式', unitPrice:  40_000, total:  40_000 },
      { itemId: 'p3-3', itemName: '外壁塗装 3工程（下・中・上塗り）', quantity: 1, unit: '式', unitPrice: 200_000, total: 200_000 },
      { itemId: 'p3-4', itemName: '屋根塗装 3工程（下・中・上塗り）', quantity: 1, unit: '式', unitPrice: 130_000, total: 130_000 },
      { itemId: 'p3-5', itemName: '付帯部塗装（雨戸・軒天・破風板等）', quantity: 1, unit: '式', unitPrice: 60_000, total: 60_000 },
      { itemId: 'p3-6', itemName: '棟板金塗装・補修',                  quantity: 1, unit: '式', unitPrice:  20_000, total:  20_000 },
      { itemId: 'p3-7', itemName: '養生・清掃費',                      quantity: 1, unit: '式', unitPrice:  25_000, total:  25_000 },
      { itemId: 'p3-8', itemName: '諸経費',                            quantity: 1, unit: '式', unitPrice:  25_000, total:  25_000 },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },

  // ── 水廻りリフォーム ─────────────────────────────────────────
  {
    templateId: 'TPL-BATH-001',
    name:       '浴室リフォーム（ユニットバス交換）',
    category:   '水廻りリフォーム',
    items: [
      { itemId: 'b1-1', itemName: '既存浴室解体・撤去処分',         quantity: 1, unit: '式', unitPrice: 120_000, total: 120_000 },
      { itemId: 'b1-2', itemName: 'ユニットバス本体（1616サイズ）', quantity: 1, unit: '台', unitPrice: 450_000, total: 450_000 },
      { itemId: 'b1-3', itemName: 'ユニットバス設置工事',           quantity: 1, unit: '式', unitPrice: 100_000, total: 100_000 },
      { itemId: 'b1-4', itemName: '給排水配管工事',                 quantity: 1, unit: '式', unitPrice:  60_000, total:  60_000 },
      { itemId: 'b1-5', itemName: '電気工事（換気扇・照明）',       quantity: 1, unit: '式', unitPrice:  40_000, total:  40_000 },
      { itemId: 'b1-6', itemName: '大工工事（下地補修等）',         quantity: 1, unit: '式', unitPrice:  50_000, total:  50_000 },
      { itemId: 'b1-7', itemName: '養生・清掃費',                   quantity: 1, unit: '式', unitPrice:  20_000, total:  20_000 },
      { itemId: 'b1-8', itemName: '諸経費',                         quantity: 1, unit: '式', unitPrice:  30_000, total:  30_000 },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    templateId: 'TPL-KITCHEN-001',
    name:       'キッチンリフォーム（システムキッチン交換）',
    category:   '水廻りリフォーム',
    items: [
      { itemId: 'k1-1', itemName: '既存キッチン解体・撤去処分',           quantity: 1, unit: '式', unitPrice: 80_000,  total: 80_000  },
      { itemId: 'k1-2', itemName: 'システムキッチン本体（I型 2550mm）',   quantity: 1, unit: '台', unitPrice: 550_000, total: 550_000 },
      { itemId: 'k1-3', itemName: 'キッチン設置工事',                     quantity: 1, unit: '式', unitPrice: 80_000,  total: 80_000  },
      { itemId: 'k1-4', itemName: '給排水配管工事',                       quantity: 1, unit: '式', unitPrice: 50_000,  total: 50_000  },
      { itemId: 'k1-5', itemName: 'ガス工事（IHは電気工事）',             quantity: 1, unit: '式', unitPrice: 30_000,  total: 30_000  },
      { itemId: 'k1-6', itemName: '壁・床仕上げ（タイル・クッションフロア）', quantity: 1, unit: '式', unitPrice: 60_000, total: 60_000 },
      { itemId: 'k1-7', itemName: '養生・清掃費',                         quantity: 1, unit: '式', unitPrice: 20_000,  total: 20_000  },
      { itemId: 'k1-8', itemName: '諸経費',                               quantity: 1, unit: '式', unitPrice: 30_000,  total: 30_000  },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    templateId: 'TPL-TOILET-001',
    name:       'トイレリフォーム（便器交換・内装仕上げ）',
    category:   '水廻りリフォーム',
    items: [
      { itemId: 't1-1', itemName: '既存便器解体・撤去処分',                  quantity: 1, unit: '式', unitPrice:  30_000, total:  30_000 },
      { itemId: 't1-2', itemName: 'システムトイレ本体（ウォシュレット一体型）', quantity: 1, unit: '台', unitPrice: 180_000, total: 180_000 },
      { itemId: 't1-3', itemName: 'トイレ設置工事',                          quantity: 1, unit: '式', unitPrice:  30_000, total:  30_000 },
      { itemId: 't1-4', itemName: '給排水配管工事',                          quantity: 1, unit: '式', unitPrice:  25_000, total:  25_000 },
      { itemId: 't1-5', itemName: '電気工事（コンセント増設）',              quantity: 1, unit: '式', unitPrice:  15_000, total:  15_000 },
      { itemId: 't1-6', itemName: '壁クロス張り替え',                        quantity: 1, unit: '式', unitPrice:  25_000, total:  25_000 },
      { itemId: 't1-7', itemName: '床クッションフロア張り替え',              quantity: 1, unit: '式', unitPrice:  18_000, total:  18_000 },
      { itemId: 't1-8', itemName: '諸経費',                                  quantity: 1, unit: '式', unitPrice:  10_000, total:  10_000 },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },

  // ── 内装リフォーム ───────────────────────────────────────────
  {
    templateId: 'TPL-INTERIOR-001',
    name:       '居室 内装リフォーム（床・壁・天井）',
    category:   '内装リフォーム',
    items: [
      { itemId: 'i1-1', itemName: '既存内装解体・撤去処分',              quantity:  1, unit: '式', unitPrice:  40_000, total:  40_000 },
      { itemId: 'i1-2', itemName: 'フローリング張り替え',                quantity: 20, unit: '㎡',  unitPrice:   8_000, total: 160_000 },
      { itemId: 'i1-3', itemName: '壁クロス張り替え',                    quantity: 40, unit: '㎡',  unitPrice:   1_800, total:  72_000 },
      { itemId: 'i1-4', itemName: '天井クロス張り替え',                  quantity: 10, unit: '㎡',  unitPrice:   1_800, total:  18_000 },
      { itemId: 'i1-5', itemName: '建具交換（ドア・建具一式）',          quantity:  1, unit: '式', unitPrice:  60_000, total:  60_000 },
      { itemId: 'i1-6', itemName: '下地補修・パテ処理',                  quantity:  1, unit: '式', unitPrice:  20_000, total:  20_000 },
      { itemId: 'i1-7', itemName: '養生・清掃費',                        quantity:  1, unit: '式', unitPrice:  15_000, total:  15_000 },
      { itemId: 'i1-8', itemName: '諸経費',                              quantity:  1, unit: '式', unitPrice:  15_000, total:  15_000 },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },

  // ── フック商材（高圧洗浄） ────────────────────────────────────
  {
    templateId: 'TPL-PIPE-001',
    name:       '配管高圧洗浄（キッチン・浴室・トイレ）',
    category:   '配管・メンテナンス',
    items: [
      { itemId: 'pp1-1', itemName: '高圧洗浄作業費（蛇口〜排水管）', quantity: 1, unit: '式', unitPrice:  8_000, total:  8_000 },
      { itemId: 'pp1-2', itemName: '薬品洗浄・除菌処理',             quantity: 1, unit: '式', unitPrice:  3_000, total:  3_000 },
      { itemId: 'pp1-3', itemName: '点検・診断費',                   quantity: 1, unit: '式', unitPrice:  2_000, total:  2_000 },
      { itemId: 'pp1-4', itemName: '出張費（大阪市内）',             quantity: 1, unit: '式', unitPrice:  2_000, total:  2_000 },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    templateId: 'TPL-PIPE-002',
    name:       '排水管 高圧洗浄（集合住宅・全戸）',
    category:   '配管・メンテナンス',
    items: [
      { itemId: 'pp2-1', itemName: '共用排水管高圧洗浄',         quantity:  1,  unit: '式', unitPrice: 120_000, total: 120_000 },
      { itemId: 'pp2-2', itemName: '各住戸排水管洗浄',           quantity: 20,  unit: '戸', unitPrice:   5_000, total: 100_000 },
      { itemId: 'pp2-3', itemName: 'カメラ内視鏡点検（共用部）', quantity:  1,  unit: '式', unitPrice:  30_000, total:  30_000 },
      { itemId: 'pp2-4', itemName: '廃液処理・養生費',           quantity:  1,  unit: '式', unitPrice:  15_000, total:  15_000 },
      { itemId: 'pp2-5', itemName: '諸経費',                     quantity:  1,  unit: '式', unitPrice:  10_000, total:  10_000 },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },

  // ── 店舗改修 ─────────────────────────────────────────────────
  {
    templateId: 'TPL-STORE-001',
    name:       '店舗全面改修工事',
    category:   '店舗・事務所リフォーム',
    items: [
      { itemId: 's1-1', itemName: '解体・撤去工事',         quantity: 1, unit: '式', unitPrice: 500_000,   total: 500_000   },
      { itemId: 's1-2', itemName: '内装造作工事（大工工事）', quantity: 1, unit: '式', unitPrice: 1_200_000, total: 1_200_000 },
      { itemId: 's1-3', itemName: '電気設備工事',           quantity: 1, unit: '式', unitPrice: 400_000,   total: 400_000   },
      { itemId: 's1-4', itemName: '空調設備工事',           quantity: 1, unit: '式', unitPrice: 350_000,   total: 350_000   },
      { itemId: 's1-5', itemName: '給排水設備工事',         quantity: 1, unit: '式', unitPrice: 300_000,   total: 300_000   },
      { itemId: 's1-6', itemName: '床・壁・天井仕上げ工事', quantity: 1, unit: '式', unitPrice: 600_000,   total: 600_000   },
      { itemId: 's1-7', itemName: '外装工事（サイン・外壁）', quantity: 1, unit: '式', unitPrice: 300_000, total: 300_000   },
      { itemId: 's1-8', itemName: '設計監理費',             quantity: 1, unit: '式', unitPrice: 200_000,   total: 200_000   },
      { itemId: 's1-9', itemName: '諸経費',                 quantity: 1, unit: '式', unitPrice: 150_000,   total: 150_000   },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
];

// ─────────────────────────────────────────────────────────────
// 外部業者 サンプルデータ
// ─────────────────────────────────────────────────────────────
export const MOCK_VENDORS: Vendor[] = [
  {
    vendorId:    'VND-001',
    name:        '山田塗装工業 株式会社',
    contactName: '山田 浩二',
    phone:       '06-1234-5678',
    email:       'yamada-coating@example.com',
    address:     '大阪府大阪市此花区春日出北1-2-3',
    specialty:   ['塗装工事', '外壁工事', '防水工事'],
    notes:       '外壁・屋根塗装が得意。ウレタン防水の施工実績多数。',
    status:      'active',
    basicContract: {
      contractDate:   '2025-04-01',
      expiryDate:     '2027-03-31',
      signedByVendor: true,
      signedAt:       '2025-04-01T10:00:00.000Z',
      contractNote:   '2年更新・自動更新条項あり',
    },
    createdAt: '2025-04-01T10:00:00.000Z',
  },
  {
    vendorId:    'VND-002',
    name:        '関西防水技研 有限会社',
    contactName: '中村 修一',
    phone:       '06-9876-5432',
    email:       'kansai-bousui@example.com',
    address:     '大阪府堺市堺区南旅篭町東4丁5-6',
    specialty:   ['防水工事', '屋根工事'],
    notes:       'ウレタン・FRP防水の専門業者。緊急対応可。',
    status:      'active',
    basicContract: {
      contractDate:   '2025-01-15',
      expiryDate:     '2026-01-14',
      signedByVendor: true,
      signedAt:       '2025-01-15T09:00:00.000Z',
    },
    createdAt: '2025-01-15T09:00:00.000Z',
  },
  {
    vendorId:    'VND-003',
    name:        '近畿内装サービス 株式会社',
    contactName: '西田 敬子',
    phone:       '072-333-4444',
    email:       'kinki-naiso@example.com',
    address:     '大阪府東大阪市荒本北1-4-17',
    specialty:   ['内装工事', '左官工事'],
    status:      'active',
    basicContract: {
      contractDate:   '2026-03-01',
      signedByVendor: false,
      contractNote:   '契約書送付済み・署名待ち',
    },
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    vendorId:  'VND-004',
    name:      '新日本電設 有限会社',
    phone:     '06-5678-9012',
    specialty: ['電気工事'],
    notes:     '第一種電気工事士在籍。低圧電力設備の交換・増設。',
    status:    'active',
    createdAt: '2025-06-01T00:00:00.000Z',
  },
  {
    vendorId:    'VND-005',
    name:        '阪神給排水設備 合同会社',
    contactName: '辻 洋介',
    phone:       '078-222-3333',
    specialty:   ['給排水工事'],
    notes:       '神戸・阪神間エリア対応。緊急駆けつけ対応あり。',
    status:      'active',
    basicContract: {
      contractDate:   '2025-09-01',
      expiryDate:     '2026-08-31',
      signedByVendor: true,
      signedAt:       '2025-09-01T10:00:00.000Z',
    },
    createdAt: '2025-09-01T10:00:00.000Z',
  },
  {
    vendorId:  'VND-006',
    name:      'みどり造園 個人事業',
    specialty: ['造園・外構'],
    phone:     '090-1234-5678',
    status:    'active',
    createdAt: '2026-01-10T00:00:00.000Z',
  },
];
