import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CandidatesService } from './candidates.service';
import { describeLog, LeadActivityService } from './lead-activity.service';

const SALE = { id: 'acc-sale', role: 'sale', sessionId: 's1' } as const;
const LEAD_ID = '11111111-1111-1111-1111-111111111111';
const STATUS_A = '22222222-2222-2222-2222-222222222222';
const STATUS_B = '33333333-3333-3333-3333-333333333333';
const ACC_B = '44444444-4444-4444-4444-444444444444';

const person = (id: string, fullName: string, role = 'sale') => ({
  id,
  fullName,
  role,
});

describe('LeadActivityService', () => {
  let service: LeadActivityService;
  let prisma: {
    auditLog: { findFirst: jest.Mock; findMany: jest.Mock };
    lead: { findUniqueOrThrow: jest.Mock };
    leadNote: { findMany: jest.Mock };
    interviewAppointment: { findMany: jest.Mock };
    callbackSchedule: { findMany: jest.Mock };
    careAssignment: { findMany: jest.Mock };
    statusCatalog: { findMany: jest.Mock };
    account: { findMany: jest.Mock };
    leadSource: { findMany: jest.Mock };
  };
  let auditLog: { log: jest.Mock };
  let candidates: { findOne: jest.Mock };

  beforeEach(async () => {
    prisma = {
      auditLog: { findFirst: jest.fn(), findMany: jest.fn() },
      lead: { findUniqueOrThrow: jest.fn() },
      leadNote: { findMany: jest.fn().mockResolvedValue([]) },
      interviewAppointment: { findMany: jest.fn().mockResolvedValue([]) },
      callbackSchedule: { findMany: jest.fn().mockResolvedValue([]) },
      careAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      statusCatalog: { findMany: jest.fn().mockResolvedValue([]) },
      account: { findMany: jest.fn().mockResolvedValue([]) },
      leadSource: { findMany: jest.fn().mockResolvedValue([]) },
    };
    auditLog = { log: jest.fn() };
    candidates = { findOne: jest.fn().mockResolvedValue({ id: LEAD_ID }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadActivityService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: CandidatesService, useValue: candidates },
      ],
    }).compile();
    service = moduleRef.get(LeadActivityService);
  });

  describe('recordView', () => {
    it('ghi lượt truy cập khi chưa có lượt nào gần đây', async () => {
      prisma.auditLog.findFirst.mockResolvedValue(null);
      await expect(service.recordView(LEAD_ID, SALE)).resolves.toEqual({
        recorded: true,
      });
      expect(auditLog.log).toHaveBeenCalledWith({
        accountId: SALE.id,
        actionType: 'view',
        entityType: 'lead',
        entityId: LEAD_ID,
      });
    });

    it('không ghi thêm nếu vừa truy cập trong 5 phút', async () => {
      prisma.auditLog.findFirst.mockResolvedValue({ id: 'v1' });
      await expect(service.recordView(LEAD_ID, SALE)).resolves.toEqual({
        recorded: false,
      });
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('không có quyền xem data thì không ghi', async () => {
      candidates.findOne.mockRejectedValue(new ForbiddenException());
      await expect(service.recordView(LEAD_ID, SALE)).rejects.toThrow(
        ForbiddenException,
      );
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    beforeEach(() => {
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        uploadedAt: new Date('2026-10-29T01:00:00Z'),
        uploadedBy: person('acc-mkt', 'MKT Demo', 'mkt'),
      });
    });

    it('chặn người không có quyền xem data', async () => {
      candidates.findOne.mockRejectedValue(new ForbiddenException());
      await expect(service.list(LEAD_ID, SALE)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('gộp truy cập, thao tác, đợt giao chăm sóc; sắp mới nhất trước; đổi id thành tên', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'l2',
          actionType: 'update',
          entityType: 'lead',
          fieldChanged: 'call_status_id',
          oldValue: STATUS_A,
          newValue: STATUS_B,
          createdAt: new Date('2026-10-29T03:47:00Z'),
          account: person('acc-a', 'Sale A'),
        },
        {
          id: 'l1',
          actionType: 'view',
          entityType: 'lead',
          fieldChanged: null,
          oldValue: null,
          newValue: null,
          createdAt: new Date('2026-10-29T03:45:00Z'),
          account: person('acc-a', 'Sale A'),
        },
      ]);
      prisma.statusCatalog.findMany.mockResolvedValue([
        { id: STATUS_A, name: 'Chưa gọi' },
        { id: STATUS_B, name: 'Đã gọi' },
      ]);
      prisma.careAssignment.findMany.mockResolvedValue([
        {
          id: 'ca1',
          assignedAt: new Date('2026-10-29T02:00:00Z'),
          endedAt: new Date('2026-10-29T04:00:00Z'),
          endReason: 'revoked',
          assignee: person('acc-b', 'Sale B'),
          endedBy: person('acc-l', 'Leader', 'leader'),
          batch: {
            method: 'manual',
            createdBy: person('acc-l', 'Leader', 'leader'),
          },
        },
      ]);

      const { items } = await service.list(LEAD_ID, SALE);
      expect(items.map((i) => [i.kind, i.actor?.name, i.text])).toEqual([
        ['action', 'Leader', 'đã thu hồi chăm sóc của Sale B'],
        [
          'action',
          'Sale A',
          'đã cập nhật Tình trạng cuộc gọi: Chưa gọi → Đã gọi',
        ],
        ['view', 'Sale A', 'đã truy cập'],
        ['action', 'Leader', 'đã giao chăm sóc cho Sale B'],
        ['action', 'MKT Demo', 'đã nhập data'],
      ]);
    });

    it('có log tạo data thì không thêm dòng "đã nhập data" từ bản ghi', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'c1',
          actionType: 'create',
          entityType: 'lead',
          fieldChanged: null,
          oldValue: null,
          newValue: 'full_name=A',
          createdAt: new Date('2026-10-29T01:00:00Z'),
          account: person('acc-mkt', 'MKT Demo', 'mkt'),
        },
      ]);
      const { items } = await service.list(LEAD_ID, SALE);
      expect(items.map((i) => i.text)).toEqual(['đã tạo data']);
    });
  });
});

