import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  CANDIDATE_INCLUDE,
  CandidateResponseDto,
  toCandidateResponse,
} from '../candidates/dto/candidate-response.dto';
import { isLockActive } from '../candidates/care-pool.util';
import { ListCarePoolQueryDto } from './dto/list-care-pool-query.dto';

/** Mục 8, docs/09: Quản lý/Admin xem toàn bộ cột chăm sóc, không giới hạn nhóm. */
const FULL_ACCESS_ROLES = new Set(['admin', 'manager']);

/**
 * Mục 5, docs/13-api-design.md — GET/POST/DELETE /care-pool. Phase 5 —
 * Cột chăm sóc tự động (Care Pool), docs/14-roadmap.md.
 */
@Injectable()
export class CarePoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Mục 5, docs/13: Sale, Leader, Quản lý, Admin (phạm vi theo nhóm, trừ Quản lý/Admin xem toàn bộ). */
  async list(
    query: ListCarePoolQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<CandidateResponseDto>> {
    const where: Record<string, unknown> = {
      deletedAt: null,
      enteredCarePoolAt: { not: null },
      removedFromCarePoolAt: null,
    };

    if (FULL_ACCESS_ROLES.has(currentUser.role)) {
      if (query.team_id) {
        where.assignedTeamId = query.team_id;
      }
    } else {
      // sale, leader — mkt không có trong danh sách quyền sử dụng của API này
      if (currentUser.role !== 'sale' && currentUser.role !== 'leader') {
        throw new ForbiddenException('Bạn không có quyền xem cột chăm sóc');
      }
      const ownTeamId = await this.getOwnTeamId(currentUser.id);
      where.assignedTeamId = ownTeamId ?? '__none__';
    }

    const [total, leads] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: CANDIDATE_INCLUDE,
        orderBy: { enteredCarePoolAt: 'asc' },
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

  /** Mục 5, docs/13: POST /care-pool/:id/lock — Sale (cùng nhóm với lead đó). */
  async lock(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    if (currentUser.role !== 'sale') {
      throw new ForbiddenException('Chỉ Sale mới được chiếm khóa xử lý');
    }

    const lead = await this.loadCarePoolLead(id);
    const ownTeamId = await this.getOwnTeamId(currentUser.id);
    if (!ownTeamId || lead.assignedTeamId !== ownTeamId) {
      throw new ForbiddenException(
        'Bạn chỉ được xử lý lead trong cột chăm sóc của nhóm mình',
      );
    }

    if (lead.carePoolLockedById === currentUser.id && isLockActive(lead)) {
      // Đã tự khóa từ trước — idempotent, không báo lỗi.
      const current = await this.prisma.lead.findUniqueOrThrow({
        where: { id },
        include: CANDIDATE_INCLUDE,
      });
      return toCandidateResponse(current);
    }

    if (lead.carePoolLockedById && isLockActive(lead)) {
      const locker = await this.prisma.account.findUnique({
        where: { id: lead.carePoolLockedById },
      });
      throw new ConflictException(
        `Sale ${locker?.fullName ?? 'khác'} đang xử lý, vui lòng thử lại sau`,
      );
    }

    await this.prisma.lead.update({
      where: { id },
      data: {
        carePoolLockedById: currentUser.id,
        carePoolLockedAt: new Date(),
      },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'lock',
      entityType: 'lead',
      entityId: id,
    });

    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }

  /** Mục 5, docs/13: POST /care-pool/:id/release — Sale (người đang giữ khóa). */
  async release(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    if (currentUser.role !== 'sale') {
      throw new ForbiddenException('Chỉ Sale mới được giải phóng khóa xử lý');
    }

    const lead = await this.loadCarePoolLead(id);

    if (lead.carePoolLockedById && lead.carePoolLockedById !== currentUser.id) {
      throw new ForbiddenException(
        'Bạn không đang giữ khóa xử lý ứng viên này',
      );
    }

    if (lead.carePoolLockedById === currentUser.id) {
      await this.prisma.lead.update({
        where: { id },
        data: { carePoolLockedById: null, carePoolLockedAt: null },
      });

      await this.auditLog.log({
        accountId: currentUser.id,
        actionType: 'unlock',
        entityType: 'lead',
        entityId: id,
      });
    }

    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }

  /** Mục 5, docs/13: DELETE /care-pool/:id — Admin (duy nhất). Không xóa ứng viên, chỉ gỡ khỏi danh sách. */
  async remove(id: string, currentUser: AuthenticatedUser): Promise<void> {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ Admin mới được gỡ lead khỏi cột chăm sóc',
      );
    }

    await this.loadCarePoolLead(id);

    await this.prisma.lead.update({
      where: { id },
      data: {
        removedFromCarePoolById: currentUser.id,
        removedFromCarePoolAt: new Date(),
        carePoolLockedById: null,
        carePoolLockedAt: null,
      },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'lead',
      entityId: id,
      fieldChanged: 'removed_from_care_pool_at',
    });
  }

  private async loadCarePoolLead(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (
      !lead ||
      lead.deletedAt ||
      !lead.enteredCarePoolAt ||
      lead.removedFromCarePoolAt
    ) {
      throw new NotFoundException('Không tìm thấy ứng viên trong cột chăm sóc');
    }
    return lead;
  }

  private async getOwnTeamId(accountId: string): Promise<string | null> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    return account?.teamId ?? null;
  }
}
