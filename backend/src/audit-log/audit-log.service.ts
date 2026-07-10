import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActionType } from '../../generated/prisma/enums';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import {
  AUDIT_LOG_INCLUDE,
  AuditLogResponseDto,
  toAuditLogResponse,
} from './dto/audit-log-response.dto';

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

  /**
   * Mục 9, docs/13-api-design.md — GET /audit-log. Đọc lại nhật ký đã ghi từ
   * Phase 0 trở đi (Mục 0 "Ghi chú xuyên suốt", docs/14-roadmap.md) — không
   * ghi thêm gì mới, chỉ tra cứu.
   */
  async list(
    query: ListAuditLogQueryDto,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const where: Prisma.AuditLogWhereInput = {
      accountId: query.account_id,
      actionType: query.action_type,
      entityType: query.entity_type,
      entityId: query.entity_id,
    };
    if (query.date_from || query.date_to) {
      where.createdAt = {
        gte: query.date_from ? new Date(query.date_from) : undefined,
        lte: query.date_to ? new Date(query.date_to) : undefined,
      };
    }

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: AUDIT_LOG_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: logs.map(toAuditLogResponse),
    };
  }
}
