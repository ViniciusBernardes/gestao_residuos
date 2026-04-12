import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const tenantListSelect = {
  id: true,
  name: true,
  slug: true,
  cnpj: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertTenantScope(user: JwtUser, tenantId: string) {
    if (user.fullAccess) return;
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('Sem permissão para este município');
    }
  }

  async list(user: JwtUser, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = user.fullAccess ? {} : { id: user.tenantId };
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        select: tenantListSelect,
        orderBy: { name: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async getById(user: JwtUser, id: string) {
    this.assertTenantScope(user, id);
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        ...tenantListSelect,
        schemaVersion: { select: { version: true, appliedAt: true } },
      },
    });
    if (!t) throw new NotFoundException('Município não encontrado');
    return t;
  }

  async getCurrent(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        cnpj: true,
        active: true,
        createdAt: true,
        schemaVersion: { select: { version: true, appliedAt: true } },
      },
    });
    if (!t) throw new NotFoundException('Tenant não encontrado');
    return t;
  }

  async create(actor: JwtUser, dto: CreateTenantDto, req: Request) {
    if (!actor.fullAccess) {
      throw new ForbiddenException('Apenas perfis com acesso total podem cadastrar um novo município.');
    }
    const slug = dto.slug.trim().toLowerCase();
    const exists = await this.prisma.tenant.findUnique({ where: { slug } });
    if (exists) throw new ConflictException('Slug já em uso');

    const row = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug,
          cnpj: dto.cnpj?.trim() || null,
          active: true,
        },
        select: tenantListSelect,
      });
      await tx.schemaVersion.create({
        data: { tenantId: t.id, version: '1.0.0' },
      });
      return t;
    });

    await this.audit.log({
      tenantId: row.id,
      userId: actor.sub,
      action: 'CREATE',
      resource: 'Tenant',
      resourceId: row.id,
      details: { slug: row.slug, name: row.name },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return row;
  }

  async updateById(user: JwtUser, id: string, dto: UpdateTenantDto, req: Request) {
    this.assertTenantScope(user, id);
    const exists = await this.prisma.tenant.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Município não encontrado');

    const row = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.cnpj !== undefined
          ? { cnpj: dto.cnpj.trim() === '' ? null : dto.cnpj.trim() }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      select: tenantListSelect,
    });
    await this.audit.log({
      tenantId: id,
      userId: user.sub,
      action: 'UPDATE',
      resource: 'Tenant',
      resourceId: id,
      details: { fields: Object.keys(dto) },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return row;
  }

  async updateCurrent(user: JwtUser, dto: UpdateTenantDto, req: Request) {
    return this.updateById(user, user.tenantId, dto, req);
  }
}
