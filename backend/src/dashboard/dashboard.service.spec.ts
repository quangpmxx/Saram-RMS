import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    team: { findMany: jest.Mock };
    lead: { count: jest.Mock; groupBy: jest.Mock };
    leadSource: { findMany: jest.Mock };
    leadNote: { count: jest.Mock };
    interviewAppointment: { count: jest.Mock };
  };

  const adminUser = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };
  const managerUser = {
    id: 'manager-1',
    role: 'manager' as const,
    sessionId: 's',
  };
  const leaderUser = {
    id: 'leader-1',
    role: 'leader' as const,
    sessionId: 's',
  };
  const saleUser = { id: 'sale-1', role: 'sale' as const, sessionId: 's' };
  const mktUser = { id: 'mkt-1', role: 'mkt' as const, sessionId: 's' };

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      team: { findMany: jest.fn().mockResolvedValue([]) },
      lead: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      leadSource: { findMany: jest.fn().mockResolvedValue([]) },
      leadNote: { count: jest.fn().mockResolvedValue(0) },
      interviewAppointment: { count: jest.fn().mockResolvedValue(0) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  describe('getSummary — phạm vi theo vai trò (Mục 8, docs/09)', () => {
    it('Sale: lọc theo assignedToId = chính mình', async () => {
      await service.getSummary({}, saleUser);
      expect(prisma.lead.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedToId: 'sale-1' }),
        }),
      );
    });

    it('MKT: lọc theo uploadedById = chính mình', async () => {
      await service.getSummary({}, mktUser);
      expect(prisma.lead.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ uploadedById: 'mkt-1' }),
        }),
      );
    });

    it('Leader: lọc theo assignedTeamId = nhóm mình, bỏ qua team_id truyền vào', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      await service.getSummary({ team_id: 'team-OTHER' }, leaderUser);
      expect(prisma.lead.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedTeamId: 'team-1' }),
        }),
      );
    });

    it('Admin không truyền team_id: không giới hạn nhóm', async () => {
      await service.getSummary({}, adminUser);
      const call = prisma.lead.groupBy.mock.calls[0][0];
      expect(call.where.assignedTeamId).toBeUndefined();
      expect(call.where.assignedToId).toBeUndefined();
      expect(call.where.uploadedById).toBeUndefined();
    });

    it('Admin có truyền team_id: thu hẹp theo đúng nhóm đó', async () => {
      await service.getSummary({ team_id: 'team-9' }, adminUser);
      expect(prisma.lead.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedTeamId: 'team-9' }),
        }),
      );
    });

    it('pending_count = 0 với Sale (không thuộc PENDING_VIEW_ROLES)', async () => {
      const result = await service.getSummary({}, saleUser);
      expect(result.pending_count).toBe(0);
      expect(prisma.lead.count).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedToId: null }),
        }),
      );
    });

    it('care_pool_count = 0 với MKT (không có quyền xem Cột chăm sóc)', async () => {
      const result = await service.getSummary({}, mktUser);
      expect(result.care_pool_count).toBe(0);
    });

    it('new_leads_total = tổng các nguồn', async () => {
      prisma.leadSource.findMany.mockResolvedValue([
        { id: 'src-fb', name: 'Facebook' },
        { id: 'src-tt', name: 'TikTok' },
      ]);
      prisma.lead.groupBy.mockResolvedValue([
        { sourceId: 'src-fb', _count: { _all: 7 } },
        { sourceId: 'src-tt', _count: { _all: 3 } },
      ]);
      const result = await service.getSummary({}, adminUser);
      expect(result.new_leads_total).toBe(10);
      expect(result.new_leads_by_source).toEqual([
        { source_id: 'src-fb', source_name: 'Facebook', count: 7 },
        { source_id: 'src-tt', source_name: 'TikTok', count: 3 },
      ]);
    });
  });

  describe('getPerformance — Mục 8, docs/13: chỉ Leader/Quản lý/Admin', () => {
    it('Sale/MKT bị từ chối', async () => {
      await expect(service.getPerformance({}, saleUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getPerformance({}, mktUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('Leader luôn bị ép về đúng nhóm mình', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      await service.getPerformance({ team_id: 'team-OTHER' }, leaderUser);
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'sale', teamId: 'team-1' }),
        }),
      );
    });

    it('Admin/Quản lý xem được, không giới hạn nếu không truyền team_id', async () => {
      await service.getPerformance({}, adminUser);
      const call = prisma.account.findMany.mock.calls[0][0];
      expect(call.where.teamId).toBeUndefined();
      await service.getPerformance({}, managerUser);
    });
  });

  describe('getByTeam — Mục 8, docs/13: chỉ Quản lý/Admin', () => {
    it('Leader/Sale/MKT bị từ chối', async () => {
      await expect(service.getByTeam({}, leaderUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getByTeam({}, saleUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getByTeam({}, mktUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('Admin xem được danh sách theo từng nhóm', async () => {
      prisma.team.findMany.mockResolvedValue([
        { id: 'team-1', name: 'Nhóm 1' },
      ]);
      const result = await service.getByTeam({}, adminUser);
      expect(result).toHaveLength(1);
      expect(result[0].team_id).toBe('team-1');
    });
  });

  describe('getFunnel/getBySource — Mục 8, docs/13: Leader/Quản lý/Admin', () => {
    it('Sale/MKT bị từ chối cả 2 API', async () => {
      await expect(service.getFunnel({}, saleUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getFunnel({}, mktUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getBySource({}, saleUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getBySource({}, mktUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('getFunnel: account_id thu hẹp theo đúng 1 Sale', async () => {
      await service.getFunnel({ account_id: 'sale-9' }, adminUser);
      expect(prisma.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedToId: 'sale-9' }),
        }),
      );
    });
  });

  describe('computeFunnel — tỷ lệ % so với bước Lead đầu tiên', () => {
    it('tính đúng % làm tròn 1 chữ số thập phân, bước Lead luôn 100%', async () => {
      prisma.lead.count
        .mockResolvedValueOnce(10) // LEAD
        .mockResolvedValueOnce(6) // INTERVIEW_SCHEDULED
        .mockResolvedValueOnce(5) // ATTENDED
        .mockResolvedValueOnce(3) // PASSED
        .mockResolvedValueOnce(1); // EMPLOYED

      const funnel = await service.getFunnel({}, adminUser);

      expect(funnel).toEqual([
        { code: 'LEAD', label: 'Lead', count: 10, percentage: 100 },
        {
          code: 'INTERVIEW_SCHEDULED',
          label: 'Hẹn PV',
          count: 6,
          percentage: 60,
        },
        { code: 'ATTENDED', label: 'Đến PV', count: 5, percentage: 50 },
        { code: 'PASSED', label: 'Đỗ PV', count: 3, percentage: 30 },
        { code: 'EMPLOYED', label: 'Đi làm', count: 1, percentage: 10 },
      ]);
    });

    it('bước Lead = 0 → tất cả % là 0, không chia cho 0', async () => {
      prisma.lead.count.mockResolvedValue(0);
      const funnel = await service.getFunnel({}, adminUser);
      expect(
        funnel.every((step) => step.percentage === 0 || step.code === 'LEAD'),
      ).toBe(true);
      expect(funnel[0].percentage).toBe(100);
    });
  });
});
