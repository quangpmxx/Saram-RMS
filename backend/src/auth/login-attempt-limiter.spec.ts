import { HttpException } from '@nestjs/common';
import {
  LOCK_MS,
  LoginAttemptLimiter,
  MAX_FAILS_PER_ACCOUNT,
  MAX_FAILS_PER_IP,
} from './login-attempt-limiter';

describe('LoginAttemptLimiter', () => {
  let now = 0;
  const limiter = () => new LoginAttemptLimiter(() => now);
  beforeEach(() => {
    now = 1_000_000;
  });

  it('sai 5 lần liên tiếp → khoá tài khoản 15 phút (không phân biệt hoa/thường)', () => {
    const l = limiter();
    for (let i = 0; i < MAX_FAILS_PER_ACCOUNT; i++)
      l.recordFailure('Admin', '1.1.1.1');
    expect(() => l.assertAllowed('admin', '2.2.2.2')).toThrow(HttpException);
    now += LOCK_MS + 1;
    expect(() => l.assertAllowed('admin', '2.2.2.2')).not.toThrow();
  });

  it('đăng nhập đúng xoá bộ đếm của tài khoản', () => {
    const l = limiter();
    for (let i = 0; i < MAX_FAILS_PER_ACCOUNT - 1; i++)
      l.recordFailure('sale', 'ip');
    l.recordSuccess('sale');
    l.recordFailure('sale', 'ip');
    expect(() => l.assertAllowed('sale', undefined)).not.toThrow();
  });

  it('1 IP thử sai nhiều tài khoản khác nhau → khoá IP', () => {
    const l = limiter();
    for (let i = 0; i < MAX_FAILS_PER_IP; i++)
      l.recordFailure(`user${i}`, '9.9.9.9');
    expect(() => l.assertAllowed('nguoi-khac', '9.9.9.9')).toThrow(
      HttpException,
    );
    expect(() => l.assertAllowed('nguoi-khac', '8.8.8.8')).not.toThrow();
  });

  it('các lần sai cách nhau quá 15 phút không cộng dồn', () => {
    const l = limiter();
    for (let i = 0; i < MAX_FAILS_PER_ACCOUNT - 1; i++)
      l.recordFailure('a', 'ip');
    now += LOCK_MS + 1;
    l.recordFailure('a', 'ip');
    expect(() => l.assertAllowed('a', 'ip')).not.toThrow();
  });
});
