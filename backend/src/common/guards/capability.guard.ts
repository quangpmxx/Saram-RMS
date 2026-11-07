import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_CAP_KEY } from '../decorators/require-cap.decorator';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { can } from '../permissions/capability-catalog';

/** Phân quyền chi tiết (2026-11-07): chặn route gắn @RequireCap khi thiếu quyền. */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const code = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_CAP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!code) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (user && can(user, code)) return true;
    throw new ForbiddenException('Bạn không có quyền thực hiện chức năng này');
  }
}
