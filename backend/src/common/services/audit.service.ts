import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        details: params.details as object | undefined,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });
  }
}
