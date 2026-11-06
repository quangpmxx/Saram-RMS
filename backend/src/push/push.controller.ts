import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  PushSubscribeDto,
  PushUnsubscribeDto,
} from './dto/push-subscription.dto';
import { PushService } from './push.service';

/**
 * Thông báo đẩy (2026-11-06) — mọi tài khoản đã đăng nhập tự bật/tắt cho
 * máy mình đang dùng (trang Cài đặt tài khoản). Không gắn @Roles().
 */
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** Khoá công khai VAPID; null = máy chủ chưa bật tính năng. */
  @Get('public-key')
  publicKey(): { public_key: string | null } {
    return { public_key: this.pushService.getPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(204)
  async subscribe(
    @Body() dto: PushSubscribeDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pushService.subscribe(user.id, dto, req.headers['user-agent']);
  }

  @Post('unsubscribe')
  @HttpCode(204)
  async unsubscribe(
    @Body() dto: PushUnsubscribeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pushService.unsubscribe(user.id, dto.endpoint);
  }
}
