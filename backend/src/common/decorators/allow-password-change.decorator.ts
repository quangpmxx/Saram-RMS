import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_KEY = 'allowWhilePasswordChangeRequired';

/**
 * Cho phép gọi API này khi tài khoản đang bị bắt đổi mật khẩu (xem
 * PasswordChangeGuard) — chỉ dùng cho xem thông tin của mình, đổi mật khẩu,
 * đăng xuất.
 */
export const AllowPasswordChange = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
