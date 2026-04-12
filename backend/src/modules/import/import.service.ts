import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';

export interface ImportMaterialsResult {
  created: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async importMaterialsFromCsv(
    tenantId: string,
    userId: string,
    csvText: string,
    req: Request,
  ): Promise<ImportMaterialsResult> {
    let records: Record<string, string>[];
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
    } catch {
      throw new BadRequestException('CSV inválido');
    }

    const errors: string[] = [];
    let created = 0;
    let skipped = 0;

    const defaultType = await this.prisma.materialType.findFirst({
      where: { tenantId, active: true },
    });
    const defaultUnit = await this.prisma.unitOfMeasure.findFirst({
      where: { tenantId, active: true },
    });
    if (!defaultType || !defaultUnit) {
      throw new BadRequestException('Cadastre ao menos um tipo de material e uma unidade antes de importar');
    }

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const name = row.name ?? row.nome ?? row.material;
      if (!name?.trim()) {
        errors.push(`Linha ${i + 2}: nome obrigatório`);
        skipped++;
        continue;
      }
      const exists = await this.prisma.recyclableMaterial.findFirst({
        where: { tenantId, name: name.trim() },
      });
      if (exists) {
        skipped++;
        continue;
      }
      try {
        await this.prisma.recyclableMaterial.create({
          data: {
            tenantId,
            materialTypeId: defaultType.id,
            unitId: defaultUnit.id,
            name: name.trim(),
            code: row.code ?? row.codigo,
            description: row.description ?? row.descricao,
            active: true,
          },
        });
        created++;
      } catch (e) {
        errors.push(`Linha ${i + 2}: ${(e as Error).message}`);
        skipped++;
      }
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'IMPORT_MATERIALS_CSV',
      resource: 'RecyclableMaterial',
      details: { created, skipped, errorCount: errors.length },
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    return { created, skipped, errors };
  }
}
