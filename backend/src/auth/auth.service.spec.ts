import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as passwordUtil from '../common/utils/password.util';

jest.mock('../common/utils/password.util');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    account: { findUnique: jest.Mock };
    session: { create: jest.Mock; update: jest.Mock };
  };
  let jwtService: { signAsync: jest.Mock };
  let auditLog: { log: jest.Mock };

  const account = {
    id: 'account-1',
    fullName: 'Nguyễn Văn A',
    username: 'admin',
    passwordHash: 'hashed',
    role: 'admin',
    teamId: null,
    status: 'active',
    createdById: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    team: null,
  };

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn() },
      session: { create: jest.fn(), update: jest.fn() },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('từ chối khi không tìm thấy tài khoản', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ username: 'ghost', password: '123456' }, 'jest'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối khi tài khoản đã bị vô hiệu hóa', async () => {
      prisma.account.findUnique.mockResolvedValue({
        ...account,
        status: 'inactive',
      });

      await expect(
        service.login({ username: 'admin', password: '123456' }, 'jest'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối khi sai mật khẩu', async () => {
      prisma.account.findUnique.mockResolvedValue(account);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'admin', password: 'wrong' }, 'jest'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('đăng nhập thành công: tạo session mới, ký JWT, ghi audit log, không trả mật khẩu', async () => {
      prisma.account.findUnique.mockResolvedValue(account);
      prisma.session.create.mockResolvedValue({
        id: 'session-1',
        accountId: account.id,
      });
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(true);

      const result = await service.login(
        { username: 'admin', password: '123456' },
        'jest-agent',
      );

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: { accountId: account.id, deviceInfo: 'jest-agent' },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: account.id,
        role: account.role,
        sessionId: 'session-1',
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: account.id, actionType: 'login' }),
      );
      expect(result.token).toBe('signed-jwt');
      expect(result.account).not.toHaveProperty('passwordHash');
      expect(result.account.username).toBe('admin');
    });

    it('cho phép nhiều session cùng lúc (đa thiết bị) — không thu hồi session cũ khi đăng nhập lại', async () => {
      prisma.account.findUnique.mockResolvedValue(account);
      prisma.session.create.mockResolvedValue({
        id: 'session-2',
        accountId: account.id,
      });
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(true);

      await service.login(
        { username: 'admin', password: '123456' },
        'device-2',
      );

      expect(prisma.session.update).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('thu hồi đúng session hiện tại và ghi audit log', async () => {
      prisma.session.update.mockResolvedValue({});

      await service.logout({
        id: account.id,
        role: 'admin',
        sessionId: 'session-1',
      });

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'logout' }),
      );
    });
  });

  describe('me', () => {
    it('trả về thông tin tài khoản không kèm mật khẩu', async () => {
      prisma.account.findUnique.mockResolvedValue(account);

      const result = await service.me(account.id);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(account.id);
    });

    it('ném lỗi nếu tài khoản không còn tồn tại', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.me('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
