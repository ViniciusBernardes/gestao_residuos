import { chromium } from 'playwright';
import { formatReportQty } from './analytical-general-pdf-html';

function esc(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type StockGeneralPdfRow = {
  materialCode: string | null;
  materialName: string;
  materialDescription: string | null;
  materialTypeName: string;
  unitCode: string;
  depositCode: string | null;
  depositName: string;
  quantity: string;
};

export function buildStockGeneralPdfHtml(opts: {
  rows: StockGeneralPdfRow[];
  periodFromIso: string;
  periodToIso: string;
  asOfIso: string;
  branding?: {
    municipalityName: string;
    coatDataUrl?: string | null;
  };
}): string {
  const { rows, periodFromIso, periodToIso, asOfIso, branding } = opts;
  const fromD = new Date(periodFromIso);
  const toD = new Date(periodToIso);
  const asOfD = new Date(asOfIso);
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
  })}. Posição em ${asOfD.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}. ${rows.length} registro(s).`;

  const qtyOnly = (v: string) => esc(formatReportQty(v));

  const tbody =
    rows.length === 0
      ? `<tr><td colspan="6" class="empty">Nenhum saldo em depósito com os filtros selecionados.</td></tr>`
      : rows
          .map((r) => {
            const depLabel = r.depositCode ? `${r.depositCode} — ${r.depositName}` : r.depositName;
            const descBlock = r.materialDescription
              ? `<span class="desc">${esc(r.materialDescription)}</span>`
              : '';
            return `<tr>
  <td class="num">${esc(r.materialCode ?? '—')}</td>
  <td class="desc-cell"><span class="name">${esc(r.materialName)}</span>${descBlock}</td>
  <td>${esc(r.materialTypeName)}</td>
  <td>${esc(depLabel)}</td>
  <td class="center unit-code">${esc(r.unitCode)}</td>
  <td class="right">${qtyOnly(r.quantity)}</td>
</tr>`;
          })
          .join('\n');

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
  <title>Materiais em estoque geral</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 8mm; }
    * { box-sizing: border-box; }
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
    .wrap { max-width: 100%; padding: 4px 0 0; }
    .report-brand { text-align: center; margin-bottom: 10px; }
    .report-brand .coat { max-height: 56px; max-width: 72px; object-fit: contain; display: inline-block; }
    .report-brand .muni { margin: 6px 0 0; font-size: 13px; font-weight: 700; color: #0f172a; }
    h1 {
      margin: 0 0 4px;
      padding-left: 10px;
      border-left: 4px solid #059669;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .lede { margin: 0 0 14px; font-size: 11px; color: #64748b; }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
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
    }
    thead th.right { text-align: right; }
    thead th.center { text-align: center; }
    tbody td {
      padding: 6px;
      border-top: 1px solid #f1f5f9;
      vertical-align: top;
      word-wrap: break-word;
    }
    tbody td.num { font-variant-numeric: tabular-nums; width: 8%; }
    tbody td.desc-cell { width: 22%; }
    tbody td.center { text-align: center; font-weight: 600; color: #475569; width: 7%; }
    tbody td.right { text-align: right; font-variant-numeric: tabular-nums; width: 12%; }
    .name { font-weight: 600; color: #1e293b; display: block; }
    .desc { display: block; margin-top: 2px; font-size: 8px; color: #64748b; }
    .empty { text-align: center; padding: 28px 12px; color: #64748b; font-size: 11px; }
    col.col-code { width: 8%; }
    col.col-desc { width: 22%; }
    col.col-type { width: 14%; }
    col.col-dep { width: 20%; }
    col.col-unit { width: 7%; }
    col.col-qty { width: 12%; }
  </style>
</head>
<body>
  <div class="wrap">
    ${brandingHtml}
    <h1>Materiais em estoque geral</h1>
    <p class="lede">Saldo por material e depósito de armazenagem (acumulado até a data final). <strong>Período:</strong> ${esc(periodLine)}</p>
    <div class="card">
      <table>
        <colgroup>
          <col class="col-code" />
          <col class="col-desc" />
          <col class="col-type" />
          <col class="col-dep" />
          <col class="col-unit" />
          <col class="col-qty" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Material</th>
            <th scope="col">Tipo</th>
            <th scope="col">Depósito</th>
            <th scope="col" class="center">Unidade</th>
            <th scope="col" class="right">Quantidade</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

export async function renderStockGeneralPdfHtml(html: string): Promise<Buffer> {
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
