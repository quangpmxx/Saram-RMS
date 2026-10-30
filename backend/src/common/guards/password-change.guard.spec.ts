import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PasswordChangeGuard } from './password-change.guard';

function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('PasswordChangeGuard', () => {
  it('chặn API thường khi tài khoản đang bị bắt đổi mật khẩu', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    expect(() =>
      new PasswordChangeGuard(reflector).canActivate(
        ctx({ id: 'a', role: 'sale', mustChangePassword: true }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('cho qua route gắn @AllowPasswordChange() và tài khoản bình thường', () => {
    const allow = { getAllAndOverride: () => true } as unknown as Reflector;
    const deny = { getAllAndOverride: () => undefined } as unknown as Reflector;
    expect(
      new PasswordChangeGuard(allow).canActivate(
        ctx({ id: 'a', role: 'sale', mustChangePassword: true }),
      ),
    ).toBe(true);
    expect(
      new PasswordChangeGuard(deny).canActivate(
        ctx({ id: 'a', role: 'sale', mustChangePassword: false }),
      ),
    ).toBe(true);
    expect(new PasswordChangeGuard(deny).canActivate(ctx(undefined))).toBe(
      true,
    );
  });
});
