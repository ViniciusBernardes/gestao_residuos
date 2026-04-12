import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { ExitsController } from './exits.controller';
import { ExitsService } from './exits.service';

@Module({
  controllers: [ExitsController],
  providers: [ExitsService, AuditService],
})
export class ExitsModule {}
