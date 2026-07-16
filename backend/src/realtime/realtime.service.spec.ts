import { Test } from '@nestjs/testing';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';
import { CandidateResponseDto } from '../candidates/dto/candidate-response.dto';
import { NoteResponseDto } from '../candidates/dto/note-response.dto';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let gateway: { broadcastLeadEvent: jest.Mock; broadcastAppEvent: jest.Mock };

  const actor: AuthenticatedUser = {
    id: 'admin-1',
    role: 'admin',
    sessionId: 's',
  };

  const baseCandidate: CandidateResponseDto = {
    id: 'lead-1',
    full_name: 'Nguyễn Văn A',
    phone_number: '0900000001',
    birth_year: null,
    address: null,
    source: { id: 'source-1', name: 'Facebook' },
    mkt_note: null,
    data_quality_score: null,
    uploaded_by: { id: 'mkt-1', name: 'MKT A', role: 'mkt', avatar_url: null },
    uploaded_at: '2026-01-01T00:00:00.000Z',
    assigned_to: {
      id: 'sale-1',
      name: 'Sale A',
      role: 'sale',
      avatar_url: null,
    },
    assigned_team_id: 'team-1',
    assigned_at: null,
    assignment_method: null,
    call_status: null,
    call_result: null,
    zalo_status: null,
    zalo_friend_status: null,
    note_color: null,
    current_interview_status: null,
    current_employment_status: null,
    current_partner_company_name: null,
    is_held: false,
    held_by: null,
    held_at: null,
    last_activity_at: null,
    entered_care_pool_at: null,
    care_pool_locked_by: {
      id: 'sale-2',
      name: 'Sale B',
      role: 'sale',
      avatar_url: null,
    },
    is_duplicate_flagged: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
  };

  beforeEach(async () => {
    gateway = { broadcastLeadEvent: jest.fn(), broadcastAppEvent: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeService,
        { provide: RealtimeGateway, useValue: gateway },
      ],
    }).compile();

    service = moduleRef.get(RealtimeService);
  });

  describe('emitCandidateChange', () => {
    it('tính đúng đối tượng nhận từ candidate (team/assigned_to/care_pool_locked_by), gửi kèm actor', () => {
      service.emitCandidateChange('updated', baseCandidate, actor);

      expect(gateway.broadcastLeadEvent).toHaveBeenCalledWith(
        {
          assignedTeamId: 'team-1',
          assignedToId: 'sale-1',
          carePoolLockedById: 'sale-2',
          visibleToAllLeaderSale: false,
        },
        {
          lead_id: 'lead-1',
          change_type: 'updated',
          candidate: baseCandidate,
          updated_at: baseCandidate.updated_at,
          actor: { id: 'admin-1', role: 'admin' },
        },
      );
    });

    it('candidate chưa có nhóm (assigned_team_id=null) -> visibleToAllLeaderSale=true', () => {
      service.emitCandidateChange(
        'created',
        {
          ...baseCandidate,
          assigned_team_id: null,
          assigned_to: null,
          care_pool_locked_by: null,
        },
        actor,
      );

      expect(gateway.broadcastLeadEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTeamId: null,
          visibleToAllLeaderSale: true,
        }),
        expect.anything(),
      );
    });

    it('actor=null (hệ thống tự thực hiện) -> payload.actor=null', () => {
      service.emitCandidateChange('care_pool_entered', baseCandidate, null);

      expect(gateway.broadcastLeadEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ actor: null }),
      );
    });

    it('Mục 4, mở rộng realtime — mọi thay đổi Lead đều kèm phát tín hiệu dashboard.invalidate (broadcastAll, không kèm dữ liệu)', () => {
      service.emitCandidateChange('updated', baseCandidate, actor);

      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        { broadcastAll: true },
        expect.objectContaining({
          module: 'dashboard',
          action: 'invalidate',
          entity_id: null,
        }),
      );
    });
  });

  describe('emitNoteChange', () => {
    const note: NoteResponseDto = {
      id: 'note-1',
      lead_id: 'lead-1',
      created_by: {
        id: 'sale-1',
        name: 'Sale A',
        role: 'sale',
        avatar_url: null,
      },
      content: 'Đã gọi, hẹn lại chiều mai',
      call_status: null,
      call_result: null,
      zalo_friend_status: null,
      created_at: '2026-07-16T00:00:00.000Z',
      is_deleted: false,
    };

    it('note_created kèm candidate -> updated_at lấy từ candidate (last_activity_at vừa đổi)', () => {
      service.emitNoteChange(
        'note_created',
        note,
        { assignedTeamId: 'team-1' },
        actor,
        baseCandidate,
      );

      expect(gateway.broadcastLeadEvent).toHaveBeenCalledWith(
        { assignedTeamId: 'team-1' },
        {
          lead_id: 'lead-1',
          change_type: 'note_created',
          note,
          candidate: baseCandidate,
          updated_at: baseCandidate.updated_at,
          actor: { id: 'admin-1', role: 'admin' },
        },
      );
    });

    it('note_updated KHÔNG kèm candidate -> updated_at lấy từ note.created_at', () => {
      service.emitNoteChange(
        'note_updated',
        note,
        { assignedTeamId: 'team-1' },
        actor,
      );

      expect(gateway.broadcastLeadEvent).toHaveBeenCalledWith(
        { assignedTeamId: 'team-1' },
        expect.objectContaining({
          change_type: 'note_updated',
          candidate: undefined,
          updated_at: note.created_at,
        }),
      );
    });
  });

  describe('emitLeadDeleted', () => {
    it('phát change_type=deleted, không kèm candidate/note', () => {
      service.emitLeadDeleted(
        'lead-1',
        { assignedTeamId: 'team-1', assignedToId: 'sale-1' },
        actor,
      );

      expect(gateway.broadcastLeadEvent).toHaveBeenCalledWith(
        { assignedTeamId: 'team-1', assignedToId: 'sale-1' },
        expect.objectContaining({
          lead_id: 'lead-1',
          change_type: 'deleted',
        }),
      );
      const [, payload] = gateway.broadcastLeadEvent.mock.calls[0];
      expect(payload.candidate).toBeUndefined();
      expect(payload.note).toBeUndefined();
      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        { broadcastAll: true },
        expect.objectContaining({ module: 'dashboard', action: 'invalidate' }),
      );
    });
  });

  describe('Mở rộng realtime (2026-07-16) — Đưa đón/Báo cáo/Check phạt/Thông báo/Dashboard', () => {
    it('emitTransportationChange -> phát app:event broadcastAll + kèm dashboard.invalidate', () => {
      service.emitTransportationChange('created', { id: 'ship-1' }, actor);

      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        { broadcastAll: true },
        expect.objectContaining({
          module: 'transportation',
          action: 'created',
          entity_id: 'ship-1',
        }),
      );
      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        { broadcastAll: true },
        expect.objectContaining({ module: 'dashboard', action: 'invalidate' }),
      );
    });

    it('emitTransportationDeleted -> phát app:event broadcastAll + kèm dashboard.invalidate', () => {
      service.emitTransportationDeleted('ship-1', actor);

      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        { broadcastAll: true },
        expect.objectContaining({
          module: 'transportation',
          action: 'deleted',
          entity_id: 'ship-1',
        }),
      );
    });

    it('emitDailyReportChange -> đúng targets (accountId + leaderOfTeamId + adminManagerOnly), KHÔNG kèm dashboard.invalidate (Dashboard không đọc dữ liệu báo cáo)', () => {
      gateway.broadcastAppEvent.mockClear();
      service.emitDailyReportChange(
        'created',
        {
          report_id: 'report-1',
          account: { id: 'sale-1' },
          team: { id: 'team-1' },
        },
        actor,
      );

      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        {
          accountId: 'sale-1',
          leaderOfTeamId: 'team-1',
          adminManagerOnly: true,
        },
        expect.objectContaining({
          module: 'daily-report',
          action: 'created',
          entity_id: 'report-1',
        }),
      );
      expect(gateway.broadcastAppEvent).toHaveBeenCalledTimes(1);
    });

    it('emitPenaltyChange -> đúng targets (accountId + leaderOfTeamId + adminManagerOnly)', () => {
      gateway.broadcastAppEvent.mockClear();
      service.emitPenaltyChange(
        'updated',
        { id: 'violation-1', account_id: 'sale-1', team_id: 'team-1' },
        actor,
      );

      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        {
          accountId: 'sale-1',
          leaderOfTeamId: 'team-1',
          adminManagerOnly: true,
        },
        expect.objectContaining({
          module: 'penalty',
          action: 'updated',
          entity_id: 'violation-1',
        }),
      );
      expect(gateway.broadcastAppEvent).toHaveBeenCalledTimes(1);
    });

    it('emitNotificationCreated -> chỉ phát tới đúng 1 accountId, KHÔNG kèm dashboard.invalidate', () => {
      gateway.broadcastAppEvent.mockClear();
      service.emitNotificationCreated(
        { id: 'notif-1', account_id: 'sale-1' },
        actor,
      );

      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        { accountId: 'sale-1' },
        expect.objectContaining({
          module: 'notification',
          action: 'created',
          entity_id: 'notif-1',
        }),
      );
      expect(gateway.broadcastAppEvent).toHaveBeenCalledTimes(1);
    });

    it('emitDashboardInvalidate -> broadcastAll, entity_id=null, không kèm payload', () => {
      gateway.broadcastAppEvent.mockClear();
      service.emitDashboardInvalidate(null);

      expect(gateway.broadcastAppEvent).toHaveBeenCalledWith(
        { broadcastAll: true },
        expect.objectContaining({
          module: 'dashboard',
          action: 'invalidate',
          entity_id: null,
          actor: null,
        }),
      );
    });
  });
});
