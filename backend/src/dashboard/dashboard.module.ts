import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ReportController } from './report.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController, ReportController],
  providers: [DashboardService],
})
export class DashboardModule {}
