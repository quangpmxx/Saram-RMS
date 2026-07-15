import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { BulkSaveAttendanceDto } from './dto/bulk-save-attendance.dto';
import { UpdateEmployeePositionDto } from './dto/update-employee-position.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới): Chấm công thủ công. Không gắn @Roles() vì quyền
 * phụ thuộc dữ liệu (nhóm mình/toàn bộ/chỉ bản thân) — toàn bộ kiểm tra chi
 * tiết nằm trong AttendanceService, giống hệt cách DailyReportsController/
 * DashboardController đã làm.
 */
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  getGrid(
    @Query() query: ListAttendanceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getGrid(query, user);
  }

  /** Dự án phụ — nâng cấp toàn diện (2026-07-15, yêu cầu trực tiếp người dùng): "tải xuống Excel cho bảng chấm công". */
  @Get('export')
  async exportXlsx(
    @Query() query: ListAttendanceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.attendanceService.exportXlsx(
      query,
      user,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('bulk')
  bulkSave(
    @Body() dto: BulkSaveAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.bulkSave(dto, user);
  }

  /** Dự án phụ — nâng cấp toàn diện (2026-07-15, yêu cầu trực tiếp người dùng): "sửa tay tên các vị trí". */
  @Put('employee/:accountId/position')
  updateEmployeePosition(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateEmployeePositionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.updateEmployeePosition(
      accountId,
      dto.position,
      user,
    );
  }
}
