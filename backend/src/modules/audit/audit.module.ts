import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditListService } from './audit-list.service';

@Module({
  controllers: [AuditController],
  providers: [AuditListService],
})
export class AuditModule {}
