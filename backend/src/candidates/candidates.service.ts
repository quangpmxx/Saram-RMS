import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Account, Lead } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  CANDIDATE_INCLUDE,
  CandidateResponseDto,
  toCandidateResponse,
} from './dto/candidate-response.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { QuickEditCandidateDto } from './dto/quick-edit-candidate.dto';
import { ListCandidatesQueryDto } from './dto/list-candidates-query.dto';
import { PendingCandidatesQueryDto } from './dto/pending-candidates-query.dto';
import { AssignCandidateDto } from './dto/assign-candidate.dto';
import { AssignBulkDto } from './dto/assign-bulk.dto';
import { TransferCandidateDto } from './dto/transfer-candidate.dto';
import { DuplicateWarning } from './dto/duplicate-warning.dto';
import { DuplicateDetailDto } from './dto/duplicate-detail.dto';
import { LeadDuplicateService } from './lead-duplicate.service';
import { isVisibleInCarePool } from './care-pool.util';

/** Mục 8, docs/09: Admin/Quản lý/Leader có quyền chia/chuyển lead. */
const ASSIGNMENT_ROLES = new Set(['admin', 'manager', 'leader']);
/** Mục 5, tài liệu 10 (S3): ai được xem danh sách "Chờ phân chia". */
const PENDING_VIEW_ROLES = new Set(['admin', 'manager', 'leader', 'mkt']);

export interface CreateCandidateResult {
  candidate: CandidateResponseDto;
  duplicate_warning: DuplicateWarning | null;
}

