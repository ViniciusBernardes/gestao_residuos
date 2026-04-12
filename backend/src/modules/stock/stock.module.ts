import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController],
  providers: [StockService, AuditService],
  exports: [StockService],
})
export class StockModule {}
