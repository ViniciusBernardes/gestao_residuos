import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export async function adjustBalance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  establishmentId: string,
  materialId: string,
  delta: Prisma.Decimal,
): Promise<void> {
  const where = {
    tenantId_establishmentId_materialId: { tenantId, establishmentId, materialId },
  };
  const existing = await tx.stockBalance.findUnique({ where });
  const next = existing ? existing.quantity.add(delta) : delta;
  if (next.lt(0)) {
    throw new BadRequestException('Saldo insuficiente no depósito para o material');
  }
  if (existing) {
    await tx.stockBalance.update({
      where,
      data: { quantity: next },
    });
  } else {
    await tx.stockBalance.create({
      data: { tenantId, establishmentId, materialId, quantity: next },
    });
  }
}
