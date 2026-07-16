import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { RemindCallbackDto } from './dto/remind-callback.dto';
import {
  RemindTargetResponseDto,
  toRemindTargetResponse,
} from './dto/remind-target-response.dto';
import { DuplicateWarning } from './dto/duplicate-warning.dto';
import { DuplicateDetailDto } from './dto/duplicate-detail.dto';
import { ListDuplicatesQueryDto } from './dto/list-duplicates-query.dto';
import { DuplicateGroupDto } from './dto/duplicate-group.dto';
import { LeadDuplicateService } from './lead-duplicate.service';
import { DistributionRuleService } from '../distribution/distribution-rule.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { RealtimeService } from '../realtime/realtime.service';

/** Mục 8, docs/09: Admin/Quản lý/Leader có quyền chia (cho người khác)/chuyển lead. */
const ASSIGNMENT_ROLES = new Set(['admin', 'manager', 'leader']);
/**
 * Dự án phụ — nâng cấp toàn diện: bổ sung 'sale' — Sale giờ cũng xem được
 * "Chờ phân chia" và tự nhận data cho chính mình (xem assertValidAssignTarget()
 * — nhánh sale chỉ được tự nhận, không được phân cho người khác).
 */
const PENDING_VIEW_ROLES = new Set([
  'admin',
  'manager',
  'leader',
  'mkt',
  'sale',
]);

export interface CreateCandidateResult {
  candidate: CandidateResponseDto;
  duplicate_warning: DuplicateWarning | null;
}

