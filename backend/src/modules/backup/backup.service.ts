import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const BACKUP_FORMAT_VERSION = 1;

function dec(v: Prisma.Decimal | null | undefined): string | null {
  if (v == null) return null;
  return v.toString();
}

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  async buildExport(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        cnpj: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const [
      permissionProfiles,
      users,
      materialTypes,
      unitsOfMeasure,
      recyclableMaterials,
      activityBranches,
      establishments,
      stockBalances,
      stockMovements,
      stockExits,
    ] = await Promise.all([
      this.prisma.permissionProfile.findMany({ where: { tenantId } }),
      this.prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          email: true,
          name: true,
          active: true,
          lastLoginAt: true,
          permissionProfileId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.materialType.findMany({ where: { tenantId } }),
      this.prisma.unitOfMeasure.findMany({ where: { tenantId } }),
      this.prisma.recyclableMaterial.findMany({ where: { tenantId } }),
      this.prisma.activityBranch.findMany({ where: { tenantId } }),
      this.prisma.establishment.findMany({ where: { tenantId } }),
      this.prisma.stockBalance.findMany({ where: { tenantId } }),
      this.prisma.stockMovement.findMany({ where: { tenantId } }),
      this.prisma.stockExit.findMany({ where: { tenantId } }),
    ]);

    const exitIds = stockExits.map((e) => e.id);
    const stockExitItems =
      exitIds.length === 0
        ? []
        : await this.prisma.stockExitItem.findMany({
            where: { stockExitId: { in: exitIds } },
          });

    return {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      meta: {
        description:
          'Backup do município (tenant): materiais, estoque (saldos e movimentos), saídas e usuários. Inclui ramos, estabelecimentos, tipos e unidades necessários à integridade. Campo passwordHash dos usuários não é exportado.',
        tenantId,
      },
      tenant,
      usuarios: {
        permissionProfiles,
        users,
      },
      materiais: {
        materialTypes,
        unitsOfMeasure,
        recyclableMaterials,
      },
      cadastrosOperacionais: {
        activityBranches,
        establishments,
      },
      estoque: {
        stockBalances: stockBalances.map((b) => ({
          ...b,
          quantity: dec(b.quantity)!,
        })),
        stockMovements: stockMovements.map((m) => ({
          ...m,
          quantity: dec(m.quantity)!,
        })),
      },
      saidas: {
        stockExits: stockExits.map((x) => ({
          ...x,
          totalValue: dec(x.totalValue),
        })),
        stockExitItems: stockExitItems.map((it) => ({
          ...it,
          quantity: dec(it.quantity)!,
          unitPrice: dec(it.unitPrice),
          lineTotal: dec(it.lineTotal),
          depositBalanceBeforeExit: dec(it.depositBalanceBeforeExit),
        })),
      },
    };
  }
}
