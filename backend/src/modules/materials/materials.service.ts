import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.recyclableMaterial.findMany({
        where,
        include: {
          materialType: { select: { id: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.recyclableMaterial.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async getOne(tenantId: string, id: string) {
    const m = await this.prisma.recyclableMaterial.findFirst({
      where: { id, tenantId },
      include: {
        materialType: true,
        unit: true,
      },
    });
    if (!m) throw new NotFoundException('Material não encontrado');
    return m;
  }

  async create(tenantId: string, dto: CreateMaterialDto, userId: string, req: Request) {
    try {
      const row = await this.prisma.recyclableMaterial.create({
        data: {
          tenantId,
          materialTypeId: dto.materialTypeId,
          unitId: dto.unitId,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          active: dto.active ?? true,
        },
        include: {
          materialType: { select: { id: true, name: true } },
          unit: { select: { id: true, code: true, name: true } },
        },
      });
      await this.audit.log({
        tenantId,
        userId,
        action: 'CREATE',
        resource: 'RecyclableMaterial',
        resourceId: row.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      });
      return row;
    } catch {
      throw new ConflictException('Não foi possível criar (verifique tipos e unidade)');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateMaterialDto, userId: string, req: Request) {
    const existing = await this.prisma.recyclableMaterial.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Material não encontrado');
    const row = await this.prisma.recyclableMaterial.update({
      where: { id },
      data: dto,
      include: {
        materialType: { select: { id: true, name: true } },
        unit: { select: { id: true, code: true, name: true } },
      },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      resource: 'RecyclableMaterial',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return row;
  }

  async remove(tenantId: string, id: string, userId: string, req: Request) {
    const existing = await this.prisma.recyclableMaterial.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Material não encontrado');
    await this.prisma.recyclableMaterial.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'SOFT_DELETE',
      resource: 'RecyclableMaterial',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true };
  }
}
