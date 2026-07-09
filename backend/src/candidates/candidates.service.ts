import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Lead } from '../../generated/prisma/client';
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
import { ListCandidatesQueryDto } from './dto/list-candidates-query.dto';
import { DuplicateWarning } from './dto/duplicate-warning.dto';
import { LeadDuplicateService } from './lead-duplicate.service';

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
    const where = await this.buildScopeWhere(currentUser);

    if (query.keyword) {
      where.OR = [
        { fullName: { contains: query.keyword, mode: 'insensitive' } },
        { phoneNumber: { contains: query.keyword } },
      ];
    }
    if (query.source_id) {
      where.sourceId = query.source_id;
    }
    if (query.is_duplicate_flagged !== undefined) {
      where.isDuplicateFlagged = query.is_duplicate_flagged === 'true';
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

  /** Mục 8, docs/09: phạm vi xem — Sale: lead của mình; Leader: cả nhóm; còn lại: toàn bộ. */
  private async buildScopeWhere(currentUser: AuthenticatedUser) {
    const where: Record<string, unknown> = { deletedAt: null };

    if (FULL_ACCESS_ROLES.has(currentUser.role)) {
      return where;
    }

    if (currentUser.role === 'leader') {
      const teamId = await this.getOwnTeamId(currentUser.id);
      where.assignedTeamId = teamId ?? '__none__';
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

    if (currentUser.role === 'sale' && lead.assignedToId === currentUser.id) {
      return;
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
