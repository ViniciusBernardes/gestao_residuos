import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.unitOfMeasure.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.unitOfMeasure.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async getOne(tenantId: string, id: string) {
    const row = await this.prisma.unitOfMeasure.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Unidade não encontrada');
    return row;
  }

  async create(tenantId: string, dto: CreateUnitDto, userId: string, req: Request) {
    try {
      const row = await this.prisma.unitOfMeasure.create({
        data: {
          tenantId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          active: dto.active ?? true,
        },
      });
      await this.audit.log({
        tenantId,
        userId,
        action: 'CREATE',
        resource: 'UnitOfMeasure',
        resourceId: row.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      });
      return row;
    } catch {
      throw new ConflictException('Código de unidade já existe');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateUnitDto, userId: string, req: Request) {
    const existing = await this.prisma.unitOfMeasure.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Unidade não encontrada');
    const row = await this.prisma.unitOfMeasure.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code ? dto.code.toUpperCase() : undefined,
      },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      resource: 'UnitOfMeasure',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return row;
  }

  async remove(tenantId: string, id: string, userId: string, req: Request) {
    const existing = await this.prisma.unitOfMeasure.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Unidade não encontrada');
    await this.prisma.unitOfMeasure.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'SOFT_DELETE',
      resource: 'UnitOfMeasure',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true };
  }
}
