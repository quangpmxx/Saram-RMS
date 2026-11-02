import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

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

/** Tùy chọn khi ĐẶT cookie đăng nhập: bền 14 ngày (không mất khi tắt trình duyệt), khớp hạn JWT. Không dùng cho clearCookie. */
export function buildLoginCookieOptions(
  configService: ConfigService,
): CookieOptions {
  return { ...buildCookieOptions(configService), maxAge: SESSION_MAX_AGE_MS };
}
