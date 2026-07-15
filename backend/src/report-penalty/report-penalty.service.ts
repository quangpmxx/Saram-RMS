import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountRole, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { ListReportPenaltyQueryDto } from './dto/list-report-penalty-query.dto';
import { UpdateViolationStatusDto } from './dto/update-violation-status.dto';
import { UpdateReportDeadlineDto } from './dto/update-report-deadline.dto';
import {
  ReportDeadlineResponseDto,
  ReportViolationResponseDto,
  RunReportPenaltyScanResultDto,
} from './dto/report-penalty-response.dto';

const TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Mục 2, yêu cầu người dùng: "Áp dụng cho tài khoản Sale phải nộp báo cáo hằng ngày" — khớp đúng role duy nhất được tạo Báo cáo hằng ngày (daily-reports.service.ts). */
const REPORTER_ROLE: AccountRole = 'sale';

/** Mục 8: Admin/Quản lý/Leader/Sale đều xem được (phạm vi khác nhau). */
const VIEW_ROLES = new Set(['admin', 'manager', 'leader', 'sale']);

/** Mục 8: chỉ Admin/Quản lý được cập nhật trạng thái vi phạm — Leader/Sale chỉ xem. */
const MANAGE_ROLES = new Set(['admin', 'manager']);

/** Mục 5: mặc định 22:30 khi Admin chưa từng cấu hình. */
const DEFAULT_DEADLINE_HOUR = 22;
const DEFAULT_DEADLINE_MINUTE = 30;

const ACCOUNT_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  teamId: true,
  status: true,
  team: { select: { id: true, name: true } },
} satisfies Prisma.AccountSelect;

const VIOLATION_INCLUDE = {
  account: { select: ACCOUNT_SELECT },
  resolvedBy: { select: { fullName: true } },
} satisfies Prisma.ReportViolationInclude;

type ViolationWithNames = Prisma.ReportViolationGetPayload<{
  include: typeof VIOLATION_INCLUDE;
}>;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** "YYYY-MM-DD" theo timezone hệ thống — dùng chung cách tính này trong toàn bộ dự án (attendance.service.ts, checkin.service.ts, leave-accrual.service.ts). */
function dateOnlyInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateOnlyToUtcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/** Việt Nam luôn UTC+7 (không DST) — dựng thời điểm hạn chót thật (múi giờ hệ thống, KHÔNG dùng giờ máy người dùng — Mục 3). */
function buildDeadlineSnapshot(
  dateOnly: string,
  hour: number,
  minute: number,
): Date {
  return new Date(`${dateOnly}T${pad2(hour)}:${pad2(minute)}:00.000+07:00`);
}

