import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AnonymousFeedbackService } from './anonymous-feedback.service';
import { CreateAnonymousFeedbackDto } from './dto/create-anonymous-feedback.dto';
import { ListAnonymousFeedbackQueryDto } from './dto/list-anonymous-feedback-query.dto';

/**
 * Đơn phản ánh ẩn danh (2026-10-28). KHÔNG đăng ký vào module-registry.ts:
 * MỌI nhân viên được gửi (kể cả vai trò không vào được trang Chấm công) —
 * gate theo module sẽ chặn nhầm. Quyền theo vai trò kiểm tra trong service.
 */
@Controller('anonymous-feedback')
export class AnonymousFeedbackController {
  constructor(private readonly service: AnonymousFeedbackService) {}

  @Post()
  create(
    @Body() dto: CreateAnonymousFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  list(
    @Query() query: ListAnonymousFeedbackQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.list(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }
}
