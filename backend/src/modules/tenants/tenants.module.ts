import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, AuditService],
})
export class TenantsModule {}
