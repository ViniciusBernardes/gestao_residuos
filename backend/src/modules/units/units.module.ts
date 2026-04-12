import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  controllers: [UnitsController],
  providers: [UnitsService, AuditService],
})
export class UnitsModule {}
