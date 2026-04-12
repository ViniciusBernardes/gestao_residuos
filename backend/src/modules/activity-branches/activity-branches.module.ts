import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityBranchesController } from './activity-branches.controller';
import { ActivityBranchesService } from './activity-branches.service';

@Module({
  imports: [PrismaModule],
  controllers: [ActivityBranchesController],
  providers: [ActivityBranchesService, AuditService],
  exports: [ActivityBranchesService],
})
export class ActivityBranchesModule {}