/** Vai trò luôn xem/sửa được toàn bộ ứng viên — Mục 2.6 & Mục 8, docs/09. */
const FULL_ACCESS_ROLES = new Set(['admin', 'manager', 'mkt']);

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly duplicateService: LeadDuplicateService,
    private readonly distributionRuleService: DistributionRuleService,
    private readonly realtime: RealtimeService,
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
      // Dùng where.AND (không ghi đè where.OR) — buildScopeWhere() ở trên có
      // thể đã đặt sẵn where.AND cho phạm vi xem của Sale/Leader (gộp "Chờ
      // phân chia"); ghi đè trực tiếp where.OR sẽ xóa mất phạm vi đó.
      const scopeAnd = Array.isArray(where.AND)
        ? (where.AND as Record<string, unknown>[])
        : [];
      where.AND = [
        ...scopeAnd,
        {
          OR: [
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
          ],
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
        // Yêu cầu trực tiếp người dùng (2026-07-16): ưu tiên hiện lead CHƯA
        // được phân chia lên đầu, còn lại xếp theo ngày giờ lên số — đúng 2
        // tiêu chí, không thêm tiêu chí nào khác.
        orderBy: [
          { assignedToId: { sort: 'asc', nulls: 'first' } },
          { uploadedAt: 'desc' },
        ],
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

  /**
   * Mục 2, docs/13-api-design.md — GET /candidate/duplicate: danh sách trùng
   * lặp toàn hệ thống (S15, docs/14-roadmap.md Phase 9), gộp theo SĐT.
   * Quyền: MKT/Quản lý/Admin xem toàn hệ thống (có thể thu hẹp theo team_id);
   * Sale/Leader chỉ xem trong phạm vi nhóm mình — 1 nhóm trùng chỉ hiển thị
   * với Sale/Leader nếu còn ÍT NHẤT 2 bản ghi thuộc đúng nhóm họ sau khi lọc
   * (giữ đúng tinh thần "Trùng khác nhóm: Sale không thấy cảnh báo", Mục 10,
   * tài liệu 09 — không để lộ việc tồn tại trùng lặp ở nhóm khác).
   */
  async listDuplicates(
    query: ListDuplicatesQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<DuplicateGroupDto>> {
    const grouped = await this.prisma.lead.groupBy({
      by: ['phoneNumber'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const duplicatePhones = grouped
      .filter((row) => row._count._all > 1)
      .map((row) => row.phoneNumber);

    if (duplicatePhones.length === 0) {
      return {
        total: 0,
        page: query.page,
        page_size: query.page_size,
        items: [],
      };
    }

    const members = await this.prisma.lead.findMany({
      where: { phoneNumber: { in: duplicatePhones }, deletedAt: null },
      include: CANDIDATE_INCLUDE,
      orderBy: { uploadedAt: 'asc' },
    });

    const byPhone = new Map<string, typeof members>();
    for (const member of members) {
      const list = byPhone.get(member.phoneNumber) ?? [];
      list.push(member);
      byPhone.set(member.phoneNumber, list);
    }

    const isFullAccess = FULL_ACCESS_ROLES.has(currentUser.role);
    const ownTeamId = isFullAccess
      ? null
      : await this.getOwnTeamId(currentUser.id);

    const groups: DuplicateGroupDto[] = [];
    for (const [phoneNumber, groupMembers] of byPhone) {
      let visibleMembers = groupMembers;
      if (!isFullAccess) {
        if (!ownTeamId) continue;
        visibleMembers = groupMembers.filter(
          (member) => member.assignedTeamId === ownTeamId,
        );
        if (visibleMembers.length < 2) continue;
      } else if (query.team_id) {
        if (
          !groupMembers.some(
            (member) => member.assignedTeamId === query.team_id,
          )
        ) {
          continue;
        }
      }
      groups.push({
        phone_number: phoneNumber,
        matches: visibleMembers.map(toCandidateResponse),
      });
    }
    groups.sort((a, b) => a.phone_number.localeCompare(b.phone_number));

    const total = groups.length;
    const start = (query.page - 1) * query.page_size;
    const items = groups.slice(start, start + query.page_size);

    return { total, page: query.page, page_size: query.page_size, items };
  }

  async create(
    dto: CreateCandidateDto,
    currentUser: AuthenticatedUser,
  ): Promise<CreateCandidateResult> {
    await this.assertSourceExists(dto.source_id);
    await this.assertTeamExists(dto.team_id);

    const created = await this.prisma.lead.create({
      data: {
        fullName: dto.full_name,
        phoneNumber: dto.phone_number,
        sourceId: dto.source_id,
        mktNote: dto.mkt_note,
        uploadedById: currentUser.id,
        // Dự án phụ — nâng cấp toàn diện: gán nhóm ngay khi up — CHỈ
        // Leader/Sale nhóm này thấy được (xem buildScopeWhere/getPending),
        // chờ Leader phân số hoặc Sale trong nhóm tự nhận (chưa gán người).
        assignedTeamId: dto.team_id,
      },
    });

    // Phase 6 — Mục 3, docs/09: lead mới tự động gán ngay nếu nhóm đang bật
    // tự động phân chia (round-robin); nếu không, giữ "Chờ phân chia" trong
    // đúng nhóm đã chọn (Dự án phụ — nâng cấp toàn diện: chỉ áp dụng quy tắc
    // tự động phân chia CỦA ĐÚNG NHÓM data này, không lấy quy tắc nhóm khác).
    await this.distributionRuleService.tryAutoAssign(created);

    // Dự án phụ — nâng cấp toàn diện (2026-07-16, ngoài phạm vi Design
    // Freeze docs/09-13, yêu cầu trực tiếp người dùng): "Khi có 1 data mới
    // được up lên nhóm, tất cả thành viên trong nhóm (cả leader) nhận được
    // thông báo nổi + chuông" — báo TOÀN BỘ tài khoản đang active thuộc
    // đúng nhóm vừa nhận data này, bất kể vai trò (Leader/Sale...).
    await this.notifyTeamOfNewData(created, currentUser);

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
    const finalResponse = toCandidateResponse(final);
    this.realtime.emitCandidateChange('created', finalResponse, currentUser);

    return {
      candidate: finalResponse,
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
    const finalResponse = toCandidateResponse(final);
    this.realtime.emitCandidateChange('updated', finalResponse, currentUser);
    return finalResponse;
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
    const finalResponse = toCandidateResponse(final);
    this.realtime.emitCandidateChange('updated', finalResponse, currentUser);
    return finalResponse;
  }

  /** Mục 6, docs/13: POST /candidate/:id/hold — Sale (chỉ với lead của mình). */
  async hold(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    return this.setHold(id, true, currentUser);
  }

  /**
   * Mục 6, docs/13: DELETE /candidate/:id/hold.
   *
   * Dự án phụ — nâng cấp toàn diện (bổ sung nghiệp vụ ngoài docs/09-13 gốc,
   * yêu cầu trực tiếp người dùng): CHỈ người ĐANG giữ số (lead.heldById)
   * mới được bỏ giữ — người khác (kể cả Quản lý, kể cả Sale đang phụ trách
   * lead nhưng không phải người giữ) không bỏ được. Admin có full quyền,
   * bỏ được bất kỳ lead nào bất kể ai đang giữ.
   */
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
   * của mình). Riêng BỎ giữ số (isHeld=false) có thêm ràng buộc: chỉ đúng
   * người đang giữ số hoặc Admin mới được bỏ (xem unhold()).
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
      // không giới hạn theo người phụ trách.
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

    if (
      !isHeld &&
      currentUser.role !== 'admin' &&
      lead.isHeld &&
      lead.heldById !== currentUser.id
    ) {
      throw new ForbiddenException(
        'Chỉ người đang giữ số này (hoặc Admin) mới được bỏ giữ số',
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
    const finalResponse = toCandidateResponse(final);
    this.realtime.emitCandidateChange(
      isHeld ? 'held' : 'unheld',
      finalResponse,
      currentUser,
    );
    return finalResponse;
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

    // Xóa mềm không tự động gỡ cờ "Trùng SĐT" ở các lead còn lại cùng SĐT —
    // tính lại đúng như create()/update() (LeadDuplicateService.syncDuplicateFlags
    // chỉ đếm lead deletedAt: null, nên lead vừa xóa tự loại khỏi phép đếm).
    await this.duplicateService.syncDuplicateFlags(existing.phoneNumber);

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'delete',
      entityType: 'lead',
      entityId: id,
    });

    // Yêu cầu trực tiếp người dùng (2026-07-16): record bị xóa phải "loại
    // khỏi danh sách" ngay ở các trình duyệt khác đang mở — dùng dữ liệu
    // `existing` (Lead TRƯỚC KHI xóa) để tính đối tượng nhận, vì bản ghi đã
    // xóa mềm không còn xuất hiện trong CandidateResponseDto bình thường.
    this.realtime.emitLeadDeleted(
      id,
      {
        assignedTeamId: existing.assignedTeamId,
        assignedToId: existing.assignedToId,
        carePoolLockedById: existing.carePoolLockedById,
        visibleToAllLeaderSale: existing.assignedTeamId === null,
      },
      currentUser,
    );
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
    // Dự án phụ — nâng cấp toàn diện: SỬA LỖI nghiệp vụ — "Chờ phân chia"
    // trước đây hiện cho MỌI Leader/Sale toàn hệ thống bất kể data đã lên
    // nhóm nào. Từ khi up data bắt buộc chọn nhóm, Leader/Sale chỉ thấy
    // đúng data của nhóm mình (hoặc data thật sự chưa có nhóm, vd Excel cũ)
    // — Admin/Quản lý/MKT vẫn xem toàn bộ như cũ (Mục 2.6, docs/09).
    if (currentUser.role === 'leader' || currentUser.role === 'sale') {
      const teamId = await this.getOwnTeamId(currentUser.id);
      where.OR = [
        { assignedTeamId: teamId ?? '__none__' },
        { assignedTeamId: null },
      ];
    }
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
        // Yêu cầu trực tiếp người dùng (2026-07-16): toàn bộ danh sách này
        // đã là "chưa chia" (assignedToId=null) nên chỉ còn xếp theo ngày
        // giờ lên số — không thêm tiêu chí nào khác.
        orderBy: [{ uploadedAt: 'desc' }],
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
    const finalResponse = toCandidateResponse(final);
    this.realtime.emitCandidateChange('assigned', finalResponse, currentUser);
    return finalResponse;
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

    // Yêu cầu trực tiếp người dùng (2026-07-16): mỗi lead vừa gán hàng loạt
    // cũng phải đồng bộ realtime như gán từng cái — 1 truy vấn duy nhất lấy
    // đủ CANDIDATE_INCLUDE cho toàn bộ lead vừa đổi, tránh N+1.
    const updatedLeads = await this.prisma.lead.findMany({
      where: { id: { in: eligible.map((lead) => lead.id) } },
      include: CANDIDATE_INCLUDE,
    });
    for (const lead of updatedLeads) {
      this.realtime.emitCandidateChange(
        'assigned',
        toCandidateResponse(lead),
        currentUser,
      );
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
    const finalResponse = toCandidateResponse(final);
    this.realtime.emitCandidateChange(
      'transferred',
      finalResponse,
      currentUser,
    );
    return finalResponse;
  }

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-16): "nút Nhắc gọi lại ở cột HĐ,
   * trang data lao động — Leader/Admin/Quản lý ấn vào hiện danh sách nhân
   * viên TRONG NHÓM đang phụ trách data đó (không phải nhóm khác)". Trả về
   * TOÀN BỘ thành viên đang active (kể cả Leader) của đúng nhóm đang phụ
   * trách lead này, TRỪ chính người đang xem (không tự nhắc chính mình).
   */
  async getRemindTargets(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<RemindTargetResponseDto[]> {
    const lead = await this.assertRemindEligible(id, currentUser);

    const members = await this.prisma.account.findMany({
      where: {
        teamId: lead.assignedTeamId!,
        status: 'active',
        id: { not: currentUser.id },
      },
      select: { id: true, fullName: true, role: true, avatarUrl: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });

    return members.map(toRemindTargetResponse);
  }

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-16): "Người được nhận nhiệm vụ
   * nhắc nhở gọi lại sẽ nhận được thông báo nổi, chuông thông báo, âm thanh"
   * — tái dùng đúng hạ tầng Notification (NotificationBell tự polling/toast/
   * chuông/âm thanh, không cần đổi gì frontend ngoài khai báo type mới),
   * khớp đúng cách notifyTeamOfNewData() ở create() đã làm.
   */
  async remindCallback(
    id: string,
    dto: RemindCallbackDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: true }> {
    const lead = await this.assertRemindEligible(id, currentUser);

    const target = await this.prisma.account.findUnique({
      where: { id: dto.account_id },
    });
    if (!target || target.status !== 'active') {
      throw new NotFoundException('Không tìm thấy tài khoản hợp lệ để nhắc');
    }
    if (target.teamId !== lead.assignedTeamId) {
      throw new ForbiddenException(
        'Chỉ được nhắc thành viên trong đúng nhóm đang phụ trách ứng viên này',
      );
    }
    if (target.id === currentUser.id) {
      throw new BadRequestException('Không thể tự nhắc chính mình');
    }

    const now = new Date();
    const notification = await this.prisma.notification.create({
      data: {
        accountId: target.id,
        leadId: lead.id,
        type: 'manual_callback_reminder',
        channel: 'in_app',
        content: `Nhắc xử lý data lao động "${lead.fullName}" (${lead.phoneNumber})`,
        senderId: currentUser.id,
        scheduledAt: now,
        sentAt: now,
        status: 'sent',
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true, avatarUrl: true },
        },
      },
    });
    this.realtime.emitNotificationCreated(
      toNotificationResponse(notification),
      currentUser,
    );

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'notification',
      entityId: id,
      newValue: `manual_callback_reminder -> ${target.id}`,
    });

    return { success: true };
  }

  /**
   * Điều kiện dùng chung cho getRemindTargets()/remindCallback(): lead phải
   * tồn tại, chưa xóa mềm, ĐÃ có nhóm phụ trách (assignedTeamId — data chưa
   * gán nhóm thì không có "nhóm" nào để nhắc); người thao tác phải là
   * Admin/Quản lý/Leader (ASSIGNMENT_ROLES), Leader thì bắt buộc đúng nhóm
   * mình đang phụ trách lead này (khớp assertValidAssignTarget()/transfer()).
   */
  private async assertRemindEligible(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }
    if (!lead.assignedTeamId) {
      throw new BadRequestException(
        'Ứng viên chưa thuộc nhóm nào — không thể nhắc gọi lại',
      );
    }
    if (!ASSIGNMENT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền nhắc gọi lại');
    }
    if (currentUser.role === 'leader') {
      const ownTeamId = await this.getOwnTeamId(currentUser.id);
      if (!ownTeamId || lead.assignedTeamId !== ownTeamId) {
        throw new ForbiddenException(
          'Bạn chỉ được nhắc gọi lại cho ứng viên trong nhóm mình',
        );
      }
    }
    return lead;
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
    // Dự án phụ — nâng cấp toàn diện: Sale được gọi POST /candidate/:id/assign
    // ("Nhận data") nhưng CHỈ khi tự nhận cho chính mình — không được phân
    // chia cho Sale khác (đó vẫn là đặc quyền riêng của ASSIGNMENT_ROLES).
    const isSelfClaim =
      currentUser.role === 'sale' && accountId === currentUser.id;
    if (!ASSIGNMENT_ROLES.has(currentUser.role) && !isSelfClaim) {
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
   * Dự án phụ — nâng cấp toàn diện (đổi so với Mục 8, docs/09 gốc): Sale giờ
   * xem được TOÀN BỘ data của nhóm mình (trước đây chỉ lead của mình), khớp
   * cùng phạm vi Leader — dùng "assigned_to=me" để lọc lại về đúng lead của
   * mình cho tab "Cá nhân" trên UI. Leader: cả nhóm; còn lại: toàn bộ.
   * Phase 2: kết hợp thêm filter assigned_to/team_id (Mục 4, tài liệu 13) —
   * luôn giao với phạm vi quyền, không cho phép filter vượt ra ngoài phạm vi
   * được xem (vd Leader truyền team_id khác nhóm mình vẫn bị ép về nhóm mình).
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

    if (currentUser.role === 'leader' || currentUser.role === 'sale') {
      const teamId = await this.getOwnTeamId(currentUser.id);
      if (assignedToFilter) {
        // Tab "Cá nhân" — thu hẹp về đúng 1 người, KHÔNG gộp thêm lead chờ
        // phân chia (khác nghĩa "cá nhân").
        where.assignedTeamId = teamId ?? '__none__';
        where.assignedToId = assignedToFilter;
        return where;
      }
      // Dự án phụ — nâng cấp toàn diện: "Tất cả" gộp lead của nhóm mình VÀ
      // lead THẬT SỰ chưa thuộc nhóm nào (assignedTeamId=null — vd data
      // nhập Excel cũ chưa gán nhóm). SỬA LỖI nghiệp vụ: trước đây dùng
      // "assignedToId: null" làm điều kiện gộp — khiến data đã lên nhóm
      // khác (assignedTeamId đã set, chỉ chưa gán người) vẫn lộ sang MỌI
      // nhóm khác. Từ khi up data bắt buộc chọn nhóm (POST /candidate), 1
      // data thuộc đúng 1 nhóm duy nhất — chỉ Leader/Sale nhóm đó thấy,
      // không còn hiện toàn hệ thống nữa. Dùng where.AND (không phải
      // where.OR trực tiếp) vì list() còn dùng where.OR riêng cho tìm kiếm
      // theo từ khóa — gộp trực tiếp sẽ bị ghi đè mất phạm vi xem.
      where.AND = [
        {
          OR: [
            { assignedTeamId: teamId ?? '__none__' },
            { assignedTeamId: null },
          ],
        },
      ];
      return where;
    }

    return where;
  }

  private async assertInScope(
    lead: Lead,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (FULL_ACCESS_ROLES.has(currentUser.role)) {
      return;
    }

    if (currentUser.role === 'leader' || currentUser.role === 'sale') {
      // Dự án phụ — nâng cấp toàn diện: xem được toàn bộ lead trong nhóm
      // mình (trước đây Sale chỉ xem lead của mình), CỘNG THÊM lead đang
      // "Chờ phân chia" (assignedTeamId=null) — khớp buildScopeWhere() đã
      // gộp "Chờ phân chia" vào "Tất cả". Sửa (assertCanModify) vẫn đòi hỏi
      // đã thuộc đúng nhóm — lead chờ phân chia chỉ XEM được, phải "Nhận
      // data" trước mới sửa được.
      const teamId = await this.getOwnTeamId(currentUser.id);
      if (
        lead.assignedTeamId === null ||
        (teamId && lead.assignedTeamId === teamId)
      ) {
        return;
      }
    }

    throw new ForbiddenException('Bạn không có quyền xem ứng viên này');
  }

  /**
   * Mục 4, docs/13: MKT (data của mình), Sale (lead của mình), Leader (nhóm
   * mình), Quản lý/Admin.
   *
   * Dự án phụ — nâng cấp toàn diện (bổ sung nghiệp vụ ngoài docs/09-13 gốc,
   * yêu cầu trực tiếp người dùng): lead đang được giữ số (isHeld=true) thì
   * CHỈ đúng người đang giữ (heldById) mới sửa được — người khác (kể cả
   * Quản lý) đều bị chặn. Admin có full quyền, không bị ràng buộc này.
   */
  private async assertCanModify(
    lead: Lead,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === 'admin') {
      return;
    }

    if (lead.isHeld && lead.heldById !== currentUser.id) {
      throw new ForbiddenException(
        'Ứng viên này đang được giữ số, chỉ người đang giữ mới sửa được',
      );
    }

    if (currentUser.role === 'manager') {
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
      // Dự án phụ — nâng cấp toàn diện: Sale khác trong cùng nhóm sửa được
      // ứng viên KHÔNG phải của mình, NHƯNG chỉ khi ứng viên đó đã được xử
      // lý ít nhất 1 lần (lastActivityAt khác null) — tôn trọng quyền xử lý
      // số hoàn toàn mới của người phụ trách gốc, tránh giành số.
      const teamId = await this.getOwnTeamId(currentUser.id);
      if (
        teamId &&
        lead.assignedTeamId === teamId &&
        lead.lastActivityAt !== null
      ) {
        return;
      }
      throw new ForbiddenException(
        lead.lastActivityAt === null
          ? 'Ứng viên này chưa được người phụ trách xử lý lần nào, chưa thể sửa'
          : 'Bạn chỉ được sửa ứng viên trong nhóm mình',
      );
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

  /** Dự án phụ — nâng cấp toàn diện: xác thực team_id khi up data mới. */
  private async assertTeamExists(teamId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(
        'Không tìm thấy nhóm (team_id không tồn tại)',
      );
    }
  }

  /**
   * Yêu cầu trực tiếp người dùng (2026-07-16): "Khi có 1 data mới được up
   * lên nhóm. Tất cả những thành viên trong nhóm (cả leader) sẽ nhận được
   * thông báo nổi, chuông thông báo" — tạo 1 Notification/thành viên, kênh
   * `in_app` (NotificationBell tự polling + hiện toast nổi + chuông, không
   * cần đổi gì ở frontend ngoài khai báo type mới). Không chặn luồng tạo
   * lead nếu bước này lỗi — tách try/catch riêng, giống cách tryAutoAssign()
   * ở trên tự nuốt lỗi để không làm hỏng thao tác chính.
   */
  private async notifyTeamOfNewData(
    lead: Lead,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (!lead.assignedTeamId) return;

    try {
      const members = await this.prisma.account.findMany({
        where: { teamId: lead.assignedTeamId, status: 'active' },
        select: { id: true },
      });
      if (members.length === 0) return;

      const now = new Date();
      await this.prisma.notification.createMany({
        data: members.map((member) => ({
          accountId: member.id,
          leadId: lead.id,
          type: 'new_data_uploaded' as const,
          channel: 'in_app' as const,
          content: `Có data mới được thêm vào nhóm: ${lead.fullName} (${lead.phoneNumber})`,
          senderId: lead.uploadedById,
          scheduledAt: now,
          sentAt: now,
          status: 'sent' as const,
        })),
      });

      // createMany() không trả lại các dòng vừa tạo — truy vấn lại đúng lô
      // vừa ghi bằng (leadId, type, scheduledAt) — đủ định danh (1 lead chỉ
      // kích hoạt hàm này đúng 1 lần lúc tạo lead), không đụng cách ghi gốc.
      const created = await this.prisma.notification.findMany({
        where: { leadId: lead.id, type: 'new_data_uploaded', scheduledAt: now },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, avatarUrl: true },
          },
        },
      });
      for (const notification of created) {
        this.realtime.emitNotificationCreated(
          toNotificationResponse(notification),
          currentUser,
        );
      }
    } catch (error) {
      this.logger.error(
        `Gửi thông báo "data mới" thất bại cho lead ${lead.id}`,
        error as Error,
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
