import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async timeline(tenantId: string, materialId: string) {
    const material = await this.prisma.recyclableMaterial.findFirst({
      where: { id: materialId, tenantId },
      include: {
        materialType: true,
        unit: true,
      },
    });
    if (!material) throw new NotFoundException('Material não encontrado');

    const movements = await this.prisma.stockMovement.findMany({
      where: { tenantId, materialId },
      include: {
        establishmentFrom: { select: { id: true, tradeName: true } },
        establishmentTo: { select: { id: true, tradeName: true } },
        stockExit: {
          include: {
            establishment: { select: { id: true, tradeName: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'asc' },
    });

    return {
      material,
      events: movements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        occurredAt: m.occurredAt,
        reference: m.reference,
        notes: m.notes,
        depositFrom: m.establishmentFrom
          ? { id: m.establishmentFrom.id, name: m.establishmentFrom.tradeName }
          : null,
        depositTo: m.establishmentTo
          ? { id: m.establishmentTo.id, name: m.establishmentTo.tradeName }
          : null,
        destinationCenter: m.stockExit?.establishment
          ? {
              id: m.stockExit.establishment.id,
              name: m.stockExit.establishment.tradeName,
            }
          : null,
        user: m.user,
      })),
    };
  }
}
