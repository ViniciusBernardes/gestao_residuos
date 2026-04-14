import { Controller, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RouteRole } from '../../common/constants/route-role.enum';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../common/services/audit.service';
import { BackupService } from './backup.service';

@ApiTags('backup')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('backup')
export class BackupController {
  constructor(
    private readonly backup: BackupService,
    private readonly audit: AuditService,
  ) {}

  @Post('export')
  @ApiOperation({ summary: 'Exportar backup JSON (materiais, estoque, saídas, usuários e cadastros ligados)' })
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  async export(@CurrentUser() user: JwtUser, @Req() req: Request): Promise<StreamableFile> {
    const data = await this.backup.buildExport(user.tenantId);
    const slug = String(data.tenant.slug ?? 'tenant').replace(/[^a-zA-Z0-9-_]/g, '_');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `gestao-residuos-backup-${slug}-${stamp}.json`;

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'BACKUP_EXPORT',
      resource: 'backup',
      details: { filename },
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 512),
    });

    const buf = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    return new StreamableFile(buf, {
      type: 'application/json; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
