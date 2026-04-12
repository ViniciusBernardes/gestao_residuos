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
import { CreatePermissionProfileDto } from './dto/create-permission-profile.dto';
import { UpdatePermissionProfileDto } from './dto/update-permission-profile.dto';
import { PermissionProfilesService } from './permission-profiles.service';

@ApiTags('permission-profiles')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('permission-profiles')
export class PermissionProfilesController {
  constructor(private readonly service: PermissionProfilesService) {}

  @Get('definitions')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  definitions() {
    return this.service.definitions();
  }

  @Get()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  list(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(user.tenantId, page, limit);
  }

  @Get(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getOne(user.tenantId, id);
  }

  @Post()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePermissionProfileDto,
    @Req() req: Request,
  ) {
    return this.service.create(user.tenantId, dto, user.sub, req);
  }

  @Patch(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdatePermissionProfileDto,
    @Req() req: Request,
  ) {
    return this.service.update(user.tenantId, id, dto, user.sub, req);
  }

  @Delete(':id')
  @Roles(RouteRole.ADMIN)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string, @Req() req: Request) {
    return this.service.remove(user.tenantId, id, user.sub, req);
  }
}
