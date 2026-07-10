import { Test } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: {
    auditLog: { create: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((queries: unknown[]) =>
        Promise.all(queries as Promise<unknown>[]),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(AuditLogService);
  });

  it('ghi đúng dữ liệu vào bảng audit_logs', async () => {
    prisma.auditLog.create.mockResolvedValue({});

    await service.log({
      accountId: 'acc-1',
      actionType: 'login',
      entityType: 'account',
      entityId: 'acc-1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        accountId: 'acc-1',
        actionType: 'login',
        entityType: 'account',
        entityId: 'acc-1',
        fieldChanged: undefined,
        oldValue: undefined,
        newValue: undefined,
      },
    });
  });

  it('không ném lỗi ra ngoài nếu ghi log thất bại (không được chặn nghiệp vụ chính)', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('DB down'));

    await expect(
      service.log({
        accountId: 'acc-1',
        actionType: 'login',
        entityType: 'account',
      }),
    ).resolves.toBeUndefined();
  });

  describe('list — Mục 9, docs/13-api-design.md (GET /audit-log)', () => {
    it('áp dụng đúng bộ lọc account_id/action_type/entity_type/entity_id', async () => {
      await service.list({
        page: 1,
        page_size: 20,
        account_id: 'acc-1',
        action_type: 'update',
        entity_type: 'lead',
        entity_id: 'lead-1',
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'acc-1',
            actionType: 'update',
            entityType: 'lead',
            entityId: 'lead-1',
          }),
        }),
      );
    });

    it('lọc theo khoảng thời gian khi có date_from/date_to', async () => {
      await service.list({
        page: 1,
        page_size: 20,
        date_from: '2026-07-01',
        date_to: '2026-07-10',
      });

      const call = prisma.auditLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toEqual(new Date('2026-07-01'));
      expect(call.where.createdAt.lte).toEqual(new Date('2026-07-10'));
    });

    it('phân trang đúng theo page/page_size, sắp xếp mới nhất trước', async () => {
      await service.list({ page: 2, page_size: 10 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('ánh xạ đúng đối tượng AuditLog (Mục 0.1, docs/13) — account mở rộng thành {id, name}', async () => {
      prisma.auditLog.count.mockResolvedValue(1);
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          account: { id: 'acc-1', fullName: 'Quản trị viên' },
          actionType: 'login',
          entityType: 'account',
          entityId: 'acc-1',
          fieldChanged: null,
          oldValue: null,
          newValue: null,
          createdAt: new Date('2026-07-10T10:00:00.000Z'),
        },
      ]);

      const result = await service.list({ page: 1, page_size: 20 });

      expect(result).toEqual({
        total: 1,
        page: 1,
        page_size: 20,
        items: [
          {
            id: 'log-1',
            account: { id: 'acc-1', name: 'Quản trị viên' },
            action_type: 'login',
            entity_type: 'account',
            entity_id: 'acc-1',
            field_changed: null,
            old_value: null,
            new_value: null,
            created_at: '2026-07-10T10:00:00.000Z',
          },
        ],
      });
    });
  });
});
