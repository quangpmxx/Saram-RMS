import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LeadPipelineService } from './lead-pipeline.service';
import { CandidatesService } from './candidates.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NOTE_INCLUDE } from './dto/note-response.dto';

describe('LeadPipelineService', () => {
  let service: LeadPipelineService;
  let prisma: {
    lead: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    leadNote: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    statusCatalog: { findUnique: jest.Mock };
    account: { findUnique: jest.Mock };
  };
  let auditLog: { log: jest.Mock };
  let candidatesService: { findOne: jest.Mock };
  let realtimeService: {
    emitCandidateChange: jest.Mock;
    emitNoteChange: jest.Mock;
    emitLeadDeleted: jest.Mock;
  };

  const baseLead = {
    id: 'lead-1',
    deletedAt: null,
    assignedToId: 'sale-1',
    assignedTeamId: 'team-1',
    callStatusId: null,
    callResultId: null,
    lastActivityAt: null,
  };

  /**
   * Shape đầy đủ cho toCandidateResponse() — dùng làm giá trị trả về mặc
   * định của prisma.lead.findUniqueOrThrow ở MỌI test, vì các hàm mới
   * (reloadCandidate/reloadCandidateSilently) đều gọi hàm này để phát
   * realtime sau khi ghi DB thành công.
   */
  const fullCandidateLead = {
    ...baseLead,
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0900000001',
    birthYear: null,
    address: null,
    sourceId: 'source-1',
    mktNote: null,
    dataQualityScore: null,
    uploadedById: 'mkt-1',
    uploadedAt: new Date('2026-01-01'),
    assignedAt: new Date('2026-01-01'),
    assignmentMethod: 'manual',
    zaloStatusId: null,
    zaloFriendStatusId: null,
    noteColor: null,
    currentInterviewStatusId: null,
    currentEmploymentStatusId: null,
    currentPartnerCompanyName: null,
    isHeld: false,
    heldById: null,
    heldAt: null,
    enteredCarePoolAt: null,
    carePoolLockedById: null,
    isDuplicateFlagged: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    source: { id: 'source-1', name: 'Facebook' },
    uploadedBy: {
      id: 'mkt-1',
      fullName: 'MKT A',
      role: 'mkt',
      avatarUrl: null,
    },
    assignedTo: {
      id: 'sale-1',
      fullName: 'Sale A',
      role: 'sale',
      avatarUrl: null,
    },
    heldBy: null,
    carePoolLockedBy: null,
    callStatus: null,
    callResult: null,
    zaloStatus: null,
    zaloFriendStatus: null,
    currentInterviewStatus: null,
    currentEmploymentStatus: null,
  };

  const saleUser = { id: 'sale-1', role: 'sale' as const, sessionId: 's' };
  const otherSaleUser = { id: 'sale-2', role: 'sale' as const, sessionId: 's' };
  const leaderUser = {
    id: 'leader-1',
    role: 'leader' as const,
    sessionId: 's',
  };
  const adminUser = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };
  const managerUser = {
    id: 'manager-1',
    role: 'manager' as const,
    sessionId: 's',
  };
  const mktUser = { id: 'mkt-1', role: 'mkt' as const, sessionId: 's' };

  beforeEach(async () => {
    prisma = {
      lead: {
        findUnique: jest.fn(),
        // Mặc định trả về 1 lead đầy đủ hợp lệ cho toCandidateResponse() —
        // reloadCandidate()/reloadCandidateSilently() (dùng để phát realtime
        // sau khi ghi DB) gọi hàm này ở MỌI API trong file, kể cả những API
        // trước đây chưa từng gọi tới (createNote/deleteNote...). Test nào
        // cần shape khác tự ghi đè bằng mockResolvedValue() của riêng nó.
        findUniqueOrThrow: jest.fn().mockResolvedValue(fullCandidateLead),
        update: jest.fn(),
      },
      leadNote: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      statusCatalog: { findUnique: jest.fn() },
      account: { findUnique: jest.fn() },
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    candidatesService = { findOne: jest.fn().mockResolvedValue({}) };
    realtimeService = {
      emitCandidateChange: jest.fn(),
      emitNoteChange: jest.fn(),
      emitLeadDeleted: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadPipelineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: CandidatesService, useValue: candidatesService },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    service = moduleRef.get(LeadPipelineService);
  });

  describe('updateCallStatus', () => {
    it('ném NotFoundException nếu ứng viên không tồn tại/đã xóa mềm', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(
        service.updateCallStatus('ghost', { call_status_id: 'x' }, saleUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Sale không được cập nhật lead không phải của mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      await expect(
        service.updateCallStatus(
          'lead-1',
          { call_status_id: 'x' },
          otherSaleUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Dự án phụ — nâng cấp toàn diện: Sale khác cùng nhóm KHÔNG được xử lý lead chưa ai đụng tới (lastActivityAt=null)', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead); // lastActivityAt: null
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      await expect(
        service.updateCallStatus(
          'lead-1',
          { call_status_id: 'x' },
          otherSaleUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Dự án phụ — nâng cấp toàn diện: Sale khác cùng nhóm xử lý được lead đã có ít nhất 1 lần hoạt động (lastActivityAt khác null)', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        lastActivityAt: new Date('2026-01-02'),
      });
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.statusCatalog.findUnique.mockResolvedValue({
        id: 'status-1',
        category: 'call_status',
      });
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        callStatusId: 'status-1',
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await expect(
        service.updateCallStatus(
          'lead-1',
          { call_status_id: 'status-1' },
          otherSaleUser,
        ),
      ).resolves.toBeDefined();
    });

    it('Dự án phụ — nâng cấp toàn diện: Sale khác NHÓM KHÁC vẫn bị từ chối dù lead đã có hoạt động', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        lastActivityAt: new Date('2026-01-02'),
      });
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-2' });
      await expect(
        service.updateCallStatus(
          'lead-1',
          { call_status_id: 'x' },
          otherSaleUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('MKT không có quyền cập nhật tình trạng cuộc gọi', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      await expect(
        service.updateCallStatus('lead-1', { call_status_id: 'x' }, mktUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('từ chối nếu call_status_id không thuộc category call_status', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.statusCatalog.findUnique.mockResolvedValue({
        id: 'status-1',
        category: 'call_result',
      });
      await expect(
        service.updateCallStatus(
          'lead-1',
          { call_status_id: 'status-1' },
          saleUser,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('Sale cập nhật thành công cho lead của mình, ghi last_activity_at + audit log', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.statusCatalog.findUnique.mockResolvedValue({
        id: 'status-1',
        category: 'call_status',
      });
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        callStatusId: 'status-1',
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await service.updateCallStatus(
        'lead-1',
        { call_status_id: 'status-1' },
        saleUser,
      );

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { callStatusId: 'status-1', lastActivityAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          fieldChanged: 'call_status_id',
        }),
      );
    });

    it('Leader cập nhật được lead trong nhóm mình, không được lead ngoài nhóm', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.statusCatalog.findUnique.mockResolvedValue({
        id: 'status-1',
        category: 'call_status',
      });
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await expect(
        service.updateCallStatus(
          'lead-1',
          { call_status_id: 'status-1' },
          leaderUser,
        ),
      ).resolves.toBeDefined();

      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-2' });
      await expect(
        service.updateCallStatus(
          'lead-1',
          { call_status_id: 'status-1' },
          leaderUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('updateZaloStatus', () => {
    it('ném NotFoundException nếu ứng viên không tồn tại/đã xóa mềm', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(
        service.updateZaloStatus('ghost', { zalo_status_id: 'x' }, saleUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('từ chối nếu zalo_status_id không thuộc category zalo_status', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.statusCatalog.findUnique.mockResolvedValue({
        id: 'status-1',
        category: 'call_result',
      });
      await expect(
        service.updateZaloStatus(
          'lead-1',
          { zalo_status_id: 'status-1' },
          saleUser,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('Sale cập nhật thành công cho lead của mình, ghi last_activity_at + audit log', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.statusCatalog.findUnique.mockResolvedValue({
        id: 'status-1',
        category: 'zalo_status',
      });
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        zaloStatusId: 'status-1',
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await service.updateZaloStatus(
        'lead-1',
        { zalo_status_id: 'status-1' },
        saleUser,
      );

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { zaloStatusId: 'status-1', lastActivityAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          fieldChanged: 'zalo_status_id',
        }),
      );
    });

    it('Dự án phụ — nâng cấp toàn diện: cho phép gửi zalo_status_id=null để bỏ chọn, KHÔNG kiểm tra assertStatusInCategory', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        zaloStatusId: 'status-1',
      });
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        zaloStatusId: null,
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await service.updateZaloStatus(
        'lead-1',
        { zalo_status_id: null },
        saleUser,
      );

      expect(prisma.statusCatalog.findUnique).not.toHaveBeenCalled();
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { zaloStatusId: null, lastActivityAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          fieldChanged: 'zalo_status_id',
          oldValue: 'status-1',
          newValue: undefined,
        }),
      );
    });
  });

  describe('updateZaloFriendStatus', () => {
    it('ném NotFoundException nếu ứng viên không tồn tại/đã xóa mềm', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(
        service.updateZaloFriendStatus(
          'ghost',
          { zalo_friend_status_id: 'x' },
          saleUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('từ chối nếu zalo_friend_status_id không thuộc category zalo_friend_status', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.statusCatalog.findUnique.mockResolvedValue({
        id: 'status-1',
        category: 'zalo_status',
      });
      await expect(
        service.updateZaloFriendStatus(
          'lead-1',
          { zalo_friend_status_id: 'status-1' },
          saleUser,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('Sale cập nhật thành công cho lead của mình, ghi last_activity_at + audit log', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.statusCatalog.findUnique.mockResolvedValue({
        id: 'status-1',
        category: 'zalo_friend_status',
      });
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        zaloFriendStatusId: 'status-1',
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await service.updateZaloFriendStatus(
        'lead-1',
        { zalo_friend_status_id: 'status-1' },
        saleUser,
      );

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          zaloFriendStatusId: 'status-1',
          lastActivityAt: expect.any(Date),
        },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          fieldChanged: 'zalo_friend_status_id',
        }),
      );
    });

    it('cho phép gửi zalo_friend_status_id=null để bỏ chọn, KHÔNG kiểm tra assertStatusInCategory', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        zaloFriendStatusId: 'status-1',
      });
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        zaloFriendStatusId: null,
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await service.updateZaloFriendStatus(
        'lead-1',
        { zalo_friend_status_id: null },
        saleUser,
      );

      expect(prisma.statusCatalog.findUnique).not.toHaveBeenCalled();
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { zaloFriendStatusId: null, lastActivityAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          fieldChanged: 'zalo_friend_status_id',
          oldValue: 'status-1',
          newValue: undefined,
        }),
      );
    });
  });

  describe('updateNoteColor', () => {
    it('ném NotFoundException nếu ứng viên không tồn tại/đã xóa mềm', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(
        service.updateNoteColor('ghost', { note_color: 'red' }, saleUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Sale cập nhật thành công cho lead của mình, ghi last_activity_at + audit log', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        noteColor: 'red',
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await service.updateNoteColor('lead-1', { note_color: 'red' }, saleUser);

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { noteColor: 'red', lastActivityAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          fieldChanged: 'note_color',
        }),
      );
    });

    it('cho phép gửi note_color=null để bỏ chọn màu', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        noteColor: 'red',
      });
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        noteColor: null,
        source: { id: 's', name: 'Facebook' },
        uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
        uploadedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });

      await service.updateNoteColor('lead-1', { note_color: null }, saleUser);

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { noteColor: null, lastActivityAt: expect.any(Date) },
      });
    });
  });

  describe('createNote', () => {
    it('tạo 3 ghi chú liên tiếp không ghi đè nhau (mỗi lần gọi create riêng)', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.leadNote.create
        .mockResolvedValueOnce({
          id: 'note-1',
          createdBy: { id: 's', fullName: 'Sale A' },
          createdAt: new Date('2026-01-01T10:00:00'),
        })
        .mockResolvedValueOnce({
          id: 'note-2',
          createdBy: { id: 's', fullName: 'Sale A' },
          createdAt: new Date('2026-01-01T10:01:00'),
        })
        .mockResolvedValueOnce({
          id: 'note-3',
          createdBy: { id: 's', fullName: 'Sale A' },
          createdAt: new Date('2026-01-01T10:02:00'),
        });
      prisma.lead.update.mockResolvedValue(baseLead);

      const n1 = await service.createNote(
        'lead-1',
        { content: 'Note 1' },
        saleUser,
      );
      const n2 = await service.createNote(
        'lead-1',
        { content: 'Note 2' },
        saleUser,
      );
      const n3 = await service.createNote(
        'lead-1',
        { content: 'Note 3' },
        saleUser,
      );

      expect(prisma.leadNote.create).toHaveBeenCalledTimes(3);
      expect([n1.id, n2.id, n3.id]).toEqual(['note-1', 'note-2', 'note-3']);
    });

    it('snapshot call_status_id/call_result_id hiện tại của lead vào note', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        callStatusId: 'status-called',
        callResultId: 'result-potential',
      });
      prisma.leadNote.create.mockResolvedValue({
        id: 'note-1',
        createdBy: { id: 's', fullName: 'Sale A' },
        createdAt: new Date('2026-01-01'),
      });
      prisma.lead.update.mockResolvedValue(baseLead);

      await service.createNote('lead-1', { content: 'Gọi lần 1' }, saleUser);

      expect(prisma.leadNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            callStatusId: 'status-called',
            callResultId: 'result-potential',
          }),
        }),
      );
    });

    it('snapshot zalo_friend_status_id hiện tại của lead vào note', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        zaloFriendStatusId: 'zalo-friend-1',
      });
      prisma.leadNote.create.mockResolvedValue({
        id: 'note-1',
        createdBy: { id: 's', fullName: 'Sale A' },
        createdAt: new Date('2026-01-01'),
      });
      prisma.lead.update.mockResolvedValue(baseLead);

      await service.createNote('lead-1', { content: 'Gọi lần 1' }, saleUser);

      expect(prisma.leadNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            zaloFriendStatusId: 'zalo-friend-1',
          }),
        }),
      );
    });

    it('MKT không có quyền thêm ghi chú', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      await expect(
        service.createNote('lead-1', { content: 'X' }, mktUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('listNotes', () => {
    it('tái dùng CandidatesService.findOne để kiểm tra phạm vi xem (MKT xem được)', async () => {
      prisma.leadNote.findMany.mockResolvedValue([]);

      await service.listNotes('lead-1', {}, mktUser);

      expect(candidatesService.findOne).toHaveBeenCalledWith('lead-1', mktUser);
    });

    it('ném lỗi nếu CandidatesService.findOne từ chối (ngoài phạm vi xem)', async () => {
      candidatesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(
        service.listNotes('lead-1', {}, otherSaleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.leadNote.findMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteNote', () => {
    const note = {
      id: 'note-1',
      leadId: 'lead-1',
      createdById: 'sale-1',
      isDeleted: false,
    };

    it('ném NotFoundException nếu note không tồn tại/không thuộc lead/đã xóa', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(null);
      await expect(
        service.deleteNote('lead-1', 'ghost', saleUser),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.leadNote.findUnique.mockResolvedValue({
        ...note,
        isDeleted: true,
      });
      await expect(
        service.deleteNote('lead-1', 'note-1', saleUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Sale khác (không phải tác giả)/Leader/MKT đều bị chặn xóa note', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(note);

      await expect(
        service.deleteNote('lead-1', 'note-1', otherSaleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.deleteNote('lead-1', 'note-1', leaderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.deleteNote('lead-1', 'note-1', mktUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Admin/Quản lý kế thừa quyền của Sale — xóa được ghi chú bất kỳ, không giới hạn "của chính mình"', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(note);
      prisma.leadNote.update.mockResolvedValue({ ...note, isDeleted: true });

      await service.deleteNote('lead-1', 'note-1', adminUser);
      expect(prisma.leadNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          isDeleted: true,
          deletedById: 'admin-1',
          deletedAt: expect.any(Date),
        },
        include: NOTE_INCLUDE,
      });

      await service.deleteNote('lead-1', 'note-1', managerUser);
      expect(prisma.leadNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          isDeleted: true,
          deletedById: 'manager-1',
          deletedAt: expect.any(Date),
        },
        include: NOTE_INCLUDE,
      });
    });

    it('Sale xóa note của chính mình → xóa mềm, giữ lại trong lịch sử', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(note);
      prisma.leadNote.update.mockResolvedValue({ ...note, isDeleted: true });

      await service.deleteNote('lead-1', 'note-1', saleUser);

      expect(prisma.leadNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          isDeleted: true,
          deletedById: 'sale-1',
          deletedAt: expect.any(Date),
        },
        include: NOTE_INCLUDE,
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'delete',
          entityType: 'lead_note',
        }),
      );
    });
  });

  describe('updateNote', () => {
    const note = {
      id: 'note-1',
      leadId: 'lead-1',
      createdById: 'sale-1',
      content: 'Nội dung cũ',
      isDeleted: false,
      createdAt: new Date('2026-07-10T10:00:00.000Z'),
    };

    it('ném NotFoundException nếu note không tồn tại/không thuộc lead/đã xóa', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(null);
      await expect(
        service.updateNote('lead-1', 'ghost', { content: 'X' }, saleUser),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.leadNote.findUnique.mockResolvedValue({
        ...note,
        isDeleted: true,
      });
      await expect(
        service.updateNote('lead-1', 'note-1', { content: 'X' }, saleUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Sale chỉ sửa được ghi chú do chính mình ghi', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(note);
      await expect(
        service.updateNote('lead-1', 'note-1', { content: 'X' }, otherSaleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.leadNote.update.mockResolvedValue({
        ...note,
        content: 'X',
        createdBy: { id: 'sale-1', fullName: 'Sale 1' },
      });
      await service.updateNote('lead-1', 'note-1', { content: 'X' }, saleUser);
      expect(prisma.leadNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { content: 'X' },
        include: expect.anything(),
      });
    });

    it('MKT không có quyền sửa ghi chú', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(note);
      await expect(
        service.updateNote('lead-1', 'note-1', { content: 'X' }, mktUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Leader chỉ sửa được ghi chú của lead trong nhóm mình', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(note);
      prisma.lead.findUnique.mockResolvedValue(baseLead); // assignedTeamId: 'team-1'
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-2' });

      await expect(
        service.updateNote('lead-1', 'note-1', { content: 'X' }, leaderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.leadNote.update.mockResolvedValue({
        ...note,
        content: 'X',
        createdBy: { id: 'sale-1', fullName: 'Sale 1' },
      });
      await service.updateNote(
        'lead-1',
        'note-1',
        { content: 'X' },
        leaderUser,
      );
      expect(prisma.leadNote.update).toHaveBeenCalled();
    });

    it('Admin/Quản lý sửa được ghi chú bất kỳ, ghi đúng audit log (nội dung cũ/mới)', async () => {
      prisma.leadNote.findUnique.mockResolvedValue(note);
      prisma.leadNote.update.mockResolvedValue({
        ...note,
        content: 'Nội dung mới',
        createdBy: { id: 'sale-1', fullName: 'Sale 1' },
      });

      await service.updateNote(
        'lead-1',
        'note-1',
        { content: 'Nội dung mới' },
        adminUser,
      );

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'admin-1',
          actionType: 'update',
          entityType: 'lead_note',
          entityId: 'note-1',
          fieldChanged: 'content',
          oldValue: 'Nội dung cũ',
          newValue: 'Nội dung mới',
        }),
      );

      prisma.leadNote.findUnique.mockResolvedValue(note);
      await service.updateNote(
        'lead-1',
        'note-1',
        { content: 'Nội dung mới 2' },
        managerUser,
      );
      expect(prisma.leadNote.update).toHaveBeenCalled();
    });
  });
});
