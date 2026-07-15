import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { ReportFunnelQueryDto } from './dto/report-funnel-query.dto';
import {
  BySourceReportDto,
  DashboardSummaryDto,
  FunnelStep,
  KpiBreakdown,
  SalePerformanceDto,
  TeamSummaryDto,
} from './dto/dashboard-response.dto';

/** Mục 4, docs/13: "Chờ phân chia" là hàng đợi chung toàn hệ thống — không giới hạn theo nhóm (đúng hành vi GET /candidate/pending đã có từ Phase 2). */
const PENDING_VIEW_ROLES = new Set(['admin', 'manager', 'leader', 'mkt']);
const PERFORMANCE_VIEW_ROLES = new Set(['admin', 'manager', 'leader']);
const REPORT_VIEW_ROLES = new Set(['admin', 'manager', 'leader']);

/** Bám sát đúng 3 trạng thái phỏng vấn tính là "đã đến PV" — SCHEDULED chưa đến, NO_SHOW là bùng (không đến). */
const ATTENDED_INTERVIEW_STATUS_CODES = ['ATTENDED', 'PASSED', 'FAILED'];

/**
 * Dự án phụ — nâng cấp toàn diện (riêng giao diện Dashboard, ngoài phạm vi
 * Design Freeze docs/09-13): 4 giá trị chuỗi khớp đúng dữ liệu hiện có trong
 * shuttle_options (Tình trạng/Kết quả của module Đưa đón) — yêu cầu trực
 * tiếp người dùng (2026-07-14): "Hẹn PV/Đến PV/Bùng PV/Đỗ PV/Trượt PV" giờ
 * lấy từ Đưa đón thay vì Candidates/InterviewAppointment. LƯU Ý: đây là 4
 * giá trị TỰ DO trong bảng shuttle_options (đổi được qua "Chỉnh sửa danh
 * sách" ở trang Đưa đón), không phải enum cố định trong schema — nếu người
 * dùng đổi tên/xóa 1 trong 4 giá trị này, việc khớp ở đây sẽ âm thầm sai
 * (đã báo trước, chấp nhận rủi ro theo đúng yêu cầu).
 */
