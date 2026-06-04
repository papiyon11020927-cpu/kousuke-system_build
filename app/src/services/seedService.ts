import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { ContractTemplate } from '@/types';
import {
  MOCK_CUSTOMERS, MOCK_PROJECTS, MOCK_SCHEDULES,
  MOCK_IN_OUT_LOGS, MOCK_COMMENTS, MOCK_ESTIMATE_TEMPLATES, MOCK_VENDORS,
} from '@/data/mockData';

const docRef = (col: string, id: string) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', col, id);

/** 初回のみデモデータを Firestore へ投入。既投入なら false を返す */
export const seedInitialData = async (): Promise<boolean> => {
  const flagRef = docRef('init_flag', 'done');
  if ((await getDoc(flagRef)).exists()) return false;

  for (const item of MOCK_CUSTOMERS)   await setDoc(docRef('customers',        item.customerId),  item);
  for (const item of MOCK_PROJECTS)    await setDoc(docRef('projects',          item.projectId),   item);
  for (const item of MOCK_SCHEDULES)   await setDoc(docRef('schedules',         item.scheduleId),  item);
  for (const item of MOCK_IN_OUT_LOGS) await setDoc(docRef('in_out_logs',       item.logId),       item);
  for (const item of MOCK_COMMENTS)    await setDoc(docRef('project_comments',  item.commentId),   item);

  await setDoc(flagRef, { done: true, seededAt: new Date().toISOString() });
  return true;
};

/**
 * 見積書テンプレートのサンプルを初回のみ投入。
 * 顧客データとは独立したフラグで管理するため、
 * 既存ユーザーにも自動適用される。
 */
export const seedEstimateTemplates = async (): Promise<boolean> => {
  const flagRef = docRef('init_flag', 'templates_v1');
  if ((await getDoc(flagRef)).exists()) return false;

  for (const tpl of MOCK_ESTIMATE_TEMPLATES) {
    await setDoc(docRef('estimate_templates', tpl.templateId), tpl);
  }

  await setDoc(flagRef, { done: true, seededAt: new Date().toISOString() });
  return true;
};

/**
 * 外部業者サンプルデータを初回のみ投入。
 * 既存ユーザーにも自動適用される独立フラグで管理。
 */
export const seedVendors = async (): Promise<boolean> => {
  const flagRef = docRef('init_flag', 'vendors_v1');
  if ((await getDoc(flagRef)).exists()) return false;

  for (const vendor of MOCK_VENDORS) {
    await setDoc(docRef('vendors', vendor.vendorId), vendor);
  }

  await setDoc(flagRef, { done: true, seededAt: new Date().toISOString() });
  return true;
};

/**
 * 契約書テンプレートのサンプルを初回のみ投入。
 * 独立フラグで管理するため既存ユーザーにも自動適用される。
 */
