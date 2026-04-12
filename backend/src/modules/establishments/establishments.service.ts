import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstablishmentRole, Prisma } from '@prisma/client';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { ActivityBranchesService } from '../activity-branches/activity-branches.service';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';

function onlyDigits(s: string | undefined, len: number): string | undefined {
  if (s == null || s === '') return undefined;
  const d = s.replace(/\D/g, '');
  if (d.length !== len) return undefined;
  return d;
}

const establishmentInclude = {
  activityBranch: { select: { id: true, name: true, role: true } },
} as const;

@Injectable()
export class EstablishmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branches: ActivityBranchesService,
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
      this.prisma.establishment.findMany({
        where,
        include: establishmentInclude,
        orderBy: [{ tradeName: 'asc' }],
        skip,
        take: l,
      }),
      this.prisma.establishment.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async getOne(tenantId: string, id: string) {
    const row = await this.prisma.establishment.findFirst({
      where: { id, tenantId },
      include: establishmentInclude,
    });
    if (!row) throw new NotFoundException('Estabelecimento não encontrado');
    return row;
  }

  private async assertBranchRole(tenantId: string, branchId: string, role: EstablishmentRole) {
    const b = await this.prisma.activityBranch.findFirst({
      where: { id: branchId, tenantId, active: true },
    });
    if (!b) throw new NotFoundException('Ramo de atividade não encontrado');
    if (b.role !== role) {
      throw new BadRequestException('O ramo de atividade não corresponde ao tipo do estabelecimento');
    }
    return b;
  }

  async create(tenantId: string, dto: CreateEstablishmentDto, userId: string, req: Request) {
    await this.branches.ensureDefaults(tenantId);
    await this.assertBranchRole(tenantId, dto.activityBranchId, dto.role);
    const cnpjRaw = dto.cnpj?.trim();
    if (!cnpjRaw) throw new BadRequestException('CNPJ é obrigatório');
    const cnpj = onlyDigits(cnpjRaw, 14);
    if (!cnpj) throw new BadRequestException('CNPJ inválido (14 dígitos)');

    const legalRepCpf = onlyDigits(dto.legalRepCpf, 11);

    try {
      const row = await this.prisma.establishment.create({
        data: {
          tenantId,
          activityBranchId: dto.activityBranchId,
          role: dto.role,
          legalName: dto.legalName,
          tradeName: dto.tradeName,
          cnpj,
          stateReg: dto.stateReg ?? undefined,
          municipalReg: dto.municipalReg ?? undefined,
          cep: dto.cep ? dto.cep.replace(/\D/g, '') : undefined,
          street: dto.street,
          number: dto.number,
          complement: dto.complement,
          district: dto.district,
          cityName: dto.cityName,
          ufSigla: dto.ufSigla?.toUpperCase(),
          ibgeCityCode: dto.ibgeCityCode ?? undefined,
          receitaPayload: dto.receitaPayload
            ? (dto.receitaPayload as Prisma.InputJsonValue)
            : undefined,
          legalRepFullName: dto.legalRepFullName,
          legalRepCpf,
          legalRepEmail: dto.legalRepEmail,
          legalRepPhone: dto.legalRepPhone?.replace(/\D/g, '') ?? undefined,
          code: dto.code,
          legacyAddress: dto.legacyAddress,
        },
        include: establishmentInclude,
      });
      await this.audit.log({
        tenantId,
        userId,
        action: 'CREATE',
        resource: 'Establishment',
        resourceId: row.id,
        details: { tradeName: dto.tradeName, role: dto.role },
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      });
      return row;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Registro duplicado (verifique CNPJ ou dados únicos)');
      }
      throw e;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateEstablishmentDto, userId: string, req: Request) {
    await this.getOne(tenantId, id);
    if (dto.activityBranchId && dto.role) {
      await this.assertBranchRole(tenantId, dto.activityBranchId, dto.role);
    } else if (dto.activityBranchId || dto.role) {
      const cur = await this.prisma.establishment.findFirst({ where: { id, tenantId } });
      if (!cur) throw new NotFoundException();
      const branchId = dto.activityBranchId ?? cur.activityBranchId;
      const role = dto.role ?? cur.role;
      await this.assertBranchRole(tenantId, branchId, role);
    }

    const cnpj = dto.cnpj !== undefined ? onlyDigits(dto.cnpj, 14) : undefined;
    if (dto.cnpj !== undefined && !cnpj) throw new BadRequestException('CNPJ inválido');

    const legalRepCpf =
      dto.legalRepCpf !== undefined ? onlyDigits(dto.legalRepCpf, 11) : undefined;
    if (dto.legalRepCpf !== undefined && dto.legalRepCpf.replace(/\D/g, '').length > 0 && !legalRepCpf) {
      throw new BadRequestException('CPF do responsável inválido');
    }

    const data: Prisma.EstablishmentUpdateInput = {
      ...(dto.activityBranchId !== undefined
        ? { activityBranch: { connect: { id: dto.activityBranchId } } }
        : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.legalName !== undefined ? { legalName: dto.legalName } : {}),
      ...(dto.tradeName !== undefined ? { tradeName: dto.tradeName } : {}),
      ...(cnpj !== undefined ? { cnpj } : {}),
      ...(dto.stateReg !== undefined ? { stateReg: dto.stateReg } : {}),
      ...(dto.municipalReg !== undefined ? { municipalReg: dto.municipalReg } : {}),
      ...(dto.cep !== undefined ? { cep: dto.cep.replace(/\D/g, '') } : {}),
      ...(dto.street !== undefined ? { street: dto.street } : {}),
      ...(dto.number !== undefined ? { number: dto.number } : {}),
      ...(dto.complement !== undefined ? { complement: dto.complement } : {}),
      ...(dto.district !== undefined ? { district: dto.district } : {}),
      ...(dto.cityName !== undefined ? { cityName: dto.cityName } : {}),
      ...(dto.ufSigla !== undefined ? { ufSigla: dto.ufSigla.toUpperCase() } : {}),
      ...(dto.ibgeCityCode !== undefined ? { ibgeCityCode: dto.ibgeCityCode } : {}),
      ...(dto.receitaPayload !== undefined
        ? { receitaPayload: dto.receitaPayload as Prisma.InputJsonValue }
        : {}),
      ...(dto.legalRepFullName !== undefined ? { legalRepFullName: dto.legalRepFullName } : {}),
      ...(legalRepCpf !== undefined ? { legalRepCpf } : {}),
      ...(dto.legalRepEmail !== undefined ? { legalRepEmail: dto.legalRepEmail } : {}),
      ...(dto.legalRepPhone !== undefined
        ? { legalRepPhone: dto.legalRepPhone.replace(/\D/g, '') }
        : {}),
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.legacyAddress !== undefined ? { legacyAddress: dto.legacyAddress } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };

    const row = await this.prisma.establishment.update({
      where: { id },
      data,
      include: establishmentInclude,
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      resource: 'Establishment',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return row;
  }

  async setLegalDocumentPath(tenantId: string, id: string, filename: string) {
    await this.getOne(tenantId, id);
    return this.prisma.establishment.update({
      where: { id },
      data: { legalRepDocPath: filename },
      include: establishmentInclude,
    });
  }

  async remove(tenantId: string, id: string, userId: string, req: Request) {
    await this.getOne(tenantId, id);
    await this.prisma.establishment.update({ where: { id }, data: { active: false } });
    await this.audit.log({
      tenantId,
      userId,
      action: 'SOFT_DELETE',
      resource: 'Establishment',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true };
  }
}
