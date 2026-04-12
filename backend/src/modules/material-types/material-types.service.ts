import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateMaterialTypeDto } from './dto/create-material-type.dto';
import { UpdateMaterialTypeDto } from './dto/update-material-type.dto';

@Injectable()
export class MaterialTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.materialType.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.materialType.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async getOne(tenantId: string, id: string) {
    const row = await this.prisma.materialType.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Tipo não encontrado');
    return row;
  }

  async create(tenantId: string, dto: CreateMaterialTypeDto, userId: string, req: Request) {
    try {
      const row = await this.prisma.materialType.create({
        data: {
          tenantId,
          name: dto.name,
          description: dto.description,
          active: dto.active ?? true,
        },
      });
      await this.audit.log({
        tenantId,
        userId,
        action: 'CREATE',
        resource: 'MaterialType',
        resourceId: row.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      });
      return row;
    } catch {
      throw new ConflictException('Já existe tipo com este nome');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateMaterialTypeDto, userId: string, req: Request) {
    const existing = await this.prisma.materialType.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Tipo não encontrado');
    const row = await this.prisma.materialType.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      resource: 'MaterialType',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return row;
  }

  async remove(tenantId: string, id: string, userId: string, req: Request) {
    const existing = await this.prisma.materialType.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Tipo não encontrado');
    await this.prisma.materialType.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'SOFT_DELETE',
      resource: 'MaterialType',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true };
  }
}
