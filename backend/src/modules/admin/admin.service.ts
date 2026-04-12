import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getParameters(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.systemParameter.findMany({
        where,
        orderBy: { key: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.systemParameter.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async getParameter(tenantId: string, id: string) {
    const row = await this.prisma.systemParameter.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Parâmetro não encontrado');
    return row;
  }

  async deleteParameter(tenantId: string, id: string, userId: string, req: Request) {
    const row = await this.prisma.systemParameter.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Parâmetro não encontrado');
    await this.prisma.systemParameter.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      resource: 'SystemParameter',
      resourceId: id,
      details: { key: row.key },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true };
  }

  async setParameter(
    tenantId: string,
    key: string,
    value: object,
    userId: string,
    req: Request,
  ) {
    const row = await this.prisma.systemParameter.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, value: value as object },
      update: { value: value as object, version: { increment: 1 } },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'PARAM_SET',
      resource: 'SystemParameter',
      resourceId: row.id,
      details: { key },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return row;
  }

  async listCustomReports(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.customReport.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: l,
      }),
      this.prisma.customReport.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async getCustomReport(tenantId: string, id: string) {
    const row = await this.prisma.customReport.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Relatório não encontrado');
    return row;
  }

  async updateCustomReport(
    tenantId: string,
    id: string,
    body: { name?: string; description?: string; definition?: object; active?: boolean },
    userId: string,
    req: Request,
  ) {
    const existing = await this.prisma.customReport.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Relatório não encontrado');
    const row = await this.prisma.customReport.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.definition !== undefined ? { definition: body.definition as object } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      resource: 'CustomReport',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return row;
  }

  async deleteCustomReport(tenantId: string, id: string, userId: string, req: Request) {
    const existing = await this.prisma.customReport.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Relatório não encontrado');
    await this.prisma.customReport.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      resource: 'CustomReport',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { ok: true };
  }

  async createCustomReport(
    tenantId: string,
    body: { name: string; description?: string; definition: object },
    userId: string,
    req: Request,
  ) {
    try {
      const row = await this.prisma.customReport.create({
        data: {
          tenantId,
          name: body.name,
          description: body.description,
          definition: body.definition as object,
        },
      });
      await this.audit.log({
        tenantId,
        userId,
        action: 'CREATE',
        resource: 'CustomReport',
        resourceId: row.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      });
      return row;
    } catch {
      throw new ConflictException('Não foi possível criar relatório');
    }
  }

  async getSchemaVersion(tenantId: string) {
    const v = await this.prisma.schemaVersion.findUnique({
      where: { tenantId },
    });
    if (!v) throw new NotFoundException('Versão não registrada');
    return v;
  }

  async systemLogs(level?: string, take = 100) {
    return this.prisma.systemLog.findMany({
      where: level ? { level } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 500),
    });
  }

  async writeSystemLog(level: string, message: string, context?: string, meta?: object) {
    return this.prisma.systemLog.create({
      data: {
        level,
        message,
        context,
        meta: meta as object | undefined,
      },
    });
  }
}
