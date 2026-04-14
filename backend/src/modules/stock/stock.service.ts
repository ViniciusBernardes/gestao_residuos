import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstablishmentRole, MovementType, Prisma, StockMovement } from '@prisma/client';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { adjustBalance } from './stock-balance.util';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

function estLabel(e: { id: string; tradeName: string }) {
  return { id: e.id, name: e.tradeName };
}

type MovWithEst = StockMovement & {
  establishmentFrom: { id: string; tradeName: string } | null;
  establishmentTo: { id: string; tradeName: string } | null;
};

function movementDepositSummary(m: MovWithEst): string {
  const from = m.establishmentFrom?.tradeName;
  const to = m.establishmentTo?.tradeName;
  switch (m.type) {
    case MovementType.ENTRY:
      return to ?? '—';
    case MovementType.EXIT:
      return from ?? '—';
    case MovementType.TRANSFER_OUT:
      return from ? `${from} (saída)` : '—';
    case MovementType.TRANSFER_IN:
      return to ? `${to} (entrada)` : '—';
    case MovementType.ADJUSTMENT:
      if (from && to && from !== to) return `${from} → ${to}`;
      return from ?? to ?? '—';
    default:
      return [from, to].filter(Boolean).join(' → ') || '—';
  }
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async balances(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId };
    const [raw, total] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where,
        include: {
          establishment: { select: { id: true, tradeName: true, code: true } },
          material: {
            select: {
              id: true,
              name: true,
              code: true,
              unit: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: [{ establishment: { tradeName: 'asc' } }, { material: { name: 'asc' } }],
        skip,
        take: l,
      }),
      this.prisma.stockBalance.count({ where }),
    ]);
    const items = raw.map((b) => ({
      id: `${b.establishmentId}-${b.materialId}`,
      quantity: b.quantity,
      material: b.material,
      deposit: {
        id: b.establishment.id,
        name: b.establishment.tradeName,
        code: b.establishment.code,
      },
    }));
    return toPaginated(items, total, p, l);
  }

  /** Visão por material: totais e depósitos com saldo &gt;0 (listagem principal do estoque). */
  async materialOverview(
    tenantId: string,
    page?: string,
    limit?: string,
    search?: string,
    scopeRaw?: string,
  ) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit, 20, 100);
    const q = search?.trim();
    const mode = Prisma.QueryMode.insensitive;
    const sc = (scopeRaw ?? 'all').toLowerCase();
    const scope = ['all', 'material', 'unit', 'deposit'].includes(sc) ? sc : 'all';

    let whereMat: Prisma.RecyclableMaterialWhereInput;
    if (!q) {
      whereMat = { tenantId, active: true };
    } else {
      const materialClauses: Prisma.RecyclableMaterialWhereInput[] = [
        { name: { contains: q, mode } },
        { code: { contains: q, mode } },
      ];
      const unitClauses: Prisma.RecyclableMaterialWhereInput[] = [
        {
          unit: {
            OR: [{ code: { contains: q, mode } }, { name: { contains: q, mode } }],
          },
        },
      ];
      const depositClauses: Prisma.RecyclableMaterialWhereInput[] = [
        {
          balances: {
            some: {
              tenantId,
              establishment: {
                OR: [{ tradeName: { contains: q, mode } }, { code: { contains: q, mode } }],
              },
            },
          },
        },
      ];
      let orList: Prisma.RecyclableMaterialWhereInput[];
      if (scope === 'material') {
        orList = materialClauses;
      } else if (scope === 'unit') {
        orList = unitClauses;
      } else if (scope === 'deposit') {
        orList = depositClauses;
      } else {
        orList = [...materialClauses, ...unitClauses, ...depositClauses];
      }
      whereMat = { tenantId, active: true, OR: orList };
    }
    const [materials, total] = await Promise.all([
      this.prisma.recyclableMaterial.findMany({
        where: whereMat,
        orderBy: { name: 'asc' },
        skip,
        take: l,
        include: { unit: { select: { code: true, name: true } } },
      }),
      this.prisma.recyclableMaterial.count({ where: whereMat }),
    ]);

    if (materials.length === 0) {
      return toPaginated([], total, p, l);
    }

    const ids = materials.map((m) => m.id);
    const balances = await this.prisma.stockBalance.findMany({
      where: { tenantId, materialId: { in: ids } },
      include: {
        establishment: { select: { id: true, tradeName: true, code: true } },
      },
    });

    const agg = new Map<
      string,
      { total: Prisma.Decimal; deposits: { id: string; name: string; code: string | null }[] }
    >();
    for (const m of materials) {
      agg.set(m.id, { total: new Prisma.Decimal(0), deposits: [] });
    }
    for (const b of balances) {
      const row = agg.get(b.materialId)!;
      row.total = row.total.add(b.quantity);
      if (b.quantity.gt(0)) {
        const dep = b.establishment;
        if (!row.deposits.some((d) => d.id === dep.id)) {
          row.deposits.push({ id: dep.id, name: dep.tradeName, code: dep.code });
        }
      }
    }

    const items = materials.map((m) => {
      const a = agg.get(m.id)!;
      return {
        material: {
          id: m.id,
          name: m.name,
          code: m.code,
          unit: m.unit,
        },
        totalQuantity: a.total.toString(),
        deposits: a.deposits,
      };
    });

    return toPaginated(items, total, p, l);
  }

  /** Detalhe por material: saldo por depósito + histórico de movimentos. */
  async materialBreakdown(tenantId: string, materialId: string) {
    const material = await this.prisma.recyclableMaterial.findFirst({
      where: { id: materialId, tenantId },
      include: { unit: { select: { code: true, name: true } } },
    });
    if (!material) throw new NotFoundException('Material não encontrado');

    const balances = await this.prisma.stockBalance.findMany({
      where: { tenantId, materialId },
      include: {
        establishment: { select: { id: true, tradeName: true, code: true } },
      },
      orderBy: { establishment: { tradeName: 'asc' } },
    });

    const perDeposit = balances.map((b) => ({
      depositId: b.establishmentId,
      depositName: b.establishment.tradeName,
      depositCode: b.establishment.code,
      quantity: b.quantity.toString(),
      unitCode: material.unit.code,
      unitName: material.unit.name,
      updatedAt: b.updatedAt.toISOString(),
    }));

    const rawMovements = await this.prisma.stockMovement.findMany({
      where: { tenantId, materialId },
      orderBy: { occurredAt: 'desc' },
      take: 150,
      include: {
        user: { select: { id: true, name: true } },
        establishmentFrom: { select: { id: true, tradeName: true } },
        establishmentTo: { select: { id: true, tradeName: true } },
      },
    });

    const movements = rawMovements.map((m) => ({
      id: m.id,
      occurredAt: m.occurredAt.toISOString(),
      type: m.type,
      quantity: m.quantity.toString(),
      depositSummary: movementDepositSummary(m as MovWithEst),
      userName: m.user?.name ?? '—',
    }));

    return {
      material: {
        id: material.id,
        name: material.name,
        code: material.code,
        unit: material.unit,
      },
      perDeposit,
      movements,
    };
  }

  async consolidated(tenantId: string) {
    const rows = await this.prisma.stockBalance.groupBy({
      by: ['materialId'],
      where: { tenantId },
      _sum: { quantity: true },
    });
    const materials = await this.prisma.recyclableMaterial.findMany({
      where: { tenantId, id: { in: rows.map((r) => r.materialId) } },
      include: { unit: true },
    });
    const map = new Map(materials.map((m) => [m.id, m]));
    return rows.map((r) => ({
      materialId: r.materialId,
      material: map.get(r.materialId),
      totalQuantity: r._sum.quantity,
    }));
  }

  async getMovement(tenantId: string, id: string) {
    const m = await this.prisma.stockMovement.findFirst({
      where: { id, tenantId },
      include: {
        material: { select: { id: true, name: true, code: true } },
        establishmentFrom: { select: { id: true, tradeName: true } },
        establishmentTo: { select: { id: true, tradeName: true } },
        user: { select: { id: true, name: true, email: true } },
        stockExit: {
          select: {
            id: true,
            documentNumber: true,
            establishment: { select: { id: true, tradeName: true, code: true } },
          },
        },
      },
    });
    if (!m) throw new NotFoundException('Movimentação não encontrada');
    return {
      ...m,
      depositFrom: m.establishmentFrom ? estLabel(m.establishmentFrom) : null,
      depositTo: m.establishmentTo ? estLabel(m.establishmentTo) : null,
      stockExit: m.stockExit
        ? {
            ...m.stockExit,
            center: m.stockExit.establishment
              ? {
                  id: m.stockExit.establishment.id,
                  name: m.stockExit.establishment.tradeName,
                  code: m.stockExit.establishment.code,
                }
              : null,
          }
        : null,
    };
  }

  async movements(
    tenantId: string,
    query: { materialId?: string; depositId?: string; page?: string; limit?: string },
  ) {
    const { page: p, limit: l, skip } = parsePageLimit(query.page, query.limit, 20, 200);
    const estId = query.depositId;
    const where = {
      tenantId,
      materialId: query.materialId,
      ...(estId
        ? {
            OR: [{ establishmentFromId: estId }, { establishmentToId: estId }],
          }
        : {}),
    };
    const [raw, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          material: { select: { id: true, name: true, code: true } },
          establishmentFrom: { select: { id: true, tradeName: true } },
          establishmentTo: { select: { id: true, tradeName: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    const items = raw.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      occurredAt: m.occurredAt,
      material: m.material,
      depositFrom: m.establishmentFrom ? estLabel(m.establishmentFrom) : null,
      depositTo: m.establishmentTo ? estLabel(m.establishmentTo) : null,
    }));
    return toPaginated(items, total, p, l);
  }

  private async assertDepositEstablishment(tenantId: string, id: string) {
    const e = await this.prisma.establishment.findFirst({
      where: { id, tenantId, active: true, role: EstablishmentRole.DEPOSIT },
    });
    if (!e) throw new NotFoundException('Depósito (estabelecimento) não encontrado');
    return e;
  }

  async registerEntry(
    tenantId: string,
    userId: string,
    dto: CreateEntryDto,
    req: Request,
  ) {
    const qty = new Prisma.Decimal(dto.quantity);
    const material = await this.prisma.recyclableMaterial.findFirst({
      where: { id: dto.materialId, tenantId },
    });
    if (!material) throw new NotFoundException('Material não encontrado');
    await this.assertDepositEstablishment(tenantId, dto.depositId);

    const movement = await this.prisma.$transaction(async (tx) => {
      await adjustBalance(tx, tenantId, dto.depositId, dto.materialId, qty);
      return tx.stockMovement.create({
        data: {
          tenantId,
          materialId: dto.materialId,
          type: MovementType.ENTRY,
          quantity: qty,
          establishmentToId: dto.depositId,
          reference: dto.reference,
          notes: dto.notes,
          userId,
        },
        include: {
          material: true,
          establishmentTo: true,
        },
      });
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'STOCK_ENTRY',
      resource: 'StockMovement',
      resourceId: movement.id,
      details: { quantity: dto.quantity, depositId: dto.depositId },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return movement;
  }

  async registerTransfer(
    tenantId: string,
    userId: string,
    dto: CreateTransferDto,
    req: Request,
  ) {
    if (dto.depositFromId === dto.depositToId) {
      throw new BadRequestException('Depósitos de origem e destino devem ser diferentes');
    }
    const qty = new Prisma.Decimal(dto.quantity);
    const material = await this.prisma.recyclableMaterial.findFirst({
      where: { id: dto.materialId, tenantId },
    });
    if (!material) throw new NotFoundException('Material não encontrado');
    await this.assertDepositEstablishment(tenantId, dto.depositFromId);
    await this.assertDepositEstablishment(tenantId, dto.depositToId);

    const ref = dto.reference ?? `TRF-${Date.now()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      await adjustBalance(tx, tenantId, dto.depositFromId, dto.materialId, qty.neg());
      await adjustBalance(tx, tenantId, dto.depositToId, dto.materialId, qty);

      const out = await tx.stockMovement.create({
        data: {
          tenantId,
          materialId: dto.materialId,
          type: MovementType.TRANSFER_OUT,
          quantity: qty,
          establishmentFromId: dto.depositFromId,
          reference: ref,
          notes: dto.notes,
          userId,
        },
      });
      const inn = await tx.stockMovement.create({
        data: {
          tenantId,
          materialId: dto.materialId,
          type: MovementType.TRANSFER_IN,
          quantity: qty,
          establishmentToId: dto.depositToId,
          reference: ref,
          notes: dto.notes,
          userId,
        },
      });
      return { out, inn };
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'STOCK_TRANSFER',
      resource: 'StockMovement',
      resourceId: result.out.id,
      details: { ref, quantity: dto.quantity },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return result;
  }

  async registerAdjustment(
    tenantId: string,
    userId: string,
    dto: CreateAdjustmentDto,
    req: Request,
  ) {
    const delta = new Prisma.Decimal(dto.quantityDelta);
    if (delta.eq(0)) {
      throw new BadRequestException('Informe uma variação diferente de zero');
    }
    const material = await this.prisma.recyclableMaterial.findFirst({
      where: { id: dto.materialId, tenantId },
    });
    if (!material) throw new NotFoundException('Material não encontrado');
    await this.assertDepositEstablishment(tenantId, dto.depositId);

    const absQty = delta.abs();
    const movement = await this.prisma.$transaction(async (tx) => {
      await adjustBalance(tx, tenantId, dto.depositId, dto.materialId, delta);
      return tx.stockMovement.create({
        data: {
          tenantId,
          materialId: dto.materialId,
          type: MovementType.ADJUSTMENT,
          quantity: absQty,
          establishmentFromId: delta.lt(0) ? dto.depositId : undefined,
          establishmentToId: delta.gt(0) ? dto.depositId : undefined,
          reference: dto.reference,
          notes: dto.notes,
          userId,
        },
        include: {
          material: true,
          establishmentFrom: true,
          establishmentTo: true,
        },
      });
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'STOCK_ADJUSTMENT',
      resource: 'StockMovement',
      resourceId: movement.id,
      details: { quantityDelta: dto.quantityDelta },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return movement;
  }
}
