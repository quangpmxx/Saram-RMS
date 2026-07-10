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
  SalePerformanceDto,
  TeamSummaryDto,
} from './dto/dashboard-response.dto';

/** Mục 4, docs/13: "Chờ phân chia" là hàng đợi chung toàn hệ thống — không giới hạn theo nhóm (đúng hành vi GET /candidate/pending đã có từ Phase 2). */
const PENDING_VIEW_ROLES = new Set(['admin', 'manager', 'leader', 'mkt']);
const PERFORMANCE_VIEW_ROLES = new Set(['admin', 'manager', 'leader']);
const REPORT_VIEW_ROLES = new Set(['admin', 'manager', 'leader']);

/** Bám sát đúng 3 trạng thái phỏng vấn tính là "đã đến PV" — SCHEDULED chưa đến, NO_SHOW là bùng (không đến). */
const ATTENDED_INTERVIEW_STATUS_CODES = ['ATTENDED', 'PASSED', 'FAILED'];

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
    const baseWhere: Prisma.LeadWhereInput = {
      ...scope,
      deletedAt: null,
      ...dateWhere,
    };

    const [sources, bySourceRaw, funnel, pendingCount, carePoolCount] =
      await Promise.all([
        this.prisma.leadSource.findMany(),
        this.prisma.lead.groupBy({
          by: ['sourceId'],
          where: baseWhere,
          _count: { _all: true },
        }),
        this.computeFunnel(baseWhere),
        this.getPendingCount(currentUser, query.date_from, query.date_to),
        this.getCarePoolCount(currentUser, query.team_id),
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
    const sales = await this.prisma.account.findMany({
      where: { role: 'sale', ...(teamId ? { teamId } : {}) },
      select: { id: true, fullName: true },
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

    return Promise.all(
      sales.map(async (sale) => {
        const [calls, potentialLeads, interviewCount, employedCount] =
          await Promise.all([
            this.prisma.leadNote.count({
              where: { createdById: sale.id, ...noteDateWhere },
            }),
            this.prisma.lead.count({
              where: {
                assignedToId: sale.id,
                deletedAt: null,
                callResult: { code: 'POTENTIAL' },
                ...leadDateWhere,
              },
            }),
            this.prisma.interviewAppointment.count({
              where: { createdById: sale.id, ...interviewDateWhere },
            }),
            this.prisma.lead.count({
              where: {
                assignedToId: sale.id,
                deletedAt: null,
                interviews: {
                  some: { employmentStatus: { code: 'EMPLOYED' } },
                },
                ...leadDateWhere,
              },
            }),
          ]);

        return {
          account_id: sale.id,
          full_name: sale.fullName,
          calls,
          potential_leads: potentialLeads,
          interview_count: interviewCount,
          employed_count: employedCount,
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

    return Promise.all(
      teams.map(async (team) => {
        const where: Prisma.LeadWhereInput = {
          assignedTeamId: team.id,
          deletedAt: null,
          ...dateWhere,
        };
        const [leadCount, funnel, carePoolCount] = await Promise.all([
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
        ]);
        const employedStep = funnel.find((step) => step.code === 'EMPLOYED');

        return {
          team_id: team.id,
          team_name: team.name,
          lead_count: leadCount,
          conversion_rate: employedStep?.percentage ?? 0,
          care_pool_count: carePoolCount,
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
}
