import { BadRequestException, Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RouteRole } from '../../common/constants/route-role.enum';
import { Response } from 'express';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('recycled-sales-monthly-chart')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  recycledSalesMonthlyHistory(
    @CurrentUser() user: JwtUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('depositId') depositId?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    return this.reports.recycledSalesMonthlyHistory(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      depositId: depositId?.trim() || undefined,
    });
  }

  @Get('sales-by-material-class-chart')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  salesByMaterialClassChart(
    @CurrentUser() user: JwtUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('materialId') materialId?: string,
    @Query('depositId') depositId?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    return this.reports.salesByMaterialClassChart(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      materialId: materialId?.trim() || undefined,
      depositId: depositId?.trim() || undefined,
    });
  }

  @Get('dashboard')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.reports.dashboard(user.tenantId);
  }

  @Get('analytical-general')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  analyticalGeneral(
    @CurrentUser() user: JwtUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('depositId') depositId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    return this.reports.analyticalGeneral(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId?.trim() || undefined,
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
  }

  @Get('analytical-by-deposit')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  analyticalByDeposit(
    @CurrentUser() user: JwtUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('depositId') depositId: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    if (!depositId?.trim()) {
      throw new BadRequestException('Selecione o depósito de armazenagem');
    }
    return this.reports.analyticalByDeposit(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId.trim(),
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
  }

  @Get('export/analytical-general.xlsx')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="analitico-geral.xlsx"')
  async exportAnalyticalGeneralExcel(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: false }) res: Response,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('depositId') depositId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    const buf = await this.reports.exportAnalyticalGeneralExcel(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId?.trim() || undefined,
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
    res.send(buf);
  }

  @Get('export/analytical-general.pdf')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="analitico-geral.pdf"')
  async exportAnalyticalGeneralPdf(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: false }) res: Response,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('depositId') depositId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    const buf = await this.reports.exportAnalyticalGeneralPdf(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId?.trim() || undefined,
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
    res.send(buf);
  }

  @Get('export/analytical-by-deposit.xlsx')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="analitico-por-deposito.xlsx"')
  async exportAnalyticalByDepositExcel(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: false }) res: Response,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('depositId') depositId: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    if (!depositId?.trim()) {
      throw new BadRequestException('Selecione o depósito de armazenagem');
    }
    const buf = await this.reports.exportAnalyticalByDepositExcel(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId.trim(),
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
    res.send(buf);
  }

  @Get('export/analytical-by-deposit.pdf')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="analitico-por-deposito.pdf"')
  async exportAnalyticalByDepositPdf(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: false }) res: Response,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('depositId') depositId: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    if (!depositId?.trim()) {
      throw new BadRequestException('Selecione o depósito de armazenagem');
    }
    const buf = await this.reports.exportAnalyticalByDepositPdf(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId.trim(),
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
    res.send(buf);
  }

  @Get('stock-general')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  stockGeneral(
    @CurrentUser() user: JwtUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('depositId') depositId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    return this.reports.stockGeneral(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId?.trim() || undefined,
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
  }

  @Get('export/stock-general.xlsx')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="estoque-geral.xlsx"')
  async exportStockGeneralExcel(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: false }) res: Response,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('depositId') depositId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    const buf = await this.reports.exportStockGeneralExcel(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId?.trim() || undefined,
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
    res.send(buf);
  }

  @Get('export/stock-general.pdf')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="estoque-geral.pdf"')
  async exportStockGeneralPdf(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: false }) res: Response,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('materialTypeId') materialTypeId?: string,
    @Query('depositId') depositId?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('Informe período inicial e final');
    }
    const buf = await this.reports.exportStockGeneralPdf(user.tenantId, {
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      materialTypeId: materialTypeId?.trim() || undefined,
      depositId: depositId?.trim() || undefined,
      sortBy: sortBy === 'description' ? 'description' : 'code',
    });
    res.send(buf);
  }

  @Get('export/movements.xlsx')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="movimentacoes.xlsx"')
  async exportMovements(@CurrentUser() user: JwtUser, @Res({ passthrough: false }) res: Response) {
    const buf = await this.reports.exportMovementsExcel(user.tenantId);
    res.send(buf);
  }

  @Get('export/stock.pdf')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="estoque.pdf"')
  async exportStock(@CurrentUser() user: JwtUser, @Res({ passthrough: false }) res: Response) {
    const buf = await this.reports.exportStockPdf(user.tenantId);
    res.send(buf);
  }
}
