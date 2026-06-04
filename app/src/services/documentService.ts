import type { Estimate, Contract, Customer } from '@/types';

// ─── ユーティリティ ────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtAmt  = (n: number) => `¥${n.toLocaleString()}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── 共通スタイル ──────────────────────────────────────────────

const BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:'Hiragino Kaku Gothic ProN','ヒラギノ角ゴ ProN','Meiryo','メイリオ',
                'MS PGothic','ＭＳ Ｐゴシック',sans-serif;
    color:#111;font-size:10.5pt;line-height:1.6
  }
  @page{size:A4 portrait;margin:18mm 20mm}
  @media print{.no-print{display:none!important}}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #444;padding:5px 9px;vertical-align:middle}
  th{background:#e8e8e8;font-weight:bold;text-align:center;font-size:9.5pt}
  .r{text-align:right}
  .c{text-align:center}
  .total-row td{background:#f0f0f0;font-weight:bold;font-size:12pt}
  .meta{font-size:8.5pt;color:#555}
  .section-title{font-weight:bold;margin:16px 0 6px;font-size:10pt;border-left:4px solid #333;padding-left:8px}
`;

const AUTO_PRINT = `<script>
  window.addEventListener('load',function(){setTimeout(function(){window.print();},700)});
</script>`;

// ─── 御見積書 HTML ─────────────────────────────────────────────

export const generateEstimateHtml = (
  estimate: Estimate,
  customer: Customer,
): string => {
  const expiryDate = (() => {
    const d = new Date(estimate.createdAt);
    d.setDate(d.getDate() + (estimate.validityDays ?? 30));
    return fmtDate(d.toISOString());
  })();

  const itemRows = (estimate.items ?? []).map(it => `
    <tr>
      <td>${esc(it.itemName)}</td>
      <td class="r">${it.quantity}</td>
      <td class="c">${esc(it.unit)}</td>
      <td class="r">${fmtAmt(it.unitPrice)}</td>
      <td class="r">${fmtAmt(it.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>御見積書 ${esc(customer.name)}様</title>
<style>${BASE_CSS}</style>
${AUTO_PRINT}
</head>
<body>
<div style="padding:0 10px">

  <div style="text-align:center;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:18px">
    <div style="font-size:22pt;font-weight:bold;letter-spacing:0.4em">御　見　積　書</div>
    <div class="meta" style="margin-top:4px">住良建設株式会社</div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
    <div>
      <div style="font-size:15pt;font-weight:bold">${esc(customer.name)}&ensp;様</div>
      <div class="meta" style="margin-top:4px">住所：${esc(customer.address)}</div>
      ${customer.phone ? `<div class="meta">電話：${esc(customer.phone)}</div>` : ''}
      ${customer.email ? `<div class="meta">E-mail：${esc(customer.email)}</div>` : ''}
    </div>
    <div style="text-align:right" class="meta">
      <div>見積番号：<strong>${esc(estimate.estimateId)}</strong></div>
      <div>発&emsp;行&emsp;日：${fmtDate(estimate.createdAt)}</div>
      <div>有 効 期 限：${expiryDate}</div>
      ${estimate.version > 1 ? `<div>改　訂　版：Ver.${estimate.version}</div>` : ''}
    </div>
  </div>

  <div style="background:#efefef;border:1px solid #bbb;padding:7px 12px;margin-bottom:14px;font-weight:bold;font-size:11pt">
    工事名称：${esc(estimate.projectTitle)}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:42%">工事名称・品目</th>
        <th style="width:10%">数量</th>
        <th style="width:8%">単位</th>
        <th style="width:20%">単価</th>
        <th style="width:20%">金額</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="4" class="r" style="font-size:11pt">合計金額（税抜）</td>
        <td class="r" style="font-size:14pt">${fmtAmt(estimate.totalAmount)}</td>
      </tr>
    </tfoot>
  </table>

  ${estimate.notes ? `
  <div style="margin-top:14px;padding:8px 12px;border:1px solid #ccc;background:#fafafa;font-size:9.5pt">
    <span style="font-weight:bold">備考・特記事項：</span>${esc(estimate.notes)}
  </div>` : ''}

  <div class="meta" style="margin-top:12px">
    ※ 本見積書の有効期限は発行日より${estimate.validityDays ?? 30}日間（${expiryDate}まで）です。<br>
    ※ 消費税は別途申し受けます。
  </div>

  <div style="border-top:1px solid #ccc;margin-top:24px;padding-top:12px;text-align:right">
    <div style="font-size:13pt;font-weight:bold">住良建設株式会社</div>
    <div class="meta">担当：${esc(estimate.createdBy)}</div>
  </div>

</div>
</body>
</html>`;
};

// ─── 工事請負契約書 HTML ────────────────────────────────────────

export const generateContractHtml = (
  contract: Contract,
  customer: Customer,
): string => {
  const paymentRows = (contract.paymentTerms ?? []).map((t, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(t.termName)}</td>
      <td class="c">${t.percentage}%</td>
      <td class="r">${fmtAmt(t.amount)}</td>
      <td class="meta">${esc(t.description ?? '')}</td>
    </tr>`).join('');

  const sigImg = contract.customerSignature
    ? `<img src="${contract.customerSignature}" alt="署名"
         style="height:48px;border:1px solid #ccc;background:#fff;display:block;margin-top:10px">`
    : `<div style="border-bottom:1px solid #333;width:180px;margin-top:40px"></div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>工事請負契約書 ${esc(customer.name)}様</title>
<style>${BASE_CSS}</style>
${AUTO_PRINT}
</head>
<body>
<div style="padding:0 10px">

  <div style="text-align:center;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:18px">
    <div style="font-size:20pt;font-weight:bold;letter-spacing:0.3em">工事請負契約書</div>
    <div class="meta" style="margin-top:4px">住良建設株式会社</div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
    <div>
      <div style="font-size:14pt;font-weight:bold">${esc(customer.name)}&ensp;様（甲）</div>
      <div class="meta" style="margin-top:4px">住所：${esc(customer.address)}</div>
      ${customer.phone ? `<div class="meta">電話：${esc(customer.phone)}</div>` : ''}
    </div>
    <div style="text-align:right" class="meta">
      <div>契約番号：<strong>${esc(contract.contractId)}</strong></div>
      <div>契&ensp;約&ensp;日：${fmtDate(contract.createdAt)}</div>
    </div>
  </div>

  <div style="background:#efefef;border:1px solid #bbb;padding:7px 12px;margin-bottom:14px;font-weight:bold;font-size:11pt">
    工事名称：${esc(contract.projectTitle)}
  </div>

  <table style="margin-bottom:14px">
    <tr>
      <th style="width:35%">工事請負金額（税抜）</th>
      <td class="r" style="font-size:14pt;font-weight:bold">${fmtAmt(contract.totalAmount)}</td>
    </tr>
    ${contract.constructionStartDate ? `<tr><th>着工予定日</th><td>${esc(contract.constructionStartDate)}</td></tr>` : ''}
    ${contract.constructionEndDate   ? `<tr><th>完工予定日</th><td>${esc(contract.constructionEndDate)}</td></tr>`   : ''}
    ${contract.warrantyMonths        ? `<tr><th>保証期間</th><td>${contract.warrantyMonths}ヶ月</td></tr>`            : ''}
  </table>

  <div class="section-title">■ 支払条件</div>
  <table style="margin-bottom:14px">
    <thead>
      <tr>
        <th style="width:6%">回</th>
        <th style="width:18%">名称</th>
        <th style="width:10%">割合</th>
        <th style="width:20%">金額</th>
        <th>お支払いのタイミング</th>
      </tr>
    </thead>
    <tbody>${paymentRows}</tbody>
  </table>

  ${contract.specialNotes ? `
  <div class="section-title">■ 特記事項</div>
  <div style="border:1px solid #ccc;padding:10px 12px;background:#fafafa;font-size:9.5pt;
              white-space:pre-line;margin-bottom:14px">${esc(contract.specialNotes)}</div>
  ` : ''}

  <div class="section-title">■ 署名欄</div>
  <div style="display:flex;gap:20px;margin-top:8px">
    <div style="flex:1;border:1px solid #444;padding:12px;min-height:90px">
      <div style="font-weight:bold;font-size:9.5pt;margin-bottom:4px">発注者（甲）</div>
      <div class="meta">${esc(customer.name)} 様</div>
      ${sigImg}
      ${contract.signatureAt
        ? `<div class="meta" style="margin-top:6px">署名日時：${fmtDate(contract.signatureAt)}</div>`
        : `<div class="meta" style="margin-top:6px">　　　　年　　月　　日</div>`}
    </div>
    <div style="flex:1;border:1px solid #444;padding:12px;min-height:90px">
      <div style="font-weight:bold;font-size:9.5pt;margin-bottom:4px">受注者（乙）</div>
      <div style="font-weight:bold;margin-top:4px">住良建設株式会社</div>
      <div class="meta">担当：${esc(contract.staffName)}</div>
      <div style="border-bottom:1px solid #333;width:180px;margin-top:36px"></div>
    </div>
  </div>

</div>
</body>
</html>`;
};

// ─── 印刷プレビューを開く ──────────────────────────────────────

export const openPrintPreview = (html: string): void => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {
    alert(
      'ポップアップがブロックされました。\n' +
      'ブラウザのアドレスバー右端のポップアップ許可ボタンを押して再度お試しください。',
    );
  }
};

// ─── メール / LINE 用テキスト ──────────────────────────────────

export const getEstimateSummaryText = (
  estimate: Estimate,
  customer: Customer,
): string =>
  `【御見積書のご送付】住良建設\n` +
  `お客様名：${customer.name} 様\n` +
  `案件名　：${estimate.projectTitle}\n` +
  `見積金額：${fmtAmt(estimate.totalAmount)}（税抜）\n` +
  `有効期限：発行日より${estimate.validityDays ?? 30}日間\n` +
  `見積番号：${estimate.estimateId}\n\n` +
  `ご不明な点はお気軽にお問い合わせください。\n住良建設株式会社`;

export const getContractSummaryText = (
  contract: Contract,
  customer: Customer,
): string =>
  `【工事請負契約書のご送付】住良建設\n` +
  `お客様名：${customer.name} 様\n` +
  `工事名　：${contract.projectTitle}\n` +
  `契約金額：${fmtAmt(contract.totalAmount)}（税抜）\n` +
  `契約番号：${contract.contractId}\n\n` +
  `内容をご確認の上、ご不明な点はお気軽にお問い合わせください。\n住良建設株式会社`;
