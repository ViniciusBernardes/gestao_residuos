import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { MaterialTypesController } from './material-types.controller';
import { MaterialTypesService } from './material-types.service';

@Module({
  controllers: [MaterialTypesController],
  providers: [MaterialTypesService, AuditService],
})
export class MaterialTypesModule {}
