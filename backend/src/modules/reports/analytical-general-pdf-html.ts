import { chromium } from 'playwright';

/** Igual ao frontend: números pt-BR e string da API. */
function parseBrDecimal(raw: string): number {
  let s = raw.trim().replace(/\s/g, '');
  if (!s || s === '-') return NaN;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1).trim();
  if (!s) return NaN;

  let n: number;
  if (s.includes(',')) {
    const c = s.indexOf(',');
    let intS = s.slice(0, c).replace(/\./g, '').replace(/\D/g, '');
    const fracS = s.slice(c + 1).replace(/\D/g, '');
    if (intS === '') intS = '0';
    intS = intS.replace(/^0+(?=\d)/, '') || '0';
    if (fracS === '') {
      n = Number(intS);
    } else {
      n = Number(`${intS}.${fracS}`);
    }
  } else {
    n = parseBrDecimalNoComma(s);
  }
  if (!Number.isFinite(n)) return NaN;
  return neg ? -n : n;
}

function parseBrDecimalNoComma(s: string): number {
  const parts = s.split('.');
  if (parts.length === 1) {
    const intS = parts[0].replace(/\D/g, '');
    return intS === '' ? NaN : Number(intS);
  }
  if (parts.length === 2) {
    const a = parts[0].replace(/\D/g, '');
    const b = parts[1].replace(/\D/g, '');
    if (b === '') {
      return a === '' ? NaN : Number(a);
    }
    if (b.length < 3) {
      const singleDigitInt = /^[1-9]$/.test(a);
      const twoDigitPureDecimal = b.length === 2 && /^[1-9][1-9]$/.test(b);
      if (singleDigitInt && b !== '' && !twoDigitPureDecimal) {
        return Number(a + b);
      }
      if (a === '') return Number(`0.${b}`);
      return Number(`${a}.${b}`);
    }
    if (b.length === 3) {
      const thousands = a !== '' && /^[1-9]\d*$/.test(a);
      if (thousands) {
        return Number(a + b);
      }
      if (a === '') return Number(b);
      return Number(`${a}.${b}`);
    }
    if (a === '') return Number(`0.${b}`);
    return Number(`${a}.${b}`);
  }
  const all = parts.map((p) => p.replace(/\D/g, '')).join('');
  return all === '' ? NaN : Number(all);
}

