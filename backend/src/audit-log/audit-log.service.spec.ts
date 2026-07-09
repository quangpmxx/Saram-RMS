import { Test } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: { auditLog: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { auditLog: { create: jest.fn() } };

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
});
