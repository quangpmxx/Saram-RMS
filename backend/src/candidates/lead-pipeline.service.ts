import {
  ConflictException,
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
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import {
  INTERVIEW_INCLUDE,
  InterviewResponseDto,
  toInterviewResponse,
} from './dto/interview-response.dto';
import { CreateCallbackDto } from './dto/create-callback.dto';
import { UpdateCallbackDto } from './dto/update-callback.dto';
import {
  CALLBACK_INCLUDE,
  CallbackResponseDto,
  toCallbackResponse,
} from './dto/callback-response.dto';
import { isLockActive, isVisibleInCarePool } from './care-pool.util';

/**
 * Mục 6, docs/13-api-design.md (Phase 3 — Pipeline cuộc gọi & Lịch sử ghi
 * chú; Phase 4 — Lịch phỏng vấn & lịch gọi lại). Vai trò được thao tác: Sale
 * (lead của mình), Leader (nhóm mình), Quản lý, Admin — KHÔNG gồm MKT (chỉ
 * xem, Mục 2.6, docs/09). Riêng PUT /callback/:id: Sale chỉ sửa lịch do
 * chính mình đặt (Mục 6, docs/13 ghi rõ "lịch của mình", khác cụm "lead của
 * mình" dùng ở các API khác trong file này).
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
   * 13 (chỉ note của chính mình), không tự suy rộng thêm cho Sale.
   * Admin/Quản lý kế thừa toàn bộ quyền nghiệp vụ của Sale (yêu cầu bổ
   * sung "Admin và Quản lý phải có toàn bộ quyền của các vai trò cấp
   * dưới") nên xóa được ghi chú bất kỳ, không giới hạn "của chính mình".
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
    const isFullAccess =
      currentUser.role === 'admin' || currentUser.role === 'manager';
    const isOwnNote =
      currentUser.role === 'sale' && note.createdById === currentUser.id;
    if (!isFullAccess && !isOwnNote) {
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
   * Mục 6, docs/13: đặt lịch hẹn PV mới — kể cả hẹn lại sau khi bùng PV, hệ
   * thống tự tăng attempt_no (Mục 2.10, tài liệu 11). Trạng thái khởi tạo
   * luôn là "Đã hẹn PV" (Mục 6, tài liệu 09).
   */
  async createInterview(
    id: string,
    dto: CreateInterviewDto,
    currentUser: AuthenticatedUser,
  ): Promise<InterviewResponseDto> {
    await this.loadLeadForUpdate(id, currentUser);

    const scheduledStatus = await this.getStatusByCode(
      'interview_status',
      'SCHEDULED',
    );
    const lastAttempt = await this.prisma.interviewAppointment.findFirst({
      where: { leadId: id },
      orderBy: { attemptNo: 'desc' },
    });

    const created = await this.prisma.interviewAppointment.create({
      data: {
        leadId: id,
        attemptNo: (lastAttempt?.attemptNo ?? 0) + 1,
        partnerCompanyName: dto.partner_company_name,
        scheduledAt: new Date(dto.scheduled_at),
        statusId: scheduledStatus.id,
        createdById: currentUser.id,
      },
      include: INTERVIEW_INCLUDE,
    });

    await this.syncCurrentInterviewSnapshot(id);

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'interview_appointment',
      entityId: created.id,
      newValue: `attempt_no=${created.attemptNo}, partner_company_name=${created.partnerCompanyName}`,
    });

    return toInterviewResponse(created);
  }

  /** Mục 6, docs/13: toàn bộ lịch sử các lần hẹn PV — sắp theo attempt_no. */
  async listInterviews(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<InterviewResponseDto[]> {
    await this.candidatesService.findOne(id, currentUser);

    const interviews = await this.prisma.interviewAppointment.findMany({
      where: { leadId: id },
      include: INTERVIEW_INCLUDE,
      orderBy: { attemptNo: 'asc' },
    });

    return interviews.map(toInterviewResponse);
  }

  /**
   * Mục 6, docs/13: cập nhật kết quả 1 lần hẹn PV (đến/bùng, đỗ/trượt, đi
   * làm/không đi làm kèm lý do). Mục 4/6, tài liệu 09: employment_status_id
   * chỉ hợp lệ khi status_id là "Đỗ PV"; employment_reason bắt buộc khi
   * "Không đi làm".
   */
  async updateInterview(
    interviewId: string,
    dto: UpdateInterviewDto,
    currentUser: AuthenticatedUser,
  ): Promise<InterviewResponseDto> {
    const interview = await this.prisma.interviewAppointment.findUnique({
      where: { id: interviewId },
    });
    if (!interview) {
      throw new NotFoundException('Không tìm thấy lịch hẹn phỏng vấn');
    }
    await this.loadLeadForUpdate(interview.leadId, currentUser);

    const status = await this.assertStatusInCategory(
      dto.status_id,
      'interview_status',
    );

    let employmentStatusCode: string | null = null;
    if (dto.employment_status_id) {
      if (status.code !== 'PASSED') {
        throw new UnprocessableEntityException(
          'Chỉ được ghi nhận kết quả đi làm khi trạng thái phỏng vấn là "Đỗ PV"',
        );
      }
      const employmentStatus = await this.assertStatusInCategory(
        dto.employment_status_id,
        'employment_status',
      );
      employmentStatusCode = employmentStatus.code;
    }
    if (employmentStatusCode === 'NOT_EMPLOYED' && !dto.employment_reason) {
      throw new UnprocessableEntityException(
        'Bắt buộc nhập lý do khi ghi nhận "Không đi làm"',
      );
    }

    const updated = await this.prisma.interviewAppointment.update({
      where: { id: interviewId },
      data: {
        statusId: dto.status_id,
        employmentStatusId: dto.employment_status_id ?? null,
        employmentReason: dto.employment_status_id
          ? (dto.employment_reason ?? null)
          : null,
      },
      include: INTERVIEW_INCLUDE,
    });

    await this.syncCurrentInterviewSnapshot(interview.leadId);

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'interview_appointment',
      entityId: interviewId,
      fieldChanged: 'status_id',
      oldValue: interview.statusId,
      newValue: dto.status_id,
    });

    return toInterviewResponse(updated);
  }

  /** Mục 6, docs/13: đặt lịch gọi lại. */
  async createCallback(
    id: string,
    dto: CreateCallbackDto,
    currentUser: AuthenticatedUser,
  ): Promise<CallbackResponseDto> {
    await this.loadLeadForUpdate(id, currentUser);

    const created = await this.prisma.callbackSchedule.create({
      data: {
        leadId: id,
        scheduledAt: new Date(dto.scheduled_at),
        createdById: currentUser.id,
      },
      include: CALLBACK_INCLUDE,
    });

    await this.prisma.lead.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'create',
      entityType: 'callback_schedule',
      entityId: created.id,
      newValue: `scheduled_at=${created.scheduledAt.toISOString()}`,
    });

    return toCallbackResponse(created);
  }

  /**
   * Mục 6, docs/13: "Sale (lịch của mình)" — khác quy tắc "lead của mình"
   * dùng ở các API khác trong file này (Leader/Quản lý/Admin vẫn theo đúng
   * phạm vi chuẩn qua lead liên quan), nên không dùng chung loadLeadForUpdate
   * cho vai trò Sale.
   */
  async updateCallback(
    callbackId: string,
    dto: UpdateCallbackDto,
    currentUser: AuthenticatedUser,
  ): Promise<CallbackResponseDto> {
    const callback = await this.prisma.callbackSchedule.findUnique({
      where: { id: callbackId },
    });
    if (!callback) {
      throw new NotFoundException('Không tìm thấy lịch gọi lại');
    }

    if (currentUser.role === 'sale') {
      if (callback.createdById !== currentUser.id) {
        throw new ForbiddenException(
          'Bạn chỉ được cập nhật lịch gọi lại của mình',
        );
      }
    } else {
      await this.loadLeadForUpdate(callback.leadId, currentUser);
    }

    const updated = await this.prisma.callbackSchedule.update({
      where: { id: callbackId },
      data: {
        scheduledAt: dto.scheduled_at ? new Date(dto.scheduled_at) : undefined,
        isCompleted: dto.is_completed,
      },
      include: CALLBACK_INCLUDE,
    });

    await this.auditLog.log({
      accountId: currentUser.id,
      actionType: 'update',
      entityType: 'callback_schedule',
      entityId: callbackId,
    });

    return toCallbackResponse(updated);
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
      // Phase 5 — Mục 8, docs/09: Sale cũng xử lý được lead trong cột chăm
      // sóc của nhóm mình, nhưng BẮT BUỘC đã chiếm khóa trước (POST
      // /care-pool/:id/lock) — đúng quy tắc "chỉ 1 người xử lý 1 lead tại 1
      // thời điểm" (Mục 10.1, docs/09).
      if (isVisibleInCarePool(lead)) {
        const account = await this.prisma.account.findUnique({
          where: { id: currentUser.id },
        });
        if (account?.teamId && lead.assignedTeamId === account.teamId) {
          if (
            lead.carePoolLockedById === currentUser.id &&
            isLockActive(lead)
          ) {
            return lead;
          }
          if (lead.carePoolLockedById && isLockActive(lead)) {
            const locker = await this.prisma.account.findUnique({
              where: { id: lead.carePoolLockedById },
            });
            throw new ConflictException(
              `Sale ${locker?.fullName ?? 'khác'} đang xử lý ứng viên này, vui lòng thử lại sau`,
            );
          }
          throw new ForbiddenException(
            'Bạn cần chiếm khóa xử lý (mở lead trong Cột chăm sóc) trước khi thao tác',
          );
        }
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
    category:
      'call_status' | 'call_result' | 'interview_status' | 'employment_status',
  ) {
    const status = await this.prisma.statusCatalog.findUnique({
      where: { id: statusId },
    });
    if (!status || status.category !== category) {
      throw new UnprocessableEntityException(
        `Giá trị trạng thái không hợp lệ cho nhóm "${category}"`,
      );
    }
    return status;
  }

  private async getStatusByCode(
    category: 'interview_status' | 'employment_status',
    code: string,
  ) {
    const status = await this.prisma.statusCatalog.findFirst({
      where: { category, code },
    });
    if (!status) {
      throw new UnprocessableEntityException(
        `Không tìm thấy trạng thái hệ thống "${category}.${code}" trong danh mục`,
      );
    }
    return status;
  }

  /** Mục 7.2, tài liệu 11: đồng bộ lại snapshot từ lần hẹn PV mới nhất. */
  private async syncCurrentInterviewSnapshot(leadId: string): Promise<void> {
    const latest = await this.prisma.interviewAppointment.findFirst({
      where: { leadId },
      orderBy: { attemptNo: 'desc' },
    });

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        currentInterviewStatusId: latest?.statusId ?? null,
        currentEmploymentStatusId: latest?.employmentStatusId ?? null,
        currentPartnerCompanyName: latest?.partnerCompanyName ?? null,
        lastActivityAt: new Date(),
      },
    });
  }

  private async reloadCandidate(id: string): Promise<CandidateResponseDto> {
    const final = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: CANDIDATE_INCLUDE,
    });
    return toCandidateResponse(final);
  }
}
