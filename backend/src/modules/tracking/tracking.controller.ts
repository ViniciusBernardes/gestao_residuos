import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RouteRole } from '../../common/constants/route-role.enum';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TrackingService } from './tracking.service';

@ApiTags('tracking')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('materials/:materialId/timeline')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  timeline(@CurrentUser() user: JwtUser, @Param('materialId') materialId: string) {
    return this.tracking.timeline(user.tenantId, materialId);
  }
}
