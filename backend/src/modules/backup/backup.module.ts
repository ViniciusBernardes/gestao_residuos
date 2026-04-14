import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  controllers: [BackupController],
  providers: [BackupService, AuditService],
})
export class BackupModule {}
