import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import {
  ListDsSaleQueryDto,
  type DsSaleSort,
} from './dto/list-ds-sale-query.dto';
import { flipOrder, type SortOrder } from '../common/utils/sort-order.util';
import { UpsertDsSaleRowDto } from './dto/upsert-ds-sale-row.dto';
import {
  DS_SALE_INCLUDE,
  DsSaleAccountOptionDto,
  DsSaleCompanyOptionDto,
  DsSaleRowResponseDto,
  DsSaleRowWithRelations,
  toDsSaleRowResponse,
} from './dto/ds-sale-response.dto';
import { findOwnTeamId } from '../common/utils/account-team.util';

/** "" hoặc chỉ khoảng trắng đều coi như chưa nhập — dùng để chặn lưu dòng hoàn toàn rỗng (Mục 9/14, yêu cầu người dùng). */
function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/**
 * Thứ tự DS Sale khi bấm tiêu đề STT/Ngày sinh/Ngày vào (yêu cầu người dùng
 * 2026-10-30). STT tăng dần = mặc định (dòng mới nhập trước); ngày trống
 * luôn xếp cuối.
 */
function dsSaleOrderBy(
  sort: DsSaleSort | undefined,
  order: SortOrder = 'asc',
): Prisma.SalesEntryRecordOrderByWithRelationInput[] {
  const byNewest: Prisma.SalesEntryRecordOrderByWithRelationInput[] = [
    { createdAt: 'desc' },
    { id: 'desc' },
  ];
  if (sort === 'date_of_birth') {
    return [{ dateOfBirth: { sort: order, nulls: 'last' } }, ...byNewest];
  }
  if (sort === 'join_date') {
    return [{ joinDate: { sort: order, nulls: 'last' } }, ...byNewest];
  }
  const dir = flipOrder(order);
  return [{ createdAt: dir }, { id: dir }];
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
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<DsSaleRowResponseDto>> {
    const where = await this.buildWhere(query, currentUser);

    const [total, records] = await this.prisma.$transaction([
      this.prisma.salesEntryRecord.count({ where }),
      this.prisma.salesEntryRecord.findMany({
        where,
        include: DS_SALE_INCLUDE,
        // Bấm tiêu đề STT/Ngày sinh/Ngày vào (yêu cầu người dùng 2026-10-30).
        // STT tăng dần = mặc định (dòng mới nhập trước); ngày trống xếp cuối.
        orderBy: dsSaleOrderBy(query.sort, query.order),
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
   *
   * Yêu cầu trực tiếp người dùng (2026-07-27): "Sale tự nhập doanh số cho
   * chính mình... leader nhìn được doanh số của cả team, quản lý/admin/kế
   * toán nhìn thấy full" — ÉP buộc scope theo vai trò ở đây (không phải chỉ
   * gợi ý qua query param), để không ai xem được dữ liệu ngoài phạm vi dù
   * có tự sửa query string.
   */
  private async buildWhere(
    query: ListDsSaleQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<Prisma.SalesEntryRecordWhereInput> {
    const where: Prisma.SalesEntryRecordWhereInput = { deletedAt: null };

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

    if (currentUser.role === 'sale') {
      // Ghi đè, KHÔNG cộng thêm điều kiện — Sale chỉ được xem đúng 1 phạm
      // vi duy nhất (chính mình), bất kể query.sale_user_id gửi lên là gì.
      where.saleUserId = currentUser.id;
    } else if (currentUser.role === 'leader') {
      const teamId = await findOwnTeamId(this.prisma, currentUser.id);
      // Chưa có nhóm — không thấy dòng nào, an toàn hơn là lộ hết dữ liệu.
      // "saleUserId: { in: [] }" (không phải 1 UUID giả) để tránh lỗi kiểu
      // dữ liệu UUID ở Postgres khi so sánh với chuỗi không hợp lệ.
      if (teamId) {
        where.saleUser = { teamId };
      } else {
        where.saleUserId = { in: [] };
      }
    }

    return where;
  }

  async exportRows(
    query: ListDsSaleQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<DsSaleRowResponseDto[]> {
    const where = await this.buildWhere(query, currentUser);
    const records = await this.prisma.salesEntryRecord.findMany({
      where,
      include: DS_SALE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toDsSaleRowResponse);
  }

  /**
   * Mục 9/14: chặn tạo/lưu 1 dòng khi TẤT CẢ trường nghiệp vụ đều trống —
   * an toàn ở tầng service dù frontend đã tự chặn trước.
   * Yêu cầu trực tiếp người dùng (2026-07-27): Sale luôn bị ép sale_user_id
   * = chính mình (xem resolveSaleUserId) — vì vậy KHÔNG tính trường này khi
   * xét "trống" cho vai trò Sale, nếu không dòng nháp trống của Sale sẽ
   * không bao giờ được coi là trống (luôn có sẵn sale_user_id), tự lưu
   * thành dòng rác dù người dùng chưa gõ gì khác.
   */
  private isRowBlank(
    dto: UpsertDsSaleRowDto,
    currentUser: AuthenticatedUser,
  ): boolean {
    const saleFieldBlank =
      currentUser.role === 'sale' ? true : !dto.sale_user_id;
    return (
      isBlank(dto.employee_code) &&
      isBlank(dto.full_name) &&
      !dto.date_of_birth &&
      isBlank(dto.identity_number) &&
      isBlank(dto.hometown) &&
      !dto.join_date &&
      !dto.company_id &&
      saleFieldBlank &&
      !dto.pickup_user_id &&
      isBlank(dto.note)
    );
  }

  async createRow(
    dto: UpsertDsSaleRowDto,
    currentUser: AuthenticatedUser,
  ): Promise<DsSaleRowResponseDto> {
    if (this.isRowBlank(dto, currentUser)) {
      throw new BadRequestException('Không thể lưu 1 dòng hoàn toàn trống');
    }

    const saleUserId = await this.resolveSaleUserId(
      dto.sale_user_id ?? null,
      currentUser,
    );

    let record: DsSaleRowWithRelations;
    try {
      record = await this.prisma.salesEntryRecord.create({
        data: {
          ...this.toWriteData(dto),
          saleUserId,
          createdById: currentUser.id,
          updatedById: currentUser.id,
        },
        include: DS_SALE_INCLUDE,
      });
    } catch (error) {
      throw this.mapCompanyForeignKeyError(error);
    }

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
    if (this.isRowBlank(dto, currentUser)) {
      throw new BadRequestException('Không thể lưu 1 dòng hoàn toàn trống');
    }

    const existing = await this.prisma.salesEntryRecord.findUnique({
      where: { id },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Không tìm thấy dòng DS Sale');
    }
    await this.assertCanModifyRow(existing.saleUserId, currentUser);

    // Không gửi sale_user_id = giữ nguyên Sale cũ (gửi null = bỏ gán có chủ ý).
    // Sale luôn bị ép về chính mình nên vẫn đi qua resolveSaleUserId.
    const saleUserId =
      dto.sale_user_id === undefined && currentUser.role !== 'sale'
        ? existing.saleUserId
        : await this.resolveSaleUserId(dto.sale_user_id ?? null, currentUser);

    let record: DsSaleRowWithRelations;
    try {
      record = await this.prisma.salesEntryRecord.update({
        where: { id },
        data: {
          ...this.toWriteData(dto),
          saleUserId,
          updatedById: currentUser.id,
        },
        include: DS_SALE_INCLUDE,
      });
    } catch (error) {
      throw this.mapCompanyForeignKeyError(error);
    }

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
    const where: Prisma.SalesEntryRecordWhereInput = { id: { in: ids } };
    if (currentUser.role === 'sale') {
      where.saleUserId = currentUser.id;
    } else if (currentUser.role === 'leader') {
      const teamId = await findOwnTeamId(this.prisma, currentUser.id);
      if (teamId) {
        where.saleUser = { teamId };
      } else {
        where.saleUserId = { in: [] };
      }
    }

    // Xoá mềm (rà soát 2026-10-30): chỉ đụng các dòng trong phạm vi quyền và
    // chưa xoá; audit ghi nội dung từng dòng; realtime chỉ phát cho id thật sự xoá.
    where.deletedAt = null;
    const targets = await this.prisma.salesEntryRecord.findMany({
      where,
      select: { id: true, employeeCode: true, fullName: true },
    });
    if (targets.length === 0) return { deleted: 0 };

    const result = await this.prisma.salesEntryRecord.updateMany({
      where: { id: { in: targets.map((t) => t.id) }, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: currentUser.id },
    });

    for (const target of targets) {
      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'delete',
        entityType: 'sales_entry_record',
        entityId: target.id,
        oldValue: target.fullName ?? target.employeeCode ?? target.id,
      });
      this.realtime.emitSalesEntryChange(
        'deleted',
        { id: target.id },
        currentUser,
      );
    }

    return { deleted: result.count };
  }

  /**
   * `company_id`/`sale_user_id`/`pickup_user_id` đều là khóa ngoại thật
   * (Account/OrderRecord) — id hợp lệ về định dạng (@IsUUID()) nhưng không
   * tồn tại (vd đơn hàng/tài khoản vừa bị xóa ở tab khác) sẽ khiến Prisma
   * ném P2003 ngay lúc ghi, khớp cách accounts.service.ts#deletePermanently
   * đã xử lý cho trường hợp tương tự.
   */
  private mapCompanyForeignKeyError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return new BadRequestException(
        'Công ty/Sale/Đưa đón đã chọn không tồn tại hoặc đã bị xóa — vui lòng chọn lại',
      );
    }
    return error as Error;
  }

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-27): "Sale sẽ tự nhập doanh số
   * cho chính mình... không cần chọn sale ở cột này mà sẽ hiện luôn tên
   * mình". Ép cứng ở tầng backend (không chỉ ẩn ô chọn ở frontend) —
   * Sale KHÔNG THỂ tự gán dòng cho người khác dù có sửa request tay.
   * Leader vẫn chọn được Sale như trước, nhưng CHỈ trong đúng nhóm mình.
   */
  private async resolveSaleUserId(
    requested: string | null,
    currentUser: AuthenticatedUser,
  ): Promise<string | null> {
    if (currentUser.role === 'sale') {
      return currentUser.id;
    }
    if (currentUser.role === 'leader' && requested) {
      const teamId = await findOwnTeamId(this.prisma, currentUser.id);
      const target = await this.prisma.account.findUnique({
        where: { id: requested },
        select: { teamId: true },
      });
      if (!teamId || !target || target.teamId !== teamId) {
        throw new ForbiddenException('Bạn chỉ được chọn Sale trong nhóm mình');
      }
    }
    return requested;
  }

  /** Chặn Sale/Leader sửa/xóa dòng NGOÀI phạm vi (chính mình/cả nhóm) — Quản lý/Admin/Kế toán không giới hạn. */
  private async assertCanModifyRow(
    existingSaleUserId: string | null,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === 'sale') {
      if (existingSaleUserId !== currentUser.id) {
        throw new ForbiddenException(
          'Bạn chỉ được sửa dòng doanh số của chính mình',
        );
      }
      return;
    }
    if (currentUser.role === 'leader') {
      const teamId = await findOwnTeamId(this.prisma, currentUser.id);
      if (!existingSaleUserId) return; // Chưa gán Sale — Leader vẫn nhận (gán) được, khớp resolveSaleUserId.
      const target = await this.prisma.account.findUnique({
        where: { id: existingSaleUserId },
        select: { teamId: true },
      });
      if (!teamId || !target || target.teamId !== teamId) {
        throw new ForbiddenException(
          'Bạn chỉ được sửa dòng doanh số trong nhóm mình',
        );
      }
    }
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
      pickupUserId: dto.pickup_user_id ?? null,
      note: isBlank(dto.note) ? null : dto.note,
    };
  }

  /**
   * Mục 5: nguồn Sale = tài khoản role 'sale' đang active — khớp đúng
   * listSaleAccounts() ở shuttle.service.ts. Yêu cầu trực tiếp người dùng
   * (2026-07-27): Leader chỉ thấy Sale TRONG NHÓM mình (khớp phạm vi
   * xem/sửa đã ép ở buildWhere/resolveSaleUserId) — Quản lý/Admin/Kế toán
   * vẫn thấy toàn bộ như trước. Sale không cần danh sách này (không hiện ô
   * chọn ở frontend) nên không cần scope riêng.
   */
  async listSaleAccounts(
    currentUser: AuthenticatedUser,
  ): Promise<DsSaleAccountOptionDto[]> {
    const teamId =
      currentUser.role === 'leader'
        ? await findOwnTeamId(this.prisma, currentUser.id)
        : undefined;
    return this.listAccountOptions('sale', teamId);
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
    /** undefined = không lọc theo nhóm; null = có nhóm nhưng KHÔNG lọc được (an toàn: trả rỗng) — chỉ dùng cho Leader. */
    teamId?: string | null,
  ): Promise<DsSaleAccountOptionDto[]> {
    if (teamId === null) return [];
    const accounts = await this.prisma.account.findMany({
      where: { role, status: 'active', ...(teamId ? { teamId } : {}) },
      select: {
        id: true,
        fullName: true,
        nickname: true,
        avatarUrl: true,
        team: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    return accounts.map((account) => ({
      id: account.id,
      full_name: account.fullName,
      nickname: account.nickname,
      avatar_url: account.avatarUrl,
      team_name: account.team?.name ?? null,
    }));
  }

  /**
   * Mục 4, yêu cầu người dùng: "Tạo service/API abstraction riêng để lấy
   * danh sách công ty." Từ 2026-07-26 (yêu cầu trực tiếp người dùng: "công
   * ty chính là đơn hàng"), nguồn dữ liệu thật là module "Quản lý đơn hàng"
   * (OrderRecord) — giữ nguyên hàm/endpoint riêng biệt như thiết kế ban đầu,
   * không đổi gì ở controller/frontend.
   */
  async listCompanies(): Promise<DsSaleCompanyOptionDto[]> {
    const records = await this.prisma.orderRecord.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return records;
  }
}
