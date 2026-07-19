import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SalesEntryController } from './sales-entry.controller';
import { SalesEntryService } from './sales-entry.service';
import { SalesEntryExportService } from './sales-entry-export.service';

/** Dự án phụ — nâng cấp toàn diện (2026-07-17): module con "DS Sale" trong "Nhập doanh số". */
@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [SalesEntryController],
  providers: [SalesEntryService, SalesEntryExportService],
})
export class SalesEntryModule {}
