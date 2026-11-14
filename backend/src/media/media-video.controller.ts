import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { MediaVideoService } from './media-video.service';
import {
  MediaChannelDto,
  MediaContentGroupDto,
  MediaVideoDto,
} from './dto/media-video.dto';

/** Sổ video (2026-11-14) + danh mục nhóm nội dung / kênh đăng. Module quyền "media". */
@Controller('media')
export class MediaVideoController {
  constructor(private readonly service: MediaVideoService) {}

  @Get('video-catalog')
  catalog() {
    return this.service.catalog();
  }

  @Post('content-groups')
  createGroup(
    @Body() dto: MediaContentGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveGroup(null, dto, user);
  }

  @Put('content-groups/:id')
  updateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaContentGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveGroup(id, dto, user);
  }

  @Delete('content-groups/:id')
  removeGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeGroup(id, user);
  }

  @Post('channels')
  createChannel(
    @Body() dto: MediaChannelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveChannel(null, dto, user);
  }

  @Put('channels/:id')
  updateChannel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaChannelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveChannel(id, dto, user);
  }

  @Delete('channels/:id')
  removeChannel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeChannel(id, user);
  }

  @Get('videos')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: string,
    @Query('person_id') personId?: string,
    @Query('group_id') groupId?: string,
    @Query('open') open?: string,
  ) {
    return this.service.list(user, {
      month,
      person_id: personId,
      group_id: groupId,
      open,
    });
  }

  @Get('videos/stats')
  stats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.stats(user, from, to);
  }

  @Post('videos')
  create(@Body() dto: MediaVideoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch('videos/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaVideoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete('videos/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user);
  }
}
