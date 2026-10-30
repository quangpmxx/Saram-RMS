import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('JwtStrategy.validate', () => {
  let prisma: {
    session: { findUnique: jest.Mock; update: jest.Mock };
    account: { findUnique: jest.Mock };
  };
  let strategy: JwtStrategy;
  const payload = { sub: 'acc-1', sessionId: 'sess-1' } as never;

  const account = {
    id: 'acc-1',
    role: 'sale',
    status: 'active',
    mustChangePassword: false,
  };

  beforeEach(() => {
    prisma = {
      session: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      account: { findUnique: jest.fn().mockResolvedValue(account) },
    };
    const config = {
      getOrThrow: () => 'test-secret',
    } as unknown as ConfigService;
    strategy = new JwtStrategy(config, prisma as unknown as PrismaService);
  });

  it('phiên đã thu hồi → 401', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: new Date(),
      lastActiveAt: null,
    });
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('tài khoản inactive → 401', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: null,
      lastActiveAt: null,
    });
    prisma.account.findUnique.mockResolvedValue({
      ...account,
      status: 'inactive',
    });
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lastActiveAt mới ghi < 60 giây → không ghi lại DB', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: null,
      lastActiveAt: new Date(Date.now() - 10_000),
    });
    const user = await strategy.validate(payload);
    expect(user).toMatchObject({ id: 'acc-1', sessionId: 'sess-1' });
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it('lastActiveAt cũ > 60 giây hoặc chưa có → ghi lại', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: null,
      lastActiveAt: new Date(Date.now() - 120_000),
    });
    await strategy.validate(payload);
    expect(prisma.session.update).toHaveBeenCalledTimes(1);

    prisma.session.update.mockClear();
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: null,
      lastActiveAt: null,
    });
    await strategy.validate(payload);
    expect(prisma.session.update).toHaveBeenCalledTimes(1);
  });
});
