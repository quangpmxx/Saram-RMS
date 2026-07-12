import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ColumnWidthController } from './column-width.controller';
import { ColumnWidthService } from './column-width.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ColumnWidthController],
  providers: [ColumnWidthService],
})
export class ColumnWidthModule {}
