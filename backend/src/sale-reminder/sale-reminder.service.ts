import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dự án phụ — nâng cấp toàn diện (ngoài phạm vi Design Freeze docs/09-13):
 * cảnh báo tự động 1 Sale không có bất kỳ bản ghi nào (trường "Sale" khớp
 * đúng họ tên tài khoản) trong "Danh sách đưa đón" suốt 3 ngày liên tiếp —
 * sang ngày thứ 4 tạo thông báo "Nhắc nhở lần 1..." (yêu cầu trực tiếp
 * người dùng). Dùng đúng nội dung message này — không tự đổi chữ.
 */
export const SALE_NO_SHUTTLE_MESSAGE =
  'Nhắc nhở lần 1: đã quá 3 ngày không có người phỏng vấn';

/** "Quá 3 ngày" — vi phạm kể từ ngày thứ 4 liên tiếp không có bản ghi. */
const VIOLATION_THRESHOLD_DAYS = 3;

/** Múi giờ hệ thống — công ty vận hành tại Việt Nam, cố định để job/độ lệch ngày luôn nhất quán bất kể server chạy ở múi giờ nào. */
const TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface SaleReminderRunResult {
  checked: number;
  violated: string[];
  notified: number;
}

/** "YYYY-MM-DD" theo múi giờ TIMEZONE tại thời điểm `date`, dựng lại thành Date UTC-midnight — khớp cách ShuttleRecord.date được lưu (parse trực tiếp chuỗi "YYYY-MM-DD" từ frontend, xem shuttle.service.ts create()). */
function toDateOnlyInTimezone(date: Date, timeZone: string): Date {
  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function diffInDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

@Injectable()
export class SaleReminderService {
  private readonly logger = new Logger(SaleReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Chạy 1 lần/ngày lúc 10:00 (giờ Việt Nam) — yêu cầu trực tiếp người dùng. */
  @Cron('0 10 * * *', { timeZone: TIMEZONE })
  async tick(): Promise<void> {
    try {
      const result = await this.runCheck();
      this.logger.log(
        `Kiểm tra Sale không có người phỏng vấn: đã kiểm tra ${result.checked}, vi phạm ${result.violated.length} (${result.violated.join(', ') || 'không có'}), đã gửi thông báo ${result.notified}`,
      );
    } catch (error) {
      this.logger.error(
        'Kiểm tra Sale không có người phỏng vấn thất bại',
        error as Error,
      );
    }
  }

  /**
   * Tách riêng khỏi tick() để test/gọi thủ công được (dev), không cần chờ
   * lịch cron — cùng mẫu với NotificationScannerService.runTick().
   *
   * Cách xác định 1 "chu kỳ vi phạm": lấy bản ghi đưa đón GẦN NHẤT của Sale
   * (theo `date`, không dùng `createdAt`) làm mốc bắt đầu chu kỳ hiện tại —
   * nếu chưa từng có bản ghi nào thì lấy ngày tạo tài khoản làm mốc. Chỉ tạo
   * thông báo mới nếu CHƯA có thông báo `sale_no_shuttle_reminder` nào được
   * tạo SAU mốc đó — nhờ vậy: có bản ghi mới → mốc dời sang ngày có bản ghi
   * → tự "reset" đếm; đã gửi rồi mà vẫn tiếp tục vi phạm (ngày 5, 6, 7...) →
   * không gửi lặp lại trong cùng chu kỳ; hết vi phạm rồi vi phạm lại → mốc
   * mới lại lớn hơn mọi thông báo cũ → cho phép 1 chu kỳ cảnh báo mới.
   */
  async runCheck(): Promise<SaleReminderRunResult> {
    const today = toDateOnlyInTimezone(new Date(), TIMEZONE);

    const sales = await this.prisma.account.findMany({
      where: { role: 'sale', status: 'active' },
      include: { team: { include: { leader: true } } },
    });

    const violated: string[] = [];
    let notified = 0;

    for (const sale of sales) {
      const lastRecord = await this.prisma.shuttleRecord.findFirst({
        where: { sale: sale.fullName },
        orderBy: { date: 'desc' },
        select: { date: true },
      });

      const cycleStart =
        lastRecord?.date ?? toDateOnlyInTimezone(sale.createdAt, TIMEZONE);
      const daysSince = diffInDays(today, cycleStart);

      if (daysSince <= VIOLATION_THRESHOLD_DAYS) continue;

      violated.push(sale.fullName);

      const alreadyNotifiedThisCycle = await this.prisma.notification.findFirst(
        {
          where: {
            accountId: sale.id,
            type: 'sale_no_shuttle_reminder',
            createdAt: { gt: cycleStart },
          },
        },
      );
      if (alreadyNotifiedThisCycle) continue;

      const recipientIds = new Set<string>([sale.id]);
      if (sale.team?.leader) recipientIds.add(sale.team.leader.id);

      const now = new Date();
      await this.prisma.notification.createMany({
        data: [...recipientIds].map((accountId) => ({
          accountId,
          type: 'sale_no_shuttle_reminder' as const,
          channel: 'in_app' as const,
          content: SALE_NO_SHUTTLE_MESSAGE,
          scheduledAt: now,
          sentAt: now,
          status: 'sent' as const,
        })),
      });
      notified += recipientIds.size;
    }

    return { checked: sales.length, violated, notified };
  }

  /**
   * Dự án phụ — nâng cấp toàn diện (ngoài phạm vi Design Freeze docs/09-13):
   * CHỈ dùng ở development — dựng dữ liệu giả lập "đã quá 3 ngày không có
   * người phỏng vấn" cho 1 tài khoản Sale có sẵn, để test runCheck() ngay mà
   * không cần chờ 3 ngày thật (yêu cầu trực tiếp người dùng, mục 6).
   */
  async seedTestData(
    username: string,
  ): Promise<{ account: string; seeded_record_date: string }> {
    const sale = await this.prisma.account.findUnique({ where: { username } });
    if (!sale || sale.role !== 'sale') {
      throw new NotFoundException(
        `Không tìm thấy tài khoản Sale với username "${username}"`,
      );
    }

    const today = toDateOnlyInTimezone(new Date(), TIMEZONE);
    const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000);

    // Xóa mọi bản ghi trong 4 ngày gần nhất của Sale này — đảm bảo đủ điều
    // kiện vi phạm (không đụng tới bản ghi cũ hơn/của Sale khác).
    await this.prisma.shuttleRecord.deleteMany({
      where: { sale: sale.fullName, date: { gte: fourDaysAgo } },
    });

    // Xóa mọi thông báo cảnh báo cũ của tài khoản này — test lại từ đầu, không bị chặn bởi chu kỳ trước.
    await this.prisma.notification.deleteMany({
      where: { accountId: sale.id, type: 'sale_no_shuttle_reminder' },
    });

    // Đảm bảo có đúng 1 bản ghi 5 ngày trước — mô phỏng "đã từng có, nhưng quá hạn" (không phải "chưa từng có").
    await this.prisma.shuttleRecord.create({
      data: {
        date: fiveDaysAgo,
        fullName: `[TEST] Ứng viên mẫu — ${sale.fullName}`,
        phoneNumber: '0900000000',
        sale: sale.fullName,
        createdById: sale.id,
        updatedById: sale.id,
      },
    });

    return {
      account: sale.fullName,
      seeded_record_date: fiveDaysAgo.toISOString().slice(0, 10),
    };
  }
}
