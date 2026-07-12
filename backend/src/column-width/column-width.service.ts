import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { UpdateColumnWidthDto } from './dto/update-column-width.dto';
import {
  ColumnWidthConfigResponseDto,
  toColumnWidthResponse,
} from './dto/column-width-response.dto';

// UI Polish — nới rộng biên kéo-thả (khớp đúng components/ui/resizable-th.tsx
// ở frontend) để Admin kéo thoải mái, chỉ chặn giá trị rác/lỗi thao tác.
const MIN_WIDTH_PX = 20;
const MAX_WIDTH_PX = 4000;

/**
 * Dự án phụ — nâng cấp toàn diện: Admin điều chỉnh độ rộng cột, áp dụng
 * chung cho mọi tài khoản (không phải preference riêng từng người) — lưu 1
 * dòng/bảng, khóa duy nhất theo `tableKey` (chuỗi tự do do từng trang tự
 * đặt, vd "candidates_list"). Trang mới sau này chỉ cần chọn 1 tableKey
 * riêng, không cần đổi gì ở backend.
 */
@Injectable()
export class ColumnWidthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(): Promise<ColumnWidthConfigResponseDto[]> {
    const configs = await this.prisma.columnWidthConfig.findMany({
      orderBy: { tableKey: 'asc' },
    });
    return configs.map(toColumnWidthResponse);
  }

  async upsert(
    tableKey: string,
    dto: UpdateColumnWidthDto,
    currentUser: AuthenticatedUser,
  ): Promise<ColumnWidthConfigResponseDto> {
    const entries = Object.entries(dto.column_widths);
    if (entries.length === 0) {
      throw new UnprocessableEntityException(
        'Danh sách độ rộng cột không được rỗng',
      );
    }
    for (const [key, value] of entries) {
      if (
        !Number.isInteger(value) ||
        value < MIN_WIDTH_PX ||
        value > MAX_WIDTH_PX
      ) {
        throw new UnprocessableEntityException(
          `Độ rộng cột "${key}" không hợp lệ (phải là số nguyên từ ${MIN_WIDTH_PX} đến ${MAX_WIDTH_PX}px)`,
        );
      }
    }

    const columnWidths = JSON.stringify(dto.column_widths);
    const existing = await this.prisma.columnWidthConfig.findUnique({
      where: { tableKey },
    });
    const updated = await this.prisma.columnWidthConfig.upsert({
      where: { tableKey },
      create: { tableKey, columnWidths, updatedById: currentUser.id },
      update: { columnWidths, updatedById: currentUser.id },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'column_width_config',
      entityId: updated.id,
      fieldChanged: tableKey,
      oldValue: existing?.columnWidths,
      newValue: columnWidths,
    });

    return toColumnWidthResponse(updated);
  }
}
