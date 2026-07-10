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

    if (key === CARE_POOL_THRESHOLD_KEY) {
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
}
