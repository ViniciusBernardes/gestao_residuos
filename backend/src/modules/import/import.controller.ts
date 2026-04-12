import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { RouteRole } from '../../common/constants/route-role.enum';
import { Request } from 'express';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ImportService } from './import.service';

class ImportCsvBody {
  csv!: string;
}

@ApiTags('import')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('materials/csv')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  @ApiBody({ schema: { properties: { csv: { type: 'string', description: 'Conteúdo CSV com colunas: name,nome,code,codigo' } } } })
  async importMaterials(
    @CurrentUser() user: JwtUser,
    @Body() body: ImportCsvBody,
    @Req() req: Request,
  ) {
    if (!body?.csv || typeof body.csv !== 'string') {
      return { error: 'Envie { "csv": "..." } com o texto do arquivo' };
    }
    return this.importService.importMaterialsFromCsv(user.tenantId, user.sub, body.csv, req);
  }
}
