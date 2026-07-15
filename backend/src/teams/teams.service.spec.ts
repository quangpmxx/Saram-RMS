import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Prisma } from '../../generated/prisma/client';

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: {
    team: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    account: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    dailyReport: { updateMany: jest.Mock };
    distributionRule: { deleteMany: jest.Mock };
    lead: { groupBy: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  const team = {
    id: 'team-1',
    name: 'Nhóm A',
    leaderId: 'leader-1',
    createdAt: new Date('2026-01-01'),
    leader: { id: 'leader-1', fullName: 'Leader A' },
    _count: { members: 2 },
  };

  beforeEach(async () => {
    prisma = {
      team: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      account: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      dailyReport: { updateMany: jest.fn() },
      distributionRule: { deleteMany: jest.fn() },
      lead: { groupBy: jest.fn() },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(TeamsService);
  });

  describe('list', () => {
    it('Admin/Quản lý thấy tất cả nhóm (không lọc theo team)', async () => {
      prisma.$transaction.mockResolvedValue([1, [team]]);

      await service.list(
        { page: 1, page_size: 20 },
        { id: 'admin-1', role: 'admin', sessionId: 's' },
      );

      // Admin/Quản lý không bị lọc theo team — where rỗng, không có điều kiện id.
      expect(prisma.team.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('Leader chỉ thấy đúng nhóm của mình', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.$transaction.mockResolvedValue([1, [team]]);

      await service.list(
        { page: 1, page_size: 20 },
        { id: 'leader-1', role: 'leader', sessionId: 's' },
      );

      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'leader-1' },
      });
    });
  });

  describe('create', () => {
    it('từ chối nếu leader_id không phải tài khoản vai trò leader', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-x',
        role: 'sale',
      });

      await expect(
        service.create({ name: 'Nhóm B', leader_id: 'acc-x' }, 'admin-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('báo lỗi nếu tài khoản đã là leader của nhóm khác (leader_id trùng)', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'leader-1',
        role: 'leader',
      });
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'duplicate',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );
      prisma.team.create.mockRejectedValue(prismaError);

      await expect(
        service.create({ name: 'Nhóm B', leader_id: 'leader-1' }, 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('tạo nhóm thành công và ghi audit log', async () => {
      prisma.team.create.mockResolvedValue(team);

      const result = await service.create({ name: 'Nhóm A' }, 'admin-1');

      expect(result.name).toBe('Nhóm A');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'create', entityType: 'team' }),
      );
    });
  });

  describe('delete', () => {
    it('ném NotFoundException nếu nhóm không tồn tại', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('xóa nhóm, gỡ thành viên/báo cáo, xóa cấu hình phân chia, ghi audit log', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.$transaction.mockResolvedValue([]);

      await service.delete('team-1', 'admin-1');

      expect(prisma.account.updateMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        data: { teamId: null },
      });
      expect(prisma.dailyReport.updateMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        data: { teamId: null },
      });
      expect(prisma.distributionRule.deleteMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
      });
      expect(prisma.team.delete).toHaveBeenCalledWith({
        where: { id: 'team-1' },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'delete', entityType: 'team' }),
      );
    });

    it('vẫn còn dữ liệu khác tham chiếu (P2003) -> ConflictException, không ghi audit log', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'fk violation',
        { code: 'P2003', clientVersion: 'test' },
      );
      prisma.$transaction.mockRejectedValue(prismaError);

      await expect(service.delete('team-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('getMembers', () => {
    it('ném NotFoundException nếu nhóm không tồn tại', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.getMembers('ghost', {
          id: 'admin-1',
          role: 'admin',
          sessionId: 's',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('chặn Leader xem nhóm khác nhóm của mình', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-other' });

      await expect(
        service.getMembers('team-1', {
          id: 'leader-1',
          role: 'leader',
          sessionId: 's',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cho phép Leader xem đúng nhóm của mình', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.account.findMany.mockResolvedValue([]);
      prisma.lead.groupBy.mockResolvedValue([]);

      await expect(
        service.getMembers('team-1', {
          id: 'leader-1',
          role: 'leader',
          sessionId: 's',
        }),
      ).resolves.toEqual([]);
    });

    it('chỉ lấy thành viên vai trò Sale, kèm assigned_count tính từ leads.assigned_to', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          fullName: 'Sale A',
          username: 'sale_a',
          role: 'sale',
          teamId: 'team-1',
          status: 'active',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          team: { id: 'team-1', name: 'Nhóm A' },
        },
        {
          id: 'sale-2',
          fullName: 'Sale B',
          username: 'sale_b',
          role: 'sale',
          teamId: 'team-1',
          status: 'active',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          team: { id: 'team-1', name: 'Nhóm A' },
        },
      ]);
      prisma.lead.groupBy.mockResolvedValue([
        { assignedToId: 'sale-1', _count: { _all: 5 } },
      ]);

      const result = await service.getMembers('team-1', {
        id: 'admin-1',
        role: 'admin',
        sessionId: 's',
      });

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: 'team-1', role: 'sale' } }),
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: 'sale-1',
          assigned_count: 5,
          care_pool_count: 0,
        }),
        expect.objectContaining({
          id: 'sale-2',
          assigned_count: 0,
          care_pool_count: 0,
        }),
      ]);
    });
  });
});
