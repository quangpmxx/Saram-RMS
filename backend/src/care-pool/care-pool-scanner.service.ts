import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';

/**
 * Mục 10.1, docs/09 + Mục 9.4, docs/10-system-design.md: worker nền quét
 * định kỳ (khuyến nghị 1-5 phút, Mục 9, tài liệu 11), đưa vào Cột chăm sóc
 * mọi lead đã qua ít nhất 1 lần xử lý (`last_activity_at` khác rỗng) nhưng
 * bị bỏ quên quá ngưỡng thời gian cấu hình, VÀ chưa được đánh dấu giữ số.
 * Lead hoàn toàn mới (`last_activity_at` rỗng) KHÔNG đủ điều kiện — đúng
 * quy tắc Mục 10.1, tài liệu 09. `entered_care_pool_at` chỉ được set 1 lần
 * (tồn tại vĩnh viễn theo đúng nghiệp vụ) — worker không đụng tới
 * `removed_from_care_pool_at`, tôn trọng quyết định gỡ của Admin.
 */
@Injectable()
export class CarePoolScannerService {
  private readonly logger = new Logger(CarePoolScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  @Interval(2 * 60 * 1000)
  async scan(): Promise<void> {
    try {
      const count = await this.runScan();
      if (count > 0) {
        this.logger.log(`Đã đưa ${count} lead vào cột chăm sóc`);
      }
    } catch (error) {
      this.logger.error('Quét cột chăm sóc thất bại', error as Error);
    }
  }

  /** Tách riêng khỏi scan() để test/gọi thủ công được, không cần chờ timer. */
  async runScan(): Promise<number> {
    const thresholdMinutes =
      await this.systemConfigService.getCarePoolThresholdMinutes();
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const result = await this.prisma.lead.updateMany({
      where: {
        deletedAt: null,
        isHeld: false,
        enteredCarePoolAt: null,
        assignedTeamId: { not: null },
        lastActivityAt: { not: null, lt: cutoff },
      },
      data: { enteredCarePoolAt: new Date() },
    });

    return result.count;
  }
}
