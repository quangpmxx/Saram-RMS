import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Bắt đổi mật khẩu (rà soát 2026-10-30): tài khoản đang dùng mật khẩu mặc
 * định (mới tạo / vừa được đặt lại / đăng nhập bằng mật khẩu mặc định) bị
 * chặn mọi API — trừ các route gắn @AllowPasswordChange() — tới khi đổi
 * mật khẩu. Chạy sau JwtAuthGuard (route công khai không có user → bỏ qua).
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>().user;
    if (!user?.mustChangePassword) return true;
    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;
    throw new ForbiddenException({
      error_code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống',
    });
  }
}
