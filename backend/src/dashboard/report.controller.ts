import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { ReportFunnelQueryDto } from './dto/report-funnel-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 8, docs/13-api-design.md — "dùng chung engine với Dashboard" (Mục 8,
 * docs/12). Không gắn @Roles() vì quyền phụ thuộc dữ liệu (nhóm mình/toàn
 * bộ) — toàn bộ kiểm tra chi tiết nằm trong DashboardService.
 */
@Controller('report')
export class ReportController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('funnel')
  getFunnel(
    @Query() query: ReportFunnelQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getFunnel(query, user);
  }

  @Get('by-source')
  getBySource(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getBySource(query, user);
  }
}
