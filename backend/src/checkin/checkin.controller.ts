import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CheckinService } from './checkin.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { CheckinPreviewQueryDto } from './dto/checkin-preview-query.dto';
import { UpdateCompanyLocationDto } from './dto/update-company-location.dto';
import { ListCheckinQueryDto } from './dto/list-checkin-query.dto';
import { ResetCheckinDto } from './dto/reset-checkin.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới, yêu cầu trực tiếp người dùng): "Check in GPS"
 * (Phase 3/4). Không gắn @Roles() ở tầng controller — CheckinService tự
 * kiểm tra vai trò (Mục 1: chỉ Nhân viên/Sale/MKT/Leader Check in; Mục 7:
 * chỉ Admin xem/sửa cấu hình vị trí công ty; Mục 10: phạm vi xem khác nhau
 * theo vai trò), giống cách AttendanceModule đã làm.
 */
@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Get('status')
  getStatus(@Req() req: Request, @CurrentUser() user: AuthenticatedUser) {
    return this.checkinService.getStatus(
      user,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /** Mục 2/3, yêu cầu người dùng: xem trước khoảng cách/trạng thái trước khi xác nhận — không ghi DB. */
  @Get('preview')
  preview(
    @Query() query: CheckinPreviewQueryDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkinService.preview(query, user, req.headers['user-agent']);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  checkin(
    @Body() dto: CreateCheckinDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkinService.checkin(
      dto,
      user,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /** Mục 11, yêu cầu người dùng: "trang quản lý Check in" — lọc theo ngày/nhóm/nhân viên/trạng thái. */
  @Get('records')
  listRecords(
    @Query() query: ListCheckinQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkinService.listRecords(query, user);
  }

  /** Mục 7: "Chỉ Admin được xem và thay đổi cấu hình này." */
  @Get('company-location')
  getCompanyLocation(@CurrentUser() user: AuthenticatedUser) {
    return this.checkinService.getCompanyLocation(user);
  }

  @Put('company-location')
  updateCompanyLocation(
    @Body() dto: UpdateCompanyLocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkinService.updateCompanyLocation(dto, user);
  }

  /** Mục 8, yêu cầu người dùng: "Admin được Reset bản ghi Check in... Bắt buộc nhập lý do." */
  @Post(':id/reset')
  @HttpCode(HttpStatus.OK)
  reset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetCheckinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkinService.reset(id, dto.reason, user);
  }
}
