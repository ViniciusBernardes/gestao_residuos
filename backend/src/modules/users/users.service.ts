import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionsService } from '../permissions/permissions.service';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
  ) {}

  async findById(tenantId: string, id: string) {
    const u = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        permissionProfileId: true,
        permissionProfile: { select: { id: true, name: true, fullAccess: true } },
      },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    const permissions = await this.permissions.effectiveMatrix(
      tenantId,
      u.permissionProfileId,
    );
    const fullAccess = u.permissionProfile?.fullAccess ?? false;
    return { ...u, fullAccess, permissions };
  }

  async list(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          lastLoginAt: true,
          createdAt: true,
          permissionProfileId: true,
          permissionProfile: { select: { id: true, name: true, fullAccess: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async create(tenantId: string, dto: CreateUserDto, actorId: string, req: Request) {
    const exists = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const prof = await this.prisma.permissionProfile.findFirst({
      where: { id: dto.permissionProfileId, tenantId, active: true },
    });
    if (!prof) throw new BadRequestException('Perfil de permissão inválido');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        permissionProfileId: dto.permissionProfileId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        permissionProfileId: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId,
      action: 'CREATE',
      resource: 'User',
      resourceId: user.id,
      details: { email: user.email },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto, actorId: string, req: Request) {
    const existing = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Usuário não encontrado');

    const data: {
      passwordHash?: string;
      name?: string;
      active?: boolean;
      permissionProfileId?: string;
    } = {};
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.permissionProfileId !== undefined) {
      const prof = await this.prisma.permissionProfile.findFirst({
        where: { id: dto.permissionProfileId, tenantId, active: true },
      });
      if (!prof) throw new BadRequestException('Perfil de permissão inválido');
      data.permissionProfileId = dto.permissionProfileId;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        updatedAt: true,
        permissionProfileId: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorId,
      action: 'UPDATE',
      resource: 'User',
      resourceId: id,
      details: { fields: Object.keys(dto) },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return user;
  }

  async remove(tenantId: string, id: string, actorId: string, req: Request) {
    if (id === actorId) {
      throw new BadRequestException('Não é possível desativar o próprio usuário');
    }
    const existing = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Usuário não encontrado');
    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.log({
      tenantId,
      userId: actorId,
      action: 'SOFT_DELETE',
      resource: 'User',
      resourceId: id,
      details: { email: existing.email },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true };
  }
}
