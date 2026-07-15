import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportPenaltyService } from './report-penalty.service';

const TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check phạt" — Mục 3: "Tạo
 * scheduled job chạy tự động sau thời hạn nộp báo cáo mỗi ngày... trễ hơn
 * thời hạn khoảng 1–5 phút". Chạy MỖI 5 PHÚT (không phải 1 cron cố định
 * đúng giờ hạn) — vì hạn nộp có thể bị Admin đổi bất kỳ lúc nào (Mục 5),
 * report-penalty.service.ts#runScan() tự kiểm tra "đã tới hạn hôm nay
 * chưa" nên chạy thừa cũng không sinh dữ liệu sai/trùng — chỉ có tác dụng
 * ở lần chạy đầu tiên SAU khi qua hạn (khớp đúng khung "1–5 phút" yêu cầu).
 */
@Injectable()
export class ReportPenaltyScannerService {
  private readonly logger = new Logger(ReportPenaltyScannerService.name);

  constructor(private readonly reportPenaltyService: ReportPenaltyService) {}

  @Cron('*/5 * * * *', { timeZone: TIMEZONE })
  async tick(): Promise<void> {
    try {
      const result = await this.reportPenaltyService.runScan();
      if (result.skipped_before_deadline) return;
      this.logger.log(
        `Quét Check phạt Báo cáo hằng ngày: đã kiểm tra ${result.checked}, nộp muộn ${result.late_submissions.length} (${result.late_submissions.join(', ') || 'không có'}), không nộp ${result.no_submissions.length} (${result.no_submissions.join(', ') || 'không có'})`,
      );
    } catch (error) {
      this.logger.error(
        'Quét Check phạt Báo cáo hằng ngày thất bại',
        error as Error,
      );
    }
  }
}
