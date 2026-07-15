import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Mục 8, docs/13-api-design.md. Không gắn @Roles() vì quyền phụ thuộc dữ
 * liệu (nhóm mình/toàn bộ) — toàn bộ kiểm tra chi tiết nằm trong DashboardService.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getSummary(query, user);
  }

  @Get('performance')
  getPerformance(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getPerformance(query, user);
  }

  @Get('by-team')
  getByTeam(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getByTeam(query, user);
  }

  /**
   * Dự án phụ — nâng cấp toàn diện (ngoài phạm vi Design Freeze docs/09-13):
   * CHỈ dùng cho development, để có data demo đánh giá bố cục Dashboard mới
   * (yêu cầu trực tiếp người dùng) — chặn cứng ở production, giống hệt
   * SaleReminderController.seedTestData().
   */
  @Post('seed-demo-data')
  @Roles('admin')
  seedDemoData() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Endpoint này chỉ dùng được ở môi trường development',
      );
    }
    return this.dashboardService.seedDemoData();
  }
}
