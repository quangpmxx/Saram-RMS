import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  DATA_NOTIFICATION_TYPES,
  dataNotificationCutoff,
} from './notification-groups';

/**
 * Dọn thông báo nhóm "Data" của các ngày trước (yêu cầu người dùng 2026-11-01:
 * sang ngày mới là tự hết hạn, để dùng càng lâu càng không đầy rác). Danh sách
 * thông báo (GET /notification) đã tự ẩn các thông báo hết hạn này; tác vụ này
 * chỉ để xoá hẳn khỏi DB. Thông báo nhóm "Khác" không bị dọn.
 */
@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Chạy phút thứ 5 mỗi giờ (không chỉ 0 giờ) để nếu máy chủ tắt đúng lúc nửa
   * đêm thì lần chạy sau vẫn dọn bù. Lỗi chỉ ghi log, không làm hỏng tiến trình.
   */
  @Cron('5 * * * *')
  async tick(): Promise<void> {
    try {
      const removed = await this.purgeExpiredDataNotifications();
      if (removed > 0) {
        this.logger.log(`Đã dọn ${removed} thông báo Data của các ngày trước`);
      }
    } catch (error) {
      this.logger.error('Dọn thông báo Data hết hạn thất bại', error as Error);
    }
  }

  /** Xoá thông báo nhóm Data tạo trước 00:00 hôm nay (giờ VN); trả về số dòng đã xoá. */
  async purgeExpiredDataNotifications(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        type: { in: [...DATA_NOTIFICATION_TYPES] },
        createdAt: { lt: dataNotificationCutoff(now) },
      },
    });
    return result.count;
  }
}
