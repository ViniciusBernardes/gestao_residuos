import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RouteRole } from '../../common/constants/route-role.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IntegrationsService } from './integrations.service';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('cep/:cep')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  cep(@Param('cep') cep: string) {
    return this.integrations.lookupCep(cep);
  }

  /** Preferir query `q` (14 dígitos ou com máscara) — evita problemas de rota com caracteres especiais. */
  @Get('cnpj')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  cnpjQuery(@Query('q') q: string) {
    return this.integrations.lookupCnpj(q ?? '');
  }

  @Get('cnpj/:cnpj')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  cnpj(@Param('cnpj') cnpj: string) {
    return this.integrations.lookupCnpj(cnpj);
  }

  @Get('ibge/ufs')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  ufs() {
    return this.integrations.listUfs();
  }

  @Get('ibge/municipios')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  municipios(@Query('uf') uf: string) {
    return this.integrations.listMunicipios(uf ?? '');
  }

  @Get('ibge/sync/:uf')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  sync(@Param('uf') uf: string) {
    return this.integrations.syncMunicipiosForUf(uf);
  }
}
