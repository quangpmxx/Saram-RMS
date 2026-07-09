import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AccountRole } from '../../../generated/prisma/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Kiểm tra vai trò sau khi JwtAuthGuard đã xác thực — đúng bảng quyền
 * Mục 8, docs/09-business-specification.md. Route không gắn @Roles() thì
 * mặc định cho phép mọi vai trò đã đăng nhập.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      AccountRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện hành động này',
      );
    }

    return true;
  }
}
