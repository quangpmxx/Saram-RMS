import { Module } from '@nestjs/common';
import { DailyReportsController } from './daily-reports.controller';
import { DailyReportsService } from './daily-reports.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ReportPenaltyModule } from '../report-penalty/report-penalty.module';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, "Check phạt"): import
 * ReportPenaltyModule để DailyReportsService gọi được
 * markSupplementedIfPending() sau khi Sale tạo báo cáo thành công (Mục 4) —
 * KHÔNG đổi cách nhân viên nhập báo cáo (Mục 10), chỉ phản ứng lại sau đó.
 */
@Module({
  imports: [AuditLogModule, ReportPenaltyModule],
  controllers: [DailyReportsController],
  providers: [DailyReportsService],
})
export class DailyReportsModule {}
