import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { LeadPipelineService } from '../candidates/lead-pipeline.service';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

/** Mục 7, docs/13-api-design.md — "Tất cả vai trò" (phạm vi theo quyền xem). */
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly pipelineService: LeadPipelineService,
  ) {}

  @Get()
  getEvents(
    @Query() query: CalendarQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarService.getEvents(query, user);
  }

  /**
   * Xoá lịch hẹn từ module Lịch hẹn (yêu cầu người dùng 2026-10-29) — xoá
   * mềm. Đặt ở controller này để ModulePermissionGuard yêu cầu quyền Sửa
   * module "Lịch hẹn"; quyền theo phạm vi lead nằm trong LeadPipelineService.
   */
  @Delete('interview/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInterview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.deleteInterview(id, user);
  }

  @Delete('callback/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCallback(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.deleteCallback(id, user);
  }
}
