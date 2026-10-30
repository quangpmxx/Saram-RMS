import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SalesEntryService } from './sales-entry.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';

describe('SalesEntryService (rà soát 2026-10-30: xoá mềm, phạm vi xoá, giữ Sale)', () => {
  let service: SalesEntryService;
  let prisma: {
    salesEntryRecord: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    account: { findFirst: jest.Mock; findUnique: jest.Mock };
    team: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let realtime: { emitSalesEntryChange: jest.Mock };

  const admin = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };
  const sale = { id: 'sale-1', role: 'sale' as const, sessionId: 's' };
  const leader = { id: 'leader-1', role: 'leader' as const, sessionId: 's' };

  beforeEach(async () => {
    prisma = {
      salesEntryRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      account: { findFirst: jest.fn(), findUnique: jest.fn() },
      team: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn() };
    realtime = { emitSalesEntryChange: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SalesEntryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();
    service = module.get(SalesEntryService);
  });

  describe('deleteRows', () => {
    it('xoá mềm (không deleteMany), chỉ phát realtime + audit cho id thật sự xoá', async () => {
      // Yêu cầu xoá 3 id, nhưng chỉ 'a' nằm trong phạm vi của Sale.
      prisma.salesEntryRecord.findMany.mockResolvedValue([
        { id: 'a', employeeCode: 'E1', fullName: 'Nguyễn A' },
      ]);
      prisma.salesEntryRecord.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteRows(['a', 'b', 'c'], sale);

      expect(result).toEqual({ deleted: 1 });
      expect(prisma.salesEntryRecord.deleteMany).not.toHaveBeenCalled();
      expect(prisma.salesEntryRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['a', 'b', 'c'] },
            saleUserId: 'sale-1',
            deletedAt: null,
          }),
        }),
      );
      expect(prisma.salesEntryRecord.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a'] }, deletedAt: null },
        data: { deletedAt: expect.any(Date), deletedById: 'sale-1' },
      });
      expect(realtime.emitSalesEntryChange).toHaveBeenCalledTimes(1);
      expect(realtime.emitSalesEntryChange).toHaveBeenCalledWith(
        'deleted',
        { id: 'a' },
        sale,
      );
      expect(auditLog.log).toHaveBeenCalledTimes(1);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'delete',
          entityId: 'a',
          oldValue: 'Nguyễn A',
        }),
      );
    });

    it('Leader có nhóm: xoá được dòng của Sale trong nhóm HOẶC dòng chưa gán do chính mình tạo', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.salesEntryRecord.findMany.mockResolvedValue([]);

      await service.deleteRows(['a'], leader);

      expect(prisma.salesEntryRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['a'] },
            deletedAt: null,
            OR: [
              { saleUser: { teamId: 'team-1' } },
              { saleUserId: null, createdById: 'leader-1' },
            ],
          }),
        }),
      );
    });

    it('Leader chưa có nhóm: chỉ xoá được dòng chưa gán do chính mình tạo', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: null });
      prisma.salesEntryRecord.findMany.mockResolvedValue([]);

      await service.deleteRows(['a'], leader);

      expect(prisma.salesEntryRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ saleUserId: null, createdById: 'leader-1' }],
          }),
        }),
      );
    });

    it('Admin/Quản lý: không giới hạn phạm vi (không có OR/saleUserId), vẫn chỉ đụng dòng chưa xoá', async () => {
      prisma.salesEntryRecord.findMany.mockResolvedValue([]);

      await service.deleteRows(['a'], admin);

      const where = (
        prisma.salesEntryRecord.findMany.mock.calls[0] as [
          { where: Record<string, unknown> },
        ]
      )[0].where;
      expect(where.OR).toBeUndefined();
      expect(where.saleUserId).toBeUndefined();
      expect(where.deletedAt).toBeNull();
    });

    it('không có dòng nào trong phạm vi → không ghi, không phát sự kiện', async () => {
      prisma.salesEntryRecord.findMany.mockResolvedValue([]);

      const result = await service.deleteRows(['x'], sale);

      expect(result).toEqual({ deleted: 0 });
      expect(prisma.salesEntryRecord.updateMany).not.toHaveBeenCalled();
      expect(realtime.emitSalesEntryChange).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('luôn loại dòng đã xoá mềm', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);
      prisma.salesEntryRecord.count.mockReturnValue('count');
      prisma.salesEntryRecord.findMany.mockReturnValue('rows');

      await service.list({ page: 1, page_size: 20 }, admin);

      expect(prisma.salesEntryRecord.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ deletedAt: null }),
      });
    });
  });

  describe('updateRow', () => {
    const base = {
      id: 'row-1',
      saleUserId: 'sale-9',
      deletedAt: null,
    };

    it('dòng đã xoá mềm → 404', async () => {
      prisma.salesEntryRecord.findUnique.mockResolvedValue({
        ...base,
        deletedAt: new Date(),
      });

      await expect(
        service.updateRow('row-1', { full_name: 'A' }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.salesEntryRecord.update).not.toHaveBeenCalled();
    });

    it('request không gửi sale_user_id → giữ nguyên Sale cũ', async () => {
      prisma.salesEntryRecord.findUnique.mockResolvedValue(base);
      prisma.salesEntryRecord.update.mockResolvedValue({
        id: 'row-1',
      });

      await service
        .updateRow('row-1', { full_name: 'A' }, admin)
        .catch(() => undefined); // toDsSaleRowResponse cần quan hệ đầy đủ; chỉ kiểm dữ liệu ghi.

      expect(prisma.salesEntryRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ saleUserId: 'sale-9' }),
        }),
      );
    });

    it('gửi sale_user_id = null → bỏ gán có chủ ý', async () => {
      prisma.salesEntryRecord.findUnique.mockResolvedValue(base);
      prisma.salesEntryRecord.update.mockResolvedValue({ id: 'row-1' });

      await service
        .updateRow('row-1', { full_name: 'A', sale_user_id: null }, admin)
        .catch(() => undefined);

      expect(prisma.salesEntryRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ saleUserId: null }),
        }),
      );
    });
  });
});
