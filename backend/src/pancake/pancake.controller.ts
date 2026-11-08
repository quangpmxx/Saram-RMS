import { RequireCap } from '../common/decorators/require-cap.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { PancakeService } from './pancake.service';
import {
  ConnectPancakeDto,
  PancakeMktSourceDto,
  PancakeOwnerDto,
  PancakePagesQueryDto,
  PancakeSelectedPostsDto,
  PancakeUpNoteDto,
  POST_ID_RE,
  SaveAutoUpDto,
} from './pancake.dto';

/**
 * Page Pancake (thuộc module Marketing Hub). Xem: Admin/Quản lý/MKT. Liên kết/gỡ: Admin hoặc
 * MKT (MKT chỉ page của mình). Đổi người phụ trách / Nguồn MKT: Admin.
 */
@Controller('pancake')
export class PancakeController {
  constructor(private readonly service: PancakeService) {}

  @Get('pages')
  listPages(@Query() q: PancakePagesQueryDto) {
    return this.service.listPages(q.from, q.to);
  }

  @Post('pages/connect')
  @HttpCode(200)
  @RequireCap('mkt.link_own')
  connect(
    @Body() dto: ConnectPancakeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.connect(dto.access_token, dto.name, user);
  }

  @Patch('pages/:id/owner')
  @RequireCap('mkt.assign_owner')
  changeOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PancakeOwnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeOwner(id, dto.owner_id, user);
  }

  @Patch('pages/:id/mkt-source')
  @RequireCap('mkt.config')
  setMktSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PancakeMktSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setMktSource(id, dto.mkt_source_id ?? null, user);
  }

  @Get('posts')
  listPosts(@Query() q: PancakePagesQueryDto) {
    return this.service.listPosts(q.from, q.to);
  }

  /**
   * Chọn bài + ghi chú khi up số theo bài: ai có quyền "Chỉnh sửa" Marketing Hub (guard phân
   * quyền module chặn "Chỉ xem").
   */
  @Put('posts/selected')
  setSelectedPosts(
    @Body() dto: PancakeSelectedPostsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setSelectedPosts(dto.post_ids, user);
  }

  @Patch('posts/:postId/up-note')
  setPostNote(
    @Param('postId') postId: string,
    @Body() dto: PancakeUpNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!POST_ID_RE.test(postId))
      throw new BadRequestException('Mã bài không hợp lệ');
    return this.service.setPostNote(postId, dto.up_note, user);
  }

  @Delete('pages/:id')
  @RequireCap('mkt.link_own')
  disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.disconnect(id, user);
  }
}

/** Cài đặt Up tự động (thuộc module Data lao động): Admin/MKT. */
@Controller('pancake')
@RequireCap('lead.pancake_auto_up')
export class PancakeAutoUpController {
  constructor(private readonly service: PancakeService) {}

  @Get('auto-up')
  getAutoUp() {
    return this.service.getAutoUp();
  }

  @Put('auto-up')
  saveAutoUp(
    @Body() dto: SaveAutoUpDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveAutoUp(dto.is_active, dto.teams, user);
  }
}
