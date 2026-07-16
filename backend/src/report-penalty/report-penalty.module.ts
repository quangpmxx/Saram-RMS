import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ReportPenaltyController } from './report-penalty.controller';
import { ReportPenaltyService } from './report-penalty.service';
import { ReportPenaltyScannerService } from './report-penalty-scanner.service';

@Module({
  imports: [AuditLogModule, RealtimeModule],
  controllers: [ReportPenaltyController],
  providers: [ReportPenaltyService, ReportPenaltyScannerService],
  exports: [ReportPenaltyService],
})
export class ReportPenaltyModule {}