export function formatReportQty(s: string): string {
  const n = parseBrDecimal(s);
  if (Number.isFinite(n)) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const fallback = Number(s);
  if (Number.isFinite(fallback)) {
    return fallback.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return s;
}

function formatBrlFromDecimalString(s: string): string {
  const n = parseBrDecimal(s);
  if (Number.isFinite(n)) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  const fallback = Number(s);
  if (Number.isFinite(fallback)) {
    return fallback.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return esc(s);
}

function esc(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type AnalyticalGeneralPdfRow = {
  materialCode: string | null;
  materialName: string;
  materialDescription: string | null;
  materialTypeName: string;
  unitCode: string;
  depositCode: string | null;
  depositName: string;
  entradas: string;
  saidas: string;
  transferenciasSaida: string;
  transferenciasEntrada: string;
  saldoLiquidoPeriodo: string;
};

export type AnalyticalGeneralFooterSummary = {
  revenueTotal: string;
  byUnit: {
    unitCode: string;
    totalEntradas: string;
    totalSaidas: string;
    totalTransferenciasSaida: string;
    totalTransferenciasEntrada: string;
    saldoLiquidoPeriodo: string;
  }[];
};

export function buildAnalyticalGeneralPdfHtml(opts: {
  rows: AnalyticalGeneralPdfRow[];
  periodFromIso: string;
  periodToIso: string;
  /** Quando definido, omite a coluna Depósito e ajusta título/texto introdutório. */
  byDepositLabel?: string;
  /** Resumo após a tabela (relatório geral). */
  footerSummary?: AnalyticalGeneralFooterSummary;
  /** Brasão e nome do município (cabeçalho). */
  branding?: {
    municipalityName: string;
    coatDataUrl?: string | null;
  };
}): string {
  const { rows, periodFromIso, periodToIso, byDepositLabel, footerSummary, branding } = opts;
  const byDeposit = Boolean(byDepositLabel?.trim());
  const fromD = new Date(periodFromIso);
  const toD = new Date(periodToIso);
  const periodLine = `${fromD.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} a ${toD.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}. ${rows.length} registro(s).`;

  const qtyOnly = (v: string) => esc(formatReportQty(v));

  const emptyColspan = byDeposit ? '9' : '10';
  const tbody =
    rows.length === 0
      ? `<tr><td colspan="${emptyColspan}" class="empty">Nenhuma movimentação no período com os filtros selecionados.</td></tr>`
      : rows
          .map((r) => {
            const depLabel = r.depositCode ? `${r.depositCode} — ${r.depositName}` : r.depositName;
            const descBlock = r.materialDescription
              ? `<span class="desc">${esc(r.materialDescription)}</span>`
              : '';
            const depCells = byDeposit
              ? ''
              : `
  <td>${esc(depLabel)}</td>`;
            return `<tr>
  <td class="num">${esc(r.materialCode ?? '—')}</td>
  <td class="desc-cell"><span class="name">${esc(r.materialName)}</span>${descBlock}</td>
  <td>${esc(r.materialTypeName)}</td>${depCells}
  <td class="center unit-code">${esc(r.unitCode)}</td>
  <td class="right">${qtyOnly(r.entradas)}</td>
  <td class="right">${qtyOnly(r.saidas)}</td>
  <td class="right">${qtyOnly(r.transferenciasSaida)}</td>
  <td class="right">${qtyOnly(r.transferenciasEntrada)}</td>
  <td class="right liquido">${qtyOnly(r.saldoLiquidoPeriodo)}</td>
</tr>`;
          })
          .join('\n');

  const summaryBlock =
    footerSummary && !byDeposit
      ? `<div class="summary">
    <p class="summary-title">Resumo geral</p>
    ${footerSummary.byUnit
      .map(
        (u) => `
    <p class="unit-tag">Unidade ${esc(u.unitCode)}</p>
    <ul class="summary-list">
      <li><strong>Total de entradas</strong> <span class="muted">(${esc(u.unitCode)})</span>: ${esc(formatReportQty(u.totalEntradas))}</li>
      <li><strong>Total de saídas</strong> <span class="muted">(${esc(u.unitCode)})</span>: ${esc(formatReportQty(u.totalSaidas))}</li>
      <li><strong>Total transf. saída</strong> <span class="muted">(${esc(u.unitCode)})</span>: ${esc(formatReportQty(u.totalTransferenciasSaida))}</li>
      <li><strong>Total transf. entrada</strong> <span class="muted">(${esc(u.unitCode)})</span>: ${esc(formatReportQty(u.totalTransferenciasEntrada))}</li>
      <li><strong>Saldo líquido no período</strong> <span class="muted">(${esc(u.unitCode)})</span>: ${esc(formatReportQty(u.saldoLiquidoPeriodo))}</li>
    </ul>`,
      )
      .join('')}
    <ul class="summary-list revenue"><li><strong>Receita total gerada:</strong> ${formatBrlFromDecimalString(footerSummary.revenueTotal)}</li></ul>
  </div>`
      : '';

  const pageTitle = byDeposit ? 'Relatório analítico por depósito' : 'Relatório analítico';
  const h1Text = byDeposit ? 'Relatório analítico por depósito' : 'Relatório analítico';

  const brandingHtml =
    branding &&
    (branding.coatDataUrl ||
      (branding.municipalityName && branding.municipalityName.trim().length > 0))
      ? `<div class="report-brand">${
          branding.coatDataUrl
            ? `<img class="coat" src="${branding.coatDataUrl}" alt="" />`
            : ''
        }${
          branding.municipalityName?.trim()
            ? `<p class="muni">${esc(branding.municipalityName.trim())}</p>`
            : ''
        }</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${esc(pageTitle)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 8mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9px;
      line-height: 1.35;
      color: #1e293b;
      background: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .summary {
      margin-top: 14px;
      padding: 12px 14px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      color: #0f172a;
      font-size: 10px;
    }

    .summary-title {
      margin: 0 0 8px;
      font-weight: 700;
      font-size: 11px;
      color: #0f172a;
    }

    .unit-tag {
      margin: 8px 0 4px;
      font-weight: 600;
      font-size: 9px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .summary-list {
      margin: 0 0 6px 16px;
      padding: 0;
    }

    .summary-list li {
      margin: 3px 0;
    }

    .summary-list.revenue {
      margin-top: 8px;
      margin-bottom: 0;
    }

    .wrap {
      max-width: 100%;
      padding: 4px 0 0;
    }

    .report-brand {
      text-align: center;
      margin-bottom: 10px;
    }

    .report-brand .coat {
      max-height: 56px;
      max-width: 72px;
      object-fit: contain;
      display: inline-block;
    }

    .report-brand .muni {
      margin: 6px 0 0;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }

    h1 {
      margin: 0 0 4px;
      padding-left: 10px;
      border-left: 4px solid #059669;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    thead {
      display: table-header-group;
    }

    tbody {
      display: table-row-group;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .lede {
      margin: 0 0 14px;
      font-size: 11px;
      color: #64748b;
    }

    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead th {
      background: #f8fafc;
      color: #475569;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: bottom;
    }

    thead th.right {
      text-align: right;
    }

    thead th.center {
      text-align: center;
    }

    tbody td.center {
      text-align: center;
      vertical-align: middle;
      font-weight: 600;
      color: #475569;
      width: 6%;
    }

    .muted {
      color: #64748b;
      font-weight: 500;
    }

    tbody td {
      padding: 6px;
      border-top: 1px solid #f1f5f9;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    tbody td.num {
      font-variant-numeric: tabular-nums;
      width: 7%;
    }

    tbody td.desc-cell {
      width: 18%;
    }

    tbody td.right {
      text-align: right;
      font-variant-numeric: tabular-nums;
      width: 8%;
    }

    tbody td.liquido {
      font-weight: 600;
      color: #0f172a;
    }

    .name {
      font-weight: 600;
      color: #1e293b;
      display: block;
    }

    .desc {
      display: block;
      margin-top: 2px;
      font-size: 8px;
      color: #64748b;
      font-weight: 400;
    }

    .unit {
      color: #64748b;
      font-size: 8px;
      margin-left: 2px;
    }

    .empty {
      text-align: center;
      padding: 28px 12px;
      color: #64748b;
      font-size: 11px;
    }

    col.col-code { width: 7%; }
    col.col-desc { width: 16%; }
    col.col-type { width: 10%; }
    col.col-dep { width: 14%; }
    col.col-unit { width: 6%; }
    col.col-qty { width: 8%; }
  </style>
</head>
<body>
  <div class="wrap">
    ${brandingHtml}
    <h1>${esc(h1Text)}</h1>
    <p class="lede">${
      byDeposit
        ? `Movimentação por material no depósito selecionado. <strong>${esc(byDepositLabel)}</strong> <strong>Período:</strong> ${esc(periodLine)}`
        : `Movimentação por material e depósito no período. <strong>Período:</strong> ${esc(periodLine)}`
    }</p>
    <div class="card">
      <table>
        <colgroup>
          <col class="col-code" />
          <col class="col-desc" />
          <col class="col-type" />
          ${byDeposit ? '' : '<col class="col-dep" />'}
          <col class="col-unit" />
          <col class="col-qty" /><col class="col-qty" /><col class="col-qty" /><col class="col-qty" /><col class="col-qty" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">${byDeposit ? 'Descrição' : 'Material'}</th>
            <th scope="col">Tipo</th>
            ${byDeposit ? '' : '<th scope="col">Depósito</th>'}
            <th scope="col" class="center">Unidade</th>
            <th scope="col" class="right">Entradas</th>
            <th scope="col" class="right">Saídas</th>
            <th scope="col" class="right">Transf. saída</th>
            <th scope="col" class="right">Transf. entrada</th>
            <th scope="col" class="right">Líquido no período</th>
          </tr>
        </thead>
        <tbody>
          ${tbody}
        </tbody>
      </table>
    </div>
    ${summaryBlock}
  </div>
</body>
</html>`;
}

export async function renderAnalyticalGeneralPdfHtml(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '8mm', right: '6mm', bottom: '8mm', left: '6mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
