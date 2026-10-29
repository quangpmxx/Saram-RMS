import { Injectable } from '@nestjs/common';
import { CandidateResponseDto } from '../candidates/dto/candidate-response.dto';
import { NoteResponseDto } from '../candidates/dto/note-response.dto';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { RealtimeGateway } from './realtime.gateway';
import { LeadChangeType, LeadEventTargets } from './realtime-event.interface';
import { AppRealtimeAction, AppRealtimeEvent } from './app-event.interface';

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): lớp bọc mỏng quanh
 * RealtimeGateway — các service nghiệp vụ (CandidatesService,
 * LeadPipelineService, CarePoolService...) gọi qua service này thay vì phụ
 * thuộc thẳng vào Gateway, tránh phải import RealtimeModule dày đặc khắp
 * nơi và tách rõ "tính toán payload/đối tượng nhận" khỏi "cơ chế phát
 * WebSocket". Gọi SAU KHI ghi DB thành công (đúng Mục 3 bản yêu cầu).
 */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  private targetsFromCandidate(
    candidate: CandidateResponseDto,
  ): LeadEventTargets {
    return {
      assignedTeamId: candidate.assigned_team_id,
      assignedToId: candidate.assigned_to?.id ?? null,
      carePoolLockedById: candidate.care_pool_locked_by?.id ?? null,
      visibleToAllLeaderSale: candidate.assigned_team_id === null,
    };
  }

  /** Dùng cho MỌI thay đổi có sẵn `CandidateResponseDto` mới nhất (create/update/assign/transfer/hold/care-pool...). */
  emitCandidateChange(
    changeType: LeadChangeType,
    candidate: CandidateResponseDto,
    actor: AuthenticatedUser | null,
  ): void {
    this.gateway.broadcastLeadEvent(this.targetsFromCandidate(candidate), {
      lead_id: candidate.id,
      change_type: changeType,
      candidate,
      updated_at: candidate.updated_at,
      actor: actor ? { id: actor.id, role: actor.role } : null,
    });
    // Mục 4, yêu cầu người dùng (mở rộng realtime — Dashboard): mọi thay đổi
    // Lead (tạo/sửa/gán/chuyển/giữ số/chăm sóc/PHỎNG VẤN — xem
    // syncCurrentInterviewSnapshot() đều đi qua emitCandidateChange()) đều
    // CÓ THỂ ảnh hưởng KPI/phễu Dashboard — phát kèm tín hiệu invalidate
    // (không kèm dữ liệu), frontend tự debounce/gộp nhiều sự kiện liên tiếp.
    this.emitDashboardInvalidate(actor);
  }

  /**
   * Dùng cho note_created (kèm luôn `candidate` vì last_activity_at đổi) và
   * note_updated/note_deleted (không có field Lead nào đổi, `candidate`
   * để trống — client chỉ cần vá đúng ghi chú trong danh sách).
   */
  emitNoteChange(
    changeType: 'note_created' | 'note_updated' | 'note_deleted',
    note: NoteResponseDto,
    targets: LeadEventTargets,
    actor: AuthenticatedUser | null,
    candidate?: CandidateResponseDto,
  ): void {
    this.gateway.broadcastLeadEvent(targets, {
      lead_id: note.lead_id,
      change_type: changeType,
      note,
      candidate,
      updated_at: candidate?.updated_at ?? note.created_at,
      actor: actor ? { id: actor.id, role: actor.role } : null,
    });
  }

  /**
   * Xóa mềm (remove()) không trả về CandidateResponseDto (bản ghi đã bị
   * loại khỏi mọi truy vấn thường) — dùng thẳng dữ liệu Lead trước khi xóa
   * (đã có sẵn ở nơi gọi) để tính đối tượng nhận.
   */
  emitLeadDeleted(
    leadId: string,
    targets: LeadEventTargets,
    actor: AuthenticatedUser | null,
  ): void {
    this.gateway.broadcastLeadEvent(targets, {
      lead_id: leadId,
      change_type: 'deleted',
      updated_at: new Date().toISOString(),
      actor: actor ? { id: actor.id, role: actor.role } : null,
    });
    this.emitDashboardInvalidate(actor);
  }

  // ===========================================================================
  // Mục 5, yêu cầu người dùng (2026-07-16) — "Mở rộng cơ chế đồng bộ realtime
  // sang Đưa đón/Báo cáo/Check phạt/Thông báo/Dashboard": TÁI SỬ DỤNG đúng
  // service/gateway/connection ở trên — các hàm bên dưới KHÔNG đụng tới
  // emitCandidateChange/emitNoteChange/emitLeadDeleted phía trên (Data lao
  // động giữ nguyên logic đang chạy ổn định).
  // ===========================================================================

  private buildAppEvent<T>(
    module: AppRealtimeEvent['module'],
    entity: string,
    action: AppRealtimeAction,
    entityId: string | null,
    actor: AuthenticatedUser | null,
    payload?: T,
  ): AppRealtimeEvent<T> {
    return {
      module,
      entity,
      action,
      entity_id: entityId,
      updated_at: new Date().toISOString(),
      actor: actor ? { id: actor.id, role: actor.role } : null,
      payload,
    };
  }

  /**
   * Đưa đón — KHÔNG có giới hạn RBAC theo bản ghi (đã xác nhận qua
   * shuttle.controller.ts/shuttle.service.ts thật — không @Roles(), không
   * lọc theo currentUser trong list()), nên phát cho MỌI tài khoản đã đăng
   * nhập (`broadcastAll`) là đúng, không phải phát rộng hơn quyền xem thật.
   */
  emitTransportationChange<T extends { id: string }>(
    action: AppRealtimeAction,
    record: T,
    actor: AuthenticatedUser | null,
  ): void {
    this.gateway.broadcastAppEvent(
      { broadcastAll: true },
      this.buildAppEvent(
        'transportation',
        'transportation',
        action,
        record.id,
        actor,
        record,
      ),
    );
    // Mục 4 — Đưa đón nằm trong computeShuttleKpi() của Dashboard (dashboard.service.ts).
    this.emitDashboardInvalidate(actor);
  }

  emitTransportationDeleted(id: string, actor: AuthenticatedUser | null): void {
    this.emitDashboardInvalidate(actor);
    this.gateway.broadcastAppEvent(
      { broadcastAll: true },
      this.buildAppEvent(
        'transportation',
        'transportation',
        'deleted',
        id,
        actor,
      ),
    );
  }

  /**
   * DS Sale (module con "Nhập doanh số") — chỉ Admin xem được (khớp
   * `@Roles('admin')` ở sales-entry.controller.ts) nên `broadcastAll` an
   * toàn, cùng lý luận với emitTransportationChange() ở trên.
   */
  emitSalesEntryChange<T extends { id: string }>(
    action: AppRealtimeAction,
    record: T,
    actor: AuthenticatedUser | null,
  ): void {
    this.gateway.broadcastAppEvent(
      { broadcastAll: true },
      this.buildAppEvent(
        'sales-entry',
        'sales_entry_record',
        action,
        record.id,
        actor,
        record,
      ),
    );
  }

  /**
   * Báo cáo hằng ngày — Sale chỉ xem báo cáo của chính mình (`accountId`),
   * Leader xem cả nhóm nhưng KHÔNG qua phòng nhóm chung của Data lao động
   * (Sale cùng nhóm KHÔNG được xem báo cáo của nhau) — dùng `leaderOfTeamId`
   * (phòng riêng chỉ Leader đúng nhóm đó), cộng `adminManagerOnly` (loại
   * MKT, khớp ALLOWED_ROLES thật ở daily-reports.service.ts).
   * `entityId` dùng `report_id` — CÓ THỂ null cho dòng "chưa báo cáo" tổng
   * hợp; client khớp theo composite key (account_id + date) chứ không phải
   * entity_id, xem lib/realtime-app.ts phía frontend.
   */
  emitDailyReportChange<
    T extends {
      report_id: string | null;
      account: { id: string };
      team: { id: string } | null;
    },
  >(action: AppRealtimeAction, row: T, actor: AuthenticatedUser | null): void {
    this.gateway.broadcastAppEvent(
      {
        accountId: row.account.id,
        leaderOfTeamId: row.team?.id ?? null,
        adminManagerOnly: true,
      },
      this.buildAppEvent(
        'daily-report',
        'daily-report',
        action,
        row.report_id,
        actor,
        row,
      ),
    );
  }

  /** Check phạt — cùng phạm vi RBAC với Báo cáo hằng ngày (xem emitDailyReportChange). */
  emitPenaltyChange<
    T extends { id: string; account_id: string; team_id: string | null },
  >(
    action: AppRealtimeAction,
    violation: T,
    actor: AuthenticatedUser | null,
  ): void {
    this.gateway.broadcastAppEvent(
      {
        accountId: violation.account_id,
        leaderOfTeamId: violation.team_id,
        adminManagerOnly: true,
      },
      this.buildAppEvent(
        'penalty',
        'penalty',
        action,
        violation.id,
        actor,
        violation,
      ),
    );
  }

  /**
   * Thông báo — mỗi dòng Notification chỉ có ĐÚNG 1 accountId nhận (không
   * có khái niệm nhóm/broadcast ở tầng DB — xác nhận qua schema.prisma
   * thật), nên gọi 1 LẦN cho MỖI người nhận (nơi gọi tự lặp qua danh sách
   * accountId nếu tạo hàng loạt qua createMany, giống cách notifyTeamOfNewData
   * đã làm cho notification hiện tại).
   */
  emitNotificationCreated<T extends { id: string; account_id: string }>(
    notification: T,
    actor: AuthenticatedUser | null,
  ): void {
    this.gateway.broadcastAppEvent(
      { accountId: notification.account_id },
      this.buildAppEvent(
        'notification',
        'notification',
        'created',
        notification.id,
        actor,
        notification,
      ),
    );
  }

  /**
   * Dashboard — CHỈ phát tín hiệu "cần refetch", KHÔNG kèm dữ liệu KPI cụ
   * thể (Mục 4 bản yêu cầu). Phát cho MỌI tài khoản đã đăng nhập vì các
   * endpoint /dashboard/* tự áp lại đúng phạm vi RBAC theo từng request phía
   * server (buildScope() — xem dashboard.service.ts) — không cần lọc phòng
   * theo vai trò ở tầng phát sự kiện.
   */
  emitDashboardInvalidate(actor: AuthenticatedUser | null): void {
    this.gateway.broadcastAppEvent(
      { broadcastAll: true },
      this.buildAppEvent('dashboard', 'dashboard', 'invalidate', null, actor),
    );
  }
}
