import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstablishmentRole } from '@prisma/client';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateActivityBranchDto } from './dto/create-activity-branch.dto';
import { UpdateActivityBranchDto } from './dto/update-activity-branch.dto';

@Injectable()
export class ActivityBranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    tenantId: string,
    page?: string,
    limit?: string,
    role?: EstablishmentRole,
  ) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId, ...(role ? { role } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.activityBranch.findMany({
        where,
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        skip,
        take: l,
      }),
      this.prisma.activityBranch.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async getOne(tenantId: string, id: string) {
    const row = await this.prisma.activityBranch.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Ramo de atividade não encontrado');
    return row;
  }

  async create(tenantId: string, dto: CreateActivityBranchDto, userId: string, req: Request) {
    try {
      const row = await this.prisma.activityBranch.create({
        data: {
          tenantId,
          name: dto.name,
          role: dto.role,
          active: dto.active ?? true,
        },
      });
      await this.audit.log({
        tenantId,
        userId,
        action: 'CREATE',
        resource: 'ActivityBranch',
        resourceId: row.id,
        details: { name: dto.name, role: dto.role },
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      });
      return row;
    } catch {
      throw new ConflictException('Já existe ramo com este nome e papel');
    }
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateActivityBranchDto,
    userId: string,
    req: Request,
  ) {
    await this.getOne(tenantId, id);
    try {
      const row = await this.prisma.activityBranch.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
      await this.audit.log({
        tenantId,
        userId,
        action: 'UPDATE',
        resource: 'ActivityBranch',
        resourceId: id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      });
      return row;
    } catch {
      throw new ConflictException('Não foi possível atualizar');
    }
  }

  async remove(tenantId: string, id: string, userId: string, req: Request) {
    await this.getOne(tenantId, id);
    const used = await this.prisma.establishment.count({ where: { activityBranchId: id } });
    if (used > 0) {
      throw new ConflictException('Ramo em uso por estabelecimentos; desative em vez de excluir.');
    }
    await this.prisma.activityBranch.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      resource: 'ActivityBranch',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true };
  }

  /** Garante ramos padrão para tenants criados após migrações antigas. */
  async ensureDefaults(tenantId: string) {
    const count = await this.prisma.activityBranch.count({ where: { tenantId } });
    if (count > 0) return;
    await this.prisma.activityBranch.createMany({
      data: [
        { tenantId, name: 'Depósito', role: EstablishmentRole.DEPOSIT, active: true },
        { tenantId, name: 'Destino final', role: EstablishmentRole.DESTINATION, active: true },
      ],
    });
  }
}
