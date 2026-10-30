import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CareAssignmentMethod, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { SYSTEM_USERNAME } from '../common/utils/system-account.util';
import {
  CANDIDATE_INCLUDE,
  CandidateResponseDto,
  toCandidateResponse,
} from '../candidates/dto/candidate-response.dto';
import { buildLeadKeywordWhere } from '../candidates/lead-keyword-search';
import { RealtimeService } from '../realtime/realtime.service';
import { toNotificationResponse } from '../notification/dto/notification-response.dto';
import { LeadChangeType } from '../realtime/realtime-event.interface';
import {
  AssignmentRow,
  LeadMonthSummary,
  NoteIndex,
  assignmentProcessedAt,
  computeAssignmentRange,
  computeSaleDaily,
  computeSaleMonthly,
  pickRandomAssignments,
  rate,
  summarizeLeadMonth,
  wasCareStoppedAt,
} from './care-metrics';
import {
  countCareDays,
  vnDateOnly,
  vnDayRange,
  vnMonthKey,
  vnMonthRange,
  vnMonthStart,
} from './care-time.util';
import { ListCareWarehouseQueryDto } from './dto/list-care-warehouse-query.dto';
import { RandomPreviewDto } from './dto/random-assign.dto';
import { CareProgressQueryDto } from './dto/care-progress-query.dto';
import { ListBatchesQueryDto } from './dto/list-batches-query.dto';

/** Quản lý/Admin thao tác trên mọi nhóm (Câu 4 đã chốt — giống mọi module hiện nay). */
const FULL_ACCESS_ROLES = new Set(['admin', 'manager']);
const ASSIGNER_ROLES = new Set(['admin', 'manager', 'leader']);

/** field_changed của audit_logs dùng để dựng lại trạng thái Dừng chăm sóc theo thời gian. */
export const CARE_STOP_AUDIT_FIELD = 'care_stopped_at';
/** field_changed của audit_logs cho đề nghị dừng chăm sóc (requested/approved/rejected). */
export const CARE_STOP_REQUEST_AUDIT_FIELD = 'care_stop_request';

const ACCOUNT_REF_SELECT = {
  id: true,
  fullName: true,
  nickname: true,
  role: true,
  avatarUrl: true,
} as const;

type Tx = Prisma.TransactionClient;

/** Đợt giao tới 500 data trên PGlite (dev) có thể vượt mặc định 5 giây của Prisma. */
const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };

/**
 * Ghi chú được tính là 1 lần chăm sóc: chưa xoá và KHÔNG phải ghi chú
 * "Hệ thống" chép từ sheet khi Tải data cũ (yêu cầu người dùng 2026-10-30)
 * — data cũ vừa tải lên là "Chưa chăm sóc". Điều kiện vào Kho (có ít nhất
 * 1 ghi chú) vẫn tính cả ghi chú Hệ thống.
 */
const CARE_NOTE_WHERE: Prisma.LeadNoteWhereInput = {
  isDeleted: false,
  createdBy: { username: { not: SYSTEM_USERNAME } },
};

export type SkipReason =
  | 'not_eligible'
  | 'out_of_scope'
  | 'team_mismatch'
  | 'duplicate_in_request'
  | 'already_assigned_same'
  | 'assigned_to_other'
  | 'held_by_other';

const SKIP_MESSAGES: Record<SkipReason, string> = {
  not_eligible: 'Data không còn đủ điều kiện trong Kho chăm sóc',
  out_of_scope: 'Data không thuộc nhóm bạn quản lý',
  team_mismatch: 'Sale nhận không cùng nhóm với data',
  duplicate_in_request: 'Data bị chọn trùng trong cùng 1 đợt',
  already_assigned_same: 'Data đang được giao cho chính Sale này',
  assigned_to_other:
    'Data đang được giao cho Sale khác và chưa xử lý — dùng "Giao lại" nếu muốn đổi người',
  held_by_other:
    'Data đang được giữ số — không giao cho người khác cho tới khi bỏ giữ số',
};

export interface AccountRef {
  id: string;
  name: string;
  nickname: string | null;
  role: string;
  avatar_url: string | null;
}

function toAccountRef(a: {
  id: string;
  fullName: string;
  nickname: string | null;
  role: string;
  avatarUrl: string | null;
}): AccountRef {
  return {
    id: a.id,
    name: a.fullName,
    nickname: a.nickname,
    role: a.role,
    avatar_url: a.avatarUrl,
  };
}

/**
 * Kho chăm sóc (2026-10-28, yêu cầu trực tiếp người dùng). Không sao chép
 * data: Kho là một "góc nhìn" trên bảng leads theo điều kiện
 * `eligibleWhere()`. Phân công là lớp "nhiệm vụ chăm sóc" riêng
 * (care_assignments) — KHÔNG đổi leads.assigned_to (người phụ trách gốc).
 */
