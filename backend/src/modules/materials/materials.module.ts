import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  controllers: [MaterialsController],
  providers: [MaterialsService, AuditService],
})
export class MaterialsModule {}
