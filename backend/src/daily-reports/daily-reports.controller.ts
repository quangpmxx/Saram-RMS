import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { DailyReportsService } from './daily-reports.service';
import { ListDailyReportQueryDto } from './dto/list-daily-report-query.dto';
import { UpsertDailyReportDto } from './dto/upsert-daily-report.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới): Báo cáo hằng ngày. Không gắn @Roles() ở
 * controller vì quyền phụ thuộc dữ liệu (nhóm mình/toàn bộ/chỉ bản thân) —
 * toàn bộ kiểm tra chi tiết nằm trong DailyReportsService, giống hệt cách
 * DashboardController đã làm.
 */
@Controller('daily-report')
export class DailyReportsController {
  constructor(private readonly dailyReportsService: DailyReportsService) {}

  @Get()
  list(
    @Query() query: ListDailyReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyReportsService.list(query, user);
  }

  @Get('summary')
  summary(
    @Query() query: ListDailyReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyReportsService.summary(query, user);
  }

  @Post()
  create(
    @Body() dto: UpsertDailyReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyReportsService.create(dto, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertDailyReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyReportsService.update(id, dto, user);
  }
}
