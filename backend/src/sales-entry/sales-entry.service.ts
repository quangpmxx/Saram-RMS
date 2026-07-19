import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListDsSaleQueryDto } from './dto/list-ds-sale-query.dto';
import { UpsertDsSaleRowDto } from './dto/upsert-ds-sale-row.dto';
import {
  DS_SALE_INCLUDE,
  DsSaleAccountOptionDto,
  DsSaleCompanyOptionDto,
  DsSaleRowResponseDto,
  toDsSaleRowResponse,
} from './dto/ds-sale-response.dto';

/** "" hoặc chỉ khoảng trắng đều coi như chưa nhập — dùng để chặn lưu dòng hoàn toàn rỗng (Mục 9/14, yêu cầu người dùng). */
function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

@Injectable()
export class SalesEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(
    query: ListDsSaleQueryDto,
  ): Promise<PaginatedResult<DsSaleRowResponseDto>> {
    const where = this.buildWhere(query);

    const [total, records] = await this.prisma.$transaction([
      this.prisma.salesEntryRecord.count({ where }),
      this.prisma.salesEntryRecord.findMany({
        where,
        include: DS_SALE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: records.map(toDsSaleRowResponse),
    };
  }

  /**
   * Dùng chung cho GET (phân trang) và export Excel — CÙNG 1 phạm vi lọc,
   * tránh file xuất lệch với màn hình đang xem (Mục 12: "Dữ liệu xuất theo
   * bộ lọc hiện tại").
   */
  private buildWhere(
    query: ListDsSaleQueryDto,
  ): Prisma.SalesEntryRecordWhereInput {
    const where: Prisma.SalesEntryRecordWhereInput = {};

    if (query.keyword) {
      where.OR = [
        { employeeCode: { contains: query.keyword, mode: 'insensitive' } },
        { fullName: { contains: query.keyword, mode: 'insensitive' } },
        { identityNumber: { contains: query.keyword, mode: 'insensitive' } },
        { hometown: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }
    if (query.join_date_from || query.join_date_to) {
      where.joinDate = {
        gte: query.join_date_from ? new Date(query.join_date_from) : undefined,
        lte: query.join_date_to ? new Date(query.join_date_to) : undefined,
      };
    }
    if (query.company_id) where.companyId = query.company_id;
    if (query.sale_user_id) where.saleUserId = query.sale_user_id;
    if (query.pickup_user_id) where.pickupUserId = query.pickup_user_id;

    return where;
  }

  async exportRows(query: ListDsSaleQueryDto): Promise<DsSaleRowResponseDto[]> {
    const where = this.buildWhere(query);
    const records = await this.prisma.salesEntryRecord.findMany({
      where,
      include: DS_SALE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toDsSaleRowResponse);
  }

  /** Mục 9/14: chặn tạo/lưu 1 dòng khi TẤT CẢ trường nghiệp vụ đều trống — an toàn ở tầng service dù frontend đã tự chặn trước. */
  private isRowBlank(dto: UpsertDsSaleRowDto): boolean {
    return (
      isBlank(dto.employee_code) &&
      isBlank(dto.full_name) &&
      !dto.date_of_birth &&
      isBlank(dto.identity_number) &&
      isBlank(dto.hometown) &&
      !dto.join_date &&
      !dto.company_id &&
      !dto.sale_user_id &&
      !dto.pickup_user_id &&
      isBlank(dto.note)
    );
  }

  async createRow(
    dto: UpsertDsSaleRowDto,
    currentUser: AuthenticatedUser,
  ): Promise<DsSaleRowResponseDto> {
    if (this.isRowBlank(dto)) {
      throw new BadRequestException('Không thể lưu 1 dòng hoàn toàn trống');
    }

    const record = await this.prisma.salesEntryRecord.create({
      data: {
        ...this.toWriteData(dto),
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
      include: DS_SALE_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'sales_entry_record',
      entityId: record.id,
      newValue: record.fullName ?? record.employeeCode ?? record.id,
    });

    const response = toDsSaleRowResponse(record);
    this.realtime.emitSalesEntryChange('created', response, currentUser);
    return response;
  }

  async updateRow(
    id: string,
    dto: UpsertDsSaleRowDto,
    currentUser: AuthenticatedUser,
  ): Promise<DsSaleRowResponseDto> {
    if (this.isRowBlank(dto)) {
      throw new BadRequestException('Không thể lưu 1 dòng hoàn toàn trống');
    }

    const existing = await this.prisma.salesEntryRecord.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy dòng DS Sale');
    }

    const record = await this.prisma.salesEntryRecord.update({
      where: { id },
      data: {
        ...this.toWriteData(dto),
        updatedById: currentUser.id,
      },
      include: DS_SALE_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'sales_entry_record',
      entityId: record.id,
      newValue: record.fullName ?? record.employeeCode ?? record.id,
    });

    const response = toDsSaleRowResponse(record);
    this.realtime.emitSalesEntryChange('updated', response, currentUser);
    return response;
  }

  async deleteRows(
    ids: string[],
    currentUser: AuthenticatedUser,
  ): Promise<{ deleted: number }> {
    const result = await this.prisma.salesEntryRecord.deleteMany({
      where: { id: { in: ids } },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'delete',
      entityType: 'sales_entry_record',
      newValue: `Đã xóa ${result.count} dòng`,
    });

    for (const id of ids) {
      this.realtime.emitSalesEntryChange('deleted', { id }, currentUser);
    }

    return { deleted: result.count };
  }

  private toWriteData(dto: UpsertDsSaleRowDto) {
    return {
      employeeCode: isBlank(dto.employee_code) ? null : dto.employee_code,
      fullName: isBlank(dto.full_name) ? null : dto.full_name,
      dateOfBirth: dto.date_of_birth ? new Date(dto.date_of_birth) : null,
      identityNumber: isBlank(dto.identity_number) ? null : dto.identity_number,
      hometown: isBlank(dto.hometown) ? null : dto.hometown,
      joinDate: dto.join_date ? new Date(dto.join_date) : null,
      companyId: dto.company_id ?? null,
      saleUserId: dto.sale_user_id ?? null,
      pickupUserId: dto.pickup_user_id ?? null,
      note: isBlank(dto.note) ? null : dto.note,
    };
  }

  /** Mục 5: nguồn Sale = tài khoản role 'sale' đang active — khớp đúng listSaleAccounts() ở shuttle.service.ts. */
  async listSaleAccounts(): Promise<DsSaleAccountOptionDto[]> {
    return this.listAccountOptions('sale');
  }

  /**
   * Mục 6: nguồn Đưa đón — dùng role hệ thống 'shuttle_staff' (vị trí "NV
   * Đưa đón" vừa thêm cùng đợt yêu cầu người dùng trước đó), KHÔNG dùng
   * cột "driver" tự do của module "Danh sách đưa đón" (đó là text tự nhập,
   * không map được về 1 tài khoản thật).
   */
  async listPickupAccounts(): Promise<DsSaleAccountOptionDto[]> {
    return this.listAccountOptions('shuttle_staff');
  }

  private async listAccountOptions(
    role: 'sale' | 'shuttle_staff',
  ): Promise<DsSaleAccountOptionDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { role, status: 'active' },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        team: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    return accounts.map((account) => ({
      id: account.id,
      full_name: account.fullName,
      avatar_url: account.avatarUrl,
      team_name: account.team?.name ?? null,
    }));
  }

  /**
   * Mục 4, yêu cầu người dùng: "Tạo service/API abstraction riêng để lấy
   * danh sách công ty... nếu chức năng công ty hợp tác chưa tồn tại thì để
   * dropdown rỗng có thông báo." Module "Quản lý đơn hàng" (nơi sẽ quản lý
   * công ty hợp tác) hiện vẫn là khung sườn trống (yêu cầu trực tiếp người
   * dùng, 2026-07-16) — CHƯA có bảng dữ liệu thật để đọc, nên trả về mảng
   * rỗng. Giữ nguyên hàm/endpoint riêng biệt để sau này chỉ cần đổi PHẦN
   * THÂN hàm này sang đọc từ bảng công ty hợp tác thật, không đổi gì ở
   * controller/frontend.
   */
  listCompanies(): DsSaleCompanyOptionDto[] {
    return [];
  }
}
