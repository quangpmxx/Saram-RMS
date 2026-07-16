import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LeaveRequestsService } from './leave-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

describe('LeaveRequestsService', () => {
  let service: LeaveRequestsService;
  let prisma: {
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    leaveRequest: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    notification: { createMany: jest.Mock; findMany: jest.Mock };
  };
  let auditLog: { log: jest.Mock };

  const sale: AuthenticatedUser = {
    id: 'sale-1',
    role: 'sale',
    sessionId: 's1',
  };
  const mkt: AuthenticatedUser = { id: 'mkt-1', role: 'mkt', sessionId: 's2' };
  const leader: AuthenticatedUser = {
    id: 'leader-1',
    role: 'leader',
    sessionId: 's3',
  };
  const otherLeader: AuthenticatedUser = {
    id: 'leader-2',
    role: 'leader',
    sessionId: 's4',
  };
  const admin: AuthenticatedUser = {
    id: 'admin-1',
    role: 'admin',
    sessionId: 's5',
  };
  const manager: AuthenticatedUser = {
    id: 'manager-1',
    role: 'manager',
    sessionId: 's6',
  };

  const baseAccount = {
    id: 'sale-1',
    fullName: 'Sale A',
    role: 'sale',
    avatarUrl: null,
    position: null,
    teamId: 'team-1',
    team: { id: 'team-1', name: 'Nhóm 1', leaderId: 'leader-1' },
  };

  const baseRequest = {
    id: 'req-1',
    accountId: 'sale-1',
    recipientText: 'Ban Giám đốc / Quản lý',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-03T00:00:00.000Z'),
    daysCount: 3,
    reason: 'Việc gia đình',
    handoverTo: 'Sale B',
    status: 'pending_leader',
    leaderDecisionById: null,
    leaderDecisionAt: null,
    leaderDecision: null,
    leaderNote: null,
    adminDecisionById: null,
    adminDecisionAt: null,
    adminDecision: null,
    adminNote: null,
    createdAt: new Date('2026-07-16T00:00:00.000Z'),
    updatedAt: new Date('2026-07-16T00:00:00.000Z'),
    account: {
      id: 'sale-1',
      fullName: 'Sale A',
      role: 'sale',
      avatarUrl: null,
      position: null,
      team: { name: 'Nhóm 1' },
    },
    leaderDecisionBy: null,
    adminDecisionBy: null,
  };

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      leaveRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    const realtimeService = { emitNotificationCreated: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    service = moduleRef.get(LeaveRequestsService);
  });

  describe('create', () => {
    const dto = {
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      reason: 'Việc gia đình',
      handover_to: 'Sale B',
    };

    it('Admin/Quản lý không tạo được đơn (không phải "nhân viên")', async () => {
      await expect(service.create(dto, admin)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.create(dto, manager)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('Leader tạo đơn cho chính mình -> status=pending_leader (chính họ là Leader phụ trách), báo CHÍNH HỌ', async () => {
      const leaderAccount = {
        id: 'leader-1',
        fullName: 'Leader A',
        role: 'leader',
        avatarUrl: null,
        position: null,
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Nhóm 1', leaderId: 'leader-1' },
      };
      prisma.account.findUnique.mockResolvedValue(leaderAccount);
      prisma.leaveRequest.create.mockResolvedValue({
        ...baseRequest,
        accountId: 'leader-1',
        account: {
          ...baseRequest.account,
          id: 'leader-1',
          fullName: 'Leader A',
          role: 'leader',
        },
      });

      const result = await service.create(dto, leader);

      expect(result.status).toBe('pending_leader');
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            accountId: 'leader-1',
            type: 'leave_request_pending_leader',
          }),
        ],
      });
    });

    it('từ chối nếu ngày kết thúc trước ngày bắt đầu', async () => {
      await expect(
        service.create(
          { ...dto, start_date: '2026-08-05', end_date: '2026-08-01' },
          sale,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('nhóm có Leader -> status=pending_leader, tính đúng số ngày, báo Leader, ghi audit log', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.leaveRequest.create.mockResolvedValue(baseRequest);

      const result = await service.create(dto, sale);

      expect(result.status).toBe('pending_leader');
      expect(result.days_count).toBe(3);
      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending_leader',
            daysCount: 3,
          }),
        }),
      );
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            accountId: 'leader-1',
            leaveRequestId: 'req-1',
            type: 'leave_request_pending_leader',
          }),
        ],
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'create',
          entityType: 'leave_request',
        }),
      );
    });

    it('nhân viên không thuộc nhóm nào -> status=pending_admin, báo TẤT CẢ Admin', async () => {
      prisma.account.findUnique.mockResolvedValue({
        ...baseAccount,
        teamId: null,
        team: null,
      });
      prisma.leaveRequest.create.mockResolvedValue({
        ...baseRequest,
        status: 'pending_admin',
      });
      prisma.account.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);

      const result = await service.create(dto, mkt);

      expect(result.status).toBe('pending_admin');
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'admin', status: 'active' } }),
      );
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            accountId: 'admin-1',
            type: 'leave_request_pending_admin',
          }),
          expect.objectContaining({
            accountId: 'admin-2',
            type: 'leave_request_pending_admin',
          }),
        ],
      });
    });

    it('nhóm chưa có Leader -> status=pending_admin', async () => {
      prisma.account.findUnique.mockResolvedValue({
        ...baseAccount,
        team: { id: 'team-1', name: 'Nhóm 1', leaderId: null },
      });
      prisma.leaveRequest.create.mockResolvedValue({
        ...baseRequest,
        status: 'pending_admin',
      });

      const result = await service.create(dto, sale);

      expect(result.status).toBe('pending_admin');
    });
  });

  describe('list', () => {
    it('Sale/MKT chỉ thấy đơn của chính mình', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      await service.list({}, sale);
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: 'sale-1' } }),
      );
    });

    it('Leader thấy đơn của thành viên nhóm mình', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'leader-1',
        teamId: 'team-1',
      });
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      await service.list({}, leader);
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { account: { teamId: 'team-1' } } }),
      );
    });

    it('Admin/Quản lý thấy toàn bộ (không lọc theo tài khoản/nhóm)', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      await service.list({}, admin);
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );

      await service.list({}, manager);
      expect(prisma.leaveRequest.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('lọc theo ngày gửi (date_from/date_to) và trạng thái', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      await service.list(
        {
          status_filter: 'approved',
          date_from: '2026-08-01',
          date_to: '2026-08-31',
        },
        admin,
      );
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'approved',
            createdAt: {
              gte: new Date('2026-08-01'),
              lte: new Date('2026-08-31'),
            },
          },
        }),
      );
    });
  });

  describe('getById', () => {
    it('không tìm thấy -> NotFoundException', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);
      await expect(service.getById('ghost', sale)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('Sale khác không xem được đơn không phải của mình', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(baseRequest);
      await expect(
        service.getById('req-1', {
          id: 'sale-2',
          role: 'sale',
          sessionId: 's',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Leader nhóm khác không xem được', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(baseRequest);
      prisma.account.findUnique
        .mockResolvedValueOnce({ id: 'leader-2', teamId: 'team-2' }) // leader hiện tại
        .mockResolvedValueOnce({ id: 'sale-1', teamId: 'team-1' }); // chủ đơn

      await expect(
        service.getById('req-1', otherLeader),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Leader cùng nhóm xem được', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(baseRequest);
      prisma.account.findUnique
        .mockResolvedValueOnce({ id: 'leader-1', teamId: 'team-1' })
        .mockResolvedValueOnce({ id: 'sale-1', teamId: 'team-1' });

      await expect(service.getById('req-1', leader)).resolves.toBeDefined();
    });

    it('Admin xem được mọi đơn', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(baseRequest);
      await expect(service.getById('req-1', admin)).resolves.toBeDefined();
    });
  });

  describe('leaderDecide', () => {
    it('không phải Leader -> ForbiddenException', async () => {
      await expect(
        service.leaderDecide('req-1', { decision: 'approved' }, admin),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('không tìm thấy đơn -> NotFoundException', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.leaderDecide('ghost', { decision: 'approved' }, leader),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('đơn không ở trạng thái pending_leader -> BadRequestException', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...baseRequest,
        status: 'pending_admin',
        account: baseAccount,
      });
      await expect(
        service.leaderDecide('req-1', { decision: 'approved' }, leader),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Leader không phụ trách nhóm này -> ForbiddenException', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...baseRequest,
        account: baseAccount,
      });
      await expect(
        service.leaderDecide('req-1', { decision: 'approved' }, otherLeader),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('duyệt -> chuyển pending_admin, báo TẤT CẢ Admin, ghi audit log', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...baseRequest,
        account: baseAccount,
      });
      prisma.leaveRequest.update.mockResolvedValue({
        ...baseRequest,
        status: 'pending_admin',
      });
      prisma.account.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      const result = await service.leaderDecide(
        'req-1',
        { decision: 'approved' },
        leader,
      );

      expect(result.status).toBe('pending_admin');
      expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending_admin',
            leaderDecision: 'approved',
          }),
        }),
      );
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            accountId: 'admin-1',
            type: 'leave_request_pending_admin',
          }),
        ],
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          fieldChanged: 'leader_decision',
        }),
      );
    });

    it('từ chối -> chuyển rejected, báo người làm đơn, ghi audit log actionType=reject', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...baseRequest,
        account: baseAccount,
      });
      prisma.leaveRequest.update.mockResolvedValue({
        ...baseRequest,
        status: 'rejected',
      });

      const result = await service.leaderDecide(
        'req-1',
        { decision: 'rejected', note: 'Đợt này bận việc' },
        leader,
      );

      expect(result.status).toBe('rejected');
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            accountId: 'sale-1',
            type: 'leave_request_decided',
          }),
        ],
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'reject' }),
      );
    });

    it('yêu cầu trực tiếp người dùng (2026-07-16): Leader tự duyệt đơn của CHÍNH MÌNH thành công (họ là Leader phụ trách chính đơn đó)', async () => {
      const ownRequest = {
        ...baseRequest,
        accountId: 'leader-1',
        account: {
          id: 'leader-1',
          fullName: 'Leader A',
          role: 'leader',
          avatarUrl: null,
          position: null,
          team: { id: 'team-1', name: 'Nhóm 1', leaderId: 'leader-1' },
        },
      };
      prisma.leaveRequest.findUnique.mockResolvedValue(ownRequest);
      prisma.leaveRequest.update.mockResolvedValue({
        ...ownRequest,
        status: 'pending_admin',
      });
      prisma.account.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      const result = await service.leaderDecide(
        'req-1',
        { decision: 'approved' },
        leader,
      );

      expect(result.status).toBe('pending_admin');
      expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leaderDecisionById: 'leader-1',
            leaderDecision: 'approved',
          }),
        }),
      );
    });
  });

  describe('adminDecide', () => {
    it('không phải Admin -> ForbiddenException', async () => {
      await expect(
        service.adminDecide('req-1', { decision: 'approved' }, manager),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.adminDecide('req-1', { decision: 'approved' }, leader),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('không tìm thấy đơn -> NotFoundException', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.adminDecide('ghost', { decision: 'approved' }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('đơn không ở trạng thái pending_admin -> BadRequestException', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...baseRequest,
        status: 'pending_leader',
        account: baseAccount,
      });
      await expect(
        service.adminDecide('req-1', { decision: 'approved' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('duyệt -> chuyển approved, báo người làm đơn', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...baseRequest,
        status: 'pending_admin',
        account: baseAccount,
      });
      prisma.leaveRequest.update.mockResolvedValue({
        ...baseRequest,
        status: 'approved',
      });

      const result = await service.adminDecide(
        'req-1',
        { decision: 'approved' },
        admin,
      );

      expect(result.status).toBe('approved');
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            accountId: 'sale-1',
            type: 'leave_request_decided',
            content: 'Đơn xin nghỉ phép của bạn đã được duyệt',
          }),
        ],
      });
    });

    it('từ chối -> chuyển rejected, ghi audit log actionType=reject', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...baseRequest,
        status: 'pending_admin',
        account: baseAccount,
      });
      prisma.leaveRequest.update.mockResolvedValue({
        ...baseRequest,
        status: 'rejected',
      });

      const result = await service.adminDecide(
        'req-1',
        { decision: 'rejected', note: 'Thiếu nhân sự' },
        admin,
      );

      expect(result.status).toBe('rejected');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'reject' }),
      );
    });
  });
});