const SHUTTLE_STATUS_ATTENDED = 'Đã đón';
const SHUTTLE_STATUS_NO_SHOW = 'Chưa đón được';
const SHUTTLE_RESULT_PASSED = 'Đỗ PV';
const SHUTTLE_RESULT_FAILED = 'Trượt PV';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Mục 9, docs/09 + Mục 1/8, docs/12 + Mục 8, docs/13-api-design.md —
 * Phase 7: Dashboard & Báo cáo. "Engine" tính toán dùng chung cho cả màn
 * Dashboard (tổng quan, thẻ số liệu) và Reports (lọc sâu hơn, xem breakdown)
 * — đúng tinh thần "Reports là phần mở rộng của Dashboard, không phát sinh
 * số liệu mới" đã ghi tại Mục 8, docs/12.
 *
 * Phạm vi xem dữ liệu tái sử dụng NGUYÊN VẸN quy tắc đã chốt Mục 8, docs/09
 * (Sale: lead của mình; Leader: nhóm mình; MKT: data mình upload; Quản
 * lý/Admin: toàn bộ) — không phát minh quy tắc phạm vi riêng cho Dashboard.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mục 8, docs/13: GET /dashboard/summary — "Tất cả vai trò (phạm vi theo quyền xem)". */
  async getSummary(
    query: DashboardQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<DashboardSummaryDto> {
    const scope = await this.buildScope(currentUser, query.team_id);
    const dateWhere = this.buildDateWhere(query.date_from, query.date_to);
    const extraWhere = this.buildExtraWhere(currentUser, query);
    const baseWhere: Prisma.LeadWhereInput = {
      ...scope,
      deletedAt: null,
      ...dateWhere,
      ...extraWhere,
    };

    const previousRange = this.getPreviousRange(query.date_from, query.date_to);
    const previousWhere: Prisma.LeadWhereInput | null = previousRange
      ? {
          ...scope,
          deletedAt: null,
          ...extraWhere,
          uploadedAt: {
            gte: new Date(previousRange.from),
            lte: new Date(previousRange.to),
          },
        }
      : null;

    const saleNames = await this.resolveSaleNamesInScope(currentUser, query);
    const sourceFiltered = Boolean(query.source_id);

    const [
      sources,
      bySourceRaw,
      funnel,
      pendingCount,
      carePoolCount,
      kpi,
      kpiPrevious,
    ] = await Promise.all([
      this.prisma.leadSource.findMany(),
      this.prisma.lead.groupBy({
        by: ['sourceId'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.computeFunnel(baseWhere),
      this.getPendingCount(currentUser, query.date_from, query.date_to),
      this.getCarePoolCount(currentUser, query.team_id),
      this.computeKpiBreakdown(
        baseWhere,
        saleNames,
        query.date_from,
        query.date_to,
        sourceFiltered,
      ),
      previousRange && previousWhere
        ? this.computeKpiBreakdown(
            previousWhere,
            saleNames,
            previousRange.from,
            previousRange.to,
            sourceFiltered,
          )
        : Promise.resolve(null),
    ]);

    const countBySourceId = new Map(
      bySourceRaw.map((row) => [row.sourceId, row._count._all]),
    );
    const newLeadsBySource = sources.map((source) => ({
      source_id: source.id,
      source_name: source.name,
      count: countBySourceId.get(source.id) ?? 0,
    }));

    return {
      new_leads_total: newLeadsBySource.reduce((sum, s) => sum + s.count, 0),
      new_leads_by_source: newLeadsBySource,
      pending_count: pendingCount,
      funnel,
      care_pool_count: carePoolCount,
      kpi,
      kpi_previous: kpiPrevious,
    };
  }

  /** Mục 8, docs/13: GET /dashboard/performance — "Leader (nhóm mình), Quản lý, Admin". */
  async getPerformance(
    query: DashboardQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<SalePerformanceDto[]> {
    if (!PERFORMANCE_VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền xem hiệu suất Sale');
    }

    const teamId = await this.resolveTeamIdForRestrictedRole(
      currentUser,
      query.team_id,
    );
    // Sale role không thể tới được đây (đã bị chặn ở ForbiddenException phía
    // trên — PERFORMANCE_VIEW_ROLES không có 'sale') nên account_id dùng
    // thẳng, không cần khóa riêng như buildExtraWhere() (nơi 'sale' CÓ thể
    // gọi tới, vd getSummary()).
    const sales = await this.prisma.account.findMany({
      where: {
        role: 'sale',
        ...(teamId ? { teamId } : {}),
        ...(query.account_id ? { id: query.account_id } : {}),
      },
      select: { id: true, fullName: true, avatarUrl: true, teamId: true },
      orderBy: { fullName: 'asc' },
    });

    const noteDateWhere = this.buildDateWhere(
      query.date_from,
      query.date_to,
      'createdAt',
    );
    const interviewDateWhere = this.buildDateWhere(
      query.date_from,
      query.date_to,
      'createdAt',
    );
    const leadDateWhere = this.buildDateWhere(query.date_from, query.date_to);
    const sourceWhere: Prisma.LeadWhereInput = query.source_id
      ? { sourceId: query.source_id }
      : {};
    const sourceFiltered = Boolean(query.source_id);

    return Promise.all(
      sales.map(async (sale) => {
        const leadWhere: Prisma.LeadWhereInput = {
          assignedToId: sale.id,
          deletedAt: null,
          ...leadDateWhere,
          ...sourceWhere,
        };
        const [calls, potentialLeads, interviewCount, employedCount, kpi] =
          await Promise.all([
            this.prisma.leadNote.count({
              where: { createdById: sale.id, ...noteDateWhere },
            }),
            this.prisma.lead.count({
              where: { ...leadWhere, callResult: { code: 'POTENTIAL' } },
            }),
            this.prisma.interviewAppointment.count({
              where: { createdById: sale.id, ...interviewDateWhere },
            }),
            this.prisma.lead.count({
              where: {
                ...leadWhere,
                interviews: {
                  some: { employmentStatus: { code: 'EMPLOYED' } },
                },
              },
            }),
            this.computeKpiBreakdown(
              leadWhere,
              [sale.fullName],
              query.date_from,
              query.date_to,
              sourceFiltered,
            ),
          ]);

        return {
          account_id: sale.id,
          full_name: sale.fullName,
          avatar_url: sale.avatarUrl,
          team_id: sale.teamId,
          calls,
          potential_leads: potentialLeads,
          interview_count: interviewCount,
          employed_count: employedCount,
          kpi,
        };
      }),
    );
  }

  /** Mục 8, docs/13: GET /dashboard/by-team — "Quản lý, Admin". */
  async getByTeam(
    query: DashboardQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<TeamSummaryDto[]> {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      throw new ForbiddenException(
        'Bạn không có quyền xem số liệu tổng hợp theo nhóm',
      );
    }

    const teams = await this.prisma.team.findMany({
      select: { id: true, name: true },
    });
    const dateWhere = this.buildDateWhere(query.date_from, query.date_to);
    const extraWhere = this.buildExtraWhere(currentUser, query);
    const sourceFiltered = Boolean(query.source_id);

    return Promise.all(
      teams.map(async (team) => {
        const where: Prisma.LeadWhereInput = {
          assignedTeamId: team.id,
          deletedAt: null,
          ...dateWhere,
          ...extraWhere,
        };
        // Sale trong nhóm này (thu hẹp thêm theo account_id nếu có lọc) —
        // dùng để tính 5 chỉ số Shuttle-based cho đúng nhóm (Mục "resolve
        // sale names", computeShuttleKpi()).
        const teamSales = await this.prisma.account.findMany({
          where: {
            role: 'sale',
            teamId: team.id,
            ...(query.account_id ? { id: query.account_id } : {}),
          },
          select: { fullName: true },
        });
        const teamSaleNames = teamSales.map((s) => s.fullName);

        const [leadCount, funnel, carePoolCount, kpi] = await Promise.all([
          this.prisma.lead.count({ where }),
          this.computeFunnel(where),
          this.prisma.lead.count({
            where: {
              assignedTeamId: team.id,
              deletedAt: null,
              enteredCarePoolAt: { not: null },
              removedFromCarePoolAt: null,
            },
          }),
          this.computeKpiBreakdown(
            where,
            teamSaleNames,
            query.date_from,
            query.date_to,
            sourceFiltered,
          ),
        ]);
        const employedStep = funnel.find((step) => step.code === 'EMPLOYED');

        return {
          team_id: team.id,
          team_name: team.name,
          lead_count: leadCount,
          conversion_rate: employedStep?.percentage ?? 0,
          care_pool_count: carePoolCount,
          kpi,
        };
      }),
    );
  }

  /** Mục 8, docs/13: GET /report/funnel — "Leader, Quản lý, Admin". */
  async getFunnel(
    query: ReportFunnelQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<FunnelStep[]> {
    if (!REPORT_VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException(
        'Bạn không có quyền xem báo cáo phễu chuyển đổi',
      );
    }

    const teamId = await this.resolveTeamIdForRestrictedRole(
      currentUser,
      query.team_id,
    );
    const dateWhere = this.buildDateWhere(query.date_from, query.date_to);
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(teamId ? { assignedTeamId: teamId } : {}),
      ...(query.account_id ? { assignedToId: query.account_id } : {}),
      ...dateWhere,
    };

    return this.computeFunnel(where);
  }

  /** Mục 8, docs/13: GET /report/by-source — "Leader, Quản lý, Admin". */
  async getBySource(
    query: DashboardQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<BySourceReportDto[]> {
    if (!REPORT_VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException(
        'Bạn không có quyền xem báo cáo theo nguồn kênh',
      );
    }

    const teamId = await this.resolveTeamIdForRestrictedRole(
      currentUser,
      query.team_id,
    );
    const dateWhere = this.buildDateWhere(query.date_from, query.date_to);
    const baseWhere: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(teamId ? { assignedTeamId: teamId } : {}),
      ...dateWhere,
    };

    const sources = await this.prisma.leadSource.findMany();

    return Promise.all(
      sources.map(async (source) => {
        const where: Prisma.LeadWhereInput = {
          ...baseWhere,
          sourceId: source.id,
        };
        const [leadCount, potentialCount, employedCount] = await Promise.all([
          this.prisma.lead.count({ where }),
          this.prisma.lead.count({
            where: { ...where, callResult: { code: 'POTENTIAL' } },
          }),
          this.prisma.lead.count({
            where: {
              ...where,
              interviews: { some: { employmentStatus: { code: 'EMPLOYED' } } },
            },
          }),
        ]);

        return {
          source_id: source.id,
          source_name: source.name,
          lead_count: leadCount,
          potential_rate:
            leadCount > 0 ? round1((potentialCount / leadCount) * 100) : 0,
          employed_rate:
            leadCount > 0 ? round1((employedCount / leadCount) * 100) : 0,
        };
      }),
    );
  }

  /**
   * "Engine" phễu chuyển đổi dùng chung Dashboard + Report — Mục 9, docs/09:
   * Lead → Hẹn PV → Đến PV → Đỗ PV → Đi làm. Mỗi bước là số LEAD (không phải
   * số lượt hẹn) đã từng đạt mốc đó ít nhất 1 lần trong toàn bộ lịch sử các
   * lần hẹn PV của lead (không chỉ tính lần hẹn gần nhất) — 1 lead bùng PV
   * lần 1 rồi đỗ PV lần 2 vẫn được tính là đã "Đến PV" và "Đỗ PV".
   */
  private async computeFunnel(
    where: Prisma.LeadWhereInput,
  ): Promise<FunnelStep[]> {
    const [
      leadCount,
      scheduledCount,
      attendedCount,
      passedCount,
      employedCount,
    ] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { ...where, interviews: { some: {} } } }),
      this.prisma.lead.count({
        where: {
          ...where,
          interviews: {
            some: { status: { code: { in: ATTENDED_INTERVIEW_STATUS_CODES } } },
          },
        },
      }),
      this.prisma.lead.count({
        where: {
          ...where,
          interviews: { some: { status: { code: 'PASSED' } } },
        },
      }),
      this.prisma.lead.count({
        where: {
          ...where,
          interviews: { some: { employmentStatus: { code: 'EMPLOYED' } } },
        },
      }),
    ]);

    const pct = (count: number) =>
      leadCount > 0 ? round1((count / leadCount) * 100) : 0;

    return [
      { code: 'LEAD', label: 'Lead', count: leadCount, percentage: 100 },
      {
        code: 'INTERVIEW_SCHEDULED',
        label: 'Hẹn PV',
        count: scheduledCount,
        percentage: pct(scheduledCount),
      },
      {
        code: 'ATTENDED',
        label: 'Đến PV',
        count: attendedCount,
        percentage: pct(attendedCount),
      },
      {
        code: 'PASSED',
        label: 'Đỗ PV',
        count: passedCount,
        percentage: pct(passedCount),
      },
      {
        code: 'EMPLOYED',
        label: 'Đi làm',
        count: employedCount,
        percentage: pct(employedCount),
      },
    ];
  }

  /**
   * Dự án phụ — nâng cấp toàn diện (riêng giao diện Dashboard, ngoài phạm vi
   * Design Freeze docs/09-13): 7 chỉ số đầy đủ. new_leads vẫn từ Lead (bằng
   * `leadWhere`, KHÔNG đổi); 5 chỉ số Hẹn/Đến/Bùng/Đỗ/Trượt PV giờ lấy từ
   * Đưa đón qua computeShuttleKpi() (yêu cầu trực tiếp người dùng,
   * 2026-07-14 — xem chú thích đầy đủ tại KpiBreakdown, dashboard-response.
   * dto.ts). employed/employed_rate/performance_rate = null (chưa có nguồn
   * dữ liệu, chờ module Quản lý lao động).
   */
  private async computeKpiBreakdown(
    leadWhere: Prisma.LeadWhereInput,
    saleNames: string[],
    dateFrom: string | undefined,
    dateTo: string | undefined,
    sourceFiltered: boolean,
  ): Promise<KpiBreakdown> {
    const [newLeads, shuttle] = await Promise.all([
      this.prisma.lead.count({ where: leadWhere }),
      this.computeShuttleKpi(saleNames, dateFrom, dateTo, sourceFiltered),
    ]);

    const pct = (count: number) =>
      newLeads > 0 ? round1((count / newLeads) * 100) : 0;

    return {
      new_leads: newLeads,
      interview_scheduled: shuttle.interview_scheduled,
      attended: shuttle.attended,
      no_show: shuttle.no_show,
      passed: shuttle.passed,
      failed: shuttle.failed,
      employed: null,
      schedule_rate: pct(shuttle.interview_scheduled),
      attend_rate: pct(shuttle.attended),
      pass_rate: pct(shuttle.passed),
      employed_rate: null,
      performance_rate: null,
    };
  }

  /**
   * Hẹn/Đến/Bùng/Đỗ/Trượt PV — tính từ ShuttleRecord.sale (chuỗi tên, KHÔNG
   * phải account_id — ghép theo đúng full_name, giống cách trang Đưa đón
   * đang ghép màu cho ComboCell Sale). `sourceFiltered=true` (đang lọc theo
   * Nguồn) → trả về 0 hết vì Đưa đón không lưu Nguồn (yêu cầu trực tiếp
   * người dùng: "số về 0 khi có lọc Nguồn"). `saleNames` rỗng (vd MKT — MKT
   * không phải Sale, không có bản ghi Đưa đón nào đứng tên MKT) → cũng 0.
   */
  private async computeShuttleKpi(
    saleNames: string[],
    dateFrom: string | undefined,
    dateTo: string | undefined,
    sourceFiltered: boolean,
  ): Promise<
    Pick<
      KpiBreakdown,
      'interview_scheduled' | 'attended' | 'no_show' | 'passed' | 'failed'
    >
  > {
    if (sourceFiltered || saleNames.length === 0) {
      return {
        interview_scheduled: 0,
        attended: 0,
        no_show: 0,
        passed: 0,
        failed: 0,
      };
    }

    const rows = await this.prisma.shuttleRecord.findMany({
      where: {
        sale: { in: saleNames },
        date: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo) : undefined,
        },
      },
      select: { status: true, interviewResult: true },
    });

    return {
      interview_scheduled: rows.length,
      attended: rows.filter((r) => r.status === SHUTTLE_STATUS_ATTENDED).length,
      no_show: rows.filter((r) => r.status === SHUTTLE_STATUS_NO_SHOW).length,
      passed: rows.filter((r) => r.interviewResult === SHUTTLE_RESULT_PASSED)
        .length,
      failed: rows.filter((r) => r.interviewResult === SHUTTLE_RESULT_FAILED)
        .length,
    };
  }

  /**
   * Danh sách tên Sale (full_name) đang trong phạm vi xem của currentUser +
   * bộ lọc hiện tại — dùng cho computeShuttleKpi() ở mức công ty (getSummary).
   * Sale: chỉ chính mình. MKT: rỗng (MKT không phải Sale, không đứng tên
   * dòng Đưa đón nào). Leader: Sale trong đúng nhóm mình (ép cứng, giống
   * buildScope()). Admin/Quản lý: theo team_id/account_id nếu có lọc, không
   * thì toàn bộ Sale.
   */
  private async resolveSaleNamesInScope(
    currentUser: AuthenticatedUser,
    query: DashboardQueryDto,
  ): Promise<string[]> {
    if (currentUser.role === 'mkt') return [];
    if (currentUser.role === 'sale') {
      const self = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
        select: { fullName: true },
      });
      return self ? [self.fullName] : [];
    }

    const teamId = await this.resolveTeamIdForRestrictedRole(
      currentUser,
      query.team_id,
    );
    const sales = await this.prisma.account.findMany({
      where: {
        role: 'sale',
        ...(teamId ? { teamId } : {}),
        ...(query.account_id ? { id: query.account_id } : {}),
      },
      select: { fullName: true },
    });
    return sales.map((s) => s.fullName);
  }

  /**
   * Khoảng ngày liền trước, độ dài bằng đúng khoảng đã lọc — dùng tính "%
   * tăng/giảm so với kỳ trước" trên thẻ KPI (yêu cầu trực tiếp người dùng).
   * Trả về null nếu chưa chọn đủ date_from/date_to (không có gì để so
   * sánh — KHÔNG tự suy đoán khoảng mặc định).
   */
  private getPreviousRange(
    dateFrom?: string,
    dateTo?: string,
  ): { from: string; to: string } | null {
    if (!dateFrom || !dateTo) return null;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const durationMs = to.getTime() - from.getTime();
    if (durationMs <= 0) return null;
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - durationMs);
    return { from: prevFrom.toISOString(), to: prevTo.toISOString() };
  }

  /**
   * Lọc thêm theo Sale (account_id)/Nguồn (source_id) — 2 bộ lọc MỚI riêng
   * cho Dashboard. Sale role LUÔN bỏ qua account_id (đã bị khóa cứng về
   * đúng bản thân ở buildScope() bằng field assignedToId — nếu ghép thêm
   * account_id của người khác vào cùng field này qua spread object, giá trị
   * sau sẽ ghi đè giá trị trước, vô tình mở khóa xem được data của Sale
   * khác). Vai trò khác không có rủi ro này vì scope của họ dùng field khác
   * (assignedTeamId/uploadedById) hoặc không giới hạn.
   */
  private buildExtraWhere(
    currentUser: AuthenticatedUser,
    query: DashboardQueryDto,
  ): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {};
    const effectiveAccountId =
      currentUser.role === 'sale' ? undefined : query.account_id;
    if (effectiveAccountId) where.assignedToId = effectiveAccountId;
    if (query.source_id) where.sourceId = query.source_id;
    return where;
  }

  private async getPendingCount(
    currentUser: AuthenticatedUser,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<number> {
    if (!PENDING_VIEW_ROLES.has(currentUser.role)) {
      return 0;
    }
    const dateWhere = this.buildDateWhere(dateFrom, dateTo);
    return this.prisma.lead.count({
      where: { deletedAt: null, assignedToId: null, ...dateWhere },
    });
  }

  /** Mục 5, docs/13: GET /care-pool — MKT không có quyền xem cột chăm sóc. */
  private async getCarePoolCount(
    currentUser: AuthenticatedUser,
    teamId?: string,
  ): Promise<number> {
    if (currentUser.role === 'mkt') {
      return 0;
    }
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      enteredCarePoolAt: { not: null },
      removedFromCarePoolAt: null,
    };
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      if (teamId) where.assignedTeamId = teamId;
    } else if (currentUser.role === 'leader' || currentUser.role === 'sale') {
      const ownTeamId = await this.getOwnTeamId(currentUser.id);
      where.assignedTeamId = ownTeamId ?? '__none__';
    } else {
      return 0;
    }
    return this.prisma.lead.count({ where });
  }

  /**
   * Phạm vi chung cho Dashboard summary (Mục 8, docs/09) — Sale: lead của
   * mình; Leader: cả nhóm; MKT: data mình upload; Quản lý/Admin: toàn bộ
   * (team_id thu hẹp thêm nếu có truyền).
   */
  private async buildScope(
    currentUser: AuthenticatedUser,
    teamId?: string,
  ): Promise<Prisma.LeadWhereInput> {
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      return teamId ? { assignedTeamId: teamId } : {};
    }
    if (currentUser.role === 'leader') {
      const ownTeamId = await this.getOwnTeamId(currentUser.id);
      return { assignedTeamId: ownTeamId ?? '__none__' };
    }
    if (currentUser.role === 'sale') {
      return { assignedToId: currentUser.id };
    }
    // mkt
    return { uploadedById: currentUser.id };
  }

  /** Leader luôn bị ép về đúng nhóm mình bất kể có truyền team_id hay không; Quản lý/Admin dùng nguyên team_id đã truyền (có thể rỗng = toàn bộ). */
  private async resolveTeamIdForRestrictedRole(
    currentUser: AuthenticatedUser,
    teamId?: string,
  ): Promise<string | undefined> {
    if (currentUser.role === 'leader') {
      return (await this.getOwnTeamId(currentUser.id)) ?? '__none__';
    }
    return teamId;
  }

  private async getOwnTeamId(accountId: string): Promise<string | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    return account?.teamId ?? null;
  }

  private buildDateWhere(
    dateFrom?: string,
    dateTo?: string,
    field: 'uploadedAt' | 'createdAt' = 'uploadedAt',
  ): Record<string, unknown> {
    if (!dateFrom && !dateTo) {
      return {};
    }
    return {
      [field]: {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lte: dateTo ? new Date(dateTo) : undefined,
      },
    };
  }

  /**
   * Dự án phụ — nâng cấp toàn diện (ngoài phạm vi Design Freeze docs/09-13):
   * CHỈ dùng cho development — tự dựng lead/lịch hẹn PV rải đều 7 chỉ số qua
   * mọi Sale đang có sẵn trong DB, để Dashboard mới thiết kế không trống khi
   * đánh giá bố cục (yêu cầu trực tiếp người dùng). Không tạo tài khoản/nhóm
   * mới — chỉ gắn data demo vào Sale/nhóm/nguồn đã có sẵn. Chặn production ở
   * DashboardController (assertNonProduction()), giống hệt
   * SaleReminderController.seedTestData().
   */
  async seedDemoData(): Promise<{
    leads_created: number;
    interviews_created: number;
    shuttle_records_created: number;
  }> {
    const [sources, uploader, statuses, sales] = await Promise.all([
      this.prisma.leadSource.findMany({ select: { id: true } }),
      this.prisma.account
        .findFirst({ where: { username: 'mkt_demo' } })
        .then(
          (a) =>
            a ?? this.prisma.account.findFirst({ where: { role: 'admin' } }),
        ),
      this.prisma.statusCatalog.findMany({
        where: {
          category: {
            in: [
              'call_result',
              'call_status',
              'interview_status',
              'employment_status',
            ],
          },
        },
      }),
      this.prisma.account.findMany({
        where: { role: 'sale', status: 'active' },
        select: { id: true, teamId: true, fullName: true },
      }),
    ]);

    if (!uploader) {
      throw new Error(
        'Không tìm thấy tài khoản để gán làm người upload demo data',
      );
    }
    if (sales.length === 0 || sources.length === 0) {
      throw new Error(
        'Cần có ít nhất 1 tài khoản Sale và 1 nguồn lead trước khi tạo demo data',
      );
    }

    const findStatus = (category: string, code: string): string => {
      const found = statuses.find(
        (s) => s.category === category && s.code === code,
      );
      if (!found) throw new Error(`Thiếu status_catalog: ${category}/${code}`);
      return found.id;
    };
    const potentialId = findStatus('call_result', 'POTENTIAL');
    const calledId = findStatus('call_status', 'CALLED');
    const employedStatusId = findStatus('employment_status', 'EMPLOYED');
    const interviewStatusIds = {
      SCHEDULED: findStatus('interview_status', 'SCHEDULED'),
      ATTENDED: findStatus('interview_status', 'ATTENDED'),
      NO_SHOW: findStatus('interview_status', 'NO_SHOW'),
      PASSED: findStatus('interview_status', 'PASSED'),
      FAILED: findStatus('interview_status', 'FAILED'),
    };

    const FIRST_NAMES = [
      'Nguyễn Văn',
      'Trần Thị',
      'Lê Văn',
      'Phạm Thị',
      'Hoàng Văn',
      'Vũ Thị',
      'Đặng Văn',
      'Bùi Thị',
      'Đỗ Văn',
      'Ngô Thị',
    ];
    const LAST_NAMES = [
      'An',
      'Bình',
      'Cường',
      'Dũng',
      'Giang',
      'Hà',
      'Huy',
      'Khánh',
      'Linh',
      'Minh',
      'Nam',
      'Oanh',
      'Phúc',
      'Quân',
      'Sơn',
      'Thảo',
      'Uyên',
      'Việt',
      'Yến',
    ];
    const PARTNER_COMPANIES = [
      'Goertek',
      'Samsung',
      'Foxconn',
      'LG Display',
      'Canon',
    ];

    const randomFrom = <T>(arr: T[]): T =>
      arr[Math.floor(Math.random() * arr.length)];
    const randomDateWithinDays = (maxDaysAgo: number): Date => {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * maxDaysAgo));
      date.setHours(
        Math.floor(Math.random() * 24),
        Math.floor(Math.random() * 60),
        0,
        0,
      );
      return date;
    };

    type Stage =
      | 'new'
      | 'scheduled'
      | 'attended'
      | 'no_show'
      | 'passed'
      | 'failed'
      | 'employed';
    const STAGE_WEIGHTS: Array<[Stage, number]> = [
      ['new', 28],
      ['scheduled', 15],
      ['attended', 10],
      ['no_show', 12],
      ['passed', 10],
      ['failed', 15],
      ['employed', 10],
    ];
    const totalWeight = STAGE_WEIGHTS.reduce(
      (sum, [, weight]) => sum + weight,
      0,
    );
    const pickStage = (): Stage => {
      let roll = Math.random() * totalWeight;
      for (const [stage, weight] of STAGE_WEIGHTS) {
        if (roll < weight) return stage;
        roll -= weight;
      }
      return 'new';
    };

    let leadsCreated = 0;
    let interviewsCreated = 0;

    for (const sale of sales) {
      const leadCount = 18 + Math.floor(Math.random() * 10);
      for (let i = 0; i < leadCount; i++) {
        const stage = pickStage();
        const uploadedAt = randomDateWithinDays(38);

        const lead = await this.prisma.lead.create({
          data: {
            fullName: `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`,
            phoneNumber: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
            sourceId: randomFrom(sources).id,
            uploadedById: uploader.id,
            uploadedAt,
            assignedToId: sale.id,
            assignedTeamId: sale.teamId,
            assignedAt: uploadedAt,
            assignmentMethod: 'manual',
            callStatusId: stage === 'new' ? null : calledId,
            callResultId: stage === 'new' ? null : potentialId,
          },
        });
        leadsCreated++;

        if (stage === 'new') continue;

        const scheduledAt = new Date(
          uploadedAt.getTime() +
            24 * 3600 * 1000 * (1 + Math.floor(Math.random() * 5)),
        );
        let statusId: string;
        let employmentStatusId: string | null = null;
        switch (stage) {
          case 'scheduled':
            statusId = interviewStatusIds.SCHEDULED;
            break;
          case 'attended':
            statusId = interviewStatusIds.ATTENDED;
            break;
          case 'no_show':
            statusId = interviewStatusIds.NO_SHOW;
            break;
          case 'passed':
            statusId = interviewStatusIds.PASSED;
            break;
          case 'failed':
            statusId = interviewStatusIds.FAILED;
            break;
          case 'employed':
            statusId = interviewStatusIds.PASSED;
            employmentStatusId = employedStatusId;
            break;
        }

        await this.prisma.interviewAppointment.create({
          data: {
            leadId: lead.id,
            partnerCompanyName: randomFrom(PARTNER_COMPANIES),
            scheduledAt,
            statusId,
            employmentStatusId,
            createdById: sale.id,
          },
        });
        interviewsCreated++;
      }
    }

    // Dự án phụ — nâng cấp toàn diện (2026-07-14, yêu cầu trực tiếp người
    // dùng): Hẹn/Đến/Bùng/Đỗ/Trượt PV giờ lấy từ Đưa đón (ShuttleRecord),
    // không còn từ vòng lặp InterviewAppointment ở trên — tạo thêm demo data
    // riêng cho Đưa đón để Dashboard mới không trống 5/7 chỉ số này.
    type ShuttleStage =
      | 'attended_passed'
      | 'attended_failed'
      | 'attended_pending'
      | 'no_show'
      | 'rescheduled'
      | 'blank';
    const SHUTTLE_STAGE_WEIGHTS: Array<[ShuttleStage, number]> = [
      ['attended_passed', 18],
      ['attended_failed', 14],
      ['attended_pending', 13],
      ['no_show', 20],
      ['rescheduled', 15],
      ['blank', 20],
    ];
    const shuttleTotalWeight = SHUTTLE_STAGE_WEIGHTS.reduce(
      (sum, [, weight]) => sum + weight,
      0,
    );
    const pickShuttleStage = (): ShuttleStage => {
      let roll = Math.random() * shuttleTotalWeight;
      for (const [stage, weight] of SHUTTLE_STAGE_WEIGHTS) {
        if (roll < weight) return stage;
        roll -= weight;
      }
      return 'blank';
    };

    let shuttleRecordsCreated = 0;

    for (const sale of sales) {
      const shuttleCount = 8 + Math.floor(Math.random() * 10);
      for (let i = 0; i < shuttleCount; i++) {
        const stage = pickShuttleStage();
        let status: string | null = null;
        let interviewResult: string | null = null;
        switch (stage) {
          case 'attended_passed':
            status = SHUTTLE_STATUS_ATTENDED;
            interviewResult = SHUTTLE_RESULT_PASSED;
            break;
          case 'attended_failed':
            status = SHUTTLE_STATUS_ATTENDED;
            interviewResult = SHUTTLE_RESULT_FAILED;
            break;
          case 'attended_pending':
            status = SHUTTLE_STATUS_ATTENDED;
            break;
          case 'no_show':
            status = SHUTTLE_STATUS_NO_SHOW;
            break;
          case 'rescheduled':
            status = 'Hẹn lại';
            break;
          case 'blank':
            status = null;
            break;
        }

        await this.prisma.shuttleRecord.create({
          data: {
            date: randomDateWithinDays(38),
            fullName: `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`,
            phoneNumber: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
            company: randomFrom(PARTNER_COMPANIES),
            sale: sale.fullName,
            status,
            interviewResult,
            createdById: uploader.id,
            updatedById: uploader.id,
          },
        });
        shuttleRecordsCreated++;
      }
    }

    return {
      leads_created: leadsCreated,
      interviews_created: interviewsCreated,
      shuttle_records_created: shuttleRecordsCreated,
    };
  }
}
