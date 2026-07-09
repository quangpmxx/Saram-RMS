import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Prisma } from '../../generated/prisma/client';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: {
    account: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    team: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  const baseAccount = {
    id: 'acc-1',
    fullName: 'Trần Thị B',
    username: 'sale01',
    passwordHash: 'hashed',
    role: 'sale',
    teamId: 'team-1',
    status: 'active',
    createdById: 'admin-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    team: { id: 'team-1', name: 'Nhóm A' },
  };

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      team: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => '123456' } },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(AccountsService);
  });

  describe('create', () => {
    it('từ chối tạo sale/leader mà không có team_id', async () => {
      await expect(
        service.create(
          { full_name: 'X', username: 'x', role: 'sale' },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('từ chối khi team_id không tồn tại', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            full_name: 'X',
            username: 'x',
            role: 'sale',
            team_id: 'ghost-team',
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('tạo thành công tài khoản sale, gán đúng team_id, ghi audit log, không trả mật khẩu', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1' });
      prisma.account.create.mockResolvedValue(baseAccount);

      const result = await service.create(
        {
          full_name: 'Trần Thị B',
          username: 'sale01',
          role: 'sale',
          team_id: 'team-1',
        },
        'admin-1',
      );

      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'sale',
            teamId: 'team-1',
            createdById: 'admin-1',
          }),
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'create' }),
      );
    });

    it('không gán team_id cho vai trò admin/manager/mkt kể cả khi client gửi lên', async () => {
      prisma.account.create.mockResolvedValue({
        ...baseAccount,
        role: 'mkt',
        teamId: null,
        team: null,
      });

      await service.create(
        { full_name: 'MKT A', username: 'mkt01', role: 'mkt' },
        'admin-1',
      );

      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teamId: undefined }),
        }),
      );
    });

    it('báo trùng tên đăng nhập bằng ConflictException', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1' });
      const prismaError = Object.assign(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      prisma.account.create.mockRejectedValue(prismaError);

      await expect(
        service.create(
          {
            full_name: 'X',
            username: 'trung',
            role: 'sale',
            team_id: 'team-1',
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('ném NotFoundException nếu tài khoản không tồn tại', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.update('ghost', { full_name: 'X' }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ghi 1 dòng audit log cho mỗi trường thay đổi', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.account.update.mockResolvedValue({
        ...baseAccount,
        status: 'inactive',
      });

      await service.update('acc-1', { status: 'inactive' }, 'admin-1');

      expect(auditLog.log).toHaveBeenCalledTimes(1);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldChanged: 'status',
          oldValue: 'active',
          newValue: 'inactive',
        }),
      );
    });
  });

  describe('deactivate', () => {
    it('chuyển status sang inactive (xóa mềm) và ghi audit log', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.account.update.mockResolvedValue({
        ...baseAccount,
        status: 'inactive',
      });

      await service.deactivate('acc-1', 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { status: 'inactive' },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'delete' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('cập nhật mật khẩu về mặc định và ghi audit log reset_password', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.account.update.mockResolvedValue(baseAccount);

      await service.resetPassword('acc-1', 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { passwordHash: expect.any(String) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'reset_password' }),
      );
    });
  });

  describe('list', () => {
    it('trả về kết quả có phân trang', async () => {
      prisma.$transaction.mockResolvedValue([1, [baseAccount]]);

      const result = await service.list({ page: 1, page_size: 20 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).not.toHaveProperty('passwordHash');
    });
  });
});
