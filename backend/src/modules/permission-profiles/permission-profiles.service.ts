import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CreatePermissionProfileDto } from './dto/create-permission-profile.dto';
import { UpdatePermissionProfileDto } from './dto/update-permission-profile.dto';

@Injectable()
export class PermissionProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
  ) {}

  definitions() {
    return this.permissions.moduleDefinitions();
  }

  private async assertActorFullAccess(tenantId: string, userId: string) {
    const ok = await this.permissions.userHasFullAccess(tenantId, userId);
    if (!ok) {
      throw new ForbiddenException('Apenas perfil com acesso total pode realizar esta operação');
    }
  }

  async list(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.permissionProfile.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: l,
        select: {
          id: true,
          name: true,
          description: true,
          fullAccess: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { users: true } },
        },
      }),
      this.prisma.permissionProfile.count({ where }),
    ]);
    const rows = items.map(({ _count, ...rest }) => ({
      ...rest,
      usersCount: _count.users,
    }));
    return toPaginated(rows, total, p, l);
  }

  async getOne(tenantId: string, id: string) {
    const row = await this.prisma.permissionProfile.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Perfil não encontrado');
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      fullAccess: row.fullAccess,
      active: row.active,
      permissions: this.permissions.sanitizePermissionsJson(row.permissions),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(
    tenantId: string,
    dto: CreatePermissionProfileDto,
    userId: string,
    req: Request,
  ) {
    const fullAccess = dto.fullAccess === true;
    if (fullAccess) await this.assertActorFullAccess(tenantId, userId);

    const permissions = fullAccess
      ? this.permissions.sanitizePermissionsJson({})
      : this.permissions.sanitizePermissionsJson(dto.permissions);

    const row = await this.prisma.permissionProfile.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        fullAccess,
        permissions: permissions as object,
      },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      resource: 'PermissionProfile',
      resourceId: row.id,
      details: { name: row.name, fullAccess },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return this.getOne(tenantId, row.id);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePermissionProfileDto,
    userId: string,
    req: Request,
  ) {
    const existing = await this.prisma.permissionProfile.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Perfil não encontrado');

    if (dto.fullAccess === true && !existing.fullAccess) {
      await this.assertActorFullAccess(tenantId, userId);
    }

    const data: {
      name?: string;
      description?: string | null;
      permissions?: object;
      active?: boolean;
      fullAccess?: boolean;
    } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.permissions !== undefined) {
      data.permissions = this.permissions.sanitizePermissionsJson(dto.permissions) as object;
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.fullAccess !== undefined) data.fullAccess = dto.fullAccess;

    await this.prisma.permissionProfile.update({ where: { id }, data });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      resource: 'PermissionProfile',
      resourceId: id,
      details: { fields: Object.keys(dto) },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return this.getOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, userId: string, req: Request) {
    const existing = await this.prisma.permissionProfile.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) throw new NotFoundException('Perfil não encontrado');
    if (existing._count.users > 0) {
      throw new BadRequestException(
        'Não é possível excluir: existem usuários vinculados a este perfil',
      );
    }

    await this.prisma.permissionProfile.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      resource: 'PermissionProfile',
      resourceId: id,
      details: { name: existing.name },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return { ok: true };
  }
}
