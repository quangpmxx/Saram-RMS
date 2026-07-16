import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveRequestDecisionDto } from './dto/leave-request-decision.dto';
import { ListLeaveRequestQueryDto } from './dto/list-leave-request-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới "Tạo đơn"): Đơn xin nghỉ phép, quy trình duyệt 2
 * cấp Leader -> Admin. Không gắn @Roles() ở tầng controller — quyền phụ
 * thuộc dữ liệu (chủ đơn/nhóm), kiểm tra chi tiết nằm trong LeaveRequestsService.
 */
@Controller('leave-request')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.create(dto, user);
  }

  @Get()
  list(
    @Query() query: ListLeaveRequestQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.list(query, user);
  }

  @Get(':id')
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.getById(id, user);
  }

  @Post(':id/leader-decision')
  @HttpCode(HttpStatus.OK)
  leaderDecide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveRequestDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.leaderDecide(id, dto, user);
  }

  @Post(':id/admin-decision')
  @HttpCode(HttpStatus.OK)
  adminDecide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveRequestDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.adminDecide(id, dto, user);
  }
}
