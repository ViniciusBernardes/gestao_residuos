import { BadRequestException, Injectable } from '@nestjs/common';
import { EstablishmentRole, MovementType, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { TENANT_COAT_UPLOAD_SUBDIR } from '../../common/utils/tenant-coat-upload';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildAnalyticalGeneralPdfHtml,
  renderAnalyticalGeneralPdfHtml,
} from './analytical-general-pdf-html';
import { buildStockGeneralPdfHtml, renderStockGeneralPdfHtml } from './stock-general-pdf-html';

type AnalyticalRow = {
  materialCode: string | null;
  materialName: string;
  materialDescription: string | null;
  materialTypeName: string;
  unitCode: string;
  depositCode: string | null;
  depositName: string;
  /** Entradas + ajustes (ajustes incorporados). */
  entradas: string;
  saidas: string;
  transferenciasSaida: string;
  transferenciasEntrada: string;
  saldoLiquidoPeriodo: string;
};

type StockGeneralRow = {
  materialCode: string | null;
  materialName: string;
  materialDescription: string | null;
  materialTypeName: string;
  unitCode: string;
  depositCode: string | null;
  depositName: string;
  quantity: string;
};

type ReportBranding = {
  municipalityName: string;
  coatDataUrl: string | null;
  coatBuffer: Buffer | null;
  coatExcelExtension: 'png' | 'jpeg' | 'gif' | null;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadReportBranding(tenantId: string): Promise<ReportBranding> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, coatOfArmsFilePath: true },
    });
    const municipalityName = t?.name?.trim() ?? '';
    if (!t?.coatOfArmsFilePath) {
      return {
        municipalityName,
        coatDataUrl: null,
        coatBuffer: null,
        coatExcelExtension: null,
      };
    }
    const full = join(process.cwd(), 'uploads', TENANT_COAT_UPLOAD_SUBDIR, t.coatOfArmsFilePath);
    if (!existsSync(full)) {
      return {
        municipalityName,
        coatDataUrl: null,
        coatBuffer: null,
        coatExcelExtension: null,
      };
    }
    const buffer = readFileSync(full);
    const ext = t.coatOfArmsFilePath.split('.').pop()?.toLowerCase() ?? '';
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
              ? 'image/gif'
              : '';
    const coatDataUrl = mime ? `data:${mime};base64,${buffer.toString('base64')}` : null;
    const coatExcelExtension =
      ext === 'png' ? 'png' : ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'gif' ? 'gif' : null;
    return {
      municipalityName,
      coatDataUrl,
      coatBuffer: coatExcelExtension ? buffer : null,
      coatExcelExtension,
    };
  }

  /** Insere brasão (se houver), nome do município, título e linha em branco; devolve o índice da próxima linha (1-based) para o cabeçalho da tabela. */
  private appendExcelBranding(
    sheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    branding: ReportBranding,
    mergeCols: number,
    title: string,
  ): number {
    let r = 1;
    if (branding.coatBuffer && branding.coatExcelExtension) {
      sheet.addRow([]);
      sheet.getRow(r).height = 64;
      const imgId = workbook.addImage({
        // ExcelJS tipa `Buffer` com assinatura legada; o buffer de `fs` é compatível em runtime.
        buffer: branding.coatBuffer as never,
        extension: branding.coatExcelExtension,
      });
      const centerCol = Math.max(0, mergeCols / 2 - 0.75);
      sheet.addImage(imgId, {
        tl: { col: centerCol, row: r - 1 },
        ext: { width: 56, height: 56 },
      });
      r++;
    }
    if (branding.municipalityName) {
      const row = sheet.addRow([branding.municipalityName]);
      sheet.mergeCells(r, 1, r, mergeCols);
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.font = { bold: true, size: 14 };
      r++;
    }
    const titleRow = sheet.addRow([title]);
    sheet.mergeCells(r, 1, r, mergeCols);
    titleRow.getCell(1).font = { bold: true, size: 12 };
    r++;
    sheet.addRow([]);
    r++;
    return r;
  }

  private summarizeAnalyticalRows(rows: AnalyticalRow[]) {
    const z = () => new Prisma.Decimal(0);
    const map = new Map<
      string,
      {
        ent: Prisma.Decimal;
        sai: Prisma.Decimal;
        ts: Prisma.Decimal;
        te: Prisma.Decimal;
        liq: Prisma.Decimal;
      }
    >();
    for (const r of rows) {
      if (!map.has(r.unitCode)) {
        map.set(r.unitCode, { ent: z(), sai: z(), ts: z(), te: z(), liq: z() });
      }
      const t = map.get(r.unitCode)!;
      t.ent = t.ent.add(new Prisma.Decimal(r.entradas));
      t.sai = t.sai.add(new Prisma.Decimal(r.saidas));
      t.ts = t.ts.add(new Prisma.Decimal(r.transferenciasSaida));
      t.te = t.te.add(new Prisma.Decimal(r.transferenciasEntrada));
      t.liq = t.liq.add(new Prisma.Decimal(r.saldoLiquidoPeriodo));
    }
    return Array.from(map.entries()).map(([unitCode, t]) => ({
      unitCode,
      totalEntradas: t.ent.toString(),
      totalSaidas: t.sai.toString(),
      totalTransferenciasSaida: t.ts.toString(),
      totalTransferenciasEntrada: t.te.toString(),
      saldoLiquidoPeriodo: t.liq.toString(),
    }));
  }

  /**
   * Movimentação analítica por material e depósito no período (entradas incluem ajustes, saídas, transferências).
   */
  async analyticalGeneral(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId?: string;
      sortBy: 'code' | 'description';
    },
  ) {
    const from = new Date(q.dateFrom);
    const to = new Date(q.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Período inválido');
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (from > to) {
      throw new BadRequestException('A data inicial deve ser anterior ou igual à final');
    }

    const materialFilter: Prisma.RecyclableMaterialWhereInput = {
      tenantId,
      ...(q.materialTypeId ? { materialTypeId: q.materialTypeId } : {}),
    };

    const depId = q.depositId?.trim() || undefined;

    const stockExitWhere: Prisma.StockExitWhereInput = {
      tenantId,
      exitedAt: { gte: from, lte: to },
      ...(depId
        ? {
            movements: {
              some: {
                type: MovementType.EXIT,
                establishmentFromId: depId,
              },
            },
          }
        : {}),
    };

    const [movements, revenueAgg] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: {
          tenantId,
          occurredAt: { gte: from, lte: to },
          material: materialFilter,
        },
        include: {
          material: {
            include: {
              materialType: { select: { id: true, name: true } },
              unit: { select: { code: true, name: true } },
            },
          },
          establishmentFrom: { select: { id: true, tradeName: true, code: true } },
          establishmentTo: { select: { id: true, tradeName: true, code: true } },
        },
      }),
      this.prisma.stockExitItem.aggregate({
        where: {
          material: materialFilter,
          stockExit: stockExitWhere,
        },
        _sum: { lineTotal: true },
      }),
    ]);
    const filtered = depId
      ? movements.filter(
          (m) => m.establishmentFromId === depId || m.establishmentToId === depId,
        )
      : movements;

    type Agg = {
      materialId: string;
      depositId: string;
      depositCode: string | null;
      depositName: string;
      materialCode: string | null;
      materialName: string;
      materialDescription: string | null;
      materialTypeName: string;
      unitCode: string;
      entradas: Prisma.Decimal;
      saidas: Prisma.Decimal;
      transferenciasSaida: Prisma.Decimal;
      transferenciasEntrada: Prisma.Decimal;
      ajustes: Prisma.Decimal;
    };

    const map = new Map<string, Agg>();

    const keyOf = (materialId: string, depositId: string) => `${materialId}\t${depositId}`;

    const ensure = (
      materialId: string,
      depositId: string,
      dep: { tradeName: string; code: string | null },
      mat: (typeof movements)[0]['material'],
    ): Agg => {
      const k = keyOf(materialId, depositId);
      let row = map.get(k);
      if (!row) {
        row = {
          materialId,
          depositId,
          depositCode: dep.code,
          depositName: dep.tradeName,
          materialCode: mat.code,
          materialName: mat.name,
          materialDescription: mat.description,
          materialTypeName: mat.materialType.name,
          unitCode: mat.unit.code,
          entradas: new Prisma.Decimal(0),
          saidas: new Prisma.Decimal(0),
          transferenciasSaida: new Prisma.Decimal(0),
          transferenciasEntrada: new Prisma.Decimal(0),
          ajustes: new Prisma.Decimal(0),
        };
        map.set(k, row);
      }
      return row;
    };

    for (const m of filtered) {
      const qty = m.quantity;
      const mat = m.material;

      switch (m.type) {
        case MovementType.ENTRY:
          if (m.establishmentToId && m.establishmentTo) {
            const row = ensure(mat.id, m.establishmentToId, m.establishmentTo, mat);
            row.entradas = row.entradas.add(qty);
          }
          break;
        case MovementType.EXIT:
          if (m.establishmentFromId && m.establishmentFrom) {
            const row = ensure(mat.id, m.establishmentFromId, m.establishmentFrom, mat);
            row.saidas = row.saidas.add(qty);
          }
          break;
        case MovementType.TRANSFER_OUT:
          if (m.establishmentFromId && m.establishmentFrom) {
            const row = ensure(mat.id, m.establishmentFromId, m.establishmentFrom, mat);
            row.transferenciasSaida = row.transferenciasSaida.add(qty);
          }
          break;
        case MovementType.TRANSFER_IN:
          if (m.establishmentToId && m.establishmentTo) {
            const row = ensure(mat.id, m.establishmentToId, m.establishmentTo, mat);
            row.transferenciasEntrada = row.transferenciasEntrada.add(qty);
          }
          break;
        case MovementType.ADJUSTMENT:
          if (m.establishmentToId && m.establishmentTo) {
            const row = ensure(mat.id, m.establishmentToId, m.establishmentTo, mat);
            row.ajustes = row.ajustes.add(qty);
          } else if (m.establishmentFromId && m.establishmentFrom) {
            const row = ensure(mat.id, m.establishmentFromId, m.establishmentFrom, mat);
            row.ajustes = row.ajustes.sub(qty);
          }
          break;
        default:
          break;
      }
    }

    const rows: AnalyticalRow[] = Array.from(map.values()).map((r) => {
      const entradasComAjustes = r.entradas.add(r.ajustes);
      const liquido = entradasComAjustes
        .add(r.transferenciasEntrada)
        .sub(r.saidas)
        .sub(r.transferenciasSaida);
      return {
        materialCode: r.materialCode,
        materialName: r.materialName,
        materialDescription: r.materialDescription,
        materialTypeName: r.materialTypeName,
        unitCode: r.unitCode,
        depositCode: r.depositCode,
        depositName: r.depositName,
        entradas: entradasComAjustes.toString(),
        saidas: r.saidas.toString(),
        transferenciasSaida: r.transferenciasSaida.toString(),
        transferenciasEntrada: r.transferenciasEntrada.toString(),
        saldoLiquidoPeriodo: liquido.toString(),
      };
    });

    const sortBy = q.sortBy === 'description' ? 'description' : 'code';
    rows.sort((a, b) => {
      if (sortBy === 'code') {
        const ac = (a.materialCode ?? '').toLowerCase();
        const bc = (b.materialCode ?? '').toLowerCase();
        if (ac !== bc) return ac.localeCompare(bc, 'pt-BR');
        return a.depositName.localeCompare(b.depositName, 'pt-BR');
      }
      const n = a.materialName.localeCompare(b.materialName, 'pt-BR');
      if (n !== 0) return n;
      return a.depositName.localeCompare(b.depositName, 'pt-BR');
    });

    const revenueTotal = (revenueAgg._sum.lineTotal ?? new Prisma.Decimal(0)).toString();
    const byUnit = this.summarizeAnalyticalRows(rows);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      rows,
      summary: {
        revenueTotal,
        byUnit,
      },
    };
  }

  async exportAnalyticalGeneralExcel(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId?: string;
      sortBy: 'code' | 'description';
    },
  ): Promise<Buffer> {
    const { rows, period, summary } = await this.analyticalGeneral(tenantId, q);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Analítico geral');
    const branding = await this.loadReportBranding(tenantId);

    const title = `Relatório analítico — ${new Date(period.from).toLocaleDateString('pt-BR')} a ${new Date(period.to).toLocaleDateString('pt-BR')}`;
    const headerStart = this.appendExcelBranding(sheet, workbook, branding, 12, title);

    const headers = [
      'Código',
      'Material',
      'Complemento',
      'Tipo de material',
      'Cód. depósito',
      'Depósito',
      'Unidade',
      'Entradas',
      'Saídas',
      'Transf. saída',
      'Transf. entrada',
      'Líquido no período',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7EF' },
      };
    });

    for (const r of rows) {
      sheet.addRow([
        r.materialCode ?? '',
        r.materialName,
        r.materialDescription ?? '',
        r.materialTypeName,
        r.depositCode ?? '',
        r.depositName,
        r.unitCode,
        r.entradas,
        r.saidas,
        r.transferenciasSaida,
        r.transferenciasEntrada,
        r.saldoLiquidoPeriodo,
      ]);
    }

    sheet.addRow([]);
    const sumTitle = sheet.addRow(['Resumo geral']);
    sumTitle.font = { bold: true, size: 11 };
    for (const u of summary.byUnit) {
      sheet.addRow([
        '',
        `Totais (${u.unitCode})`,
        '',
        '',
        '',
        '',
        u.unitCode,
        u.totalEntradas,
        u.totalSaidas,
        u.totalTransferenciasSaida,
        u.totalTransferenciasEntrada,
        u.saldoLiquidoPeriodo,
      ]);
    }
    const revRow = sheet.addRow([
      '',
      'Receita total gerada (itens de saída com valor)',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      summary.revenueTotal,
    ]);
    revRow.getCell(2).font = { bold: true };

    sheet.columns = [
      { width: 12 },
      { width: 30 },
      { width: 22 },
      { width: 20 },
      { width: 12 },
      { width: 26 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
    ];

    sheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber >= headerStart) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportAnalyticalGeneralPdf(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId?: string;
      sortBy: 'code' | 'description';
    },
  ): Promise<Buffer> {
    const { rows, period, summary } = await this.analyticalGeneral(tenantId, q);
    const branding = await this.loadReportBranding(tenantId);
    const html = buildAnalyticalGeneralPdfHtml({
      rows,
      periodFromIso: period.from,
      periodToIso: period.to,
      footerSummary: summary,
      branding:
        branding.municipalityName || branding.coatDataUrl
          ? {
              municipalityName: branding.municipalityName,
              coatDataUrl: branding.coatDataUrl,
            }
          : undefined,
    });
    return renderAnalyticalGeneralPdfHtml(html);
  }

  private async requireActiveDeposit(tenantId: string, depositId: string) {
    const dep = await this.prisma.establishment.findFirst({
      where: {
        id: depositId,
        tenantId,
        role: EstablishmentRole.DEPOSIT,
        active: true,
      },
      select: { id: true, tradeName: true, code: true },
    });
    if (!dep) {
      throw new BadRequestException('Depósito de armazenagem não encontrado ou inativo');
    }
    return dep;
  }

  /** Mesmo conjunto de dados do analítico geral, com depósito obrigatório. */
  async analyticalByDeposit(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId: string;
      sortBy: 'code' | 'description';
    },
  ) {
    await this.requireActiveDeposit(tenantId, q.depositId.trim());
    return this.analyticalGeneral(tenantId, {
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      materialTypeId: q.materialTypeId,
      depositId: q.depositId.trim(),
      sortBy: q.sortBy,
    });
  }

  async exportAnalyticalByDepositExcel(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId: string;
      sortBy: 'code' | 'description';
    },
  ): Promise<Buffer> {
    const dep = await this.requireActiveDeposit(tenantId, q.depositId.trim());
    const { rows, period } = await this.analyticalByDeposit(tenantId, q);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Analítico por depósito');

    const depLine = dep.code ? `${dep.code} — ${dep.tradeName}` : dep.tradeName;
    const title = `Relatório analítico por depósito — ${depLine} — ${new Date(period.from).toLocaleDateString('pt-BR')} a ${new Date(period.to).toLocaleDateString('pt-BR')}`;
    const branding = await this.loadReportBranding(tenantId);
    const headerStart = this.appendExcelBranding(sheet, workbook, branding, 10, title);

    const headers = [
      'Código',
      'Descrição',
      'Complemento',
      'Tipo de material',
      'Unidade',
      'Entradas',
      'Saídas',
      'Transf. saída',
      'Transf. entrada',
      'Líquido no período',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7EF' },
      };
    });

    for (const r of rows) {
      sheet.addRow([
        r.materialCode ?? '',
        r.materialName,
        r.materialDescription ?? '',
        r.materialTypeName,
        r.unitCode,
        r.entradas,
        r.saidas,
        r.transferenciasSaida,
        r.transferenciasEntrada,
        r.saldoLiquidoPeriodo,
      ]);
    }

    sheet.columns = [
      { width: 12 },
      { width: 30 },
      { width: 22 },
      { width: 20 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
    ];

    sheet.getColumn(5).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber >= headerStart) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportAnalyticalByDepositPdf(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId: string;
      sortBy: 'code' | 'description';
    },
  ): Promise<Buffer> {
    const dep = await this.requireActiveDeposit(tenantId, q.depositId.trim());
    const { rows, period } = await this.analyticalByDeposit(tenantId, q);
    const depLabel = dep.code ? `Depósito: ${dep.code} — ${dep.tradeName}` : `Depósito: ${dep.tradeName}`;
    const branding = await this.loadReportBranding(tenantId);
    const html = buildAnalyticalGeneralPdfHtml({
      rows,
      periodFromIso: period.from,
      periodToIso: period.to,
      byDepositLabel: depLabel,
      branding:
        branding.municipalityName || branding.coatDataUrl
          ? {
              municipalityName: branding.municipalityName,
              coatDataUrl: branding.coatDataUrl,
            }
          : undefined,
    });
    return renderAnalyticalGeneralPdfHtml(html);
  }

  /**
   * Saldo por material e depósito de armazenagem acumulado até o fim do período (data final).
   */
  async stockGeneral(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId?: string;
      sortBy: 'code' | 'description';
    },
  ) {
    const from = new Date(q.dateFrom);
    const to = new Date(q.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Período inválido');
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (from > to) {
      throw new BadRequestException('A data inicial deve ser anterior ou igual à final');
    }

    const materialFilter: Prisma.RecyclableMaterialWhereInput = {
      tenantId,
      ...(q.materialTypeId ? { materialTypeId: q.materialTypeId } : {}),
    };

    const activeDeposits = await this.prisma.establishment.findMany({
      where: { tenantId, role: EstablishmentRole.DEPOSIT, active: true },
      select: { id: true },
    });
    const depositIds = new Set(activeDeposits.map((e) => e.id));

    const depId = q.depositId?.trim() || undefined;
    if (depId && !depositIds.has(depId)) {
      throw new BadRequestException('Depósito não encontrado ou inativo');
    }

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        occurredAt: { lte: to },
        material: materialFilter,
      },
      include: {
        material: {
          include: {
            materialType: { select: { name: true } },
            unit: { select: { code: true } },
          },
        },
        establishmentFrom: { select: { id: true, tradeName: true, code: true } },
        establishmentTo: { select: { id: true, tradeName: true, code: true } },
      },
    });

    const filtered = depId
      ? movements.filter(
          (m) => m.establishmentFromId === depId || m.establishmentToId === depId,
        )
      : movements;

    type Cell = {
      materialId: string;
      depositId: string;
      depositCode: string | null;
      depositName: string;
      materialCode: string | null;
      materialName: string;
      materialDescription: string | null;
      materialTypeName: string;
      unitCode: string;
      balance: Prisma.Decimal;
    };

    const map = new Map<string, Cell>();
    const keyOf = (materialId: string, depositId: string) => `${materialId}\t${depositId}`;

    const ensure = (
      materialId: string,
      depositId: string,
      dep: { tradeName: string; code: string | null },
      mat: (typeof movements)[0]['material'],
    ): Cell => {
      const k = keyOf(materialId, depositId);
      let row = map.get(k);
      if (!row) {
        row = {
          materialId,
          depositId,
          depositCode: dep.code,
          depositName: dep.tradeName,
          materialCode: mat.code,
          materialName: mat.name,
          materialDescription: mat.description,
          materialTypeName: mat.materialType.name,
          unitCode: mat.unit.code,
          balance: new Prisma.Decimal(0),
        };
        map.set(k, row);
      }
      return row;
    };

    const z = new Prisma.Decimal(0);

    for (const m of filtered) {
      const qty = m.quantity;
      const mat = m.material;

      switch (m.type) {
        case MovementType.ENTRY:
          if (m.establishmentToId && m.establishmentTo && depositIds.has(m.establishmentToId)) {
            const row = ensure(mat.id, m.establishmentToId, m.establishmentTo, mat);
            row.balance = row.balance.add(qty);
          }
          break;
        case MovementType.EXIT:
          if (m.establishmentFromId && m.establishmentFrom && depositIds.has(m.establishmentFromId)) {
            const row = ensure(mat.id, m.establishmentFromId, m.establishmentFrom, mat);
            row.balance = row.balance.sub(qty);
          }
          break;
        case MovementType.TRANSFER_OUT:
          if (m.establishmentFromId && m.establishmentFrom && depositIds.has(m.establishmentFromId)) {
            const row = ensure(mat.id, m.establishmentFromId, m.establishmentFrom, mat);
            row.balance = row.balance.sub(qty);
          }
          break;
        case MovementType.TRANSFER_IN:
          if (m.establishmentToId && m.establishmentTo && depositIds.has(m.establishmentToId)) {
            const row = ensure(mat.id, m.establishmentToId, m.establishmentTo, mat);
            row.balance = row.balance.add(qty);
          }
          break;
        case MovementType.ADJUSTMENT:
          if (m.establishmentToId && m.establishmentTo && depositIds.has(m.establishmentToId)) {
            const row = ensure(mat.id, m.establishmentToId, m.establishmentTo, mat);
            row.balance = row.balance.add(qty);
          } else if (m.establishmentFromId && m.establishmentFrom && depositIds.has(m.establishmentFromId)) {
            const row = ensure(mat.id, m.establishmentFromId, m.establishmentFrom, mat);
            row.balance = row.balance.sub(qty);
          }
          break;
        default:
          break;
      }
    }

    let rows: StockGeneralRow[] = Array.from(map.values())
      .filter((r) => !depId || r.depositId === depId)
      .filter((r) => !r.balance.equals(z))
      .map((r) => ({
        materialCode: r.materialCode,
        materialName: r.materialName,
        materialDescription: r.materialDescription,
        materialTypeName: r.materialTypeName,
        unitCode: r.unitCode,
        depositCode: r.depositCode,
        depositName: r.depositName,
        quantity: r.balance.toString(),
      }));

    const sortBy = q.sortBy === 'description' ? 'description' : 'code';
    rows.sort((a, b) => {
      if (sortBy === 'code') {
        const ac = (a.materialCode ?? '').toLowerCase();
        const bc = (b.materialCode ?? '').toLowerCase();
        if (ac !== bc) return ac.localeCompare(bc, 'pt-BR');
        return a.depositName.localeCompare(b.depositName, 'pt-BR');
      }
      const n = a.materialName.localeCompare(b.materialName, 'pt-BR');
      if (n !== 0) return n;
      return a.depositName.localeCompare(b.depositName, 'pt-BR');
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      asOf: to.toISOString(),
      rows,
    };
  }

  async exportStockGeneralExcel(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId?: string;
      sortBy: 'code' | 'description';
    },
  ): Promise<Buffer> {
    const { rows, period, asOf } = await this.stockGeneral(tenantId, q);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Estoque geral');
    const branding = await this.loadReportBranding(tenantId);

    const title = `Materiais em estoque geral — ${new Date(period.from).toLocaleDateString('pt-BR')} a ${new Date(period.to).toLocaleDateString('pt-BR')} — posição em ${new Date(asOf).toLocaleString('pt-BR')}`;
    const headerStart = this.appendExcelBranding(sheet, workbook, branding, 8, title);

    const headers = [
      'Código',
      'Material',
      'Complemento',
      'Tipo de material',
      'Cód. depósito',
      'Depósito',
      'Unidade',
      'Quantidade',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7EF' },
      };
    });

    for (const r of rows) {
      sheet.addRow([
        r.materialCode ?? '',
        r.materialName,
        r.materialDescription ?? '',
        r.materialTypeName,
        r.depositCode ?? '',
        r.depositName,
        r.unitCode,
        r.quantity,
      ]);
    }

    sheet.columns = [
      { width: 12 },
      { width: 30 },
      { width: 22 },
      { width: 20 },
      { width: 12 },
      { width: 26 },
      { width: 10 },
      { width: 14 },
    ];

    sheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber >= headerStart) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportStockGeneralPdf(
    tenantId: string,
    q: {
      materialTypeId?: string;
      dateFrom: string;
      dateTo: string;
      depositId?: string;
      sortBy: 'code' | 'description';
    },
  ): Promise<Buffer> {
    const { rows, period, asOf } = await this.stockGeneral(tenantId, q);
    const branding = await this.loadReportBranding(tenantId);
    const html = buildStockGeneralPdfHtml({
      rows,
      periodFromIso: period.from,
      periodToIso: period.to,
      asOfIso: asOf,
      branding:
        branding.municipalityName || branding.coatDataUrl
          ? {
              municipalityName: branding.municipalityName,
              coatDataUrl: branding.coatDataUrl,
            }
          : undefined,
    });
    return renderStockGeneralPdfHtml(html);
  }

  /**
   * Dados para gráficos de vendas (saídas) agregadas por classe (tipo) de material.
   * Quantidades vêm de movimentos EXIT; receita dos itens da saída pareados na mesma ordem.
   */
  async salesByMaterialClassChart(
    tenantId: string,
    q: {
      dateFrom: string;
      dateTo: string;
      materialTypeId?: string;
      materialId?: string;
      depositId?: string;
    },
  ) {
    const from = new Date(q.dateFrom);
    const to = new Date(q.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Período inválido');
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (from > to) {
      throw new BadRequestException('A data inicial deve ser anterior ou igual à final');
    }

    const materialWhere: Prisma.RecyclableMaterialWhereInput = {
      tenantId,
      ...(q.materialTypeId ? { materialTypeId: q.materialTypeId } : {}),
      ...(q.materialId ? { id: q.materialId } : {}),
    };

    const depId = q.depositId?.trim() || undefined;

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        type: MovementType.EXIT,
        occurredAt: { gte: from, lte: to },
        material: materialWhere,
        ...(depId ? { establishmentFromId: depId } : {}),
      },
      include: {
        material: {
          include: {
            materialType: { select: { id: true, name: true } },
            unit: { select: { code: true } },
          },
        },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });

    const exitIds = [...new Set(movements.map((m) => m.stockExitId).filter((id): id is string => !!id))];
    const revenueByMovementId = new Map<string, Prisma.Decimal>();

    if (exitIds.length > 0) {
      const exits = await this.prisma.stockExit.findMany({
        where: { id: { in: exitIds }, tenantId },
        include: {
          items: { orderBy: { id: 'asc' } },
          movements: {
            where: { type: MovementType.EXIT },
            orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      for (const ex of exits) {
        const exitMovs = ex.movements;
        const n = Math.min(ex.items.length, exitMovs.length);
        for (let i = 0; i < n; i++) {
          const it = ex.items[i];
          const mov = exitMovs[i];
          revenueByMovementId.set(mov.id, it.lineTotal ?? new Prisma.Decimal(0));
        }
      }
    }

    type ClassAgg = {
      materialTypeId: string;
      materialTypeName: string;
      qtyByUnit: Map<string, Prisma.Decimal>;
      revenue: Prisma.Decimal;
    };
    const byClassMap = new Map<string, ClassAgg>();

    type MonthAgg = {
      revenue: Prisma.Decimal;
      qtyByUnit: Map<string, Prisma.Decimal>;
    };
    const byMonthMap = new Map<string, MonthAgg>();

    const monthKeyOf = (d: Date) => {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${mo}`;
    };

    for (const m of movements) {
      const mt = m.material.materialType;
      const unitCode = m.material.unit.code;
      const typeKey = mt.id;

      if (!byClassMap.has(typeKey)) {
        byClassMap.set(typeKey, {
          materialTypeId: mt.id,
          materialTypeName: mt.name,
          qtyByUnit: new Map(),
          revenue: new Prisma.Decimal(0),
        });
      }
      const c = byClassMap.get(typeKey)!;
      const prevQ = c.qtyByUnit.get(unitCode) ?? new Prisma.Decimal(0);
      c.qtyByUnit.set(unitCode, prevQ.add(m.quantity));

      const rev = revenueByMovementId.get(m.id);
      if (rev) {
        c.revenue = c.revenue.add(rev);
      }

      const mk = monthKeyOf(m.occurredAt);
      if (!byMonthMap.has(mk)) {
        byMonthMap.set(mk, { revenue: new Prisma.Decimal(0), qtyByUnit: new Map() });
      }
      const mo = byMonthMap.get(mk)!;
      if (rev) {
        mo.revenue = mo.revenue.add(rev);
      }
      const pq = mo.qtyByUnit.get(unitCode) ?? new Prisma.Decimal(0);
      mo.qtyByUnit.set(unitCode, pq.add(m.quantity));
    }

    const byMaterialClass = Array.from(byClassMap.values())
      .sort((a, b) => a.materialTypeName.localeCompare(b.materialTypeName, 'pt-BR'))
      .map((row) => ({
        materialTypeId: row.materialTypeId,
        materialTypeName: row.materialTypeName,
        revenueTotal: row.revenue.toString(),
        quantities: Array.from(row.qtyByUnit.entries())
          .sort(([ua], [ub]) => ua.localeCompare(ub, 'pt-BR'))
          .map(([unitCode, quantity]) => ({
            unitCode,
            quantity: quantity.toString(),
          })),
      }));

    /** Todos os meses civis entre início e fim (como em recycled-sales-monthly-chart); meses sem venda em zero. */
    const monthKeys: string[] = [];
    const monthCursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const endMonth = new Date(to.getFullYear(), to.getMonth(), 1);
    while (monthCursor <= endMonth) {
      monthKeys.push(
        `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`,
      );
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    const z = () => new Prisma.Decimal(0);
    const byMonth = monthKeys.map((month) => {
      const agg = byMonthMap.get(month);
      const [y, moNum] = month.split('-').map(Number);
      const monthLabel = new Date(y, moNum - 1, 15).toLocaleDateString('pt-BR', {
        month: 'short',
        year: 'numeric',
      });
      return {
        month,
        monthLabel,
        revenueTotal: (agg?.revenue ?? z()).toString(),
        quantities:
          agg == null
            ? []
            : Array.from(agg.qtyByUnit.entries())
                .sort(([ua], [ub]) => ua.localeCompare(ub, 'pt-BR'))
                .map(([unitCode, quantity]) => ({
                  unitCode,
                  quantity: quantity.toString(),
                })),
      };
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      byMaterialClass,
      byMonth,
    };
  }

  /**
   * Série mensal de vendas de materiais reciclados (saídas EXIT), com receita dos itens pareados.
   * Opcionalmente filtra por depósito de origem. Meses sem movimento aparecem com zeros.
   */
  async recycledSalesMonthlyHistory(
    tenantId: string,
    q: { dateFrom: string; dateTo: string; depositId?: string },
  ) {
    const from = new Date(q.dateFrom);
    const to = new Date(q.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Período inválido');
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (from > to) {
      throw new BadRequestException('A data inicial deve ser anterior ou igual à final');
    }

    const depId = q.depositId?.trim() || undefined;

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        type: MovementType.EXIT,
        occurredAt: { gte: from, lte: to },
        material: { tenantId },
        ...(depId ? { establishmentFromId: depId } : {}),
      },
      include: {
        material: {
          include: {
            unit: { select: { code: true } },
          },
        },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });

    const exitIds = [...new Set(movements.map((m) => m.stockExitId).filter((id): id is string => !!id))];
    const revenueByMovementId = new Map<string, Prisma.Decimal>();

    if (exitIds.length > 0) {
      const exits = await this.prisma.stockExit.findMany({
        where: { id: { in: exitIds }, tenantId },
        include: {
          items: { orderBy: { id: 'asc' } },
          movements: {
            where: { type: MovementType.EXIT },
            orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      for (const ex of exits) {
        const exitMovs = ex.movements;
        const n = Math.min(ex.items.length, exitMovs.length);
        for (let i = 0; i < n; i++) {
          const it = ex.items[i];
          const mov = exitMovs[i];
          revenueByMovementId.set(mov.id, it.lineTotal ?? new Prisma.Decimal(0));
        }
      }
    }

    type MonthAgg = {
      revenue: Prisma.Decimal;
      qtyByUnit: Map<string, Prisma.Decimal>;
    };
    const byMonthMap = new Map<string, MonthAgg>();

    const monthKeyOf = (d: Date) => {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${mo}`;
    };

    for (const m of movements) {
      const unitCode = m.material.unit.code;
      const mk = monthKeyOf(m.occurredAt);
      if (!byMonthMap.has(mk)) {
        byMonthMap.set(mk, { revenue: new Prisma.Decimal(0), qtyByUnit: new Map() });
      }
      const mo = byMonthMap.get(mk)!;
      const rev = revenueByMovementId.get(m.id);
      if (rev) {
        mo.revenue = mo.revenue.add(rev);
      }
      const pq = mo.qtyByUnit.get(unitCode) ?? new Prisma.Decimal(0);
      mo.qtyByUnit.set(unitCode, pq.add(m.quantity));
    }

    const monthKeys: string[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const endMonth = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= endMonth) {
      monthKeys.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const z = () => new Prisma.Decimal(0);
    const byMonth = monthKeys.map((month) => {
      const agg = byMonthMap.get(month);
      const [y, moNum] = month.split('-').map(Number);
      const monthLabel = new Date(y, moNum - 1, 15).toLocaleDateString('pt-BR', {
        month: 'short',
        year: 'numeric',
      });
      const revenueTotal = (agg?.revenue ?? z()).toString();
      const quantities =
        agg == null
          ? []
          : Array.from(agg.qtyByUnit.entries())
              .sort(([ua], [ub]) => ua.localeCompare(ub, 'pt-BR'))
              .map(([unitCode, quantity]) => ({
                unitCode,
                quantity: quantity.toString(),
              }));
      return {
        month,
        monthLabel,
        revenueTotal,
        quantities,
      };
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      depositId: depId ?? null,
      byMonth,
    };
  }

  async dashboard(tenantId: string) {
    const end = new Date();
    const y = end.getFullYear();
    const mo1 = end.getMonth() + 1;
    const lastDayOfMonth = new Date(y, mo1, 0).getDate();
    const dateFrom = `${y}-01-01`;
    const dateTo = `${y}-${String(mo1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const [balanceAgg, movementCount, revenue, deposits, materials, monthlyHistory] = await Promise.all([
      this.prisma.stockBalance.aggregate({
        where: { tenantId },
        _sum: { quantity: true },
        _count: true,
      }),
      this.prisma.stockMovement.count({ where: { tenantId } }),
      this.prisma.stockExit.aggregate({
        where: { tenantId },
        _sum: { totalValue: true },
      }),
      this.prisma.establishment.count({
        where: { tenantId, active: true, role: EstablishmentRole.DEPOSIT },
      }),
      this.prisma.recyclableMaterial.count({ where: { tenantId, active: true } }),
      this.recycledSalesMonthlyHistory(tenantId, { dateFrom, dateTo }),
    ]);

    const qtySum = balanceAgg._sum.quantity ?? new Prisma.Decimal(0);
    const revSum = revenue._sum.totalValue ?? new Prisma.Decimal(0);

    const revenueByMonth = monthlyHistory.byMonth.map(({ month, monthLabel, revenueTotal }) => ({
      month,
      monthLabel,
      revenueTotal,
    }));

    return {
      totalStockQuantity: qtySum.toString(),
      stockBalanceRows: balanceAgg._count,
      movementsTotal: movementCount,
      revenueTotal: revSum.toString(),
      activeDeposits: deposits,
      activeMaterials: materials,
      revenueByMonth,
    };
  }

  async exportMovementsExcel(tenantId: string): Promise<Buffer> {
    const rows = await this.prisma.stockMovement.findMany({
      where: { tenantId },
      take: 5000,
      orderBy: { occurredAt: 'desc' },
      include: {
        material: { select: { name: true } },
        establishmentFrom: { select: { tradeName: true } },
        establishmentTo: { select: { tradeName: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Movimentações');
    const branding = await this.loadReportBranding(tenantId);
    this.appendExcelBranding(
      sheet,
      workbook,
      branding,
      7,
      'Histórico de movimentações (até 5000 registos mais recentes)',
    );
    const headers = ['Data', 'Tipo', 'Material', 'Qtd', 'Origem', 'Destino', 'Ref'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7EF' },
      };
    });
    for (const r of rows) {
      sheet.addRow([
        r.occurredAt.toISOString(),
        r.type,
        r.material.name,
        r.quantity.toString(),
        r.establishmentFrom?.tradeName ?? '',
        r.establishmentTo?.tradeName ?? '',
        r.reference ?? '',
      ]);
    }
    const widths = [22, 14, 28, 14, 22, 22, 16];
    widths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportStockPdf(tenantId: string): Promise<Buffer> {
    const branding = await this.loadReportBranding(tenantId);
    const balances = await this.prisma.stockBalance.findMany({
      where: { tenantId },
      include: {
        establishment: true,
        material: true,
      },
      orderBy: [{ establishment: { tradeName: 'asc' } }, { material: { name: 'asc' } }],
    });

    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const left = doc.page.margins.left;
    let y = doc.y;
    if (branding.coatBuffer && branding.coatExcelExtension) {
      try {
        doc.image(branding.coatBuffer, left, y, { width: 56, height: 56 });
        y += 60;
        doc.y = y;
      } catch {
        /* formato não suportado pelo PDFKit */
      }
    }
    if (branding.municipalityName) {
      doc.fontSize(12).text(branding.municipalityName, { align: 'center' });
      doc.moveDown(0.4);
    }
    doc.fontSize(16).text('Relatório de estoque por depósito', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    for (const b of balances) {
      doc.text(
        `${b.establishment.tradeName} | ${b.material.name}: ${b.quantity.toString()} `,
        { continued: false },
      );
    }
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}
