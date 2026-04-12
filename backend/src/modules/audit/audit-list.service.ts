import { Injectable } from '@nestjs/common';
import { parsePageLimit, toPaginated } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditListService {
  constructor(private readonly prisma: PrismaService) {}

  async listActions(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit, 20, 500);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }

  async listLogins(tenantId: string, page?: string, limit?: string) {
    const { page: p, limit: l, skip } = parsePageLimit(page, limit, 20, 500);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.loginAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.loginAuditLog.count({ where }),
    ]);
    return toPaginated(items, total, p, l);
  }
}