@Injectable()
export class CareWarehouseService {
  private readonly logger = new Logger(CareWarehouseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ===========================================================================
  // Điều kiện vào Kho + phạm vi xem
  // ===========================================================================

  /**
   * Điều kiện đã chốt: đã có người phụ trách, có ≥1 ghi chú chưa xóa, chưa bị
   * xóa, chưa bị "Dừng chăm sóc", và KHÔNG có lịch gọi lại chưa hoàn thành
   * trong hôm nay (trường hợp đó vẫn ở luồng Data lao động).
   */
  eligibleWhere(now: Date): Prisma.LeadWhereInput {
    const today = vnDayRange(vnDateOnly(now));
    return {
      deletedAt: null,
      assignedToId: { not: null },
      careStoppedAt: null,
      notes: { some: { isDeleted: false } },
      callbacks: {
        none: {
          deletedAt: null,
          isCompleted: false,
          OR: [
            { scheduledAt: { gte: today.start, lt: today.end } },
            // Lịch "Mỗi ngày" đã bắt đầu = hôm nay cũng có lịch gọi lại.
            { repeatDaily: true, scheduledAt: { lt: today.end } },
          ],
        },
      },
    };
  }

  /**
   * Nhóm được xem: Quản lý/Admin/MKT = mọi nhóm (hoặc nhóm đang lọc), Leader/
   * Sale = CHỈ nhóm mình (bỏ qua team_id client gửi lên). Các vai trò khác
   * không dùng Kho.
   * Trả về null = không giới hạn nhóm.
   */
  private async resolveTeamScope(
    user: AuthenticatedUser,
    requestedTeamId?: string,
  ): Promise<string | null> {
    // MKT xem Kho toàn công ty (yêu cầu người dùng 2026-10-28) — CHỈ xem:
    // mọi thao tác giao/nhận/dừng đều chặn MKT ở các hàm tương ứng.
    if (FULL_ACCESS_ROLES.has(user.role) || user.role === 'mkt') {
      return requestedTeamId ?? null;
    }
    if (user.role !== 'leader' && user.role !== 'sale') {
      throw new ForbiddenException('Bạn không có quyền xem Kho chăm sóc');
    }
    const teamId = await this.getOwnTeamId(user.id);
    if (!teamId) {
      throw new ForbiddenException('Tài khoản của bạn chưa thuộc nhóm nào');
    }
    return teamId;
  }

  private async getOwnTeamId(accountId: string): Promise<string | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { teamId: true },
    });
    return account?.teamId ?? null;
  }

  // ===========================================================================
  // Danh sách Kho + thống kê
  // ===========================================================================

  async list(query: ListCareWarehouseQueryDto, user: AuthenticatedUser) {
    const now = new Date();
    const monthStart = vnMonthStart(now);
    const teamId = await this.resolveTeamScope(user, query.team_id);

    const scopeWhere: Prisma.LeadWhereInput = {
      ...this.eligibleWhere(now),
      ...(teamId ? { assignedTeamId: teamId } : {}),
    };
    // Cùng điều kiện tìm kiếm với tab Tất cả (tên/SĐT/ghi chú/địa chỉ/năm sinh).
    const searchWhere = buildLeadKeywordWhere(query.search);
    const leadWhere: Prisma.LeadWhereInput = searchWhere
      ? { ...scopeWhere, ...searchWhere }
      : scopeWhere;

    const leads = await this.prisma.lead.findMany({
      where: leadWhere,
      select: { id: true, uploadedAt: true },
    });
    const ids = leads.map((l) => l.id);
    const uploadedAt = new Map(
      leads.map((l) => [l.id, l.uploadedAt.getTime()]),
    );

    const { summaries, totals, lastAssigned } = await this.loadLeadSummaries(
      leadWhere,
      ids,
      monthStart,
      now,
    );

    // Thống kê lấy trên TOÀN BỘ data trong phạm vi (trước khi áp các bộ lọc
    // trạng thái/Sale/số lần...), để thanh thống kê ổn định khi đổi bộ lọc.
    const stats = {
      total: ids.length,
      cared: 0,
      not_cared: 0,
      assigned_pending: 0,
      care_turns_month: 0,
      care_turns_total: 0,
      mine_assigned: 0,
      mine_pending: 0,
    };
    for (const id of ids) {
      const s = summaries.get(id)!;
      if (s.month_status === 'cared') stats.cared++;
      else stats.not_cared++;
      if (s.assigned_pending) stats.assigned_pending++;
      stats.care_turns_month += s.month_care_count;
      stats.care_turns_total += totals.get(id)?.count ?? 0;
      if (s.open_assignment?.assignee_id === user.id) {
        stats.mine_assigned++;
        if (!s.open_assignment.processed) stats.mine_pending++;
      }
    }
    const range = await this.progressStats(
      query,
      user,
      now,
      teamId,
      searchWhere ? null : { cared: stats.cared, total: stats.total },
    );
    // Thẻ "Chăm sóc (N)": tổng data trong Kho theo bộ lọc Nhóm/Nhân viên của
    // thanh Tiến độ (yêu cầu người dùng 2026-10-29), không tính ô tìm kiếm.
    // Sale không có bộ lọc đó → tổng Kho của nhóm mình.
    const warehouseTotal =
      user.role !== 'sale'
        ? range.in_warehouse
        : searchWhere
          ? await this.prisma.lead.count({ where: scopeWhere })
          : ids.length;

    const lastCareFrom = query.last_care_from
      ? vnDayRange(query.last_care_from).start
      : null;
    const lastCareTo = query.last_care_to
      ? vnDayRange(query.last_care_to).end
      : null;
    const assignedFrom = query.assigned_from
      ? vnDayRange(query.assigned_from).start
      : null;
    const assignedTo = query.assigned_to
      ? vnDayRange(query.assigned_to).end
      : null;

    const filtered = ids.filter((id) => {
      const s = summaries.get(id)!;
      const total = totals.get(id);
      const lastAt = lastAssigned.get(id) ?? null;
      if (
        query.scope === 'assigned' &&
        s.open_assignment?.assignee_id !== user.id
      ) {
        return false;
      }
      if (query.status === 'cared' && s.month_status !== 'cared') return false;
      if (query.status === 'not_cared' && s.month_status !== 'not_cared') {
        return false;
      }
      if (query.status === 'assigned_pending' && !s.assigned_pending) {
        return false;
      }
      if (
        query.assignee_id &&
        s.open_assignment?.assignee_id !== query.assignee_id
      ) {
        return false;
      }
      const count = total?.count ?? 0;
      if (query.care_count_min !== undefined && count < query.care_count_min) {
        return false;
      }
      if (query.care_count_max !== undefined && count > query.care_count_max) {
        return false;
      }
      const lastCare = total?.lastAt ?? null;
      if (lastCareFrom && (!lastCare || lastCare < lastCareFrom)) return false;
      if (lastCareTo && (!lastCare || lastCare >= lastCareTo)) return false;
      if (assignedFrom && (!lastAt || lastAt < assignedFrom)) return false;
      if (assignedTo && (!lastAt || lastAt >= assignedTo)) return false;
      return true;
    });

    // Xếp theo ngày giờ lên số giảm dần — mới nhất trước, giống tab Tất cả
    // (yêu cầu người dùng 2026-10-30, thay cho "lâu chưa chăm sóc nhất lên
    // đầu"); bấm tiêu đề STT để đảo ngược.
    const dir = query.order === 'desc' ? -1 : 1;
    filtered.sort(
      (a, b) =>
        dir * (uploadedAt.get(b)! - uploadedAt.get(a)! || b.localeCompare(a)),
    );

    const pageIds = filtered.slice(
      (query.page - 1) * query.page_size,
      query.page * query.page_size,
    );
    const items = await this.buildItems(
      pageIds,
      summaries,
      totals,
      lastAssigned,
    );

    return {
      total: filtered.length,
      page: query.page,
      page_size: query.page_size,
      month: vnMonthKey(now),
      stats: { ...stats, range, warehouse_total: warehouseTotal },
      items,
    };
  }

  /**
   * Được giao / Đã xử lý / Chưa xử lý theo khoảng ngày (mặc định tháng này)
   * cho thanh thống kê đầu Kho. Sale chỉ tính lượt giao của chính mình;
   * Leader/Quản lý/Admin/MKT tính cả phạm vi nhóm đang xem. Không phụ thuộc
   * điều kiện "đang trong Kho" — data đã rời Kho sau khi xử lý vẫn được đếm.
   */
  /**
   * Số liệu thanh "Tiến độ" — có bộ lọc Nhóm/Nhân viên riêng, độc lập với
   * bộ lọc danh sách (yêu cầu người dùng 2026-10-29). Nhóm: chỉ Quản lý/
   * Admin/MKT chọn được; Leader/Sale luôn là nhóm mình. Nhân viên: Sale luôn
   * là chính mình.
   * - assigned/processed/pending: theo khoảng ngày (assignmentRangeStats).
   * - cared_month/in_warehouse ("Đã CS/Data"): data đang trong Kho đã được
   *   chăm sóc trong tháng / tổng; lọc nhân viên = data đang giao cho người đó.
   * `listCounts`: số của danh sách khi cùng phạm vi, dùng lại khỏi tính lại.
   */
  private async progressStats(
    query: ListCareWarehouseQueryDto,
    user: AuthenticatedUser,
    now: Date,
    listTeamId: string | null,
    listCounts: { cared: number; total: number } | null,
  ) {
    const teamId =
      FULL_ACCESS_ROLES.has(user.role) || user.role === 'mkt'
        ? (query.stats_team_id ?? null)
        : await this.resolveTeamScope(user);
    const assigneeId =
      user.role === 'sale' ? user.id : (query.stats_assignee_id ?? null);

    const range = await this.assignmentRangeStats(
      query,
      teamId,
      assigneeId,
      now,
    );

    let cared = listCounts?.cared ?? 0;
    let total = listCounts?.total ?? 0;
    if (
      user.role !== 'sale' &&
      (!listCounts || teamId !== listTeamId || assigneeId)
    ) {
      const monthStart = vnMonthStart(now);
      const where: Prisma.LeadWhereInput = {
        ...this.eligibleWhere(now),
        ...(teamId ? { assignedTeamId: teamId } : {}),
        // Lượt giao còn hiệu lực luôn nằm trong tháng này và chưa đóng.
        ...(assigneeId
          ? {
              careAssignments: {
                some: {
                  assigneeId,
                  endedAt: null,
                  assignedAt: { gte: monthStart },
                },
              },
            }
          : {}),
      };
      const leads = await this.prisma.lead.findMany({
        where,
        select: { id: true },
      });
      const ids = leads.map((l) => l.id);
      const { summaries } = await this.loadLeadSummaries(
        where,
        ids,
        monthStart,
        now,
      );
      cared = 0;
      total = 0;
      for (const id of ids) {
        const s = summaries.get(id)!;
        if (assigneeId && s.open_assignment?.assignee_id !== assigneeId) {
          continue;
        }
        total++;
        if (s.month_status === 'cared') cared++;
      }
    }
    return { ...range, cared_month: cared, in_warehouse: total };
  }

  private async assignmentRangeStats(
    query: ListCareWarehouseQueryDto,
    teamId: string | null,
    assigneeId: string | null,
    now: Date,
  ) {
    const from = query.stats_from
      ? vnDayRange(query.stats_from).start
      : query.stats_to
        ? null
        : vnMonthStart(now);
    const to = query.stats_to ? vnDayRange(query.stats_to).end : now;
    const leadWhere: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(teamId ? { assignedTeamId: teamId } : {}),
    };
    const assignmentWhere: Prisma.CareAssignmentWhereInput = {
      assignedAt: { ...(from ? { gte: from } : {}), lt: to },
      ...(assigneeId ? { assigneeId } : {}),
    };
    const assignments = await this.prisma.careAssignment.findMany({
      where: { ...assignmentWhere, lead: leadWhere },
      select: {
        id: true,
        leadId: true,
        assigneeId: true,
        assignedAt: true,
        endedAt: true,
      },
    });
    // Lọc theo quan hệ thay vì danh sách id — tránh giới hạn tham số Postgres.
    const notes = assignments.length
      ? await this.prisma.leadNote.findMany({
          where: {
            ...CARE_NOTE_WHERE,
            ...(from ? { createdAt: { gte: from } } : {}),
            lead: { ...leadWhere, careAssignments: { some: assignmentWhere } },
          },
          select: { leadId: true, createdById: true, createdAt: true },
        })
      : [];
    const metrics = computeAssignmentRange(
      assignments,
      new NoteIndex(notes),
      from ?? new Date(0),
      to,
      now,
    );
    return {
      from: from ? vnDateOnly(from) : null,
      to: vnDateOnly(new Date(to.getTime() - 1)),
      ...metrics,
    };
  }

  /**
   * Tải 1 lần toàn bộ ghi chú/lượt giao của tập data, rồi tính trạng thái
   * từng data bằng hàm thuần. Lọc theo quan hệ `lead: leadWhere` thay vì
   * danh sách id để không đụng giới hạn số tham số của Postgres.
   */
  private async loadLeadSummaries(
    leadWhere: Prisma.LeadWhereInput,
    ids: string[],
    monthStart: Date,
    now: Date,
  ) {
    const monthNotes = await this.prisma.leadNote.findMany({
      where: {
        ...CARE_NOTE_WHERE,
        createdAt: { gte: monthStart },
        lead: leadWhere,
      },
      select: { leadId: true, createdById: true, createdAt: true },
    });
    const monthAssignments = await this.prisma.careAssignment.findMany({
      where: { assignedAt: { gte: monthStart }, lead: leadWhere },
      select: {
        id: true,
        leadId: true,
        assigneeId: true,
        assignedAt: true,
        endedAt: true,
      },
    });
    // Tổng số lần chăm sóc = số ngày khác nhau có ghi chú → cần mốc từng
    // ghi chú (groupBy không gom được theo ngày giờ VN).
    const allNotes = await this.prisma.leadNote.findMany({
      where: { ...CARE_NOTE_WHERE, lead: leadWhere },
      select: { leadId: true, createdAt: true },
    });
    const assignmentMax = await this.prisma.careAssignment.groupBy({
      by: ['leadId'],
      where: { lead: leadWhere },
      _max: { assignedAt: true },
    });

    const noteIndex = new NoteIndex(monthNotes);
    const assignmentsByLead = new Map<string, AssignmentRow[]>();
    for (const a of monthAssignments) {
      const list = assignmentsByLead.get(a.leadId);
      if (list) list.push(a);
      else assignmentsByLead.set(a.leadId, [a]);
    }

    const summaries = new Map<string, LeadMonthSummary>();
    for (const id of ids) {
      summaries.set(
        id,
        summarizeLeadMonth(
          id,
          assignmentsByLead.get(id) ?? [],
          noteIndex,
          monthStart,
          now,
        ),
      );
    }
    const notesByLead = new Map<string, Date[]>();
    for (const n of allNotes) {
      const list = notesByLead.get(n.leadId);
      if (list) list.push(n.createdAt);
      else notesByLead.set(n.leadId, [n.createdAt]);
    }
    const totals = new Map(
      [...notesByLead].map(([leadId, dates]) => [
        leadId,
        {
          count: countCareDays(dates),
          lastAt: new Date(Math.max(...dates.map((d) => d.getTime()))),
        },
      ]),
    );
    const lastAssigned = new Map(
      assignmentMax.map((a) => [a.leadId, a._max.assignedAt]),
    );
    return { summaries, totals, lastAssigned };
  }

  private async buildItems(
    pageIds: string[],
    summaries: Map<string, LeadMonthSummary>,
    totals: Map<string, { count: number; lastAt: Date | null }>,
    lastAssigned: Map<string, Date | null>,
  ) {
    if (pageIds.length === 0) return [];
    const [leads, latestNotes] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where: { id: { in: pageIds } },
        include: CANDIDATE_INCLUDE,
      }),
      this.prisma.leadNote.findMany({
        where: { leadId: { in: pageIds }, isDeleted: false },
        orderBy: [{ leadId: 'asc' }, { createdAt: 'desc' }],
        distinct: ['leadId'],
        select: {
          leadId: true,
          content: true,
          createdAt: true,
          createdBy: { select: ACCOUNT_REF_SELECT },
          callStatus: { select: { id: true, name: true } },
          callResult: { select: { id: true, name: true } },
        },
      }),
    ]);
    const assigneeIds = [
      ...new Set(
        pageIds
          .map((id) => summaries.get(id)?.open_assignment?.assignee_id)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const assignees = assigneeIds.length
      ? await this.prisma.account.findMany({
          where: { id: { in: assigneeIds } },
          select: ACCOUNT_REF_SELECT,
        })
      : [];
    const assigneeById = new Map(assignees.map((a) => [a.id, toAccountRef(a)]));
    const leadById = new Map(leads.map((l) => [l.id, l]));
    const noteByLead = new Map(latestNotes.map((n) => [n.leadId, n]));

    return pageIds
      .filter((id) => leadById.has(id))
      .map((id) => {
        const s = summaries.get(id)!;
        const note = noteByLead.get(id);
        return {
          ...toCandidateResponse(leadById.get(id)!),
          care: {
            month_status: s.month_status,
            month_care_count: s.month_care_count,
            total_care_count: totals.get(id)?.count ?? 0,
            last_care_at: note?.createdAt.toISOString() ?? null,
            last_care_by: note ? toAccountRef(note.createdBy) : null,
            last_care_result: note
              ? {
                  call_status: note.callStatus,
                  call_result: note.callResult,
                  content: note.content,
                }
              : null,
            open_assignment: s.open_assignment
              ? {
                  id: s.open_assignment.id,
                  assignee:
                    assigneeById.get(s.open_assignment.assignee_id) ?? null,
                  assigned_at: s.open_assignment.assigned_at.toISOString(),
                  processed: s.open_assignment.processed,
                }
              : null,
            assigned_pending: s.assigned_pending,
            last_assigned_at: lastAssigned.get(id)?.toISOString() ?? null,
          },
        };
      });
  }

  // ===========================================================================
  // Phân công (thủ công / ngẫu nhiên / Sale tự nhận) — dùng chung 1 lõi
  // ===========================================================================

  async assignManual(
    leadIds: string[],
    assigneeId: string,
    user: AuthenticatedUser,
  ) {
    this.assertAssigner(user);
    return this.assignPairs(
      leadIds.map((leadId) => ({ leadId, assigneeId })),
      'manual',
      user,
    );
  }

  async randomConfirm(
    pairs: { lead_id: string; assignee_id: string }[],
    user: AuthenticatedUser,
  ) {
    this.assertAssigner(user);
    return this.assignPairs(
      pairs.map((p) => ({ leadId: p.lead_id, assigneeId: p.assignee_id })),
      'random',
      user,
    );
  }

  /**
   * Xem trước giao ngẫu nhiên — KHÔNG ghi gì. Danh sách trả về được gửi lại
   * nguyên vẹn ở bước xác nhận, backend kiểm tra lại từng data lúc đó.
   */
  async randomPreview(dto: RandomPreviewDto, user: AuthenticatedUser) {
    this.assertAssigner(user);
    if ((dto.per_assignee === undefined) === (dto.total === undefined)) {
      throw new BadRequestException(
        'Nhập số lượng cho từng Sale HOẶC tổng số lượng (chỉ 1 trong 2)',
      );
    }
    const assigneeIds = [...new Set(dto.assignee_ids)];
    const assignees = await this.loadValidAssignees(assigneeIds, user);

    const quotas = new Map<string, number>();
    assigneeIds.forEach((id, i) => {
      if (dto.per_assignee !== undefined) quotas.set(id, dto.per_assignee);
      else {
        const base = Math.floor(dto.total! / assigneeIds.length);
        quotas.set(id, base + (i < dto.total! % assigneeIds.length ? 1 : 0));
      }
    });

    const now = new Date();
    const monthStart = vnMonthStart(now);
    const teamIds = [...new Set(assignees.map((a) => a.teamId!))];
    // Data đang giữ số không được chia ngẫu nhiên (yêu cầu người dùng 2026-10-30).
    const leadWhere: Prisma.LeadWhereInput = {
      ...this.eligibleWhere(now),
      assignedTeamId: { in: teamIds },
      isHeld: false,
    };
    const leads = await this.prisma.lead.findMany({
      where: leadWhere,
      select: { id: true, assignedTeamId: true },
    });
    const { summaries } = await this.loadLeadSummaries(
      leadWhere,
      leads.map((l) => l.id),
      monthStart,
      now,
    );

    const candidates = leads.flatMap((l) => {
      const priority = summaries.get(l.id)?.random_priority ?? null;
      return priority === null
        ? []
        : [{ leadId: l.id, teamId: l.assignedTeamId!, priority }];
    });
    const picks = pickRandomAssignments(
      candidates,
      assigneeIds.map((id) => {
        const a = assignees.find((x) => x.id === id)!;
        return { id, teamId: a.teamId!, quota: quotas.get(id)! };
      }),
    );

    const pickedLeads = picks.length
      ? await this.prisma.lead.findMany({
          where: { id: { in: picks.map((p) => p.leadId) } },
          select: { id: true, fullName: true, phoneNumber: true },
        })
      : [];
    const leadInfo = new Map(pickedLeads.map((l) => [l.id, l]));

    const requestedTotal = [...quotas.values()].reduce((a, b) => a + b, 0);
    return {
      requested_total: requestedTotal,
      available_total: candidates.length,
      picked_total: picks.length,
      shortage: picks.length < requestedTotal,
      by_priority: {
        1: picks.filter((p) => p.priority === 1).length,
        2: picks.filter((p) => p.priority === 2).length,
        3: picks.filter((p) => p.priority === 3).length,
      },
      per_assignee: assigneeIds.map((id) => {
        const a = assignees.find((x) => x.id === id)!;
        return {
          assignee: toAccountRef(a),
          requested: quotas.get(id)!,
          picked: picks.filter((p) => p.assigneeId === id).length,
        };
      }),
      pairs: picks.map((p) => ({
        lead_id: p.leadId,
        assignee_id: p.assigneeId,
        priority: p.priority,
        full_name: leadInfo.get(p.leadId)?.fullName ?? '',
        phone_number: leadInfo.get(p.leadId)?.phoneNumber ?? '',
      })),
    };
  }

  /** Sale tự nhận 1 data trong Kho của nhóm mình. */
  async claim(leadId: string, user: AuthenticatedUser) {
    if (user.role !== 'sale') {
      throw new ForbiddenException('Chỉ Sale mới tự nhận data trong Kho');
    }
    const result = await this.assignPairs(
      [{ leadId, assigneeId: user.id }],
      'self',
      user,
    );
    if (result.assigned.length === 0) {
      const reason = result.skipped[0]?.reason;
      if (reason === 'already_assigned_same') return result;
      if (reason === 'assigned_to_other') {
        throw new ConflictException(SKIP_MESSAGES.assigned_to_other);
      }
      throw new BadRequestException(
        result.skipped[0]?.message ?? 'Không nhận được data này',
      );
    }
    return result;
  }

  /**
   * Lõi phân công. Chống trùng khi nhiều người thao tác cùng lúc: khóa các
   * dòng leads liên quan (`SELECT ... FOR UPDATE`, theo thứ tự id để không
   * deadlock) trong 1 transaction, rồi kiểm tra lại điều kiện ngay trong
   * transaction đó. Data không hợp lệ bị BỎ QUA và báo lại, không làm hỏng
   * cả đợt.
   */
  private async assignPairs(
    pairs: { leadId: string; assigneeId: string }[],
    method: CareAssignmentMethod,
    user: AuthenticatedUser,
  ) {
    const assigneeIds = [...new Set(pairs.map((p) => p.assigneeId))];
    const assignees =
      method === 'self'
        ? await this.loadSelfAsAssignee(user)
        : await this.loadValidAssignees(assigneeIds, user);
    const assigneeById = new Map(assignees.map((a) => [a.id, a]));
    const actorTeamId = await this.actorTeamId(user);

    const now = new Date();
    const monthStart = vnMonthStart(now);
    const leadIds = [...new Set(pairs.map((p) => p.leadId))];

    const outcome = await this.prisma.$transaction(async (tx) => {
      await this.lockLeads(tx, leadIds);

      const eligible = await tx.lead.findMany({
        where: { id: { in: leadIds }, ...this.eligibleWhere(now) },
        select: {
          id: true,
          assignedTeamId: true,
          isHeld: true,
          heldById: true,
        },
      });
      const eligibleById = new Map(eligible.map((l) => [l.id, l]));
      const open = await this.loadOpenAssignments(tx, leadIds, monthStart, now);

      const skipped: {
        lead_id: string;
        assignee_id: string;
        reason: SkipReason;
      }[] = [];
      const accepted: { leadId: string; assigneeId: string }[] = [];
      const toClose: string[] = [];
      const seen = new Set<string>();

      for (const p of pairs) {
        const skip = (reason: SkipReason) =>
          skipped.push({
            lead_id: p.leadId,
            assignee_id: p.assigneeId,
            reason,
          });
        if (seen.has(p.leadId)) {
          skip('duplicate_in_request');
          continue;
        }
        seen.add(p.leadId);
        const lead = eligibleById.get(p.leadId);
        if (!lead) {
          skip('not_eligible');
          continue;
        }
        if (actorTeamId !== null && lead.assignedTeamId !== actorTeamId) {
          skip('out_of_scope');
          continue;
        }
        if (lead.assignedTeamId !== assigneeById.get(p.assigneeId)?.teamId) {
          skip('team_mismatch');
          continue;
        }
        // Đang giữ số: chỉ người giữ số mới được giao/tự nhận.
        if (lead.isHeld && lead.heldById !== p.assigneeId) {
          skip('held_by_other');
          continue;
        }
        const current = open.get(p.leadId);
        if (current && !current.processed) {
          skip(
            current.assigneeId === p.assigneeId
              ? 'already_assigned_same'
              : 'assigned_to_other',
          );
          continue;
        }
        // Lượt giao cũ ĐÃ được xử lý thì đóng lại để chỉ còn 1 lượt mở/data.
        if (current) toClose.push(current.id);
        accepted.push(p);
      }

      if (accepted.length === 0) return { batchId: null, accepted, skipped };

      if (toClose.length) {
        await tx.careAssignment.updateMany({
          where: { id: { in: toClose } },
          data: { endedAt: now, endedById: user.id, endReason: 'reassigned' },
        });
      }
      const batch = await tx.careAssignmentBatch.create({
        data: { method, createdById: user.id, leadCount: accepted.length },
      });
      await tx.careAssignment.createMany({
        data: accepted.map((p) => ({
          batchId: batch.id,
          leadId: p.leadId,
          assigneeId: p.assigneeId,
          assignedAt: now,
        })),
      });
      await tx.auditLog.create({
        data: {
          accountId: user.id,
          actionType: 'assign',
          entityType: 'care_assignment_batch',
          entityId: batch.id,
          newValue: JSON.stringify({
            method,
            lead_count: accepted.length,
            assignees: [...new Set(accepted.map((p) => p.assigneeId))],
          }),
        },
      });
      return { batchId: batch.id, accepted, skipped };
    }, TX_OPTIONS);

    await this.emitForLeads(
      outcome.accepted.map((p) => p.leadId),
      'care_assigned',
      user,
    );
    // Sale tự nhận thì không cần báo chính mình.
    if (method !== 'self') await this.notifyAssignees(outcome.accepted, user);

    return {
      batch_id: outcome.batchId,
      assigned: outcome.accepted.map((p) => ({
        lead_id: p.leadId,
        assignee_id: p.assigneeId,
      })),
      skipped: outcome.skipped.map((s) => ({
        ...s,
        message: SKIP_MESSAGES[s.reason],
      })),
    };
  }

  /** Thu hồi lượt giao đang mở của 1 data (không cần lý do — đã chốt). */
  async revoke(leadId: string, user: AuthenticatedUser) {
    this.assertAssigner(user);
    const actorTeamId = await this.actorTeamId(user);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.lockLeads(tx, [leadId]);
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        select: { assignedTeamId: true, deletedAt: true },
      });
      if (!lead || lead.deletedAt) {
        throw new NotFoundException('Không tìm thấy data');
      }
      this.assertLeadInTeam(actorTeamId, lead.assignedTeamId);
      const open = await this.loadOpenAssignments(
        tx,
        [leadId],
        vnMonthStart(now),
        now,
      );
      const current = open.get(leadId);
      if (!current) {
        throw new NotFoundException('Data này không có lượt giao đang mở');
      }
      await tx.careAssignment.update({
        where: { id: current.id },
        data: { endedAt: now, endedById: user.id, endReason: 'revoked' },
      });
      await tx.auditLog.create({
        data: {
          accountId: user.id,
          actionType: 'update',
          entityType: 'care_assignment',
          entityId: current.id,
          fieldChanged: 'end_reason',
          newValue: 'revoked',
        },
      });
    }, TX_OPTIONS);
    await this.emitForLeads([leadId], 'care_revoked', user);
    return { lead_id: leadId };
  }

  /** Giao lại: đóng lượt đang mở (nếu có) và giao cho Sale khác trong 1 bước. */
  async reassign(leadId: string, assigneeId: string, user: AuthenticatedUser) {
    this.assertAssigner(user);
    const [assignee] = await this.loadValidAssignees([assigneeId], user);
    const actorTeamId = await this.actorTeamId(user);
    const now = new Date();
    const batchId = await this.prisma.$transaction(async (tx) => {
      await this.lockLeads(tx, [leadId]);
      const lead = await tx.lead.findFirst({
        where: { id: leadId, ...this.eligibleWhere(now) },
        select: { assignedTeamId: true, isHeld: true, heldById: true },
      });
      if (!lead) throw new BadRequestException(SKIP_MESSAGES.not_eligible);
      this.assertLeadInTeam(actorTeamId, lead.assignedTeamId);
      if (lead.assignedTeamId !== assignee.teamId) {
        throw new BadRequestException(SKIP_MESSAGES.team_mismatch);
      }
      if (lead.isHeld && lead.heldById !== assigneeId) {
        throw new ConflictException(SKIP_MESSAGES.held_by_other);
      }
      const open = await this.loadOpenAssignments(
        tx,
        [leadId],
        vnMonthStart(now),
        now,
      );
      const current = open.get(leadId);
      if (current && !current.processed && current.assigneeId === assigneeId) {
        throw new BadRequestException(SKIP_MESSAGES.already_assigned_same);
      }
      if (current) {
        await tx.careAssignment.update({
          where: { id: current.id },
          data: { endedAt: now, endedById: user.id, endReason: 'reassigned' },
        });
      }
      const batch = await tx.careAssignmentBatch.create({
        data: { method: 'manual', createdById: user.id, leadCount: 1 },
      });
      await tx.careAssignment.create({
        data: { batchId: batch.id, leadId, assigneeId, assignedAt: now },
      });
      await tx.auditLog.create({
        data: {
          accountId: user.id,
          actionType: 'transfer',
          entityType: 'care_assignment_batch',
          entityId: batch.id,
          oldValue: current?.assigneeId,
          newValue: assigneeId,
        },
      });
      return batch.id;
    }, TX_OPTIONS);
    await this.emitForLeads([leadId], 'care_assigned', user);
    await this.notifyAssignees([{ leadId, assigneeId }], user);
    return { batch_id: batchId, lead_id: leadId, assignee_id: assigneeId };
  }

  // ===========================================================================
  // Dừng / Tiếp tục chăm sóc
  // ===========================================================================

  /**
   * Quyền: Quản lý/Admin mọi data; Leader data nhóm mình; Sale khi là người
   * phụ trách gốc HOẶC đang được giao chăm sóc data đó.
   *
   * Dừng chăm sóc (yêu cầu người dùng 2026-10-28): Sale bấm → chỉ tạo ĐỀ
   * NGHỊ chờ duyệt + báo Leader nhóm (không có Leader thì Quản lý/Admin);
   * Leader/Quản lý/Admin bấm → dừng ngay (họ là người duyệt). Tiếp tục chăm
   * sóc giữ nguyên quyền cũ.
   */
  async setCareStopped(
    leadId: string,
    stopped: boolean,
    user: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const now = new Date();
    const actorTeamId =
      user.role === 'leader' ? await this.actorTeamId(user) : null;
    const isRequest = stopped && user.role === 'sale';
    let pendingRequesterId: string | null = null;
    let leadName = '';
    let leadTeamId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      await this.lockLeads(tx, [leadId]);
      const lead = await this.loadLeadForStop(tx, leadId);
      leadName = lead.fullName;
      leadTeamId = lead.assignedTeamId;
      const current = (
        await this.loadOpenAssignments(tx, [leadId], vnMonthStart(now), now)
      ).get(leadId);
      this.assertCanStop(user, actorTeamId, lead, current?.assigneeId ?? null);

      if (stopped === Boolean(lead.careStoppedAt)) {
        throw new ConflictException(
          stopped
            ? 'Data này đã được dừng chăm sóc'
            : 'Data này đang được chăm sóc',
        );
      }

      if (isRequest) {
        if (lead.careStopRequestedAt) {
          throw new ConflictException(
            'Data này đã có đề nghị dừng chăm sóc, đang chờ duyệt',
          );
        }
        await tx.lead.update({
          where: { id: leadId },
          data: { careStopRequestedAt: now, careStopRequestedById: user.id },
        });
        await tx.auditLog.create({
          data: {
            accountId: user.id,
            actionType: 'update',
            entityType: 'lead',
            entityId: leadId,
            fieldChanged: CARE_STOP_REQUEST_AUDIT_FIELD,
            newValue: 'requested',
          },
        });
        return;
      }

      // Leader/Quản lý/Admin dừng trực tiếp: nếu đang có đề nghị chờ duyệt
      // thì coi như đã duyệt đề nghị đó.
      pendingRequesterId = stopped ? lead.careStopRequestedById : null;
      if (stopped) {
        await this.applyCareStop(tx, leadId, lead, current, user, now);
      } else {
        await tx.lead.update({
          where: { id: leadId },
          data: {
            careStoppedAt: null,
            careStoppedById: null,
            careStopRequestedAt: null,
            careStopRequestedById: null,
          },
        });
        await tx.auditLog.create({
          data: {
            accountId: user.id,
            actionType: 'update',
            entityType: 'lead',
            entityId: leadId,
            fieldChanged: CARE_STOP_AUDIT_FIELD,
            oldValue: lead.careStoppedAt?.toISOString() ?? null,
            newValue: null,
          },
        });
      }
    }, TX_OPTIONS);

    if (isRequest) {
      await this.notifyStopApprovers(leadId, leadName, leadTeamId, user);
    } else if (pendingRequesterId && pendingRequesterId !== user.id) {
      await this.notifyAccounts(
        [pendingRequesterId],
        'care_stop_decided',
        leadId,
        `Đề nghị dừng chăm sóc "${leadName}" đã được duyệt — data đã đóng`,
        user,
      );
    }

    return this.emitStopChange(
      leadId,
      isRequest
        ? 'care_stop_requested'
        : stopped
          ? 'care_stopped'
          : 'care_resumed',
      user,
    );
  }

  /**
   * Leader (nhóm của data)/Quản lý/Admin duyệt hoặc từ chối đề nghị dừng
   * chăm sóc của Sale. Duyệt → dừng chăm sóc (giống dừng trực tiếp); từ chối
   * → xóa đề nghị, data vẫn chăm sóc bình thường. Báo kết quả cho Sale.
   */
  async decideStopRequest(
    leadId: string,
    approve: boolean,
    user: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    if (!ASSIGNER_ROLES.has(user.role)) {
      throw new ForbiddenException(
        'Chỉ Leader, Quản lý hoặc Admin mới duyệt đề nghị dừng chăm sóc',
      );
    }
    const now = new Date();
    const actorTeamId = await this.actorTeamId(user);
    let requesterId: string | null = null;
    let leadName = '';

    await this.prisma.$transaction(async (tx) => {
      await this.lockLeads(tx, [leadId]);
      const lead = await this.loadLeadForStop(tx, leadId);
      this.assertLeadInTeam(actorTeamId, lead.assignedTeamId);
      if (!lead.careStopRequestedAt) {
        throw new ConflictException(
          'Data này không có đề nghị dừng chăm sóc đang chờ duyệt',
        );
      }
      requesterId = lead.careStopRequestedById;
      leadName = lead.fullName;

      if (approve) {
        const current = (
          await this.loadOpenAssignments(tx, [leadId], vnMonthStart(now), now)
        ).get(leadId);
        await this.applyCareStop(tx, leadId, lead, current, user, now);
      } else {
        await tx.lead.update({
          where: { id: leadId },
          data: { careStopRequestedAt: null, careStopRequestedById: null },
        });
      }
      await tx.auditLog.create({
        data: {
          accountId: user.id,
          actionType: 'update',
          entityType: 'lead',
          entityId: leadId,
          fieldChanged: CARE_STOP_REQUEST_AUDIT_FIELD,
          oldValue: 'requested',
          newValue: approve ? 'approved' : 'rejected',
        },
      });
    }, TX_OPTIONS);

    if (requesterId) {
      await this.notifyAccounts(
        [requesterId],
        'care_stop_decided',
        leadId,
        approve
          ? `Đề nghị dừng chăm sóc "${leadName}" đã được duyệt — data đã đóng`
          : `Đề nghị dừng chăm sóc "${leadName}" bị từ chối — tiếp tục chăm sóc`,
        user,
      );
    }
    return this.emitStopChange(
      leadId,
      approve ? 'care_stopped' : 'care_stop_rejected',
      user,
    );
  }

  private async loadLeadForStop(tx: Tx, leadId: string) {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: {
        fullName: true,
        assignedTeamId: true,
        assignedToId: true,
        deletedAt: true,
        careStoppedAt: true,
        careStopRequestedAt: true,
        careStopRequestedById: true,
      },
    });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy data');
    }
    return lead;
  }

  /**
   * Dừng chăm sóc thật: điền care_stopped_*, xóa đề nghị chờ duyệt (nếu có),
   * đóng lượt giao đang mở, ghi nhật ký (nguồn dựng lại trạng thái cho báo
   * cáo tháng cũ — ghi TRONG transaction, không qua AuditLogService.log vốn
   * nuốt lỗi).
   */
  private async applyCareStop(
    tx: Tx,
    leadId: string,
    lead: { careStoppedAt: Date | null },
    current: { id: string } | undefined,
    user: AuthenticatedUser,
    now: Date,
  ): Promise<void> {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        careStoppedAt: now,
        careStoppedById: user.id,
        careStopRequestedAt: null,
        careStopRequestedById: null,
      },
    });
    if (current) {
      await tx.careAssignment.update({
        where: { id: current.id },
        data: { endedAt: now, endedById: user.id, endReason: 'stopped' },
      });
    }
    await tx.auditLog.create({
      data: {
        accountId: user.id,
        actionType: 'update',
        entityType: 'lead',
        entityId: leadId,
        fieldChanged: CARE_STOP_AUDIT_FIELD,
        oldValue: lead.careStoppedAt?.toISOString() ?? null,
        newValue: now.toISOString(),
      },
    });
  }

  private async emitStopChange(
    leadId: string,
    changeType: LeadChangeType,
    user: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: CANDIDATE_INCLUDE,
    });
    const response = toCandidateResponse(final);
    this.realtime.emitCandidateChange(changeType, response, user);
    return response;
  }

  /** Báo Leader nhóm của data; nhóm không có Leader (đang hoạt động) thì báo mọi Quản lý/Admin. */
  private async notifyStopApprovers(
    leadId: string,
    leadName: string,
    teamId: string | null,
    requester: AuthenticatedUser,
  ): Promise<void> {
    const team = teamId
      ? await this.prisma.team.findUnique({
          where: { id: teamId },
          select: { leader: { select: { id: true, status: true } } },
        })
      : null;
    let approverIds: string[];
    if (team?.leader && team.leader.status === 'active') {
      approverIds = [team.leader.id];
    } else {
      approverIds = (
        await this.prisma.account.findMany({
          where: { role: { in: ['admin', 'manager'] }, status: 'active' },
          select: { id: true },
        })
      ).map((a) => a.id);
    }
    const requesterName =
      (
        await this.prisma.account.findUnique({
          where: { id: requester.id },
          select: { fullName: true },
        })
      )?.fullName ?? 'Sale';
    await this.notifyAccounts(
      approverIds,
      'care_stop_requested',
      leadId,
      `${requesterName} đề nghị dừng chăm sóc "${leadName}" — chờ bạn duyệt`,
      requester,
    );
  }

  /**
   * Báo Sale được giao data chăm sóc (giao thủ công/ngẫu nhiên/giao lại — Sale
   * tự nhận thì không báo). Gộp 1 thông báo/Sale/đợt: giao 1 data thì gắn
   * lead_id (bấm mở trang Chi tiết), nhiều data thì không gắn (bấm mở Kho,
   * lọc "Được giao").
   */
  private async notifyAssignees(
    pairs: { leadId: string; assigneeId: string }[],
    assigner: AuthenticatedUser,
  ): Promise<void> {
    if (pairs.length === 0) return;
    try {
      const byAssignee = new Map<string, string[]>();
      for (const p of pairs) {
        byAssignee.set(p.assigneeId, [
          ...(byAssignee.get(p.assigneeId) ?? []),
          p.leadId,
        ]);
      }
      const singleLeadIds = [...byAssignee.values()]
        .filter((ids) => ids.length === 1)
        .map((ids) => ids[0]);
      const names = new Map(
        (
          await this.prisma.lead.findMany({
            where: { id: { in: singleLeadIds } },
            select: { id: true, fullName: true },
          })
        ).map((l) => [l.id, l.fullName]),
      );
      const assignerName =
        (
          await this.prisma.account.findUnique({
            where: { id: assigner.id },
            select: { fullName: true },
          })
        )?.fullName ?? 'Leader';
      for (const [assigneeId, leadIds] of byAssignee) {
        if (leadIds.length === 1) {
          await this.notifyAccounts(
            [assigneeId],
            'care_assigned',
            leadIds[0],
            `${assignerName} giao cho bạn data chăm sóc "${names.get(leadIds[0]) ?? ''}"`,
            assigner,
          );
        } else {
          await this.notifyAccounts(
            [assigneeId],
            'care_assigned',
            null,
            `${assignerName} giao cho bạn ${leadIds.length} data chăm sóc`,
            assigner,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Gửi thông báo giao data chăm sóc thất bại',
        error as Error,
      );
    }
  }

  /** Thông báo chuông (in_app). Có lead_id thì bấm vào mở trang Chi tiết. Lỗi gửi không làm hỏng thao tác chính. */
  private async notifyAccounts(
    accountIds: string[],
    type: 'care_stop_requested' | 'care_stop_decided' | 'care_assigned',
    leadId: string | null,
    content: string,
    sender: AuthenticatedUser,
  ): Promise<void> {
    try {
      const now = new Date();
      for (const accountId of accountIds) {
        const notification = await this.prisma.notification.create({
          data: {
            accountId,
            leadId,
            type,
            channel: 'in_app',
            content: content.slice(0, 500),
            senderId: sender.id,
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
          sender,
        );
      }
    } catch (error) {
      this.logger.error(
        `Gửi thông báo Kho chăm sóc thất bại (type=${type}, lead=${leadId ?? '-'})`,
        error as Error,
      );
    }
  }

  private assertCanStop(
    user: AuthenticatedUser,
    actorTeamId: string | null,
    lead: { assignedTeamId: string | null; assignedToId: string | null },
    openAssigneeId: string | null,
  ): void {
    if (FULL_ACCESS_ROLES.has(user.role)) return;
    if (user.role === 'leader') {
      this.assertLeadInTeam(actorTeamId, lead.assignedTeamId);
      return;
    }
    if (
      user.role === 'sale' &&
      (lead.assignedToId === user.id || openAssigneeId === user.id)
    ) {
      return;
    }
    throw new ForbiddenException(
      'Bạn không có quyền dừng/tiếp tục chăm sóc data này',
    );
  }

  // ===========================================================================
  // Lịch sử phân công
  // ===========================================================================

  async listBatches(query: ListBatchesQueryDto, user: AuthenticatedUser) {
    this.assertAssigner(user);
    const teamId = await this.resolveTeamScope(user, query.team_id);
    const where: Prisma.CareAssignmentBatchWhereInput = teamId
      ? { assignments: { some: { lead: { assignedTeamId: teamId } } } }
      : {};
    const [total, batches] = await this.prisma.$transaction([
      this.prisma.careAssignmentBatch.count({ where }),
      this.prisma.careAssignmentBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
        include: {
          createdBy: { select: ACCOUNT_REF_SELECT },
          assignments: {
            orderBy: { assignedAt: 'asc' },
            include: {
              lead: {
                select: { id: true, fullName: true, phoneNumber: true },
              },
              assignee: { select: ACCOUNT_REF_SELECT },
              endedBy: { select: ACCOUNT_REF_SELECT },
            },
          },
        },
      }),
    ]);
    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: batches.map((b) => ({
        id: b.id,
        method: b.method,
        created_at: b.createdAt.toISOString(),
        created_by: toAccountRef(b.createdBy),
        lead_count: b.leadCount,
        assignments: b.assignments.map((a) => this.toAssignmentResponse(a)),
      })),
    };
  }

  /** Lịch sử lượt giao của 1 data (mọi tháng). */
  async leadAssignments(leadId: string, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { assignedTeamId: true, deletedAt: true },
    });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy data');
    }
    const teamId = await this.resolveTeamScope(user);
    if (teamId !== null && lead.assignedTeamId !== teamId) {
      throw new ForbiddenException('Data không thuộc nhóm của bạn');
    }
    const rows = await this.prisma.careAssignment.findMany({
      where: { leadId },
      orderBy: { assignedAt: 'desc' },
      include: {
        batch: {
          select: { method: true, createdBy: { select: ACCOUNT_REF_SELECT } },
        },
        lead: { select: { id: true, fullName: true, phoneNumber: true } },
        assignee: { select: ACCOUNT_REF_SELECT },
        endedBy: { select: ACCOUNT_REF_SELECT },
      },
    });
    return rows.map((a) => ({
      ...this.toAssignmentResponse(a),
      method: a.batch.method,
      assigned_by: toAccountRef(a.batch.createdBy),
    }));
  }

  private toAssignmentResponse(a: {
    id: string;
    batchId: string;
    assignedAt: Date;
    endedAt: Date | null;
    endReason: string | null;
    lead: { id: string; fullName: string; phoneNumber: string };
    assignee: Parameters<typeof toAccountRef>[0];
    endedBy: Parameters<typeof toAccountRef>[0] | null;
  }) {
    return {
      id: a.id,
      batch_id: a.batchId,
      lead: {
        id: a.lead.id,
        full_name: a.lead.fullName,
        phone_number: a.lead.phoneNumber,
      },
      assignee: toAccountRef(a.assignee),
      assigned_at: a.assignedAt.toISOString(),
      ended_at: a.endedAt?.toISOString() ?? null,
      ended_by: a.endedBy ? toAccountRef(a.endedBy) : null,
      end_reason: a.endReason,
    };
  }

  // ===========================================================================
  // Tiến độ chăm sóc (khối Dashboard + tab Báo cáo dùng chung API này)
  // ===========================================================================

  async progress(query: CareProgressQueryDto, user: AuthenticatedUser) {
    const now = new Date();
    const date = query.date ?? vnDateOnly(now);
    const month = query.month ?? date.slice(0, 7);
    const day = vnDayRange(date);
    const monthRange = vnMonthRange(month);

    let teamId: string | null;
    let accountId = query.account_id;
    if (user.role === 'sale') {
      teamId = await this.resolveTeamScope(user);
      accountId = user.id;
    } else if (ASSIGNER_ROLES.has(user.role)) {
      teamId = await this.resolveTeamScope(user, query.team_id);
    } else {
      throw new ForbiddenException('Bạn không có quyền xem tiến độ chăm sóc');
    }

    const dayMonthStart = vnMonthStart(day.start);
    const windowStart =
      dayMonthStart < monthRange.start ? dayMonthStart : monthRange.start;
    const windowEnd = day.end > monthRange.end ? day.end : monthRange.end;

    const accountWhere: Prisma.AccountWhereInput = {
      role: 'sale',
      ...(teamId ? { teamId } : {}),
      ...(accountId ? { id: accountId } : {}),
      OR: [
        { status: 'active' },
        {
          careAssignmentsReceived: {
            some: { assignedAt: { gte: windowStart, lt: windowEnd } },
          },
        },
      ],
    };
    const sales = await this.prisma.account.findMany({
      where: accountWhere,
      select: {
        ...ACCOUNT_REF_SELECT,
        team: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    const saleIds = sales.map((s) => s.id);

    const assignments = saleIds.length
      ? await this.prisma.careAssignment.findMany({
          where: {
            assigneeId: { in: saleIds },
            assignedAt: { gte: windowStart, lt: windowEnd },
            lead: { deletedAt: null },
          },
          select: {
            id: true,
            leadId: true,
            assigneeId: true,
            assignedAt: true,
            endedAt: true,
          },
        })
      : [];
    const notes = saleIds.length
      ? await this.prisma.leadNote.findMany({
          where: {
            isDeleted: false,
            createdById: { in: saleIds },
            createdAt: { gte: windowStart },
            lead: {
              careAssignments: {
                some: {
                  assigneeId: { in: saleIds },
                  assignedAt: { gte: windowStart, lt: windowEnd },
                },
              },
            },
          },
          select: { leadId: true, createdById: true, createdAt: true },
        })
      : [];
    const noteIndex = new NoteIndex(notes);

    const bySale = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      const list = bySale.get(a.assigneeId);
      if (list) list.push(a);
      else bySale.set(a.assigneeId, [a]);
    }

    let rows = sales.map((s) => {
      const own = bySale.get(s.id) ?? [];
      const daily = computeSaleDaily(own, noteIndex, day.start, day.end, now);
      const monthly = computeSaleMonthly(
        own,
        noteIndex,
        monthRange.start,
        monthRange.end,
        now,
      );
      return {
        account: toAccountRef(s),
        team: s.team,
        daily,
        monthly: {
          ...monthly,
          last_care_at: monthly.last_care_at?.toISOString() ?? null,
        },
      };
    });

    if (query.status) {
      rows = rows.filter((r) => {
        const hasWork = r.daily.today.assigned + r.daily.backlog.start > 0;
        const pending = r.daily.today.pending + r.daily.backlog.remaining > 0;
        return query.status === 'pending' ? pending : hasWork && !pending;
      });
    }

    // Dòng tổng đếm theo DATA KHÁC NHAU trên toàn bộ lượt giao (không cộng
    // dồn từng Sale) — 1 data giao lại từ A sang B không bị tính 2 lần. Lượt
    // chăm sóc là số ghi chú nên cộng dồn được.
    const shownIds = new Set(rows.map((r) => r.account.id));
    const shownAssignments = assignments.filter((a) =>
      shownIds.has(a.assigneeId),
    );
    const totalDaily = computeSaleDaily(
      shownAssignments,
      noteIndex,
      day.start,
      day.end,
      now,
    );
    const totalMonthly = computeSaleMonthly(
      shownAssignments,
      noteIndex,
      monthRange.start,
      monthRange.end,
      now,
    );
    totalDaily.care_turns = rows.reduce((n, r) => n + r.daily.care_turns, 0);
    totalMonthly.care_turns = rows.reduce(
      (n, r) => n + r.monthly.care_turns,
      0,
    );

    return {
      date,
      month,
      rows,
      totals: {
        daily: totalDaily,
        monthly: {
          ...totalMonthly,
          last_care_at: totalMonthly.last_care_at?.toISOString() ?? null,
        },
      },
      target: await this.monthlyTarget(teamId, monthRange, now),
    };
  }

  /**
   * Mục tiêu tháng: mẫu số = data đủ điều kiện Kho TẠI MỐC cuối tháng (hoặc
   * hiện tại nếu tháng chưa hết), tử số = data trong đó có ≥1 ghi chú chưa
   * xóa (của bất kỳ ai) trong tháng. Data vào Kho giữa tháng tính luôn vào
   * tháng đó (Câu 3 = A). Điều kiện "lịch gọi lại hôm nay" là điều kiện theo
   * ngày nên không áp cho mục tiêu tháng. Trạng thái Dừng chăm sóc dựng lại
   * từ audit_logs (Câu 6 = A).
   */
  private async monthlyTarget(
    teamId: string | null,
    monthRange: { start: Date; end: Date },
    now: Date,
  ) {
    const cutoff = now < monthRange.end ? now : monthRange.end;
    if (cutoff <= monthRange.start) {
      return { eligible: 0, cared: 0, not_cared: 0, rate: null };
    }
    const leadWhere: Prisma.LeadWhereInput = {
      assignedToId: { not: null },
      OR: [{ deletedAt: null }, { deletedAt: { gte: cutoff } }],
      ...(teamId ? { assignedTeamId: teamId } : {}),
      notes: { some: { isDeleted: false, createdAt: { lt: cutoff } } },
    };
    const leads = await this.prisma.lead.findMany({
      where: leadWhere,
      select: { id: true },
    });
    const stopLogs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'lead',
        fieldChanged: CARE_STOP_AUDIT_FIELD,
        createdAt: { lt: cutoff },
      },
      select: { entityId: true, createdAt: true, newValue: true },
    });
    const logsByLead = new Map<
      string,
      { createdAt: Date; newValue: string | null }[]
    >();
    for (const log of stopLogs) {
      if (!log.entityId) continue;
      const list = logsByLead.get(log.entityId);
      if (list) list.push(log);
      else logsByLead.set(log.entityId, [log]);
    }
    const eligible = leads.filter(
      (l) => !wasCareStoppedAt(logsByLead.get(l.id) ?? [], cutoff),
    );
    const caredRows = await this.prisma.leadNote.findMany({
      where: {
        ...CARE_NOTE_WHERE,
        createdAt: { gte: monthRange.start, lt: cutoff },
        lead: leadWhere,
      },
      distinct: ['leadId'],
      select: { leadId: true },
    });
    const caredSet = new Set(caredRows.map((r) => r.leadId));
    const cared = eligible.filter((l) => caredSet.has(l.id)).length;
    return {
      eligible: eligible.length,
      cared,
      not_cared: eligible.length - cared,
      rate: rate(cared, eligible.length),
    };
  }

  // ===========================================================================
  // Tiện ích dùng chung
  // ===========================================================================

  private assertAssigner(user: AuthenticatedUser): void {
    if (!ASSIGNER_ROLES.has(user.role)) {
      throw new ForbiddenException(
        'Chỉ Leader, Quản lý hoặc Admin mới được phân công trong Kho',
      );
    }
  }

  /**
   * Nhóm giới hạn thao tác của người dùng: null = không giới hạn (Quản lý/
   * Admin). Leader/Sale chưa thuộc nhóm nào bị chặn luôn — KHÔNG được hiểu
   * null là "không giới hạn". Gọi TRƯỚC transaction: với DATABASE_POOL_MAX=1
   * mọi truy vấn qua this.prisma bên trong transaction sẽ chờ mãi.
   */
  private async actorTeamId(user: AuthenticatedUser): Promise<string | null> {
    if (FULL_ACCESS_ROLES.has(user.role)) return null;
    const teamId = await this.getOwnTeamId(user.id);
    if (!teamId) {
      throw new ForbiddenException('Tài khoản của bạn chưa thuộc nhóm nào');
    }
    return teamId;
  }

  private assertLeadInTeam(
    actorTeamId: string | null,
    leadTeamId: string | null,
  ): void {
    if (actorTeamId !== null && leadTeamId !== actorTeamId) {
      throw new ForbiddenException('Data không thuộc nhóm bạn quản lý');
    }
  }

  /** Sale nhận phải là Sale đang hoạt động, có nhóm; Leader chỉ giao cho Sale nhóm mình. */
  private async loadValidAssignees(ids: string[], user: AuthenticatedUser) {
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: ids } },
      select: { ...ACCOUNT_REF_SELECT, teamId: true, status: true },
    });
    const ownTeamId = await this.actorTeamId(user);
    for (const id of ids) {
      const a = accounts.find((x) => x.id === id);
      if (!a || a.role !== 'sale' || a.status !== 'active' || !a.teamId) {
        throw new BadRequestException(
          'Người nhận phải là Sale đang hoạt động và đã thuộc 1 nhóm',
        );
      }
      if (ownTeamId !== null && a.teamId !== ownTeamId) {
        throw new ForbiddenException(
          'Bạn chỉ được giao cho Sale trong nhóm mình',
        );
      }
    }
    return accounts;
  }

  private async loadSelfAsAssignee(user: AuthenticatedUser) {
    const me = await this.prisma.account.findUnique({
      where: { id: user.id },
      select: { ...ACCOUNT_REF_SELECT, teamId: true, status: true },
    });
    if (!me?.teamId) {
      throw new ForbiddenException('Tài khoản của bạn chưa thuộc nhóm nào');
    }
    return [me];
  }

  private async lockLeads(tx: Tx, leadIds: string[]): Promise<void> {
    if (leadIds.length === 0) return;
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ANY(${leadIds}::uuid[]) ORDER BY id FOR UPDATE`;
  }

  /** Lượt giao còn hiệu lực tại `now` của từng data, kèm đã xử lý hay chưa. */
  private async loadOpenAssignments(
    tx: Tx,
    leadIds: string[],
    monthStart: Date,
    now: Date,
  ): Promise<
    Map<string, { id: string; assigneeId: string; processed: boolean }>
  > {
    const rows = await tx.careAssignment.findMany({
      where: {
        leadId: { in: leadIds },
        endedAt: null,
        assignedAt: { gte: monthStart, lte: now },
      },
      orderBy: { assignedAt: 'desc' },
      select: { id: true, leadId: true, assigneeId: true, assignedAt: true },
    });
    const result = new Map<
      string,
      { id: string; assigneeId: string; processed: boolean }
    >();
    if (rows.length === 0) return result;
    const notes = new NoteIndex(
      await tx.leadNote.findMany({
        where: {
          leadId: { in: [...new Set(rows.map((r) => r.leadId))] },
          createdById: { in: [...new Set(rows.map((r) => r.assigneeId))] },
          isDeleted: false,
          createdAt: { gte: monthStart },
        },
        select: { leadId: true, createdById: true, createdAt: true },
      }),
    );
    for (const r of rows) {
      if (result.has(r.leadId)) continue;
      result.set(r.leadId, {
        id: r.id,
        assigneeId: r.assigneeId,
        processed:
          assignmentProcessedAt({ ...r, endedAt: null }, notes) !== null,
      });
    }
    return result;
  }

  private async emitForLeads(
    leadIds: string[],
    changeType: LeadChangeType,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (leadIds.length === 0) return;
    const leads = await this.prisma.lead.findMany({
      where: { id: { in: leadIds } },
      include: CANDIDATE_INCLUDE,
    });
    for (const lead of leads) {
      this.realtime.emitCandidateChange(
        changeType,
        toCandidateResponse(lead),
        user,
      );
    }
  }
}
