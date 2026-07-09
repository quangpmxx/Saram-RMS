import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActionType } from '../../generated/prisma/enums';

export interface AuditLogEntry {
  accountId: string;
  actionType: AuditActionType;
  entityType: string;
  entityId?: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Ghi nhật ký truy cập/thao tác — hạ tầng cần dựng từ Phase 0 theo
 * Mục 0 ("Ghi chú xuyên suốt"), docs/14-roadmap.md, dù màn hình xem
 * nhật ký (M12 UI) chỉ xuất hiện ở Phase 9.
 *
 * Ghi log là tác vụ phụ trợ — lỗi ghi log không được làm hỏng nghiệp vụ
 * chính (vd không được chặn đăng nhập chỉ vì audit log insert thất bại),
 * nên lỗi được nuốt và log cảnh báo thay vì ném ra ngoài.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          accountId: entry.accountId,
          actionType: entry.actionType,
          entityType: entry.entityType,
          entityId: entry.entityId,
          fieldChanged: entry.fieldChanged,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
        },
      });
    } catch (error) {
      this.logger.error(
        `Ghi audit log thất bại (${entry.actionType} ${entry.entityType})`,
        error as Error,
      );
    }
  }
}
