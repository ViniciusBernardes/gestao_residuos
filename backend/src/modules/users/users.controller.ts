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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    return this.users.findById(user.tenantId, user.sub);
  }

  @Get()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  async list(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.list(user.tenantId, page, limit);
  }

  @Get(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  async getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.users.findById(user.tenantId, id);
  }

  @Post()
  @Roles(RouteRole.ADMIN)
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateUserDto,
    @Req() req: Request,
  ) {
    return this.users.create(user.tenantId, dto, user.sub, req);
  }

  @Patch(':id')
  @Roles(RouteRole.ADMIN)
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.users.update(user.tenantId, id, dto, user.sub, req);
  }

  @Delete(':id')
  @Roles(RouteRole.ADMIN)
  async remove(@CurrentUser() user: JwtUser, @Param('id') id: string, @Req() req: Request) {
    return this.users.remove(user.tenantId, id, user.sub, req);
  }
}