/** Vai trò luôn xem/sửa được toàn bộ ứng viên — Mục 2.6 & Mục 8, docs/09. */
const FULL_ACCESS_ROLES = new Set(['admin', 'manager', 'mkt']);

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly duplicateService: LeadDuplicateService,
  ) {}

  async list(
    query: ListCandidatesQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<CandidateResponseDto>> {
    const where = await this.buildScopeWhere(currentUser, {
      assigned_to: query.assigned_to,
      team_id: query.team_id,
    });

    if (query.keyword) {
      // UI Polish — mở rộng tìm kiếm sang cả nội dung ghi chú chăm sóc của
      // Sale (lead_notes.content), ngoài tên/SĐT như tài liệu 13 mô tả gốc —
      // theo yêu cầu trực tiếp của người dùng trong phiên làm việc. Chỉ khớp
      // ghi chú CHƯA xóa (is_deleted=false), tương ứng đúng nội dung đang
      // hiển thị thật cho người dùng, không tính ghi chú đã xóa mềm.
      where.OR = [
        { fullName: { contains: query.keyword, mode: 'insensitive' } },
        { phoneNumber: { contains: query.keyword } },
        {
          notes: {
            some: {
              content: { contains: query.keyword, mode: 'insensitive' },
              isDeleted: false,
            },
          },
        },
      ];
    }
    if (query.source_id) {
      where.sourceId = query.source_id;
    }
    if (query.is_duplicate_flagged !== undefined) {
      where.isDuplicateFlagged = query.is_duplicate_flagged === 'true';
    }
    if (query.is_pending !== undefined) {
      where.assignedToId =
        query.is_pending === 'true' ? null : where.assignedToId;
    }
    if (query.date_from || query.date_to) {
      where.uploadedAt = {
        gte: query.date_from ? new Date(query.date_from) : undefined,
        lte: query.date_to ? new Date(query.date_to) : undefined,
      };
    }
    if (query.call_status_id) {
      where.callStatusId = query.call_status_id;
    }
    if (query.call_result_id) {
      where.callResultId = query.call_result_id;
    }
    if (query.interview_status_id) {
      where.currentInterviewStatusId = query.interview_status_id;
    }
    if (query.employment_status_id) {
      where.currentEmploymentStatusId = query.employment_status_id;
    }
    if (query.partner_company_name) {
      where.currentPartnerCompanyName = {
        contains: query.partner_company_name,
        mode: 'insensitive',
      };
    }

    const [total, leads] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: CANDIDATE_INCLUDE,
        orderBy: { uploadedAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: leads.map(toCandidateResponse),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }

    await this.assertInScope(lead, currentUser);

    return toCandidateResponse(lead);
  }

  /**
   * Mục 2.1, docs/12 (tooltip/popup khi hover badge "Trùng SĐT") + Mục 10.4,
   * docs/09: Admin/Quản lý/MKT xem toàn bộ các lần trùng không giới hạn
   * nhóm; Leader/Sale chỉ xem chi tiết các bản ghi trùng thuộc đúng nhóm
   * mình, các bản ghi trùng ở nhóm khác không được hiện chi tiết (xác nhận
   * bổ sung của chủ doanh nghiệp — Leader áp dụng cùng quy tắc "cùng nhóm"
   * như Sale, vì tài liệu 09 gốc chỉ nói tới Sale/MKT/Quản lý/Admin).
   */
  async getDuplicateDetail(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<DuplicateDetailDto> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }
    await this.assertInScope(lead, currentUser);

    const others = await this.prisma.lead.findMany({
      where: {
        phoneNumber: lead.phoneNumber,
        deletedAt: null,
        id: { not: lead.id },
      },
      include: {
        assignedTo: {
          include: { team: { select: { id: true, name: true } } },
        },
      },
      orderBy: { uploadedAt: 'asc' },
    });

    const visibleMatches = FULL_ACCESS_ROLES.has(currentUser.role)
      ? others
      : await this.filterMatchesByOwnTeam(others, currentUser);

    return {
      phone_number: lead.phoneNumber,
      visible: visibleMatches.length > 0,
      matches: visibleMatches.map((match) => ({
        lead_id: match.id,
        full_name: match.fullName,
        uploaded_at: match.uploadedAt.toISOString(),
        assigned_to: match.assignedTo
          ? { id: match.assignedTo.id, name: match.assignedTo.fullName }
          : null,
        team_name: match.assignedTo?.team?.name ?? null,
        status_label: match.assignedTo
          ? `Đã giao: ${match.assignedTo.fullName}`
          : 'Chờ phân chia',
      })),
    };
  }

  /** Leader/Sale: chỉ giữ lại các bản ghi trùng thuộc đúng nhóm mình. */
  private async filterMatchesByOwnTeam(
    matches: Array<
      Lead & {
        assignedTo:
          (Account & { team: { id: string; name: string } | null }) | null;
      }
    >,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.role !== 'leader' && currentUser.role !== 'sale') {
      return [];
    }
    const ownTeamId = await this.getOwnTeamId(currentUser.id);
    if (!ownTeamId) {
      return [];
    }
    return matches.filter((match) => match.assignedTeamId === ownTeamId);
  }

  async create(
    dto: CreateCandidateDto,
    currentUser: AuthenticatedUser,
  ): Promise<CreateCandidateResult> {
    await this.assertSourceExists(dto.source_id);

    const created = await this.prisma.lead.create({
      data: {
        fullName: dto.full_name,
        phoneNumber: dto.phone_number,
        sourceId: dto.source_id,
        mktNote: dto.mkt_note,
        uploadedById: currentUser.id,
      },
    });

    const matches = await this.duplicateService.syncDuplicateFlags(
      created.phoneNumber,
    );
    const otherMatches = matches.filter((match) => match.id !== created.id);

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'lead',
      entityId: created.id,
      newValue: `full_name=${created.fullName}, phone_number=${created.phoneNumber}`,
    });

    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id: created.id },
      include: CANDIDATE_INCLUDE,
    });

    return {
      candidate: toCandidateResponse(final),
      duplicate_warning: await this.buildDuplicateWarning(
        created.phoneNumber,
        otherMatches,
      ),
    };
  }

  async update(
    id: string,
    dto: UpdateCandidateDto,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }

    await this.assertCanModify(existing, currentUser);

    if (dto.source_id) {
      await this.assertSourceExists(dto.source_id);
    }

    // Sửa SĐT trên trang Chi tiết ứng viên (yêu cầu bổ sung) — chuẩn hóa
    // khoảng trắng và từ chối giá trị rỗng sau khi trim, dù DTO cho phép
    // optional (không gửi lên thì giữ nguyên, khác với gửi lên chuỗi rỗng).
    if (dto.phone_number !== undefined) {
      dto.phone_number = dto.phone_number.trim();
      if (!dto.phone_number) {
        throw new UnprocessableEntityException(
          'Số điện thoại không được để trống',
        );
      }
    }

    const oldPhoneNumber = existing.phoneNumber;

    await this.prisma.lead.update({
      where: { id },
      data: {
        fullName: dto.full_name,
        phoneNumber: dto.phone_number,
        birthYear: dto.birth_year,
        address: dto.address,
        sourceId: dto.source_id,
        mktNote: dto.mkt_note,
      },
    });

    if (dto.phone_number && dto.phone_number !== oldPhoneNumber) {
      await this.duplicateService.syncDuplicateFlags(oldPhoneNumber);
      await this.duplicateService.syncDuplicateFlags(dto.phone_number);
    }

    await this.logFieldChanges(currentUser.id, id, existing, dto);

    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }

  /**
   * UI Polish — PUT /candidate/:id/quick-edit: sửa nhanh Năm sinh/Địa chỉ
   * ngay tại trang Chi tiết ứng viên. API MỚI theo yêu cầu trực tiếp người
   * dùng trong phiên làm việc: KHÔNG áp dụng assertCanModify() (giới hạn
   * theo nhóm/người phụ trách) — cố ý cho phép TẤT CẢ 5 vai trò đã đăng
   * nhập (Admin/Quản lý/Leader/MKT/Sale) sửa 2 trường này trên MỌI ứng
   * viên, khác hẳn phạm vi quyền đã đóng góp tại Mục 4, docs/13 cho
   * PUT /candidate/:id — chỉ áp dụng cho đúng 2 trường birth_year/address,
   * không mở thêm quyền sửa trường nào khác.
   */
  async quickEdit(
    id: string,
    dto: QuickEditCandidateDto,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }

    if (dto.birth_year !== undefined && dto.birth_year !== null) {
      const currentYear = new Date().getFullYear();
      if (dto.birth_year > currentYear) {
        throw new UnprocessableEntityException(
          'Năm sinh không được lớn hơn năm hiện tại',
        );
      }
    }

    const address =
      dto.address !== undefined && dto.address !== null
        ? dto.address.trim()
        : dto.address;

    const changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];
    if (dto.birth_year !== undefined && dto.birth_year !== existing.birthYear) {
      changes.push({
        field: 'birth_year',
        oldValue: existing.birthYear?.toString() ?? null,
        newValue: dto.birth_year?.toString() ?? null,
      });
    }
    if (dto.address !== undefined && address !== existing.address) {
      changes.push({
        field: 'address',
        oldValue: existing.address,
        newValue: address ?? null,
      });
    }

    if (changes.length === 0) {
      const unchanged = await this.prisma.lead.findUniqueOrThrow({
        where: { id },
        include: CANDIDATE_INCLUDE,
      });
      return toCandidateResponse(unchanged);
    }

    await this.prisma.lead.update({
      where: { id },
      data: {
        birthYear: dto.birth_year !== undefined ? dto.birth_year : undefined,
        address: dto.address !== undefined ? address : undefined,
      },
    });

    for (const change of changes) {
      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'update',
        entityType: 'lead',
        entityId: id,
        fieldChanged: change.field,
        oldValue: change.oldValue ?? undefined,
        newValue: change.newValue ?? undefined,
      });
    }

    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }

  /** Mục 6, docs/13: POST /candidate/:id/hold — Sale (chỉ với lead của mình). */
  async hold(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    return this.setHold(id, true, currentUser);
  }

  /** Mục 6, docs/13: DELETE /candidate/:id/hold — Sale (chỉ với lead của mình). */
  async unhold(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    return this.setHold(id, false, currentUser);
  }

  /**
   * Admin/Quản lý kế thừa toàn bộ quyền nghiệp vụ của Sale (yêu cầu bổ
   * sung "Admin và Quản lý phải có toàn bộ quyền của các vai trò cấp
   * dưới") — không giới hạn theo người phụ trách, khác Sale (chỉ lead
   * của mình).
   */
  private async setHold(
    id: string,
    isHeld: boolean,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }

    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      // không giới hạn.
    } else if (currentUser.role === 'sale') {
      if (lead.assignedToId !== currentUser.id) {
        throw new ForbiddenException(
          'Bạn chỉ được giữ số ứng viên đang phụ trách',
        );
      }
    } else {
      throw new ForbiddenException(
        'Chỉ Sale, Quản lý hoặc Admin mới được đánh dấu/bỏ đánh dấu giữ số',
      );
    }

    await this.prisma.lead.update({
      where: { id },
      data: isHeld
        ? { isHeld: true, heldById: currentUser.id, heldAt: new Date() }
        : { isHeld: false, heldById: null, heldAt: null },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'hold',
      entityType: 'lead',
      entityId: id,
      fieldChanged: 'is_held',
      oldValue: lead.isHeld.toString(),
      newValue: isHeld.toString(),
    });

    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }

  async remove(id: string, currentUser: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }

    this.assertCanDelete(existing, currentUser);

    await this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: currentUser.id },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'delete',
      entityType: 'lead',
      entityId: id,
    });
  }

  /** Mục 4, docs/13: GET /candidate/pending — MKT, Leader, Quản lý, Admin. */
  async getPending(
    query: PendingCandidatesQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<CandidateResponseDto>> {
    if (!PENDING_VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException(
        'Bạn không có quyền xem danh sách chờ phân chia',
      );
    }

    const where: Record<string, unknown> = {
      deletedAt: null,
      assignedToId: null,
    };
    if (query.source_id) {
      where.sourceId = query.source_id;
    }
    if (query.date_from || query.date_to) {
      where.uploadedAt = {
        gte: query.date_from ? new Date(query.date_from) : undefined,
        lte: query.date_to ? new Date(query.date_to) : undefined,
      };
    }

    const [total, leads] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: CANDIDATE_INCLUDE,
        orderBy: { uploadedAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: leads.map(toCandidateResponse),
    };
  }

  /** Mục 5, docs/13: POST /candidate/:id/assign — Leader (nhóm mình)/Quản lý/Admin. */
  async assign(
    id: string,
    dto: AssignCandidateDto,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }
    if (lead.assignedToId) {
      throw new BadRequestException(
        'Ứng viên đã được phân chia — dùng chức năng Chuyển lead để đổi người phụ trách',
      );
    }

    const target = await this.assertValidAssignTarget(
      dto.account_id,
      currentUser,
    );

    await this.prisma.lead.update({
      where: { id },
      data: {
        assignedToId: target.id,
        assignedTeamId: target.teamId,
        assignedAt: new Date(),
        assignmentMethod: 'manual',
      },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'assign',
      entityType: 'lead',
      entityId: id,
      newValue: target.id,
    });

    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }

  /** Mục 5, docs/13: POST /candidate/assign-bulk — Leader (nhóm mình)/Quản lý/Admin. */
  async assignBulk(
    dto: AssignBulkDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ assigned_count: number }> {
    const target = await this.assertValidAssignTarget(
      dto.account_id,
      currentUser,
    );

    const eligible = await this.prisma.lead.findMany({
      where: {
        id: { in: dto.candidate_ids },
        deletedAt: null,
        assignedToId: null,
      },
      select: { id: true },
    });
    if (eligible.length === 0) {
      return { assigned_count: 0 };
    }

    await this.prisma.lead.updateMany({
      where: { id: { in: eligible.map((lead) => lead.id) } },
      data: {
        assignedToId: target.id,
        assignedTeamId: target.teamId,
        assignedAt: new Date(),
        assignmentMethod: 'manual',
      },
    });

    for (const lead of eligible) {
      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'assign',
        entityType: 'lead',
        entityId: lead.id,
        newValue: target.id,
      });
    }

    return { assigned_count: eligible.length };
  }

  /** Mục 5, docs/13: POST /candidate/:id/transfer — Leader (nhóm mình)/Quản lý/Admin. */
  async transfer(
    id: string,
    dto: TransferCandidateDto,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }
    if (!lead.assignedToId) {
      throw new BadRequestException(
        'Ứng viên chưa được phân chia — dùng chức năng Phân chia trước',
      );
    }
    if (!ASSIGNMENT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền chuyển ứng viên');
    }
    if (currentUser.role === 'leader') {
      const teamId = await this.getOwnTeamId(currentUser.id);
      if (!teamId || lead.assignedTeamId !== teamId) {
        throw new ForbiddenException(
          'Bạn chỉ được chuyển ứng viên trong nhóm mình',
        );
      }
    }

    const target = await this.prisma.account.findUnique({
      where: { id: dto.new_account_id },
    });
    if (!target || target.status !== 'active' || target.role !== 'sale') {
      throw new UnprocessableEntityException(
        'Chỉ được chuyển cho tài khoản vai trò Sale đang hoạt động',
      );
    }
    // Mục 3, docs/09: Leader chuyển lead "trong cùng nhóm" — áp dụng chung
    // cho mọi vai trò được phép chuyển (Sale đích phải thuộc đúng nhóm đang
    // sở hữu lead này, không cho chuyển sang nhóm khác).
    if (target.teamId !== lead.assignedTeamId) {
      throw new ForbiddenException(
        'Chỉ được chuyển cho Sale trong cùng nhóm đang phụ trách ứng viên này',
      );
    }

    const oldAccountId = lead.assignedToId;

    await this.prisma.lead.update({
      where: { id },
      data: { assignedToId: target.id, assignedAt: new Date() },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'transfer',
      entityType: 'lead',
      entityId: id,
      fieldChanged: 'assigned_to',
      oldValue: oldAccountId ?? undefined,
      newValue: dto.reason ? `${target.id} | reason: ${dto.reason}` : target.id,
    });

    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }

  /**
   * Mục 5, docs/13: xác thực tài khoản nhận phân chia — phải là Sale đang
   * hoạt động; nếu người thao tác là Leader thì Sale đó bắt buộc thuộc đúng
   * nhóm mình (Mục 3, docs/09), Quản lý/Admin không bị giới hạn nhóm.
   */
  private async assertValidAssignTarget(
    accountId: string,
    currentUser: AuthenticatedUser,
  ): Promise<Account> {
    if (!ASSIGNMENT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền phân chia ứng viên');
    }

    const target = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!target || target.status !== 'active') {
      throw new NotFoundException('Không tìm thấy tài khoản Sale hợp lệ');
    }
    if (target.role !== 'sale') {
      throw new UnprocessableEntityException(
        'Chỉ được phân chia cho tài khoản vai trò Sale',
      );
    }

    if (currentUser.role === 'leader') {
      const ownTeamId = await this.getOwnTeamId(currentUser.id);
      if (!ownTeamId || target.teamId !== ownTeamId) {
        throw new ForbiddenException(
          'Bạn chỉ được phân chia cho Sale trong nhóm mình',
        );
      }
    }

    return target;
  }

  private async buildDuplicateWarning(
    phoneNumber: string,
    otherMatches: Lead[],
  ): Promise<DuplicateWarning | null> {
    if (otherMatches.length === 0) {
      return null;
    }

    const uploaders = await this.prisma.account.findMany({
      where: { id: { in: otherMatches.map((match) => match.uploadedById) } },
      select: { id: true, fullName: true },
    });
    const uploaderNameById = new Map(
      uploaders.map((uploader) => [uploader.id, uploader.fullName]),
    );

    return {
      phone_number: phoneNumber,
      matches: otherMatches.map((match) => ({
        lead_id: match.id,
        uploaded_at: match.uploadedAt.toISOString(),
        uploaded_by:
          uploaderNameById.get(match.uploadedById) ?? 'Không xác định',
      })),
    };
  }

  /**
   * Mục 8, docs/09: phạm vi xem — Sale: lead của mình; Leader: cả nhóm; còn
   * lại: toàn bộ. Phase 2: kết hợp thêm filter assigned_to/team_id (Mục 4,
   * tài liệu 13) — luôn giao với phạm vi quyền, không cho phép filter vượt
   * ra ngoài phạm vi được xem (vd Leader truyền team_id khác nhóm mình vẫn
   * bị ép về nhóm mình).
   */
  private async buildScopeWhere(
    currentUser: AuthenticatedUser,
    filters?: { assigned_to?: string; team_id?: string },
  ) {
    const where: Record<string, unknown> = { deletedAt: null };
    const assignedToFilter =
      filters?.assigned_to === 'me' ? currentUser.id : filters?.assigned_to;

    if (FULL_ACCESS_ROLES.has(currentUser.role)) {
      if (filters?.team_id) {
        where.assignedTeamId = filters.team_id;
      }
      if (assignedToFilter) {
        where.assignedToId = assignedToFilter;
      }
      return where;
    }

    if (currentUser.role === 'leader') {
      const teamId = await this.getOwnTeamId(currentUser.id);
      where.assignedTeamId = teamId ?? '__none__';
      if (assignedToFilter) {
        where.assignedToId = assignedToFilter;
      }
      return where;
    }

    // sale
    where.assignedToId = currentUser.id;
    return where;
  }

  private async assertInScope(
    lead: Lead,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (FULL_ACCESS_ROLES.has(currentUser.role)) {
      return;
    }

    if (currentUser.role === 'leader') {
      const teamId = await this.getOwnTeamId(currentUser.id);
      if (teamId && lead.assignedTeamId === teamId) {
        return;
      }
      throw new ForbiddenException('Bạn chỉ được xem ứng viên trong nhóm mình');
    }

    if (currentUser.role === 'sale') {
      if (lead.assignedToId === currentUser.id) {
        return;
      }
      // Phase 5 — Mục 8, docs/09: "Sale: lead của mình + cột chăm sóc nhóm
      // mình". Lead đang ở cột chăm sóc (chưa bị Admin gỡ) vẫn xem được nếu
      // cùng nhóm, dù không phải người phụ trách gốc.
      if (isVisibleInCarePool(lead)) {
        const teamId = await this.getOwnTeamId(currentUser.id);
        if (teamId && lead.assignedTeamId === teamId) {
          return;
        }
      }
    }

    throw new ForbiddenException('Bạn không có quyền xem ứng viên này');
  }

  /** Mục 4, docs/13: MKT (data của mình), Sale (lead của mình), Leader (nhóm mình), Quản lý/Admin. */
  private async assertCanModify(
    lead: Lead,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      return;
    }

    if (currentUser.role === 'mkt') {
      if (lead.uploadedById === currentUser.id) {
        return;
      }
      throw new ForbiddenException(
        'Bạn chỉ được sửa dữ liệu do chính mình upload',
      );
    }

    if (currentUser.role === 'sale') {
      if (lead.assignedToId === currentUser.id) {
        return;
      }
      throw new ForbiddenException('Bạn chỉ được sửa ứng viên đang phụ trách');
    }

    if (currentUser.role === 'leader') {
      const teamId = await this.getOwnTeamId(currentUser.id);
      if (teamId && lead.assignedTeamId === teamId) {
        return;
      }
      throw new ForbiddenException('Bạn chỉ được sửa ứng viên trong nhóm mình');
    }

    throw new ForbiddenException('Bạn không có quyền thực hiện hành động này');
  }

  /** Mục 4, docs/13: Admin (mọi ứng viên) hoặc MKT (chỉ data do mình upload). */
  private assertCanDelete(lead: Lead, currentUser: AuthenticatedUser): void {
    if (currentUser.role === 'admin') {
      return;
    }
    if (currentUser.role === 'mkt' && lead.uploadedById === currentUser.id) {
      return;
    }
    throw new ForbiddenException('Bạn không có quyền xóa ứng viên này');
  }

  private async getOwnTeamId(accountId: string): Promise<string | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    return account?.teamId ?? null;
  }

  private async assertSourceExists(sourceId: string): Promise<void> {
    const source = await this.prisma.leadSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) {
      throw new NotFoundException(
        'Không tìm thấy nguồn kênh (source_id không tồn tại)',
      );
    }
  }

  private async logFieldChanges(
    actorId: string,
    entityId: string,
    before: Lead,
    dto: UpdateCandidateDto,
  ): Promise<void> {
    const changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];

    if (dto.full_name !== undefined && dto.full_name !== before.fullName) {
      changes.push({
        field: 'full_name',
        oldValue: before.fullName,
        newValue: dto.full_name,
      });
    }
    if (
      dto.phone_number !== undefined &&
      dto.phone_number !== before.phoneNumber
    ) {
      changes.push({
        field: 'phone_number',
        oldValue: before.phoneNumber,
        newValue: dto.phone_number,
      });
    }
    if (dto.birth_year !== undefined && dto.birth_year !== before.birthYear) {
      changes.push({
        field: 'birth_year',
        oldValue: before.birthYear?.toString() ?? null,
        newValue: String(dto.birth_year),
      });
    }
    if (dto.address !== undefined && dto.address !== before.address) {
      changes.push({
        field: 'address',
        oldValue: before.address,
        newValue: dto.address,
      });
    }
    if (dto.source_id !== undefined && dto.source_id !== before.sourceId) {
      changes.push({
        field: 'source_id',
        oldValue: before.sourceId,
        newValue: dto.source_id,
      });
    }
    if (dto.mkt_note !== undefined && dto.mkt_note !== before.mktNote) {
      changes.push({
        field: 'mkt_note',
        oldValue: before.mktNote,
        newValue: dto.mkt_note,
      });
    }

    for (const change of changes) {
      await this.auditLog.log({
        accountId: actorId,
        actionType: 'update',
        entityType: 'lead',
        entityId,
        fieldChanged: change.field,
        oldValue: change.oldValue ?? undefined,
        newValue: change.newValue ?? undefined,
      });
    }
  }
}
