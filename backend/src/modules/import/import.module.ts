import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  controllers: [ImportController],
  providers: [ImportService, AuditService],
})
export class ImportModule {}
