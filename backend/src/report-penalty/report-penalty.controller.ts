import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ReportPenaltyService } from './report-penalty.service';
import { ListReportPenaltyQueryDto } from './dto/list-report-penalty-query.dto';
import { UpdateViolationStatusDto } from './dto/update-violation-status.dto';
import { UpdateReportDeadlineDto } from './dto/update-report-deadline.dto';
import { RunReportPenaltyScanDto } from './dto/run-report-penalty-scan.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13 — trang con mới, yêu cầu trực tiếp người dùng): "Check phạt"
 * trong module Báo cáo. Không gắn @Roles() ở tầng controller —
 * ReportPenaltyService tự kiểm tra vai trò theo từng hành động (Mục 8),
 * giống cách AttendanceModule/CheckinModule đã làm.
 */
@Controller('report-penalty')
export class ReportPenaltyController {
  constructor(private readonly reportPenaltyService: ReportPenaltyService) {}

  @Get()
  list(
    @Query() query: ListReportPenaltyQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportPenaltyService.listRecords(query, user);
  }

  @Get('deadline')
  getDeadline(@CurrentUser() user: AuthenticatedUser) {
    return this.reportPenaltyService.getDeadline(user);
  }

  /** Mục 5: "Chỉ Admin được thay đổi." */
  @Put('deadline')
  updateDeadline(
    @Body() dto: UpdateReportDeadlineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportPenaltyService.updateDeadline(dto, user);
  }

  /** Mục 8: Admin/Quản lý cập nhật trạng thái + ghi chú/miễn phạt. */
  @Patch(':id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViolationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportPenaltyService.updateStatus(id, dto, user);
  }

  private assertNonProduction(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Endpoint này chỉ dùng được ở môi trường development',
      );
    }
  }

  /**
   * Mục 11, yêu cầu người dùng: "Cho phép Admin/dev chạy job kiểm tra bằng
   * endpoint... chỉ dùng trong development... Có thể truyền thời điểm giả
   * lập vào job" — không cần chờ tới hạn thật để test.
   */
  @Post('run')
  @Roles('admin')
  run(@Body() dto: RunReportPenaltyScanDto) {
    this.assertNonProduction();
    return this.reportPenaltyService.runScan(
      dto.simulated_at ? new Date(dto.simulated_at) : undefined,
    );
  }
}