function toViolationResponse(
  violation: ViolationWithNames,
): ReportViolationResponseDto {
  return {
    id: violation.id,
    account_id: violation.accountId,
    account_name: violation.account.fullName,
    account_avatar_url: violation.account.avatarUrl,
    team_id: violation.account.teamId,
    team_name: violation.account.team?.name ?? null,
    report_date: violation.reportDate.toISOString().slice(0, 10),
    deadline_snapshot: violation.deadlineSnapshot.toISOString(),
    actual_submitted_at: violation.actualSubmittedAt?.toISOString() ?? null,
    violation_type: violation.violationType,
    status: violation.status,
    note: violation.note,
    resolved_by_name: violation.resolvedBy?.fullName ?? null,
    resolved_at: violation.resolvedAt?.toISOString() ?? null,
    created_at: violation.createdAt.toISOString(),
    updated_at: violation.updatedAt.toISOString(),
  };
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check phạt" — trang con trong
 * module Báo cáo (Mục 1: "Không tạo module độc lập ngoài sidebar"). Tự
 * động ghi nhận Sale nộp Báo cáo hằng ngày muộn/không nộp, dựa trên
 * DailyReport đã có (daily-reports.service.ts) — KHÔNG đụng tới cách nhân
 * viên nhập báo cáo (Mục 10).
 */
@Injectable()
export class ReportPenaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Mục 5: đọc hạn hiện tại — mọi vai trò xem được trang Check phạt đều cần biết hạn để hiểu cột "Hạn nộp", chỉ ĐỔI mới giới hạn Admin. */
  private async getDeadlineRaw(): Promise<{
    hour: number;
    minute: number;
  }> {
    const config = await this.prisma.reportDeadlineConfig.findFirst();
    return config
      ? { hour: config.hour, minute: config.minute }
      : { hour: DEFAULT_DEADLINE_HOUR, minute: DEFAULT_DEADLINE_MINUTE };
  }

  async getDeadline(
    currentUser: AuthenticatedUser,
  ): Promise<ReportDeadlineResponseDto> {
    if (!VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền xem Check phạt');
    }
    const config = await this.prisma.reportDeadlineConfig.findFirst({
      include: { updatedBy: { select: { fullName: true } } },
    });
    if (!config) {
      return {
        hour: DEFAULT_DEADLINE_HOUR,
        minute: DEFAULT_DEADLINE_MINUTE,
        updated_at: null,
        updated_by_name: null,
      };
    }
    return {
      hour: config.hour,
      minute: config.minute,
      updated_at: config.updatedAt.toISOString(),
      updated_by_name: config.updatedBy.fullName,
    };
  }

  /**
   * Mục 5, yêu cầu người dùng: "Chỉ Admin được thay đổi." Áp dụng cho các
   * ngày TIẾP THEO — KHÔNG tính lại/đổi vi phạm đã ghi nhận trước đó (mỗi
   * vi phạm tự giữ `deadlineSnapshot` riêng, xem createViolationIfMissing()).
   * Ghi audit log đầy đủ: người thay đổi, thời gian, hạn cũ, hạn mới.
   */
  async updateDeadline(
    dto: UpdateReportDeadlineDto,
    currentUser: AuthenticatedUser,
  ): Promise<ReportDeadlineResponseDto> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ Admin được thay đổi thời hạn nộp báo cáo',
      );
    }

    const existing = await this.prisma.reportDeadlineConfig.findFirst();
    const oldLabel = existing
      ? `${pad2(existing.hour)}:${pad2(existing.minute)}`
      : `${pad2(DEFAULT_DEADLINE_HOUR)}:${pad2(DEFAULT_DEADLINE_MINUTE)} (mặc định)`;
    const newLabel = `${pad2(dto.hour)}:${pad2(dto.minute)}`;

    const data = {
      hour: dto.hour,
      minute: dto.minute,
      updatedById: currentUser.id,
    };
    const saved = existing
      ? await this.prisma.reportDeadlineConfig.update({
          where: { id: existing.id },
          data,
          include: { updatedBy: { select: { fullName: true } } },
        })
      : await this.prisma.reportDeadlineConfig.create({
          data,
          include: { updatedBy: { select: { fullName: true } } },
        });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'report_deadline_config',
      entityId: saved.id,
      fieldChanged: 'deadline',
      oldValue: oldLabel,
      newValue: newLabel,
    });

    return {
      hour: saved.hour,
      minute: saved.minute,
      updated_at: saved.updatedAt.toISOString(),
      updated_by_name: saved.updatedBy.fullName,
    };
  }

  /**
   * Mục 3, yêu cầu người dùng: quét sau hạn nộp mỗi ngày, chống trùng theo
   * (nhân viên, ngày báo cáo, loại vi phạm). Có thể truyền `simulatedNow`
   * để test không cần chờ tới hạn thật (Mục 11).
   *
   * QUYẾT ĐỊNH THIẾT KẾ: lịch chạy mỗi 5 phút (self-healing, giống
   * leave-accrual.service.ts) thay vì 1 cron cố định đúng "hạn+1-5 phút" —
   * vì hạn có thể bị Admin đổi bất kỳ lúc nào (Mục 5), 1 giờ cron cố định
   * sẽ lệch nếu hạn mới khác giờ cũ. Mỗi lần chạy tự kiểm tra "đã tới hạn
   * hôm nay chưa" (bỏ qua nếu chưa tới) — cùng với chống trùng theo unique
   * constraint, đảm bảo đúng yêu cầu "trễ hơn thời hạn khoảng 1–5 phút" mà
   * không cần đăng ký lại lịch cron khi hạn đổi.
   */
  async runScan(simulatedNow?: Date): Promise<RunReportPenaltyScanResultDto> {
    const now = simulatedNow ?? new Date();
    const today = dateOnlyInTimezone(now, TIMEZONE);
    const { hour, minute } = await this.getDeadlineRaw();
    const deadlineSnapshot = buildDeadlineSnapshot(today, hour, minute);

    if (now < deadlineSnapshot) {
      return {
        checked: 0,
        late_submissions: [],
        no_submissions: [],
        skipped_before_deadline: true,
      };
    }

    const reportDate = dateOnlyToUtcMidnight(today);
    const sales = await this.prisma.account.findMany({
      where: { role: REPORTER_ROLE, status: 'active' },
      select: { id: true, fullName: true },
    });
    const saleIds = sales.map((s) => s.id);
    if (saleIds.length === 0) {
      return {
        checked: 0,
        late_submissions: [],
        no_submissions: [],
        skipped_before_deadline: false,
      };
    }

    const [reports, existingViolations] = await Promise.all([
      this.prisma.dailyReport.findMany({
        where: { accountId: { in: saleIds }, date: reportDate },
        select: { accountId: true, createdAt: true },
      }),
      this.prisma.reportViolation.findMany({
        where: { accountId: { in: saleIds }, reportDate },
        select: { accountId: true, violationType: true },
      }),
    ]);
    const reportByAccount = new Map(reports.map((r) => [r.accountId, r]));
    const existingKeys = new Set(
      existingViolations.map((v) => `${v.accountId}_${v.violationType}`),
    );

    const lateSubmissions: string[] = [];
    const noSubmissions: string[] = [];

    for (const sale of sales) {
      const report = reportByAccount.get(sale.id);
      if (report) {
        if (
          report.createdAt > deadlineSnapshot &&
          !existingKeys.has(`${sale.id}_late_submission`)
        ) {
          const created = await this.createViolationIfMissing({
            accountId: sale.id,
            reportDate,
            deadlineSnapshot,
            actualSubmittedAt: report.createdAt,
            violationType: 'late_submission',
          });
          if (created) lateSubmissions.push(sale.fullName);
        }
      } else if (!existingKeys.has(`${sale.id}_no_submission`)) {
        const created = await this.createViolationIfMissing({
          accountId: sale.id,
          reportDate,
          deadlineSnapshot,
          actualSubmittedAt: null,
          violationType: 'no_submission',
        });
        if (created) noSubmissions.push(sale.fullName);
      }
    }

    return {
      checked: sales.length,
      late_submissions: lateSubmissions,
      no_submissions: noSubmissions,
      skipped_before_deadline: false,
    };
  }

  /** Bắt riêng P2002 (unique constraint accountId+reportDate+violationType) làm lớp chặn trùng cuối cùng chống race condition — Mục 3: "chạy lại nhiều lần không được sinh thêm bản ghi trùng". */
  private async createViolationIfMissing(data: {
    accountId: string;
    reportDate: Date;
    deadlineSnapshot: Date;
    actualSubmittedAt: Date | null;
    violationType: 'late_submission' | 'no_submission';
  }): Promise<boolean> {
    try {
      await this.prisma.reportViolation.create({ data });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Mục 4, yêu cầu người dùng: "Sau khi bị ghi nhận 'Không nộp báo cáo',
   * nhân viên bổ sung báo cáo... Có thể cập nhật trạng thái thành 'Đã nộp
   * bổ sung'... Vẫn giữ loại vi phạm ban đầu." Gọi từ
   * daily-reports.service.ts NGAY SAU khi tạo báo cáo thành công (Mục 10:
   * KHÔNG đổi cách nhân viên nhập báo cáo — chỉ phản ứng lại sau khi báo
   * cáo đã tồn tại). CHỈ tự chuyển từ trạng thái "pending" — nếu Admin đã
   * chủ động xử lý (confirmed/waived) thì KHÔNG tự động ghi đè quyết định
   * đó (giả định hợp lý, không có trong đặc tả gốc — báo lại nếu sai).
   */
  async markSupplementedIfPending(
    accountId: string,
    reportDateOnly: string,
    submittedAt: Date,
  ): Promise<void> {
    const reportDate = dateOnlyToUtcMidnight(reportDateOnly);
    const violation = await this.prisma.reportViolation.findUnique({
      where: {
        accountId_reportDate_violationType: {
          accountId,
          reportDate,
          violationType: 'no_submission',
        },
      },
    });
    if (!violation || violation.status !== 'pending') return;

    await this.prisma.reportViolation.update({
      where: { id: violation.id },
      data: {
        status: 'supplemented',
        actualSubmittedAt: submittedAt,
      },
    });
  }

  /** Mục 7/8: bộ lọc + phân trang phía server + phạm vi RBAC. */
  async listRecords(
    query: ListReportPenaltyQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<ReportViolationResponseDto>> {
    if (!VIEW_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Bạn không có quyền xem Check phạt');
    }

    const where: Prisma.ReportViolationWhereInput = {};
    if (query.date_from || query.date_to) {
      where.reportDate = {
        gte: query.date_from
          ? dateOnlyToUtcMidnight(query.date_from.slice(0, 10))
          : undefined,
        lte: query.date_to
          ? dateOnlyToUtcMidnight(query.date_to.slice(0, 10))
          : undefined,
      };
    }
    if (query.violation_type) where.violationType = query.violation_type;
    if (query.status) where.status = query.status;

    const accountWhere: Prisma.AccountWhereInput = {};
    if (currentUser.role === 'sale') {
      accountWhere.id = currentUser.id;
    } else if (currentUser.role === 'leader') {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      accountWhere.teamId = account?.teamId ?? '__none__';
      if (query.account_id) accountWhere.id = query.account_id;
    } else {
      if (query.team_id) accountWhere.teamId = query.team_id;
      if (query.account_id) accountWhere.id = query.account_id;
    }
    if (query.keyword) {
      accountWhere.fullName = { contains: query.keyword, mode: 'insensitive' };
    }
    where.account = accountWhere;

    const [total, records] = await this.prisma.$transaction([
      this.prisma.reportViolation.count({ where }),
      this.prisma.reportViolation.findMany({
        where,
        include: VIOLATION_INCLUDE,
        orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return {
      total,
      page: query.page,
      page_size: query.page_size,
      items: records.map(toViolationResponse),
    };
  }

  /** Mục 8: chỉ Admin/Quản lý được cập nhật trạng thái/ghi chú/miễn phạt. */
  async updateStatus(
    id: string,
    dto: UpdateViolationStatusDto,
    currentUser: AuthenticatedUser,
  ): Promise<ReportViolationResponseDto> {
    if (!MANAGE_ROLES.has(currentUser.role)) {
      throw new ForbiddenException(
        'Chỉ Admin/Quản lý được cập nhật trạng thái vi phạm',
      );
    }
    const existing = await this.prisma.reportViolation.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bản ghi vi phạm');
    }

    const updated = await this.prisma.reportViolation.update({
      where: { id },
      data: {
        status: dto.status,
        note: dto.note !== undefined ? dto.note : existing.note,
        resolvedById: currentUser.id,
        resolvedAt: new Date(),
      },
      include: VIOLATION_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'report_violation',
      entityId: id,
      fieldChanged: 'status',
      oldValue: existing.status,
      newValue: dto.status,
    });

    return toViolationResponse(updated);
  }
}
