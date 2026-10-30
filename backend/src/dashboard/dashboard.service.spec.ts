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
    leadNote: { count: jest.Mock; groupBy: jest.Mock };
    interviewAppointment: { count: jest.Mock; groupBy: jest.Mock };
    shuttleRecord: { findMany: jest.Mock };
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
      leadNote: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      interviewAppointment: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      shuttleRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  describe('getSummary — số liệu chung toàn công ty (rà soát phân quyền 2026-10-30)', () => {
    it('Sale/MKT/Leader: số liệu chung toàn công ty, không bị thu hẹp về mình/nhóm mình', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      for (const user of [saleUser, mktUser, leaderUser]) {
        prisma.lead.groupBy.mockClear();
        await service.getSummary({}, user);
        const call = prisma.lead.groupBy.mock.calls[0][0];
        expect(call.where.assignedTeamId).toBeUndefined();
        expect(call.where.assignedToId).toBeUndefined();
        expect(call.where.uploadedById).toBeUndefined();
      }
    });

    it('Sale/Leader truyền team_id nhóm khác: bị bỏ qua (vẫn toàn công ty)', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      await service.getSummary({ team_id: 'team-OTHER' }, leaderUser);
      const call = prisma.lead.groupBy.mock.calls[0][0];
      expect(call.where.assignedTeamId).toBeUndefined();
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

    it('Chờ phân chia của Sale/Leader: chỉ nhóm mình + data chưa có nhóm', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      await service.getSummary({}, saleUser);
      expect(prisma.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: null,
            OR: [{ assignedTeamId: 'team-1' }, { assignedTeamId: null }],
          }),
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

  describe('getPerformance — chi tiết từng cá nhân', () => {
    it('Sale chỉ thấy dòng của mình (account_id truyền vào bị bỏ qua); MKT thấy toàn bộ', async () => {
      await service.getPerformance({ account_id: 'sale-2' }, saleUser);
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'sale', id: 'sale-1' }),
        }),
      );
      prisma.account.findMany.mockClear();
      await service.getPerformance({}, mktUser);
      const call = prisma.account.findMany.mock.calls[0][0];
      expect(call.where.teamId).toBeUndefined();
      expect(call.where.id).toBeUndefined();
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

  describe('getByTeam — hiệu suất theo nhóm (mọi vai trò)', () => {
    it('Sale/Leader xem được số liệu các nhóm', async () => {
      prisma.team.findMany.mockResolvedValue([
        { id: 'team-1', name: 'Nhóm 1' },
        { id: 'team-2', name: 'Nhóm 2' },
      ]);
      await expect(service.getByTeam({}, saleUser)).resolves.toHaveLength(2);
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

  describe('computeFunnel — tỷ lệ % so với bước Lead đầu tiên', () => {
    it('tính đúng % làm tròn 1 chữ số thập phân, bước Lead luôn 100%', async () => {
      prisma.lead.count
        .mockResolvedValueOnce(10) // LEAD
        .mockResolvedValueOnce(6) // INTERVIEW_SCHEDULED
        .mockResolvedValueOnce(5) // ATTENDED
        .mockResolvedValueOnce(3) // PASSED
        .mockResolvedValueOnce(1); // EMPLOYED

      const funnel = await service['computeFunnel']({});

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
      const funnel = await service['computeFunnel']({});
      expect(
        funnel.every((step) => step.percentage === 0 || step.code === 'LEAD'),
      ).toBe(true);
      expect(funnel[0].percentage).toBe(100);
    });
  });

  /**
   * Dự án phụ — nâng cấp toàn diện (riêng giao diện Dashboard, ngoài phạm vi
   * Design Freeze docs/09-13): computeKpiBreakdown() — 7 chỉ số đầy đủ, tách
   * riêng khỏi computeFunnel() nên test qua getSummary() (nơi cả 2 cùng
   * được gọi) để xác nhận không đụng nhau.
   *
   * ĐỔI NGUỒN (2026-07-14, yêu cầu trực tiếp người dùng): Hẹn/Đến/Bùng/Đỗ/
   * Trượt PV giờ lấy từ ShuttleRecord (module Đưa đón), không còn từ
   * InterviewAppointment — mock qua prisma.shuttleRecord.findMany() thay vì
   * chuỗi lead.count theo interview status như trước.
   */
  describe('computeKpiBreakdown (qua getSummary) — 7 chỉ số + tỷ lệ trên new_leads', () => {
    /** 12 dòng đưa đón: 9 "Đã đón" (4 Đỗ PV, 2 Trượt PV, 3 chưa có kết quả) + 3 "Chưa đón được". */
    const SHUTTLE_ROWS = [
      ...Array(4).fill({ status: 'Đã đón', interviewResult: 'Đỗ PV' }),
      ...Array(2).fill({ status: 'Đã đón', interviewResult: 'Trượt PV' }),
      ...Array(3).fill({ status: 'Đã đón', interviewResult: null }),
      ...Array(3).fill({ status: 'Chưa đón được', interviewResult: null }),
    ];

    it('tách riêng no_show (Bùng PV)/failed (Trượt PV), employed=null (chưa có nguồn dữ liệu)', async () => {
      prisma.lead.count.mockResolvedValue(20); // new_leads
      prisma.account.findMany.mockResolvedValue([{ id: 'sale-a' }]); // resolveSaleAccountIdsInScope (admin)
      prisma.shuttleRecord.findMany.mockResolvedValue(SHUTTLE_ROWS);

      const result = await service.getSummary({}, adminUser);

      expect(result.kpi).toEqual({
        new_leads: 20,
        interview_scheduled: 12,
        attended: 9,
        no_show: 3,
        passed: 4,
        failed: 2,
        employed: null,
        schedule_rate: 60,
        attend_rate: 45,
        pass_rate: 20,
        employed_rate: null,
        performance_rate: null,
      });
      expect(prisma.shuttleRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ saleUserId: { in: ['sale-a'] } }),
        }),
      );
    });

    it('"Hẹn lại"/để trống Tình trạng KHÔNG tính vào attended lẫn no_show (vẫn tính vào interview_scheduled)', async () => {
      prisma.lead.count.mockResolvedValue(5);
      prisma.account.findMany.mockResolvedValue([{ id: 'sale-a' }]);
      prisma.shuttleRecord.findMany.mockResolvedValue([
        { status: 'Hẹn lại', interviewResult: null },
        { status: null, interviewResult: null },
      ]);

      const result = await service.getSummary({}, adminUser);

      expect(result.kpi.interview_scheduled).toBe(2);
      expect(result.kpi.attended).toBe(0);
      expect(result.kpi.no_show).toBe(0);
    });

    it('MKT không có tên Sale nào (không phải Sale) → 5 chỉ số Shuttle đều 0, không cần gọi shuttleRecord', async () => {
      prisma.lead.count.mockResolvedValue(5);
      const result = await service.getSummary({}, mktUser);
      expect(result.kpi.interview_scheduled).toBe(0);
      expect(prisma.shuttleRecord.findMany).not.toHaveBeenCalled();
    });

    it('lọc theo Nguồn (source_id) → 5 chỉ số Shuttle-based về 0 (yêu cầu trực tiếp người dùng)', async () => {
      prisma.lead.count.mockResolvedValue(20);
      prisma.account.findMany.mockResolvedValue([{ id: 'sale-a' }]);
      prisma.shuttleRecord.findMany.mockResolvedValue(SHUTTLE_ROWS);

      const result = await service.getSummary(
        { source_id: 'src-fb' },
        adminUser,
      );

      expect(result.kpi.interview_scheduled).toBe(0);
      expect(result.kpi.attended).toBe(0);
      expect(result.kpi.no_show).toBe(0);
      expect(result.kpi.passed).toBe(0);
      expect(result.kpi.failed).toBe(0);
      expect(result.kpi.new_leads).toBe(20); // new_leads KHÔNG bị ảnh hưởng — vẫn lọc Nguồn bình thường
      expect(prisma.shuttleRecord.findMany).not.toHaveBeenCalled();
    });

    it('kpi_previous = null nếu chưa chọn khoảng ngày (không có gì để so sánh)', async () => {
      const result = await service.getSummary({}, adminUser);
      expect(result.kpi_previous).toBeNull();
    });

    it('kpi_previous tính trên khoảng liền trước, độ dài bằng khoảng đã lọc', async () => {
      prisma.lead.count.mockResolvedValue(20);
      const result = await service.getSummary(
        {
          date_from: '2026-07-08T00:00:00.000Z',
          date_to: '2026-07-14T23:59:59.999Z',
        },
        adminUser,
      );
      expect(result.kpi_previous).not.toBeNull();
      expect(result.kpi_previous?.new_leads).toBe(20);
    });
  });

  describe('Bảo mật: account_id/source_id (bộ lọc Nhân viên/Nguồn mới của Dashboard)', () => {
    it('Sale không lọc được theo nhân viên khác (số liệu chung toàn công ty)', async () => {
      await service.getSummary({ account_id: 'sale-OTHER' }, saleUser);
      const call = prisma.lead.groupBy.mock.calls[0][0];
      expect(call.where.assignedToId).toBeUndefined();
    });

    it('Admin dùng account_id để thu hẹp đúng 1 Sale', async () => {
      await service.getSummary({ account_id: 'sale-9' }, adminUser);
      const call = prisma.lead.groupBy.mock.calls[0][0];
      expect(call.where.assignedToId).toBe('sale-9');
    });

    it('source_id thu hẹp theo đúng 1 nguồn, mọi vai trò', async () => {
      await service.getSummary({ source_id: 'src-fb' }, adminUser);
      const call = prisma.lead.groupBy.mock.calls[0][0];
      expect(call.where.sourceId).toBe('src-fb');
    });
  });

  describe('getPerformance — bổ sung avatar_url/team_id/kpi + lọc account_id/source_id', () => {
    it('trả về avatar_url/team_id/kpi cho từng Sale', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'sale-9',
          fullName: 'Nguyễn Văn A',
          avatarUrl: '/uploads/avatars/a.jpg',
          teamId: 'team-1',
        },
      ]);
      const result = await service.getPerformance({}, adminUser);
      expect(result[0]).toMatchObject({
        account_id: 'sale-9',
        avatar_url: '/uploads/avatars/a.jpg',
        team_id: 'team-1',
      });
      expect(result[0].kpi).toBeDefined();
    });

    it('account_id thu hẹp danh sách Sale còn đúng 1 người', async () => {
      await service.getPerformance({ account_id: 'sale-9' }, adminUser);
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'sale-9' }),
        }),
      );
    });
  });
});
