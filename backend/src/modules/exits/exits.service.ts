import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstablishmentRole, MovementType, Prisma } from '@prisma/client';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { adjustBalance } from '../stock/stock-balance.util';
import { CreateExitDto } from './dto/create-exit.dto';
import { UpdateExitDto } from './dto/update-exit.dto';

function exitsUploadDir(): string {
  const dir = join(process.cwd(), 'uploads', 'stock-exits');
  mkdirSync(dir, { recursive: true });
  return dir;
}

@Injectable()
export class ExitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit, 20, 100);
    const where = { tenantId };
    const [raw, total] = await Promise.all([
      this.prisma.stockExit.findMany({
        where,
        include: {
          establishment: { select: { id: true, tradeName: true, code: true } },
          user: { select: { id: true, name: true } },
          items: {
            orderBy: { id: 'asc' },
            include: {
              material: {
                select: { id: true, name: true, code: true, unit: { select: { code: true } } },
              },
            },
          },
          movements: {
            where: { type: MovementType.EXIT },
            orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
            include: {
              establishmentFrom: { select: { id: true, tradeName: true, code: true } },
            },
          },
        },
        orderBy: { exitedAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.stockExit.count({ where }),
    ]);
    const items = raw.map((ex) => {
      const { documentFilePath: _fp, establishment, movements, ...rest } = ex;
      const exitMovements = movements;
      return {
        ...rest,
        items: ex.items.map((it, i) => {
          const from = exitMovements[i]?.establishmentFrom;
          return {
            ...it,
            depositFrom: from
              ? {
                  id: from.id,
                  name: from.tradeName,
                  code: from.code,
                }
              : null,
          };
        }),
        center: {
          id: establishment.id,
          name: establishment.tradeName,
          code: establishment.code,
        },
      };
    });
    return toPaginated(items, total, p, l);
  }

  async getOne(tenantId: string, id: string) {
    const e = await this.prisma.stockExit.findFirst({
      where: { id, tenantId },
      include: {
        establishment: true,
        user: true,
        items: { include: { material: { include: { unit: true } } } },
        movements: {
          orderBy: { occurredAt: 'asc' },
          include: { establishmentFrom: true, material: true },
        },
      },
    });
    if (!e) throw new NotFoundException('Saída não encontrada');
    const { documentFilePath: _df, ...core } = e;
    return {
      ...core,
      center: {
        id: e.establishment.id,
        name: e.establishment.tradeName,
        code: e.establishment.code,
      },
      movements: e.movements.map((m) => ({
        ...m,
        depositFrom: m.establishmentFrom
          ? { id: m.establishmentFrom.id, name: m.establishmentFrom.tradeName }
          : null,
      })),
    };
  }

  async attachDocument(
    tenantId: string,
    exitId: string,
    userId: string,
    file: Express.Multer.File,
    req: Request,
  ) {
    const exit = await this.prisma.stockExit.findFirst({ where: { id: exitId, tenantId } });
    if (!exit) throw new NotFoundException('Saída não encontrada');
    const dir = exitsUploadDir();
    const safeOriginal = basename(file.originalname || 'documento').slice(0, 255);
    if (exit.documentFilePath) {
      const prev = join(dir, exit.documentFilePath);
      if (existsSync(prev)) unlinkSync(prev);
    }
    await this.prisma.stockExit.update({
      where: { id: exitId },
      data: {
        documentFilePath: file.filename,
        documentOriginalName: safeOriginal,
      },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      resource: 'StockExit',
      resourceId: exitId,
      details: { documentAttached: true },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true, documentOriginalName: safeOriginal };
  }

  async resolveDocumentFile(
    tenantId: string,
    id: string,
  ): Promise<{ fullPath: string; downloadName: string }> {
    const exit = await this.prisma.stockExit.findFirst({
      where: { id, tenantId },
      select: { documentFilePath: true, documentOriginalName: true },
    });
    if (!exit?.documentFilePath) throw new NotFoundException('Nenhum arquivo anexado');
    const dir = exitsUploadDir();
    const full = join(dir, exit.documentFilePath);
    if (!existsSync(full)) throw new NotFoundException('Arquivo não encontrado no servidor');
    const downloadName = basename(exit.documentOriginalName || exit.documentFilePath || 'documento');
    return { fullPath: full, downloadName };
  }

  async create(tenantId: string, userId: string, dto: CreateExitDto, req: Request) {
    const dest = await this.prisma.establishment.findFirst({
      where: {
        id: dto.establishmentId,
        tenantId,
        active: true,
        role: EstablishmentRole.DESTINATION,
      },
    });
    if (!dest) throw new NotFoundException('Estabelecimento de destino final não encontrado');

    let totalValue = new Prisma.Decimal(0);

    const exit = await this.prisma.$transaction(async (tx) => {
      const balanceBeforeSnapshots: Prisma.Decimal[] = [];
      for (const item of dto.items) {
        const qty = new Prisma.Decimal(item.quantity);
        const material = await tx.recyclableMaterial.findFirst({
          where: { id: item.materialId, tenantId },
        });
        if (!material) throw new NotFoundException(`Material ${item.materialId} inválido`);
        const dep = await tx.establishment.findFirst({
          where: {
            id: item.depositId,
            tenantId,
            active: true,
            role: EstablishmentRole.DEPOSIT,
          },
        });
        if (!dep) throw new NotFoundException(`Depósito ${item.depositId} inválido`);
        const balWhere = {
          tenantId_establishmentId_materialId: {
            tenantId,
            establishmentId: item.depositId,
            materialId: item.materialId,
          },
        };
        const balRow = await tx.stockBalance.findUnique({ where: balWhere });
        balanceBeforeSnapshots.push(balRow ? balRow.quantity : new Prisma.Decimal(0));
        await adjustBalance(tx, tenantId, item.depositId, item.materialId, qty.neg());
      }

      const exitRow = await tx.stockExit.create({
        data: {
          tenantId,
          establishmentId: dto.establishmentId,
          notes: dto.notes,
          userId,
          totalValue: 0,
        },
      });

      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i];
        const qty = new Prisma.Decimal(item.quantity);
        const unitPrice = item.unitPrice != null ? new Prisma.Decimal(item.unitPrice) : null;
        const lineTotal = unitPrice != null ? unitPrice.mul(qty) : null;
        if (lineTotal) totalValue = totalValue.add(lineTotal);

        await tx.stockExitItem.create({
          data: {
            stockExitId: exitRow.id,
            materialId: item.materialId,
            quantity: qty,
            unitPrice,
            lineTotal,
            depositBalanceBeforeExit: balanceBeforeSnapshots[i],
          },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            materialId: item.materialId,
            type: MovementType.EXIT,
            quantity: qty,
            establishmentFromId: item.depositId,
            reference: exitRow.id,
            notes: dto.notes,
            userId,
            stockExitId: exitRow.id,
          },
        });
      }

      await tx.stockExit.update({
        where: { id: exitRow.id },
        data: { totalValue },
      });

      return { exit: exitRow, totalValue };
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'STOCK_EXIT',
      resource: 'StockExit',
      resourceId: exit.exit.id,
      details: { establishmentId: dto.establishmentId, items: dto.items.length },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return this.getOne(tenantId, exit.exit.id);
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateExitDto,
    req: Request,
  ) {
    const existing = await this.prisma.stockExit.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Saída não encontrada');
    const row = await this.prisma.stockExit.update({
      where: { id },
      data: {
        notes: dto.notes,
        totalValue:
          dto.totalValue !== undefined ? new Prisma.Decimal(dto.totalValue) : undefined,
      },
      include: {
        establishment: { select: { id: true, tradeName: true } },
        items: { include: { material: true } },
      },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      resource: 'StockExit',
      resourceId: id,
      details: { fields: Object.keys(dto) },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    const { documentFilePath: _df, ...rest } = row;
    return {
      ...rest,
      center: { id: row.establishment.id, name: row.establishment.tradeName },
    };
  }

  async remove(tenantId: string, id: string, userId: string, req: Request) {
    const exit = await this.prisma.stockExit.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!exit) throw new NotFoundException('Saída não encontrada');
    const docPath = exit.documentFilePath;

    await this.prisma.$transaction(async (tx) => {
      const movements = await tx.stockMovement.findMany({
        where: { tenantId, stockExitId: id, type: MovementType.EXIT },
      });
      if (movements.length === 0) {
        throw new BadRequestException('Movimentações da saída não encontradas');
      }
      for (const m of movements) {
        if (!m.establishmentFromId) continue;
        await adjustBalance(tx, tenantId, m.establishmentFromId, m.materialId, m.quantity);
      }
      await tx.stockMovement.deleteMany({ where: { stockExitId: id, tenantId } });
      await tx.stockExitItem.deleteMany({ where: { stockExitId: id } });
      await tx.stockExit.delete({ where: { id } });
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      resource: 'StockExit',
      resourceId: id,
      details: { itemsRestored: exit.items.length },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    if (docPath) {
      const full = join(exitsUploadDir(), docPath);
      if (existsSync(full)) unlinkSync(full);
    }

    return { ok: true };
  }
}
