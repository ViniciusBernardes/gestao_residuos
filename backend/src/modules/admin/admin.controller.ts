import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RouteRole } from '../../common/constants/route-role.enum';
import { Request } from 'express';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('parameters')
  @Roles(RouteRole.ADMIN)
  parameters(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getParameters(user.tenantId, page, limit);
  }

  @Post('parameters')
  @Roles(RouteRole.ADMIN)
  setParameter(
    @CurrentUser() user: JwtUser,
    @Body() body: { key: string; value: Record<string, unknown> },
    @Req() req: Request,
  ) {
    return this.admin.setParameter(user.tenantId, body.key, body.value ?? {}, user.sub, req);
  }

  @Get('parameters/:id')
  @Roles(RouteRole.ADMIN)
  parameterOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.admin.getParameter(user.tenantId, id);
  }

  @Delete('parameters/:id')
  @Roles(RouteRole.ADMIN)
  deleteParameter(@CurrentUser() user: JwtUser, @Param('id') id: string, @Req() req: Request) {
    return this.admin.deleteParameter(user.tenantId, id, user.sub, req);
  }

  @Get('custom-reports')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  customReports(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listCustomReports(user.tenantId, page, limit);
  }

  @Post('custom-reports')
  @Roles(RouteRole.ADMIN)
  createCustomReport(
    @CurrentUser() user: JwtUser,
    @Body() body: { name: string; description?: string; definition: Record<string, unknown> },
    @Req() req: Request,
  ) {
    return this.admin.createCustomReport(user.tenantId, body, user.sub, req);
  }

  @Get('custom-reports/:id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  customReportOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.admin.getCustomReport(user.tenantId, id);
  }

  @Patch('custom-reports/:id')
  @Roles(RouteRole.ADMIN)
  updateCustomReport(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; definition?: Record<string, unknown>; active?: boolean },
    @Req() req: Request,
  ) {
    return this.admin.updateCustomReport(user.tenantId, id, body, user.sub, req);
  }

  @Delete('custom-reports/:id')
  @Roles(RouteRole.ADMIN)
  deleteCustomReport(@CurrentUser() user: JwtUser, @Param('id') id: string, @Req() req: Request) {
    return this.admin.deleteCustomReport(user.tenantId, id, user.sub, req);
  }

  @Get('schema-version')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  schemaVersion(@CurrentUser() user: JwtUser) {
    return this.admin.getSchemaVersion(user.tenantId);
  }

  @Get('system-logs')
  @Roles(RouteRole.ADMIN)
  systemLogs(@Query('level') level?: string, @Query('take') take?: string) {
    return this.admin.systemLogs(level, take ? parseInt(take, 10) : 100);
  }
}
