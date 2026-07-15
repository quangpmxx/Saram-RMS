import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AccountRole } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "mỗi khi sang 1 tháng mới thì
 * mỗi nhân viên sẽ được cộng dồn thêm 1 ngày nghỉ phép". Cùng nhóm vai trò
 * xuất hiện trên bảng chấm công — PHẢI khớp EMPLOYEE_ROLES ở
 * attendance.service.ts (không import chung — cùng quy ước redeclare hằng
 * số nhỏ theo từng module đã có sẵn trong dự án, ví dụ TIMEZONE lặp lại ở
 * cả sale-reminder.service.ts và daily-reports.service.ts).
 */
const EMPLOYEE_ROLES: AccountRole[] = ['leader', 'mkt', 'sale'];

/** Múi giờ hệ thống — công ty vận hành tại Việt Nam, cố định để job/độ lệch ngày luôn nhất quán bất kể server chạy ở múi giờ nào. */
const TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface LeaveAccrualRunResult {
  checked: number;
  accrued: string[];
}

/** "YYYY-MM" theo múi giờ TIMEZONE tại thời điểm `date` — dùng để so sánh "đã cộng phép tháng này chưa". */
function monthKeyInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).format(date); // en-CA -> "YYYY-MM" khi chỉ truyền year+month
}

@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Chạy HẰNG NGÀY lúc 00:15 (giờ Việt Nam) thay vì đúng 1 lần vào ngày 1
   * hằng tháng — CHỦ Ý: nếu chỉ đặt lịch đúng ngày 1, server tắt/lỗi đúng
   * lúc đó sẽ làm mất hẳn lượt cộng phép tháng đó (cron không tự bù). Chạy
   * hằng ngày + tự phát hiện "tháng đã đổi chưa" (so lastLeaveAccrualAt)
   * vừa đảm bảo không bao giờ bỏ sót tháng nào (tự bù khi server online
   * lại, dù trễ vài ngày), vừa không bao giờ cộng 2 lần trong cùng 1 tháng.
   */
  @Cron('15 0 * * *', { timeZone: TIMEZONE })
  async tick(): Promise<void> {
    try {
      const result = await this.runAccrual();
      this.logger.log(
        `Cộng dồn phép tháng: đã kiểm tra ${result.checked}, đã cộng ${result.accrued.length} (${result.accrued.join(', ') || 'không có'})`,
      );
    } catch (error) {
      this.logger.error('Cộng dồn phép tháng thất bại', error as Error);
    }
  }

  /** Tách riêng khỏi tick() để test/gọi thủ công được (dev), cùng mẫu với SaleReminderService.runCheck(). */
  async runAccrual(): Promise<LeaveAccrualRunResult> {
    const now = new Date();
    const currentMonth = monthKeyInTimezone(now, TIMEZONE);

    const employees = await this.prisma.account.findMany({
      where: { role: { in: EMPLOYEE_ROLES }, status: 'active' },
      select: {
        id: true,
        fullName: true,
        remainingLeaveDays: true,
        lastLeaveAccrualAt: true,
      },
    });

    const toAccrue = employees.filter((e) => {
      if (!e.lastLeaveAccrualAt) return true;
      return (
        monthKeyInTimezone(e.lastLeaveAccrualAt, TIMEZONE) !== currentMonth
      );
    });

    await Promise.all(
      toAccrue.map((e) =>
        this.prisma.account.update({
          where: { id: e.id },
          data: {
            remainingLeaveDays: (e.remainingLeaveDays ?? 0) + 1,
            lastLeaveAccrualAt: now,
          },
        }),
      ),
    );

    return {
      checked: employees.length,
      accrued: toAccrue.map((e) => e.fullName),
    };
  }
}
