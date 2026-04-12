import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityBranchesModule } from '../activity-branches/activity-branches.module';
import { EstablishmentsController } from './establishments.controller';
import { EstablishmentsService } from './establishments.service';

@Module({
  imports: [PrismaModule, ActivityBranchesModule],
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService, AuditService],
  exports: [EstablishmentsService],
})
export class EstablishmentsModule {}
