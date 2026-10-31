import { Test } from '@nestjs/testing';
import { NotificationCleanupService } from './notification-cleanup.service';
import { DATA_NOTIFICATION_TYPES } from './notification-groups';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationCleanupService', () => {
  let service: NotificationCleanupService;
  let prisma: { notification: { deleteMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      notification: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationCleanupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(NotificationCleanupService);
  });

  it('chỉ xoá thông báo nhóm Data tạo trước 00:00 hôm nay (giờ VN), trả về số dòng đã xoá', async () => {
    // 10:00 sáng 02/11/2026 giờ VN (= 03:00 UTC) → mốc 00:00 02/11 VN = 17:00 UTC 01/11.
    const removed = await service.purgeExpiredDataNotifications(
      new Date('2026-11-02T03:00:00.000Z'),
    );

    expect(removed).toBe(3);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        type: { in: [...DATA_NOTIFICATION_TYPES] },
        createdAt: { lt: new Date('2026-11-01T17:00:00.000Z') },
      },
    });
  });

  it('KHÔNG đụng thông báo nhóm Khác (điều kiện xoá luôn giới hạn theo loại Data)', async () => {
    await service.purgeExpiredDataNotifications();
    const args = prisma.notification.deleteMany.mock.calls[0] as [
      { where: { type: { in: string[] } } },
    ];
    expect(args[0].where.type.in).not.toContain('shuttle_update');
    expect(args[0].where.type.in).not.toContain('admin_message');
  });

  it('tick: lỗi DB chỉ ghi log, không ném ra ngoài (không làm sập tiến trình)', async () => {
    prisma.notification.deleteMany.mockRejectedValue(new Error('db down'));
    await expect(service.tick()).resolves.toBeUndefined();
  });

  it('tick: chạy bình thường khi không có gì để dọn', async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.tick()).resolves.toBeUndefined();
    expect(prisma.notification.deleteMany).toHaveBeenCalledTimes(1);
  });
});
