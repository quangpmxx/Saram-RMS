import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  SYSTEM_CONFIG_INCLUDE,
  SystemConfigResponseDto,
  toSystemConfigResponse,
} from './dto/system-config-response.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

/** Mục 10.1, docs/09: ngưỡng mặc định 30 phút — dùng khi chưa seed tham số này. */
export const CARE_POOL_THRESHOLD_KEY = 'CARE_POOL_THRESHOLD_MINUTES';
const CARE_POOL_THRESHOLD_DEFAULT = 30;

/**
 * Phase 8 — Thông báo Zalo (docs/14-roadmap.md). "Tần suất" nhắc lịch chưa
 * được chốt cụ thể tại Mục 11.5, docs/09 ("chưa xác định rõ những sự kiện cụ
 * thể nào sẽ kích hoạt gửi thông báo") — tiêu chí hoàn thành Phase 8 chỉ yêu
 * cầu "gửi đúng thời điểm CẤU HÌNH", nên chọn 1 tham số duy nhất: số phút
 * nhắc trước giờ hẹn (gọi lại/phỏng vấn), mặc định 15 phút, sửa được qua
 * màn hình Cấu hình vận hành (PUT /config/:key) — tái dùng đúng cơ chế đã có
 * từ Phase 5, không thêm API mới.
 */
export const NOTIFICATION_LEAD_MINUTES_KEY = 'NOTIFICATION_LEAD_MINUTES';
const NOTIFICATION_LEAD_MINUTES_DEFAULT = 15;

/**
 * Mục 9, docs/13-api-design.md — GET /config, PUT /config/:key. Quyền sử
 * dụng: Admin (duy nhất) — theo đúng bảng đã chốt tại Mục 9, docs/13, giải
 * quyết điểm còn để ngỏ ở Mục 11.2, docs/09 (Quản lý "chưa xác định rõ").
 */
@Injectable()
export class SystemConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(): Promise<SystemConfigResponseDto[]> {
    const configs = await this.prisma.systemConfig.findMany({
      include: SYSTEM_CONFIG_INCLUDE,
      orderBy: { configKey: 'asc' },
    });
    return configs.map(toSystemConfigResponse);
  }

  async update(
    key: string,
    dto: UpdateSystemConfigDto,
    currentUser: AuthenticatedUser,
  ): Promise<SystemConfigResponseDto> {
    const existing = await this.prisma.systemConfig.findUnique({
      where: { configKey: key },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tham số cấu hình');
    }

    if (
      key === CARE_POOL_THRESHOLD_KEY ||
      key === NOTIFICATION_LEAD_MINUTES_KEY
    ) {
      const parsed = Number(dto.value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new UnprocessableEntityException(
          'Ngưỡng thời gian phải là số nguyên dương (đơn vị phút)',
        );
      }
    }

    await this.prisma.systemConfig.update({
      where: { configKey: key },
      data: { configValue: dto.value, updatedById: currentUser.id },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'system_config',
      entityId: existing.id,
      fieldChanged: key,
      oldValue: existing.configValue,
      newValue: dto.value,
    });

    const final = await this.prisma.systemConfig.findUniqueOrThrow({
      where: { configKey: key },
      include: SYSTEM_CONFIG_INCLUDE,
    });
    return toSystemConfigResponse(final);
  }

  /**
   * Đọc trực tiếp giá trị số nguyên của 1 tham số — dùng nội bộ cho worker
   * quét cột chăm sóc (CarePoolScannerService), không phải API công khai.
   * Fallback về giá trị mặc định nếu tham số chưa được seed hoặc giá trị hỏng.
   */
  async getIntValue(key: string, fallback: number): Promise<number> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { configKey: key },
    });
    const parsed = config ? Number(config.configValue) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  async getCarePoolThresholdMinutes(): Promise<number> {
    return this.getIntValue(
      CARE_POOL_THRESHOLD_KEY,
      CARE_POOL_THRESHOLD_DEFAULT,
    );
  }

  /** Dùng nội bộ cho NotificationScannerService (Phase 8) — số phút nhắc trước giờ hẹn. */
  async getNotificationLeadMinutes(): Promise<number> {
    return this.getIntValue(
      NOTIFICATION_LEAD_MINUTES_KEY,
      NOTIFICATION_LEAD_MINUTES_DEFAULT,
    );
  }
}
