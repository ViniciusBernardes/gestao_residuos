import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { PermissionProfilesController } from './permission-profiles.controller';
import { PermissionProfilesService } from './permission-profiles.service';

@Module({
  controllers: [PermissionProfilesController],
  providers: [PermissionProfilesService, AuditService],
})
export class PermissionProfilesModule {}
