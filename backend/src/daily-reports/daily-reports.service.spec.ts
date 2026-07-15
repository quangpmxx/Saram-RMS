import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DailyReportsService } from './daily-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ReportPenaltyService } from '../report-penalty/report-penalty.service';

describe('DailyReportsService', () => {
  let service: DailyReportsService;
  let prisma: {
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    dailyReport: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    lead: { groupBy: jest.Mock; count: jest.Mock };
  };
  let auditLog: { log: jest.Mock };

  // 17:00 giờ VN (10:00 UTC) ngày 14/07/2026 — luôn nằm trong "ngày 14/07" ở
  // cả UTC lẫn Asia/Ho_Chi_Minh, tránh test bị lệch ngày do đổi timezone.
  const NOW = new Date('2026-07-14T10:00:00.000Z');

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

  const upsertDto = {
    calls: 10,
    old_data: 2,
    no_answer: 1,
    interested: 3,
    interview_scheduled: 2,
    interview_passed: 1,
    employed: 0,
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    prisma = {
      account: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyReport: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      lead: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    const reportPenaltyService = {
      markSupplementedIfPending: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: ReportPenaltyService, useValue: reportPenaltyService },
      ],
    }).compile();

    service = moduleRef.get(DailyReportsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('list — Mục 3, phạm vi theo vai trò', () => {
    it('1) Nhân viên chưa có báo cáo hôm nay → 1 dòng status=not_reported, report_id=null', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          fullName: 'Sale One',
          avatarUrl: null,
          role: 'sale',
          teamId: 'team-1',
          team: { id: 'team-1', name: 'Nhóm 1' },
        },
      ]);

      const rows = await service.list({}, saleUser);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        date: '2026-07-14',
        report_id: null,
        status: 'not_reported',
        calls: 0,
        new_leads: 0,
      });
    });

    it('6) Leader chỉ thấy Sale trong đúng nhóm mình, bỏ qua team_id truyền vào', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      await service.list({ team_id: 'team-OTHER' }, leaderUser);
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'sale', teamId: 'team-1' }),
        }),
      );
    });

    it('7) Admin thấy toàn bộ khi không truyền team_id/account_id', async () => {
      await service.list({}, adminUser);
      const call = prisma.account.findMany.mock.calls[0][0];
      expect(call.where.teamId).toBeUndefined();
      expect(call.where.id).toBeUndefined();
    });

    it('8a) Admin lọc theo team_id/account_id', async () => {
      await service.list(
        { team_id: 'team-9', account_id: 'sale-9' },
        adminUser,
      );
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teamId: 'team-9', id: 'sale-9' }),
        }),
      );
    });

    it('8b) Sale bị khóa cứng chỉ chính mình, bỏ qua team_id/account_id truyền vào', async () => {
      await service.list(
        { team_id: 'team-X', account_id: 'sale-OTHER' },
        saleUser,
      );
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sale-1', role: 'sale' } }),
      );
    });

    it('8c) Bộ lọc ngày — date_from/date_to xác định đúng khoảng ngày liệt kê', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          fullName: 'A',
          avatarUrl: null,
          role: 'sale',
          teamId: null,
          team: null,
        },
      ]);
      const rows = await service.list(
        { date_from: '2026-07-10', date_to: '2026-07-12' },
        adminUser,
      );
      const dates = [...new Set(rows.map((r) => r.date))].sort();
      expect(dates).toEqual(['2026-07-10', '2026-07-11', '2026-07-12']);
    });

    it('MKT không có quyền xem', async () => {
      await expect(service.list({}, mktUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('Manager thấy toàn bộ giống Admin', async () => {
      await service.list({}, managerUser);
      const call = prisma.account.findMany.mock.calls[0][0];
      expect(call.where.teamId).toBeUndefined();
    });
  });

  describe('create — Mục 2, yêu cầu người dùng', () => {
    it('2) Nhân viên tạo báo cáo lần đầu — thành công, ghi audit log', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'sale-1',
        fullName: 'Sale One',
        avatarUrl: null,
        role: 'sale',
        teamId: 'team-1',
      });
      prisma.dailyReport.create.mockResolvedValue({
        id: 'report-1',
        date: new Date('2026-07-14T00:00:00.000Z'),
        accountId: 'sale-1',
        teamId: 'team-1',
        ...camelizeDto(upsertDto),
        createdAt: NOW,
        updatedAt: NOW,
        createdBy: { id: 'sale-1', fullName: 'Sale One', role: 'sale' },
        updatedBy: { id: 'sale-1', fullName: 'Sale One', role: 'sale' },
      });

      const result = await service.create(upsertDto, saleUser);

      expect(prisma.dailyReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'sale-1',
            calls: 10,
            oldData: 2,
          }),
        }),
      );
      expect(result.status).toBe('reported');
      expect(result.report_id).toBe('report-1');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'create',
          entityType: 'daily_report',
        }),
      );
    });

    it('4) Chặn tạo báo cáo trùng ngày cho cùng nhân viên', async () => {
      prisma.dailyReport.findUnique.mockResolvedValue({
        id: 'existing-report',
      });
      await expect(service.create(upsertDto, saleUser)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.dailyReport.create).not.toHaveBeenCalled();
    });

    it('chỉ Sale được tạo — Admin/Leader/MKT bị từ chối', async () => {
      await expect(service.create(upsertDto, adminUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.create(upsertDto, leaderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update — Mục 2, yêu cầu người dùng', () => {
    it('3) Nhân viên sửa báo cáo của chính mình trong đúng ngày — thành công', async () => {
      prisma.dailyReport.findUnique.mockResolvedValue({
        id: 'report-1',
        accountId: 'sale-1',
        date: new Date('2026-07-14T00:00:00.000Z'),
      });
      prisma.account.findUnique.mockResolvedValue({
        id: 'sale-1',
        fullName: 'Sale One',
        avatarUrl: null,
        role: 'sale',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Nhóm 1' },
      });
      prisma.dailyReport.update.mockResolvedValue({
        id: 'report-1',
        date: new Date('2026-07-14T00:00:00.000Z'),
        accountId: 'sale-1',
        teamId: 'team-1',
        ...camelizeDto({ ...upsertDto, calls: 20 }),
        createdAt: NOW,
        updatedAt: NOW,
        createdBy: { id: 'sale-1', fullName: 'Sale One', role: 'sale' },
        updatedBy: { id: 'sale-1', fullName: 'Sale One', role: 'sale' },
      });

      const result = await service.update(
        'report-1',
        { ...upsertDto, calls: 20 },
        saleUser,
      );

      expect(result.calls).toBe(20);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          entityType: 'daily_report',
        }),
      );
    });

    it('không cho sửa báo cáo của người khác', async () => {
      prisma.dailyReport.findUnique.mockResolvedValue({
        id: 'report-1',
        accountId: 'sale-OTHER',
        date: new Date('2026-07-14T00:00:00.000Z'),
      });
      await expect(
        service.update('report-1', upsertDto, saleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('không cho sửa báo cáo của ngày khác (không phải hôm nay)', async () => {
      prisma.dailyReport.findUnique.mockResolvedValue({
        id: 'report-1',
        accountId: 'sale-1',
        date: new Date('2026-07-10T00:00:00.000Z'),
      });
      await expect(
        service.update('report-1', upsertDto, saleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('báo lỗi NotFoundException nếu không tìm thấy báo cáo', async () => {
      prisma.dailyReport.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', upsertDto, saleUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('5) Data mới tự động đúng — tính từ Lead.uploadedAt, không cho nhập tay', () => {
    it('list(): new_leads lấy đúng từ lead.groupBy theo từng ngày', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          fullName: 'A',
          avatarUrl: null,
          role: 'sale',
          teamId: null,
          team: null,
        },
      ]);
      prisma.lead.groupBy.mockResolvedValue([
        { assignedToId: 'sale-1', _count: { _all: 7 } },
      ]);

      const rows = await service.list({}, saleUser);

      expect(rows[0].new_leads).toBe(7);
      expect(prisma.lead.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: { in: ['sale-1'] },
            deletedAt: null,
          }),
        }),
      );
    });

    it('create(): new_leads lấy từ lead.count đúng ngày hôm nay', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'sale-1',
        fullName: 'Sale One',
        avatarUrl: null,
        role: 'sale',
        teamId: null,
      });
      prisma.dailyReport.create.mockResolvedValue({
        id: 'report-1',
        date: new Date('2026-07-14T00:00:00.000Z'),
        accountId: 'sale-1',
        teamId: null,
        ...camelizeDto(upsertDto),
        createdAt: NOW,
        updatedAt: NOW,
        createdBy: { id: 'sale-1', fullName: 'Sale One', role: 'sale' },
        updatedBy: { id: 'sale-1', fullName: 'Sale One', role: 'sale' },
      });
      prisma.lead.count.mockResolvedValue(4);

      const result = await service.create(upsertDto, saleUser);

      expect(result.new_leads).toBe(4);
      expect(prisma.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: 'sale-1',
            deletedAt: null,
          }),
        }),
      );
    });
  });
});

/** Đổi 7 field snake_case (request DTO) sang camelCase (Prisma model) cho mock trả về. */
function camelizeDto(dto: {
  calls: number;
  old_data: number;
  no_answer: number;
  interested: number;
  interview_scheduled: number;
  interview_passed: number;
  employed: number;
}) {
  return {
    calls: dto.calls,
    oldData: dto.old_data,
    noAnswer: dto.no_answer,
    interested: dto.interested,
    interviewScheduled: dto.interview_scheduled,
    interviewPassed: dto.interview_passed,
    employed: dto.employed,
  };
}
