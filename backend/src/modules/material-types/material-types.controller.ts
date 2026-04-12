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
import { CreateMaterialTypeDto } from './dto/create-material-type.dto';
import { UpdateMaterialTypeDto } from './dto/update-material-type.dto';
import { MaterialTypesService } from './material-types.service';

@ApiTags('material-types')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('material-types')
export class MaterialTypesController {
  constructor(private readonly service: MaterialTypesService) {}

  @Get()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  list(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(user.tenantId, page, limit);
  }

  @Get(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getOne(user.tenantId, id);
  }

  @Post()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateMaterialTypeDto, @Req() req: Request) {
    return this.service.create(user.tenantId, dto, user.sub, req);
  }

  @Patch(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialTypeDto,
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
