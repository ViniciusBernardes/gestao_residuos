import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RouteRole } from '../../common/constants/route-role.enum';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditListService } from './audit-list.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditList: AuditListService) {}

  @Get('actions')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  listActions(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditList.listActions(user.tenantId, page, limit);
  }

  @Get('logins')
  @Roles(RouteRole.ADMIN)
  listLogins(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditList.listLogins(user.tenantId, page, limit);
  }
}
