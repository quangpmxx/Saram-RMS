import {
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as passwordUtil from '../common/utils/password.util';

jest.mock('../common/utils/password.util');
jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    account: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
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
    avatarUrl: null as string | null,
    createdById: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    team: null,
  };

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
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
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ username: 'ghost', password: '123456' }, 'jest'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối khi tài khoản đã bị vô hiệu hóa', async () => {
      prisma.account.findFirst.mockResolvedValue({
        ...account,
        status: 'inactive',
      });

      await expect(
        service.login({ username: 'admin', password: '123456' }, 'jest'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối khi sai mật khẩu', async () => {
      prisma.account.findFirst.mockResolvedValue(account);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'admin', password: 'wrong' }, 'jest'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('đăng nhập thành công: tạo session mới, ký JWT, ghi audit log, không trả mật khẩu', async () => {
      prisma.account.findFirst.mockResolvedValue(account);
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
      prisma.account.findFirst.mockResolvedValue(account);
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

    it('đăng nhập được dù gõ tên đăng nhập hoa/thường khác với lúc lưu (yêu cầu trực tiếp người dùng, 2026-07-16)', async () => {
      prisma.account.findFirst.mockResolvedValue(account);
      prisma.session.create.mockResolvedValue({
        id: 'session-3',
        accountId: account.id,
      });
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(true);

      await service.login({ username: 'ADMIN', password: '123456' }, 'jest');

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { username: { equals: 'ADMIN', mode: 'insensitive' } },
        include: { team: { select: { id: true, name: true } } },
      });
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

  describe('changePassword — dự án phụ: PUT /me/password (tự đổi mật khẩu)', () => {
    const dto = {
      current_password: 'old-pass',
      new_password: 'new-pass-123',
      confirm_password: 'new-pass-123',
    };

    it('ném UnprocessableEntityException nếu mật khẩu mới và xác nhận không khớp', async () => {
      await expect(
        service.changePassword(account.id, {
          ...dto,
          confirm_password: 'khac-hoan-toan',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
    });

    it('ném UnauthorizedException nếu tài khoản không còn tồn tại', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(account.id, dto),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('ném UnprocessableEntityException nếu mật khẩu hiện tại sai', async () => {
      prisma.account.findUnique.mockResolvedValue(account);
      jest.mocked(passwordUtil.comparePassword).mockResolvedValue(false);

      await expect(
        service.changePassword(account.id, dto),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it('đổi mật khẩu thành công: hash mật khẩu mới, ghi audit log, không thu hồi session', async () => {
      prisma.account.findUnique.mockResolvedValue(account);
      jest.mocked(passwordUtil.comparePassword).mockResolvedValue(true);
      jest.mocked(passwordUtil.hashPassword).mockResolvedValue('new-hashed');

      await service.changePassword(account.id, dto);

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: account.id },
        data: { passwordHash: 'new-hashed' },
      });
      expect(prisma.session.update).not.toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          entityType: 'account',
          fieldChanged: 'password',
        }),
      );
    });
  });

  describe('updateAvatar — dự án phụ: POST /me/avatar (tự upload ảnh đại diện)', () => {
    it('ném UnauthorizedException nếu tài khoản không còn tồn tại', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAvatar(account.id, '/uploads/avatars/new.png'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('cập nhật avatar_url và ghi audit log', async () => {
      prisma.account.findUnique.mockResolvedValue(account);
      prisma.account.update.mockResolvedValue({
        ...account,
        avatarUrl: '/uploads/avatars/new.png',
      });

      const result = await service.updateAvatar(
        account.id,
        '/uploads/avatars/new.png',
      );

      expect(prisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: account.id },
          data: { avatarUrl: '/uploads/avatars/new.png' },
        }),
      );
      expect(result.avatar_url).toBe('/uploads/avatars/new.png');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ fieldChanged: 'avatar_url' }),
      );
    });

    it('không xóa file cũ nếu trước đó chưa có avatar', async () => {
      prisma.account.findUnique.mockResolvedValue(account); // avatarUrl: null
      prisma.account.update.mockResolvedValue({
        ...account,
        avatarUrl: '/uploads/avatars/new.png',
      });
      const fsPromises = jest.requireMock('fs/promises');

      await service.updateAvatar(account.id, '/uploads/avatars/new.png');

      expect(fsPromises.unlink).not.toHaveBeenCalled();
    });

    it('dọn file avatar cũ (best-effort) khi thay bằng ảnh mới', async () => {
      const accountWithOldAvatar = {
        ...account,
        avatarUrl: '/uploads/avatars/old.png',
      };
      prisma.account.findUnique.mockResolvedValue(accountWithOldAvatar);
      prisma.account.update.mockResolvedValue({
        ...accountWithOldAvatar,
        avatarUrl: '/uploads/avatars/new.png',
      });
      const fsPromises = jest.requireMock('fs/promises');

      await service.updateAvatar(account.id, '/uploads/avatars/new.png');

      expect(fsPromises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('uploads/avatars/old.png'),
      );
    });
  });
});
