import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Lead } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { CandidatesService } from './candidates.service';
import {
  CANDIDATE_INCLUDE,
  CandidateResponseDto,
  toCandidateResponse,
} from './dto/candidate-response.dto';
import { UpdateCallStatusDto } from './dto/update-call-status.dto';
import { UpdateCallResultDto } from './dto/update-call-result.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { ListNotesQueryDto } from './dto/list-notes-query.dto';
import {
  NOTE_INCLUDE,
  NoteResponseDto,
  toNoteResponse,
} from './dto/note-response.dto';

/**
 * Mục 6, docs/13-api-design.md (Phase 3 — Pipeline cuộc gọi & Lịch sử ghi
 * chú). Vai trò được thao tác: Sale (lead của mình), Leader (nhóm mình),
 * Quản lý, Admin — KHÔNG gồm MKT (chỉ xem, Mục 2.6, docs/09).
 */
@Injectable()
export class LeadPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly candidatesService: CandidatesService,
  ) {}

  async updateCallStatus(
    id: string,
    dto: UpdateCallStatusDto,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const lead = await this.loadLeadForUpdate(id, currentUser);
    await this.assertStatusInCategory(dto.call_status_id, 'call_status');

    await this.prisma.lead.update({
      where: { id },
      data: { callStatusId: dto.call_status_id, lastActivityAt: new Date() },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'lead',
      entityId: id,
      fieldChanged: 'call_status_id',
      oldValue: lead.callStatusId ?? undefined,
      newValue: dto.call_status_id,
    });

    return this.reloadCandidate(id);
  }

  async updateCallResult(
    id: string,
    dto: UpdateCallResultDto,
    currentUser: AuthenticatedUser,
  ): Promise<CandidateResponseDto> {
    const lead = await this.loadLeadForUpdate(id, currentUser);
    await this.assertStatusInCategory(dto.call_result_id, 'call_result');

    await this.prisma.lead.update({
      where: { id },
      data: { callResultId: dto.call_result_id, lastActivityAt: new Date() },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'lead',
      entityId: id,
      fieldChanged: 'call_result_id',
      oldValue: lead.callResultId ?? undefined,
      newValue: dto.call_result_id,
    });

    return this.reloadCandidate(id);
  }

  /** Mục 6, docs/13: tất cả note (kể cả đã xóa) — giữ nguyên lịch sử. */
  async listNotes(
    id: string,
    query: ListNotesQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<NoteResponseDto[]> {
    // Tái dùng đúng phạm vi xem ứng viên đã có (MKT chỉ xem, không sửa).
    await this.candidatesService.findOne(id, currentUser);

    const notes = await this.prisma.leadNote.findMany({
      where: {
        leadId: id,
        createdAt: {
          gte: query.date_from ? new Date(query.date_from) : undefined,
          lte: query.date_to ? new Date(query.date_to) : undefined,
        },
      },
      include: NOTE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return notes.map(toNoteResponse);
  }

  async createNote(
    id: string,
    dto: CreateNoteDto,
    currentUser: AuthenticatedUser,
  ): Promise<NoteResponseDto> {
    const lead = await this.loadLeadForUpdate(id, currentUser);

    const created = await this.prisma.leadNote.create({
      data: {
        leadId: id,
        createdById: currentUser.id,
        content: dto.content,
        // Snapshot tình trạng/kết quả cuộc gọi tại thời điểm ghi (Mục 2.9, docs/11).
        callStatusId: lead.callStatusId,
        callResultId: lead.callResultId,
      },
      include: NOTE_INCLUDE,
    });

    await this.prisma.lead.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'lead_note',
      entityId: created.id,
      newValue: dto.content,
    });

    return toNoteResponse(created);
  }

  /**
   * Mục 6, docs/13: "Sale (ghi chú của mình)" — điểm còn chưa xác nhận
   * (Mục 11.7, docs/09) về việc Sale có được xóa note của sale khác cùng
   * lead hay không; tạm hiện thực đúng theo giả định đã ghi trong tài liệu
   * 13 (chỉ note của chính mình), không tự suy rộng thêm.
   */
  async deleteNote(
    id: string,
    noteId: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const note = await this.prisma.leadNote.findUnique({
      where: { id: noteId },
    });
    if (!note || note.leadId !== id || note.isDeleted) {
      throw new NotFoundException('Không tìm thấy ghi chú');
    }
    if (currentUser.role !== 'sale' || note.createdById !== currentUser.id) {
      throw new ForbiddenException(
        'Bạn chỉ được xóa ghi chú do chính mình ghi',
      );
    }

    await this.prisma.leadNote.update({
      where: { id: noteId },
      data: {
        isDeleted: true,
        deletedById: currentUser.id,
        deletedAt: new Date(),
      },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'delete',
      entityType: 'lead_note',
      entityId: noteId,
    });
  }

  /**
   * Mục 6, docs/13: cập nhật tình trạng/kết quả cuộc gọi + thêm note đều
   * dùng chung 1 quy tắc quyền — Sale (lead của mình), Leader (nhóm mình),
   * Quản lý, Admin. KHÔNG gồm MKT (khác với PUT /candidate/:id vốn cho MKT
   * sửa data do mình upload — đây là dữ liệu do Sale xử lý, không phải MKT).
   */
  private async loadLeadForUpdate(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }

    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      return lead;
    }
    if (currentUser.role === 'sale') {
      if (lead.assignedToId === currentUser.id) {
        return lead;
      }
      throw new ForbiddenException(
        'Bạn chỉ được cập nhật ứng viên đang phụ trách',
      );
    }
    if (currentUser.role === 'leader') {
      const account = await this.prisma.account.findUnique({
        where: { id: currentUser.id },
      });
      if (account?.teamId && lead.assignedTeamId === account.teamId) {
        return lead;
      }
      throw new ForbiddenException(
        'Bạn chỉ được cập nhật ứng viên trong nhóm mình',
      );
    }

    throw new ForbiddenException('Bạn không có quyền thực hiện hành động này');
  }

  private async assertStatusInCategory(
    statusId: string,
    category: 'call_status' | 'call_result',
  ): Promise<void> {
    const status = await this.prisma.statusCatalog.findUnique({
      where: { id: statusId },
    });
    if (!status || status.category !== category) {
      throw new UnprocessableEntityException(
        `Giá trị trạng thái không hợp lệ cho nhóm "${category}"`,
      );
    }
  }

  private async reloadCandidate(id: string): Promise<CandidateResponseDto> {
    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }
}
