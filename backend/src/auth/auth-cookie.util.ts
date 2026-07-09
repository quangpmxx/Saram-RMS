import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Không đặt `domain` tường minh — cookie sẽ là host-only ("localhost"),
 * và vì cookie bỏ qua port khi khớp request, frontend Next.js (cổng khác,
 * cùng host "localhost") vẫn đọc/gửi được cookie này ở môi trường dev.
 */
export function buildCookieOptions(
  configService: ConfigService,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: configService.get<string>('NODE_ENV') === 'production',
    path: '/',
  };
}
