import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Giới hạn đăng nhập sai (rà soát 2026-10-30): chống dò mật khẩu khi đưa lên
 * VPS. Đếm trong bộ nhớ của tiến trình — đủ cho 1 máy chủ; chạy nhiều tiến
 * trình thì cần chuyển sang bộ đếm dùng chung (Redis...).
 * - Theo tài khoản: sai 5 lần liên tiếp → khoá đăng nhập 15 phút.
 * - Theo IP: sai 20 lần trong 15 phút → khoá IP đó 15 phút.
 * Đăng nhập đúng xoá bộ đếm của tài khoản.
 */
export const MAX_FAILS_PER_ACCOUNT = 5;
export const MAX_FAILS_PER_IP = 20;
export const LOCK_MS = 15 * 60 * 1000;

interface Counter {
  fails: number;
  firstFailAt: number;
  lockedUntil: number;
}

export class LoginAttemptLimiter {
  private readonly accounts = new Map<string, Counter>();
  private readonly ips = new Map<string, Counter>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Ném 429 nếu tài khoản hoặc IP đang bị khoá. */
  assertAllowed(username: string, ip: string | undefined): void {
    const lockedUntil = Math.max(
      this.lockedUntil(this.accounts, username.toLowerCase()),
      ip ? this.lockedUntil(this.ips, ip) : 0,
    );
    if (lockedUntil > 0) {
      const minutes = Math.ceil((lockedUntil - this.now()) / 60000);
      throw new HttpException(
        {
          error_code: 'TOO_MANY_LOGIN_ATTEMPTS',
          message: `Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ${minutes} phút`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(username: string, ip: string | undefined): void {
    this.bump(this.accounts, username.toLowerCase(), MAX_FAILS_PER_ACCOUNT);
    if (ip) this.bump(this.ips, ip, MAX_FAILS_PER_IP);
  }

  recordSuccess(username: string): void {
    this.accounts.delete(username.toLowerCase());
  }

  private lockedUntil(map: Map<string, Counter>, key: string): number {
    const c = map.get(key);
    if (!c) return 0;
    if (c.lockedUntil > this.now()) return c.lockedUntil;
    if (c.lockedUntil || this.now() - c.firstFailAt > LOCK_MS) map.delete(key);
    return 0;
  }

  private bump(map: Map<string, Counter>, key: string, max: number): void {
    const now = this.now();
    let c = map.get(key);
    if (!c || now - c.firstFailAt > LOCK_MS || c.lockedUntil) {
      c = { fails: 0, firstFailAt: now, lockedUntil: 0 };
      map.set(key, c);
    }
    c.fails++;
    if (c.fails >= max) c.lockedUntil = now + LOCK_MS;
  }
}