export const seedContractTemplates = async (): Promise<boolean> => {
  const flagRef = docRef('init_flag', 'contract_templates_v1');
  if ((await getDoc(flagRef)).exists()) return false;

  const now = new Date().toISOString();
  const templates: ContractTemplate[] = [
    {
      templateId: 'CTPL-STANDARD-001',
      name:       '標準取引基本契約書',
      category:   '汎用',
      text: `取引基本契約書

甲（発注者）: 住良建設株式会社
乙（受注者）: [業者名]

甲乙間の取引に際し、以下の条件を基本とした取引基本契約を締結する。

第1条（目的）
本契約は、甲乙間で行う工事・サービス等の個別取引に適用する基本的事項を定めることを目的とする。

第2条（個別発注）
個別取引は甲が発行する発注書（または口頭・電話・メール等の指示）により成立し、乙はこれを承諾した時点で契約が成立するものとする。

第3条（代金の支払い）
甲は乙が発行する請求書に基づき、請求月の翌月末日までに乙の指定口座へ支払うものとする。

第4条（瑕疵担保）
引き渡し後1年以内に施工上の瑕疵が発見された場合、乙は甲の指示に従い無償にて補修を行う。

第5条（秘密保持）
甲乙双方は、本契約を通じて知り得た相手方の業務上の秘密情報を第三者に開示しないものとする。

第6条（契約期間）
本契約の有効期間は契約締結日より1年間とし、期間満了の1ヶ月前までに双方より異議がない場合は自動更新する。

以上、本契約成立の証として電子署名の上、本契約を締結する。`,
      createdAt: now,
    },
    {
      templateId: 'CTPL-EXTERIOR-001',
      name:       '外壁・塗装工事 業務委託契約書',
      category:   '塗装・外装',
      text: `業務委託契約書（外壁・塗装工事）

甲（委託者）: 住良建設株式会社
乙（受託者）: [業者名]

甲は乙に対し、以下の条件にて塗装・外壁工事に関する業務を委託し、乙はこれを受託する。

第1条（委託業務）
甲が施工管理する物件において、乙は塗装・外壁補修・防水等の工事施工を担当する。

第2条（発注方法）
各工事は甲発行の個別発注書により発注し、乙が書面または電子メールにて承諾した時点で個別契約が成立する。

第3条（施工品質）
乙は建築基準法その他関連法規・規格を遵守し、甲が指定する品質基準に従い施工を行う。
施工後の品質検査は甲が行い、不合格箇所については乙の負担にて是正を行う。

第4条（代金）
甲は各個別契約の完了確認後、乙の請求書受領から翌月末日以内に指定口座へ支払う。

第5条（瑕疵担保責任）
完成引き渡し後2年以内に発生した施工上の瑕疵について、乙は無償にて補修を行う。

第6条（安全管理）
乙は工事施工にあたり、労働安全衛生法を遵守し、作業員の安全確保に努める。
事故発生時は即時甲へ報告するものとする。

第7条（契約期間）
本契約の有効期間は締結日より1年間とし、期間満了1ヶ月前までに書面による終了意思表示がない場合は1年間自動更新する。

以上、本契約成立の証として電子署名の上、本契約を締結する。`,
      createdAt: now,
    },
    {
      templateId: 'CTPL-INTERIOR-001',
      name:       '内装・リフォーム工事 業務委託契約書',
      category:   '内装・リフォーム',
      text: `業務委託契約書（内装・リフォーム工事）

甲（委託者）: 住良建設株式会社
乙（受託者）: [業者名]

第1条（目的）
本契約は、甲が施工管理する内装工事・リフォーム工事の施工を乙に委託することを目的とする。

第2条（委託業務の範囲）
乙が担当する業務は、内装仕上げ（クロス張り・フローリング・タイル等）、設備取付補助、その他甲が個別発注書にて指定する作業とする。

第3条（発注と契約成立）
甲が発行する個別発注書（書面・電子データいずれも可）に乙が承諾の意思を示した時点で個別工事契約が成立する。

第4条（材料支給）
乙が使用する主要材料は原則として甲が支給する。乙が自己調達する場合は事前に甲の承認を得ること。

第5条（支払条件）
工事完了確認後、乙の請求書に基づき翌月末日までに乙指定口座へ支払うものとする。

第6条（瑕疵対応）
引き渡し後1年以内に発生した施工上の欠陥については、乙の費用負担にて補修を行う。

第7条（秘密保持）
乙は本業務を通じて知り得た顧客情報・設計情報を第三者へ漏洩しないものとする。

第8条（契約期間）
本契約は締結日から1年間有効とし、以降は双方合意のうえ更新する。

以上、本契約成立の証として電子署名の上、本契約を締結する。`,
      createdAt: now,
    },
  ];

  for (const tpl of templates) {
    await setDoc(docRef('contract_templates', tpl.templateId), tpl);
  }

  await setDoc(flagRef, { done: true, seededAt: now });
  return true;
};

/** デモデータを強制再投入（デバッグ用） */
export const reseedData = async (): Promise<void> => {
  const flagRef = docRef('init_flag', 'done');
  await setDoc(flagRef, { done: false });
  await seedInitialData();
};