describe('describeLog', () => {
  const names = new Map([[ACC_B, 'Sale B']]);
  const log = (over: Partial<Parameters<typeof describeLog>[0]>) => ({
    actionType: 'update',
    entityType: 'lead',
    fieldChanged: null,
    oldValue: null,
    newValue: null,
    ...over,
  });

  it.each([
    [log({ actionType: 'hold', newValue: 'true' }), 'đã giữ số'],
    [log({ actionType: 'hold', newValue: 'false' }), 'đã bỏ giữ số'],
    [log({ actionType: 'assign', newValue: ACC_B }), 'đã giao data cho Sale B'],
    [
      log({ actionType: 'transfer', newValue: `${ACC_B} | reason: nghỉ phép` }),
      'đã chuyển data sang Sale B (lý do: nghỉ phép)',
    ],
    [
      log({ fieldChanged: 'note_color', newValue: 'green' }),
      'đã cập nhật Đánh dấu màu: (trống) → Xanh',
    ],
    [
      log({ fieldChanged: 'birth_year', oldValue: '1997', newValue: '1998' }),
      'đã cập nhật Năm sinh: 1997 → 1998',
    ],
    [
      log({
        fieldChanged: 'care_stopped_at',
        newValue: '2026-10-29T00:00:00Z',
      }),
      'đã dừng chăm sóc',
    ],
    [
      log({ fieldChanged: 'care_stopped_at', newValue: null }),
      'đã cho tiếp tục chăm sóc',
    ],
    [
      log({ fieldChanged: 'care_stop_request', newValue: 'requested' }),
      'đã đề nghị dừng chăm sóc',
    ],
    [
      log({
        entityType: 'lead_note',
        actionType: 'create',
        newValue: 'Gọi không nghe',
      }),
      'đã thêm ghi chú "Gọi không nghe"',
    ],
    [
      log({ entityType: 'lead_note', actionType: 'delete' }),
      'đã xóa 1 ghi chú',
    ],
    [
      log({
        entityType: 'callback_schedule',
        actionType: 'create',
        newValue: 'scheduled_at=2026-10-29T03:30:00.000Z',
      }),
      'đã đặt lịch gọi lại lúc 10:30 29/10/2026',
    ],
  ])('%o → %s', (input, expected) => {
    expect(describeLog(input, names)).toBe(expected);
  });
});
