import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RouteRole } from '../../common/constants/route-role.enum';
import { Request } from 'express';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { StockService } from './stock.service';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('overview/materials/:materialId')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  materialBreakdown(@CurrentUser() user: JwtUser, @Param('materialId') materialId: string) {
    return this.stock.materialBreakdown(user.tenantId, materialId);
  }

  @Get('overview/materials')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  materialOverview(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('scope') scope?: string,
  ) {
    return this.stock.materialOverview(user.tenantId, page, limit, q, scope);
  }

  @Get('balances')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  balances(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stock.balances(user.tenantId, page, limit);
  }

  @Get('consolidated')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  consolidated(@CurrentUser() user: JwtUser) {
    return this.stock.consolidated(user.tenantId);
  }

  @Get('movements/:id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  movementOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.stock.getMovement(user.tenantId, id);
  }

  @Get('movements')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  movements(
    @CurrentUser() user: JwtUser,
    @Query('materialId') materialId?: string,
    @Query('depositId') depositId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stock.movements(user.tenantId, {
      materialId,
      depositId,
      page,
      limit,
    });
  }

  @Post('entries')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  entry(@CurrentUser() user: JwtUser, @Body() dto: CreateEntryDto, @Req() req: Request) {
    return this.stock.registerEntry(user.tenantId, user.sub, dto, req);
  }

  @Post('transfers')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  transfer(@CurrentUser() user: JwtUser, @Body() dto: CreateTransferDto, @Req() req: Request) {
    return this.stock.registerTransfer(user.tenantId, user.sub, dto, req);
  }

  @Post('adjustments')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  adjustment(@CurrentUser() user: JwtUser, @Body() dto: CreateAdjustmentDto, @Req() req: Request) {
    return this.stock.registerAdjustment(user.tenantId, user.sub, dto, req);
  }
}
