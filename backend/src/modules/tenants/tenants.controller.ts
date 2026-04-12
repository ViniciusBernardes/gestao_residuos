import {
  Body,
  Controller,
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
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  list(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenants.list(user, page, limit);
  }

  @Get('current')
  async current(@CurrentUser() user: JwtUser) {
    return this.tenants.getCurrent(user.tenantId);
  }

  @Post()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTenantDto, @Req() req: Request) {
    return this.tenants.create(user, dto, req);
  }

  @Get(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.tenants.getById(user, id);
  }

  @Patch('current')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  async updateCurrent(@CurrentUser() user: JwtUser, @Body() dto: UpdateTenantDto, @Req() req: Request) {
    return this.tenants.updateCurrent(user, dto, req);
  }

  @Patch(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  updateOne(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @Req() req: Request,
  ) {
    return this.tenants.updateById(user, id, dto, req);
  }
}
