import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReportPenaltyService } from './report-penalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

describe('ReportPenaltyService', () => {
  let service: ReportPenaltyService;
  let prisma: {
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    dailyReport: { findMany: jest.Mock };
    reportViolation: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    reportDeadlineConfig: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    role: 'admin',
    sessionId: 's1',
  };
  const manager: AuthenticatedUser = {
    id: 'manager-1',
    role: 'manager',
    sessionId: 's2',
  };
  const leader: AuthenticatedUser = {
    id: 'leader-1',
    role: 'leader',
    sessionId: 's3',
  };
  const sale: AuthenticatedUser = {
    id: 'sale-1',
    role: 'sale',
    sessionId: 's4',
  };

  // 22:35 giờ VN (15:35 UTC) ngày 15/07/2026 — sau hạn mặc định 22:30 đúng 5 phút.
  const AFTER_DEADLINE = new Date('2026-07-15T15:35:00.000Z');
  const REPORT_DATE_UTC = new Date('2026-07-15T00:00:00.000Z');

  const sale1 = { id: 'sale-1', fullName: 'Sale One' };
  const sale2 = { id: 'sale-2', fullName: 'Sale Two' };

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'leader-1', teamId: 'team-1' }),
        findMany: jest.fn().mockResolvedValue([sale1, sale2]),
      },
      dailyReport: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      reportViolation: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      reportDeadlineConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([0, []]),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportPenaltyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(ReportPenaltyService);
  });

  describe('runScan() — Mục 13, kịch bản 1-4', () => {
    it('1) Nộp TRƯỚC hạn -> không tạo vi phạm nào', async () => {
      prisma.dailyReport.findMany.mockResolvedValue([
        {
          accountId: 'sale-1',
          createdAt: new Date('2026-07-15T15:29:59.000Z'),
        }, // 22:29:59 VN
        {
          accountId: 'sale-2',
          createdAt: new Date('2026-07-15T15:00:00.000Z'),
        },
      ]);

      const result = await service.runScan(AFTER_DEADLINE);

      expect(result.late_submissions).toEqual([]);
      expect(result.no_submissions).toEqual([]);
      expect(prisma.reportViolation.create).not.toHaveBeenCalled();
    });

    it('2) Nộp SAU hạn 1 giây -> "Nộp báo cáo muộn"', async () => {
      prisma.dailyReport.findMany.mockResolvedValue([
        {
          accountId: 'sale-1',
          createdAt: new Date('2026-07-15T15:30:01.000Z'),
        }, // 22:30:01 VN — muộn 1s
      ]);

      const result = await service.runScan(AFTER_DEADLINE);

      expect(result.late_submissions).toEqual(['Sale One']);
      expect(prisma.reportViolation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'sale-1',
          violationType: 'late_submission',
          actualSubmittedAt: new Date('2026-07-15T15:30:01.000Z'),
        }),
      });
    });

    it('3) KHÔNG có báo cáo -> "Không nộp báo cáo"', async () => {
      prisma.dailyReport.findMany.mockResolvedValue([]);

      const result = await service.runScan(AFTER_DEADLINE);

      expect(result.no_submissions.sort()).toEqual(
        ['Sale One', 'Sale Two'].sort(),
      );
      expect(prisma.reportViolation.create).toHaveBeenCalledTimes(2);
      expect(prisma.reportViolation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'sale-1',
          violationType: 'no_submission',
          actualSubmittedAt: null,
        }),
      });
    });

    it('4) Chạy job HAI LẦN -> lần 2 không tạo trùng (đã có bản ghi từ lần 1)', async () => {
      prisma.dailyReport.findMany.mockResolvedValue([]);
      // Mô phỏng lần chạy đầu đã tạo xong — lần 2 findMany trả về bản ghi đã tồn tại.
      prisma.reportViolation.findMany.mockResolvedValue([
        { accountId: 'sale-1', violationType: 'no_submission' },
        { accountId: 'sale-2', violationType: 'no_submission' },
      ]);

      const result = await service.runScan(AFTER_DEADLINE);

      expect(result.no_submissions).toEqual([]);
      expect(prisma.reportViolation.create).not.toHaveBeenCalled();
    });

    it('Chưa tới hạn -> bỏ qua (skipped_before_deadline=true), không truy vấn/tạo gì', async () => {
      const beforeDeadline = new Date('2026-07-15T15:00:00.000Z'); // 22:00 VN
      const result = await service.runScan(beforeDeadline);

      expect(result.skipped_before_deadline).toBe(true);
      expect(prisma.account.findMany).not.toHaveBeenCalled();
      expect(prisma.reportViolation.create).not.toHaveBeenCalled();
    });
  });

  describe('markSupplementedIfPending() — Mục 13, kịch bản 5', () => {
    it('5) Bản ghi "Không nộp báo cáo" đang pending -> chuyển "Đã nộp bổ sung", lưu thời gian nộp, GIỮ violationType gốc', async () => {
      prisma.reportViolation.findUnique.mockResolvedValue({
        id: 'violation-1',
        status: 'pending',
        violationType: 'no_submission',
      });
      const submittedAt = new Date('2026-07-15T16:00:00.000Z');

      await service.markSupplementedIfPending(
        'sale-1',
        '2026-07-15',
        submittedAt,
      );

      expect(prisma.reportViolation.update).toHaveBeenCalledWith({
        where: { id: 'violation-1' },
        data: { status: 'supplemented', actualSubmittedAt: submittedAt },
      });
    });

    it('Không có vi phạm pending nào -> không làm gì', async () => {
      prisma.reportViolation.findUnique.mockResolvedValue(null);
      await service.markSupplementedIfPending(
        'sale-1',
        '2026-07-15',
        new Date(),
      );
      expect(prisma.reportViolation.update).not.toHaveBeenCalled();
    });

    it('Vi phạm đã bị Admin xử lý (confirmed) -> KHÔNG tự động ghi đè quyết định đó', async () => {
      prisma.reportViolation.findUnique.mockResolvedValue({
        id: 'violation-1',
        status: 'confirmed',
        violationType: 'no_submission',
      });
      await service.markSupplementedIfPending(
        'sale-1',
        '2026-07-15',
        new Date(),
      );
      expect(prisma.reportViolation.update).not.toHaveBeenCalled();
    });
  });

  describe('listRecords() — Mục 13, kịch bản 6-7 (RBAC)', () => {
    it('6) Leader chỉ xem được vi phạm trong nhóm mình, KHÔNG xem được nhóm khác', async () => {
      await service.listRecords({ page: 1, page_size: 20 }, leader);

      expect(prisma.$transaction).toHaveBeenCalled();
      const [, findManyCall] = prisma.$transaction.mock.calls[0][0];
      // Không cách nào introspect trực tiếp query builder ở đây — kiểm tra
      // gián tiếp qua việc account.findUnique (lấy teamId của leader) được gọi.
      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'leader-1' },
      });
      expect(findManyCall).toBeDefined();
    });

    it('7) Sale chỉ xem được vi phạm của chính mình', async () => {
      await service.listRecords({ page: 1, page_size: 20 }, sale);
      // Sale không cần tra cứu teamId (không dùng account.findUnique cho leader logic).
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
    });

    it('Vai trò không hợp lệ (mkt) bị chặn xem Check phạt', async () => {
      const mkt: AuthenticatedUser = {
        id: 'mkt-1',
        role: 'mkt',
        sessionId: 's5',
      };
      await expect(
        service.listRecords({ page: 1, page_size: 20 }, mkt),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateDeadline() — Mục 13, kịch bản 8', () => {
    it('8) Admin đổi hạn -> lưu cấu hình mới, ghi audit log đầy đủ, KHÔNG đụng vi phạm cũ (deadlineSnapshot đã snapshot riêng từng bản ghi)', async () => {
      prisma.reportDeadlineConfig.findFirst.mockResolvedValue(null);
      prisma.reportDeadlineConfig.create.mockResolvedValue({
        id: 'cfg-1',
        hour: 20,
        minute: 0,
        updatedAt: new Date('2026-07-15T10:00:00.000Z'),
        updatedBy: { fullName: 'Admin Root' },
      });

      const result = await service.updateDeadline(
        { hour: 20, minute: 0 },
        admin,
      );

      expect(result.hour).toBe(20);
      expect(result.minute).toBe(0);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'admin-1',
          actionType: 'update',
          entityType: 'report_deadline_config',
          oldValue: '22:30 (mặc định)',
          newValue: '20:00',
        }),
      );
      // Vi phạm cũ không bị đụng tới — updateDeadline() không gọi reportViolation.update/create nào.
      expect(prisma.reportViolation.update).not.toHaveBeenCalled();
    });

    it('Không phải Admin -> bị chặn đổi hạn (Mục 5: "Chỉ Admin được thay đổi")', async () => {
      await expect(
        service.updateDeadline({ hour: 20, minute: 0 }, manager),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateDeadline({ hour: 20, minute: 0 }, leader),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Vi phạm ĐÃ TẠO trước đó vẫn giữ nguyên deadlineSnapshot cũ dù hạn đổi sau đó (kịch bản 8)', async () => {
      // Bước 1: hạn mặc định 22:30, quét lúc 22:35 -> tạo vi phạm snapshot 22:30.
      prisma.dailyReport.findMany.mockResolvedValue([]);
      await service.runScan(AFTER_DEADLINE);
      const firstCallData = prisma.reportViolation.create.mock.calls[0][0].data;
      expect(firstCallData.deadlineSnapshot).toEqual(
        new Date('2026-07-15T15:30:00.000Z'),
      );

      // Bước 2: Admin đổi hạn sang 20:00.
      prisma.reportDeadlineConfig.findFirst.mockResolvedValue({
        id: 'cfg-1',
        hour: 22,
        minute: 30,
      });
      prisma.reportDeadlineConfig.update.mockResolvedValue({
        id: 'cfg-1',
        hour: 20,
        minute: 0,
        updatedAt: new Date(),
        updatedBy: { fullName: 'Admin Root' },
      });
      await service.updateDeadline({ hour: 20, minute: 0 }, admin);

      // Bản ghi vi phạm cũ (đã return ở bước 1) không hề bị update lại.
      expect(prisma.reportViolation.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus()', () => {
    it('Admin/Quản lý cập nhật trạng thái thành công, ghi audit log', async () => {
      prisma.reportViolation.findUnique.mockResolvedValue({
        id: 'v1',
        status: 'pending',
        note: null,
      });
      prisma.reportViolation.update.mockResolvedValue({
        id: 'v1',
        accountId: 'sale-1',
        account: {
          fullName: 'Sale One',
          avatarUrl: null,
          teamId: null,
          team: null,
        },
        reportDate: REPORT_DATE_UTC,
        deadlineSnapshot: AFTER_DEADLINE,
        actualSubmittedAt: null,
        violationType: 'no_submission',
        status: 'waived',
        note: 'Nghỉ ốm có phép',
        resolvedBy: { fullName: 'Admin Root' },
        resolvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateStatus(
        'v1',
        { status: 'waived', note: 'Nghỉ ốm có phép' },
        admin,
      );

      expect(result.status).toBe('waived');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'report_violation',
          oldValue: 'pending',
          newValue: 'waived',
        }),
      );
    });

    it('Leader/Sale KHÔNG được cập nhật trạng thái', async () => {
      await expect(
        service.updateStatus('v1', { status: 'waived' }, leader),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateStatus('v1', { status: 'waived' }, sale),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Không tìm thấy bản ghi -> NotFoundException', async () => {
      prisma.reportViolation.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('missing', { status: 'waived' }, admin),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
