import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CreateOrderRecordDto } from './dto/create-order-record.dto';
import { UpdateOrderRecordDto } from './dto/update-order-record.dto';
import {
  OrderRecordResponseDto,
  toOrderRecordResponse,
} from './dto/order-record-response.dto';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-26, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): module "Quản lý đơn hàng" —
 * chỉ Admin dùng được (chặn ở ModulePermissionGuard qua module-registry.ts,
 * không cần @Roles() ở đây). Cấu trúc mirror đúng ShuttleService#*Option
 * (add/update/remove) — không lưu người tạo trên bản ghi, dùng audit log để
 * truy vết, khớp đúng nguyên tắc của ShuttleOption.
 */
@Injectable()
export class OrderManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(): Promise<OrderRecordResponseDto[]> {
    const records = await this.prisma.orderRecord.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toOrderRecordResponse);
  }

  async create(
    dto: CreateOrderRecordDto,
    currentUser: AuthenticatedUser,
  ): Promise<OrderRecordResponseDto> {
    const record = await this.prisma.orderRecord.create({
      data: {
        name: dto.name,
        colorKey: dto.color_key ?? null,
        textColorKey: dto.text_color_key ?? null,
      },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'order_record',
      entityId: record.id,
      newValue: record.name,
    });

    return toOrderRecordResponse(record);
  }

  async update(
    id: string,
    dto: UpdateOrderRecordDto,
    currentUser: AuthenticatedUser,
  ): Promise<OrderRecordResponseDto> {
    const existing = await this.prisma.orderRecord.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy đơn hàng này');
    }

    const record = await this.prisma.orderRecord.update({
      where: { id },
      data: {
        name: dto.name,
        colorKey: dto.color_key === undefined ? undefined : dto.color_key,
        textColorKey:
          dto.text_color_key === undefined ? undefined : dto.text_color_key,
      },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'order_record',
      entityId: id,
      oldValue: existing.name,
      newValue: record.name,
    });

    return toOrderRecordResponse(record);
  }

  async remove(id: string, currentUser: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.orderRecord.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy đơn hàng này');
    }

    // Rà soát 2026-10-30 (S1): khoá ngoại company_id là ON DELETE SET NULL —
    // xoá đơn đang được dùng sẽ làm mất tên công ty ở mọi dòng. Chặn và báo rõ.
    const [shuttleCount, salesCount] = await Promise.all([
      this.prisma.shuttleRecord.count({
        where: { companyId: id, deletedAt: null },
      }),
      this.prisma.salesEntryRecord.count({
        where: { companyId: id, deletedAt: null },
      }),
    ]);
    if (shuttleCount + salesCount > 0) {
      throw new ConflictException(
        `Đơn hàng đang được dùng ở ${shuttleCount} dòng Đưa đón và ${salesCount} dòng DS Sale — không thể xóa`,
      );
    }

    await this.prisma.orderRecord.delete({ where: { id } });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'delete',
      entityType: 'order_record',
      entityId: id,
      oldValue: existing.name,
    });
  }
}
