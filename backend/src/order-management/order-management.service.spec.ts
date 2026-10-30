import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderManagementService } from './order-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('OrderManagementService.remove (rà soát 2026-10-30: chặn xoá đơn đang dùng)', () => {
  let service: OrderManagementService;
  let prisma: {
    orderRecord: { findUnique: jest.Mock; delete: jest.Mock };
    shuttleRecord: { count: jest.Mock };
    salesEntryRecord: { count: jest.Mock };
  };
  let auditLog: { log: jest.Mock };
  const admin = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };

  beforeEach(async () => {
    prisma = {
      orderRecord: { findUnique: jest.fn(), delete: jest.fn() },
      shuttleRecord: { count: jest.fn().mockResolvedValue(0) },
      salesEntryRecord: { count: jest.fn().mockResolvedValue(0) },
    };
    auditLog = { log: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        OrderManagementService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    service = module.get(OrderManagementService);
  });

  it('đơn không tồn tại → 404', async () => {
    prisma.orderRecord.findUnique.mockResolvedValue(null);
    await expect(service.remove('o1', admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('đơn đang được dùng → 409 kèm số dòng, không xoá', async () => {
    prisma.orderRecord.findUnique.mockResolvedValue({ id: 'o1', name: 'ABC' });
    prisma.shuttleRecord.count.mockResolvedValue(3);
    prisma.salesEntryRecord.count.mockResolvedValue(2);

    const error = await service.remove('o1', admin).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toContain('3 dòng Đưa đón');
    expect((error as ConflictException).message).toContain('2 dòng DS Sale');
    expect(prisma.orderRecord.delete).not.toHaveBeenCalled();
    expect(prisma.shuttleRecord.count).toHaveBeenCalledWith({
      where: { companyId: 'o1', deletedAt: null },
    });
  });

  it('đơn không ai dùng → xoá và ghi audit', async () => {
    prisma.orderRecord.findUnique.mockResolvedValue({ id: 'o1', name: 'ABC' });

    await service.remove('o1', admin);

    expect(prisma.orderRecord.delete).toHaveBeenCalledWith({
      where: { id: 'o1' },
    });
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'delete', oldValue: 'ABC' }),
    );
  });
});
