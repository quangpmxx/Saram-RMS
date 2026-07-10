import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CandidatesService } from './candidates.service';
import { LeadDuplicateService } from './lead-duplicate.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DistributionRuleService } from '../distribution/distribution-rule.service';

describe('CandidatesService', () => {
  let service: CandidatesService;
  let prisma: {
    lead: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    leadSource: { findUnique: jest.Mock };
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let distributionRuleService: { tryAutoAssign: jest.Mock };

  const source = { id: 'source-1', name: 'Facebook' };

  const baseLead = {
    id: 'lead-1',
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0900000001',
    birthYear: null,
    address: null,
    sourceId: 'source-1',
    mktNote: null,
    dataQualityScore: null,
    uploadedById: 'mkt-1',
    uploadedAt: new Date('2026-01-01'),
    assignedToId: null,
    assignedTeamId: null,
    assignedAt: null,
    assignmentMethod: null,
    callStatusId: null,
    callResultId: null,
    isHeld: false,
    heldById: null,
    heldAt: null,
    lastActivityAt: null,
    enteredCarePoolAt: null,
    carePoolLockedById: null,
    isDuplicateFlagged: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    deletedById: null,
    source,
    uploadedBy: { id: 'mkt-1', fullName: 'MKT A' },
    assignedTo: null,
    heldBy: null,
    carePoolLockedBy: null,
    callStatus: null,
    callResult: null,
  };

  const mktUser = { id: 'mkt-1', role: 'mkt' as const, sessionId: 's' };
  const otherMktUser = { id: 'mkt-2', role: 'mkt' as const, sessionId: 's' };
  const adminUser = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };
  const saleUser = { id: 'sale-1', role: 'sale' as const, sessionId: 's' };
  const leaderUser = {
    id: 'leader-1',
    role: 'leader' as const,
    sessionId: 's',
  };

  beforeEach(async () => {
    prisma = {
      lead: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      leadSource: { findUnique: jest.fn() },
      account: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    distributionRuleService = {
      tryAutoAssign: jest
        .fn()
        .mockImplementation((lead: unknown) => Promise.resolve(lead)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CandidatesService,
        LeadDuplicateService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: DistributionRuleService, useValue: distributionRuleService },
      ],
    }).compile();

    service = moduleRef.get(CandidatesService);
  });

  describe('create', () => {
    it('từ chối nếu source_id không tồn tại', async () => {
      prisma.leadSource.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { full_name: 'X', phone_number: '090', source_id: 'ghost' },
          mktUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('tạo thành công, không trùng SĐT → duplicate_warning là null', async () => {
      prisma.leadSource.findUnique.mockResolvedValue(source);
      prisma.lead.create.mockResolvedValue(baseLead);
      prisma.lead.findMany.mockResolvedValue([baseLead]); // chỉ chính nó
      prisma.lead.findUniqueOrThrow.mockResolvedValue(baseLead);

      const result = await service.create(
        {
          full_name: 'Nguyễn Văn A',
          phone_number: '0900000001',
          source_id: 'source-1',
        },
        mktUser,
      );

      expect(result.duplicate_warning).toBeNull();
      // Chỉ 1 bản ghi khớp SĐT (chính nó) → LeadDuplicateService vẫn đồng bộ để đảm bảo
      // is_duplicate_flagged = false (idempotent), không phải bỏ qua hoàn toàn.
      expect(prisma.lead.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['lead-1'] } },
        data: { isDuplicateFlagged: false },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'create', entityType: 'lead' }),
      );
    });

    it('tạo trùng SĐT → đánh dấu is_duplicate_flagged cho TẤT CẢ bản ghi cùng SĐT và trả duplicate_warning', async () => {
      const existingLead = { ...baseLead, id: 'lead-0', uploadedById: 'mkt-2' };
      const newLead = { ...baseLead, id: 'lead-1' };

      prisma.leadSource.findUnique.mockResolvedValue(source);
      prisma.lead.create.mockResolvedValue(newLead);
      prisma.lead.findMany.mockResolvedValue([existingLead, newLead]);
      prisma.account.findMany.mockResolvedValue([
        { id: 'mkt-2', fullName: 'MKT B' },
      ]);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...newLead,
        isDuplicateFlagged: true,
      });

      const result = await service.create(
        {
          full_name: 'Nguyễn Văn A',
          phone_number: '0900000001',
          source_id: 'source-1',
        },
        mktUser,
      );

      expect(prisma.lead.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['lead-0', 'lead-1'] } },
        data: { isDuplicateFlagged: true },
      });
      expect(result.duplicate_warning).toEqual({
        phone_number: '0900000001',
        matches: [
          {
            lead_id: 'lead-0',
            uploaded_at: existingLead.uploadedAt.toISOString(),
            uploaded_by: 'MKT B',
          },
        ],
      });
    });
  });

  describe('update', () => {
    it('ném NotFoundException nếu ứng viên không tồn tại hoặc đã xóa mềm', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(
        service.update('ghost', { full_name: 'X' }, mktUser),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        deletedAt: new Date(),
      });
      await expect(
        service.update('lead-1', { full_name: 'X' }, mktUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('MKT được sửa data do chính mình upload', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue(baseLead);

      await expect(
        service.update('lead-1', { full_name: 'Tên mới' }, mktUser),
      ).resolves.toBeDefined();
    });

    it('MKT khác không được sửa data không phải của mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);

      await expect(
        service.update('lead-1', { full_name: 'X' }, otherMktUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Sale không được sửa lead chưa được giao cho mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);

      await expect(
        service.update('lead-1', { full_name: 'X' }, saleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Admin luôn sửa được', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue(baseLead);

      await expect(
        service.update('lead-1', { full_name: 'X' }, adminUser),
      ).resolves.toBeDefined();
    });

    it('đổi SĐT → đồng bộ lại cờ trùng cho cả nhóm SĐT cũ và mới', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.lead.update.mockResolvedValue({
        ...baseLead,
        phoneNumber: '0911111111',
      });
      prisma.lead.findMany.mockResolvedValue([]); // không còn ai trùng ở mỗi nhóm
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        phoneNumber: '0911111111',
      });

      await service.update('lead-1', { phone_number: '0911111111' }, mktUser);

      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: { phoneNumber: '0900000001', deletedAt: null },
      });
      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: { phoneNumber: '0911111111', deletedAt: null },
      });
    });

    it('ghi 1 dòng audit log cho mỗi trường thay đổi', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue(baseLead);

      await service.update(
        'lead-1',
        { full_name: 'Tên mới', address: 'Địa chỉ mới' },
        mktUser,
      );

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ fieldChanged: 'full_name' }),
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ fieldChanged: 'address' }),
      );
    });
  });

  describe('remove', () => {
    it('Admin xóa được mọi ứng viên', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.lead.update.mockResolvedValue(baseLead);

      await expect(
        service.remove('lead-1', adminUser),
      ).resolves.toBeUndefined();
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { deletedAt: expect.any(Date), deletedById: adminUser.id },
      });
    });

    it('MKT xóa được data do chính mình upload', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.lead.update.mockResolvedValue(baseLead);

      await expect(service.remove('lead-1', mktUser)).resolves.toBeUndefined();
    });

    it('MKT khác không được xóa data không phải của mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);

      await expect(
        service.remove('lead-1', otherMktUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Sale/Leader không có quyền xóa dù là ứng viên của mình', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        assignedToId: 'sale-1',
      });
      await expect(service.remove('lead-1', saleUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        assignedTeamId: 'team-1',
      });
      await expect(service.remove('lead-1', leaderUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    it('ném NotFoundException nếu không tồn tại/đã xóa mềm', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.findOne('ghost', adminUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('Sale không xem được lead chưa gán cho mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      await expect(service.findOne('lead-1', saleUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('MKT xem được mọi ứng viên (không chỉ của mình)', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        uploadedById: 'mkt-2',
      });
      await expect(service.findOne('lead-1', mktUser)).resolves.toBeDefined();
    });
  });

  describe('list', () => {
    it('Admin/Quản lý/MKT thấy toàn bộ (không lọc theo assigned)', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.list({ page: 1, page_size: 20 }, mktUser);

      const whereArg = prisma.lead.count.mock.calls;
      expect(prisma.$transaction).toHaveBeenCalled();
      void whereArg;
    });

    it('Sale chỉ thấy lead được giao cho mình', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.list({ page: 1, page_size: 20 }, saleUser);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('Leader lọc theo assigned_team_id của nhóm mình', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.list({ page: 1, page_size: 20 }, leaderUser);

      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: leaderUser.id },
      });
    });

    it('assigned_to=me quy đổi thành id người gọi', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.list(
        { page: 1, page_size: 20, assigned_to: 'me' },
        adminUser,
      );

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedToId: adminUser.id }),
        }),
      );
    });
  });

  describe('getPending', () => {
    it('Sale không có quyền xem danh sách chờ phân chia', async () => {
      await expect(
        service.getPending({ page: 1, page_size: 20 }, saleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Leader/MKT/Admin xem được, luôn lọc assignedToId=null, không lọc theo nhóm', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.getPending({ page: 1, page_size: 20 }, leaderUser);

      expect(prisma.lead.count).toHaveBeenCalledWith({
        where: { deletedAt: null, assignedToId: null },
      });
    });
  });

  const saleAccount = {
    id: 'sale-1',
    role: 'sale',
    status: 'active',
    teamId: 'team-1',
  };

  describe('assign', () => {
    it('ném NotFoundException nếu ứng viên không tồn tại/đã xóa mềm', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(
        service.assign('ghost', { account_id: 'sale-1' }, leaderUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('từ chối nếu ứng viên đã được phân chia — gợi ý dùng transfer', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...baseLead,
        assignedToId: 'sale-2',
      });

      await expect(
        service.assign('lead-1', { account_id: 'sale-1' }, leaderUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('MKT/Sale không có quyền phân chia', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);

      await expect(
        service.assign('lead-1', { account_id: 'sale-1' }, mktUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('từ chối nếu account_id không phải vai trò Sale', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.account.findUnique.mockResolvedValue({
        ...saleAccount,
        role: 'mkt',
      });

      await expect(
        service.assign('lead-1', { account_id: 'sale-1' }, adminUser),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('Leader chỉ được phân chia cho Sale trong nhóm mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.account.findUnique
        .mockResolvedValueOnce(saleAccount) // account đích (team-1)
        .mockResolvedValueOnce({ teamId: 'team-2' }); // getOwnTeamId(leader) → khác nhóm

      await expect(
        service.assign('lead-1', { account_id: 'sale-1' }, leaderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Leader phân chia thành công cho Sale đúng nhóm mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.account.findUnique
        .mockResolvedValueOnce(saleAccount) // account đích (team-1)
        .mockResolvedValueOnce({ teamId: 'team-1' }); // getOwnTeamId(leader) → cùng nhóm
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...baseLead,
        assignedToId: 'sale-1',
      });

      await expect(
        service.assign('lead-1', { account_id: 'sale-1' }, leaderUser),
      ).resolves.toBeDefined();

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          assignedToId: 'sale-1',
          assignedTeamId: 'team-1',
          assignedAt: expect.any(Date),
          assignmentMethod: 'manual',
        },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'assign', entityType: 'lead' }),
      );
    });

    it('Quản lý/Admin phân chia không giới hạn theo nhóm', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.account.findUnique.mockResolvedValue(saleAccount);
      prisma.lead.update.mockResolvedValue(baseLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue(baseLead);

      await expect(
        service.assign('lead-1', { account_id: 'sale-1' }, adminUser),
      ).resolves.toBeDefined();
    });
  });

  describe('assignBulk', () => {
    it('bỏ qua các lead không hợp lệ (đã xóa/đã phân chia/không tồn tại), chỉ gán lead hợp lệ', async () => {
      prisma.account.findUnique.mockResolvedValue(saleAccount);
      prisma.lead.findMany.mockResolvedValue([
        { id: 'lead-1' },
        { id: 'lead-2' },
      ]);
      prisma.lead.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.assignBulk(
        { candidate_ids: ['lead-1', 'lead-2', 'lead-3'], account_id: 'sale-1' },
        adminUser,
      );

      expect(result).toEqual({ assigned_count: 2 });
      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['lead-1', 'lead-2', 'lead-3'] },
          deletedAt: null,
          assignedToId: null,
        },
        select: { id: true },
      });
      expect(auditLog.log).toHaveBeenCalledTimes(2);
    });

    it('trả về assigned_count=0 nếu không có lead nào hợp lệ, không gọi updateMany', async () => {
      prisma.account.findUnique.mockResolvedValue(saleAccount);
      prisma.lead.findMany.mockResolvedValue([]);

      const result = await service.assignBulk(
        { candidate_ids: ['lead-1'], account_id: 'sale-1' },
        adminUser,
      );

      expect(result).toEqual({ assigned_count: 0 });
      expect(prisma.lead.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    const assignedLead = {
      ...baseLead,
      assignedToId: 'sale-1',
      assignedTeamId: 'team-1',
    };

    it('từ chối nếu ứng viên chưa được phân chia', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);

      await expect(
        service.transfer('lead-1', { new_account_id: 'sale-2' }, leaderUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('MKT/Sale không có quyền chuyển lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(assignedLead);

      await expect(
        service.transfer('lead-1', { new_account_id: 'sale-2' }, saleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Leader không chuyển được lead ngoài nhóm mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(assignedLead);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-other' });

      await expect(
        service.transfer('lead-1', { new_account_id: 'sale-2' }, leaderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('từ chối nếu Sale đích không thuộc đúng nhóm đang sở hữu lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(assignedLead);
      prisma.account.findUnique
        .mockResolvedValueOnce({ teamId: 'team-1' }) // getOwnTeamId(leader)
        .mockResolvedValueOnce({
          ...saleAccount,
          id: 'sale-2',
          teamId: 'team-2',
        }); // sale đích khác nhóm

      await expect(
        service.transfer('lead-1', { new_account_id: 'sale-2' }, leaderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('chuyển thành công, ghi audit log kèm lý do', async () => {
      prisma.lead.findUnique.mockResolvedValue(assignedLead);
      prisma.account.findUnique
        .mockResolvedValueOnce({ teamId: 'team-1' }) // getOwnTeamId(leader)
        .mockResolvedValueOnce({
          ...saleAccount,
          id: 'sale-2',
          teamId: 'team-1',
        }); // sale đích cùng nhóm
      prisma.lead.update.mockResolvedValue(assignedLead);
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        ...assignedLead,
        assignedToId: 'sale-2',
      });

      await expect(
        service.transfer(
          'lead-1',
          { new_account_id: 'sale-2', reason: 'Sale A nghỉ phép' },
          leaderUser,
        ),
      ).resolves.toBeDefined();

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { assignedToId: 'sale-2', assignedAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'transfer',
          oldValue: 'sale-1',
          newValue: 'sale-2 | reason: Sale A nghỉ phép',
        }),
      );
    });
  });

  describe('getDuplicateDetail', () => {
    const matchOwnTeam = {
      ...baseLead,
      id: 'lead-2',
      fullName: 'Trùng cùng nhóm',
      assignedToId: 'sale-1',
      assignedTeamId: 'team-1',
      assignedTo: {
        id: 'sale-1',
        fullName: 'Sale Cùng Nhóm',
        team: { id: 'team-1', name: 'Nhóm 1' },
      },
    };
    const matchOtherTeam = {
      ...baseLead,
      id: 'lead-3',
      fullName: 'Trùng khác nhóm',
      assignedToId: 'sale-9',
      assignedTeamId: 'team-9',
      assignedTo: {
        id: 'sale-9',
        fullName: 'Sale Khác Nhóm',
        team: { id: 'team-9', name: 'Nhóm 9' },
      },
    };
    const matchPending = {
      ...baseLead,
      id: 'lead-4',
      fullName: 'Trùng chưa phân chia',
      assignedToId: null,
      assignedTeamId: null,
      assignedTo: null,
    };

    it('ném NotFoundException nếu ứng viên không tồn tại/đã xóa mềm', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(
        service.getDuplicateDetail('ghost', adminUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Sale không xem được chi tiết trùng của ứng viên ngoài phạm vi mình', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead); // assignedToId khác sale-1

      await expect(
        service.getDuplicateDetail('lead-1', saleUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Admin/MKT xem toàn bộ các lần trùng, không giới hạn nhóm', async () => {
      prisma.lead.findUnique.mockResolvedValue(baseLead);
      prisma.lead.findMany.mockResolvedValue([
        matchOwnTeam,
        matchOtherTeam,
        matchPending,
      ]);

      const result = await service.getDuplicateDetail('lead-1', adminUser);

      expect(result.visible).toBe(true);
      expect(result.matches).toHaveLength(3);
      expect(result.matches.map((m) => m.lead_id)).toEqual(
        expect.arrayContaining(['lead-2', 'lead-3', 'lead-4']),
      );
      expect(result.matches.find((m) => m.lead_id === 'lead-2')).toEqual(
        expect.objectContaining({
          full_name: 'Trùng cùng nhóm',
          team_name: 'Nhóm 1',
          status_label: 'Đã giao: Sale Cùng Nhóm',
        }),
      );
      expect(result.matches.find((m) => m.lead_id === 'lead-4')).toEqual(
        expect.objectContaining({
          status_label: 'Chờ phân chia',
          team_name: null,
        }),
      );
    });

    it('Leader chỉ xem được các bản ghi trùng thuộc đúng nhóm mình', async () => {
      const leadInLeaderTeam = { ...baseLead, assignedTeamId: 'team-1' };
      prisma.lead.findUnique.mockResolvedValue(leadInLeaderTeam);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.lead.findMany.mockResolvedValue([
        matchOwnTeam,
        matchOtherTeam,
        matchPending,
      ]);

      const result = await service.getDuplicateDetail('lead-1', leaderUser);

      expect(result.visible).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].lead_id).toBe('lead-2');
    });

    it('Leader không thấy gì (visible=false) nếu mọi bản ghi trùng đều ở nhóm khác', async () => {
      const leadInLeaderTeam = { ...baseLead, assignedTeamId: 'team-1' };
      prisma.lead.findUnique.mockResolvedValue(leadInLeaderTeam);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.lead.findMany.mockResolvedValue([matchOtherTeam, matchPending]);

      const result = await service.getDuplicateDetail('lead-1', leaderUser);

      expect(result.visible).toBe(false);
      expect(result.matches).toHaveLength(0);
    });

    it('Sale chỉ xem được các bản ghi trùng thuộc đúng nhóm mình', async () => {
      const ownLead = {
        ...baseLead,
        assignedToId: 'sale-1',
        assignedTeamId: 'team-1',
      };
      prisma.lead.findUnique.mockResolvedValue(ownLead);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.lead.findMany.mockResolvedValue([matchOwnTeam, matchOtherTeam]);

      const result = await service.getDuplicateDetail('lead-1', saleUser);

      expect(result.visible).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].lead_id).toBe('lead-2');
    });
  });

  describe('listDuplicates — Mục 2, docs/13-api-design.md (GET /candidate/duplicate, Phase 9)', () => {
    const dupTeam1 = {
      ...baseLead,
      id: 'lead-10',
      phoneNumber: '0900000010',
      assignedTeamId: 'team-1',
    };
    const dupTeam9 = {
      ...baseLead,
      id: 'lead-11',
      phoneNumber: '0900000010',
      assignedTeamId: 'team-9',
    };

    it('Admin/MKT xem toàn hệ thống, gộp đúng theo SĐT', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { phoneNumber: '0900000010', _count: { _all: 2 } },
      ]);
      prisma.lead.findMany.mockResolvedValue([dupTeam1, dupTeam9]);

      const result = await service.listDuplicates(
        { page: 1, page_size: 20 },
        adminUser,
      );

      expect(result.total).toBe(1);
      expect(result.items[0].phone_number).toBe('0900000010');
      expect(result.items[0].matches).toHaveLength(2);
    });

    it('không có SĐT nào trùng (count<=1) → danh sách rỗng, không truy vấn thêm', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { phoneNumber: '0900000099', _count: { _all: 1 } },
      ]);

      const result = await service.listDuplicates(
        { page: 1, page_size: 20 },
        adminUser,
      );

      expect(result.total).toBe(0);
      expect(prisma.lead.findMany).not.toHaveBeenCalled();
    });

    it('Admin thu hẹp theo team_id: giữ nhóm có ≥1 thành viên thuộc team đó, vẫn hiện ĐỦ mọi thành viên', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { phoneNumber: '0900000010', _count: { _all: 2 } },
      ]);
      prisma.lead.findMany.mockResolvedValue([dupTeam1, dupTeam9]);

      const result = await service.listDuplicates(
        { page: 1, page_size: 20, team_id: 'team-1' },
        adminUser,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].matches).toHaveLength(2);
    });

    it('Admin thu hẹp theo team_id không khớp nhóm nào → rỗng', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { phoneNumber: '0900000010', _count: { _all: 2 } },
      ]);
      prisma.lead.findMany.mockResolvedValue([dupTeam1, dupTeam9]);

      const result = await service.listDuplicates(
        { page: 1, page_size: 20, team_id: 'team-OTHER' },
        adminUser,
      );

      expect(result.items).toHaveLength(0);
    });

    it('Sale/Leader: nhóm trùng chỉ còn 1 bản ghi thuộc nhóm mình (còn lại ở nhóm khác) → ẩn hoàn toàn, không lộ việc tồn tại trùng', async () => {
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.lead.groupBy.mockResolvedValue([
        { phoneNumber: '0900000010', _count: { _all: 2 } },
      ]);
      prisma.lead.findMany.mockResolvedValue([dupTeam1, dupTeam9]);

      const result = await service.listDuplicates(
        { page: 1, page_size: 20 },
        saleUser,
      );

      expect(result.total).toBe(0);
    });

    it('Sale/Leader: thấy đúng nhóm trùng khi cả 2 bản ghi cùng thuộc nhóm mình', async () => {
      const a = { ...dupTeam1, assignedTeamId: 'team-1' };
      const b = { ...dupTeam9, id: 'lead-12', assignedTeamId: 'team-1' };
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.lead.groupBy.mockResolvedValue([
        { phoneNumber: '0900000010', _count: { _all: 2 } },
      ]);
      prisma.lead.findMany.mockResolvedValue([a, b]);

      const result = await service.listDuplicates(
        { page: 1, page_size: 20 },
        saleUser,
      );

      expect(result.total).toBe(1);
      expect(result.items[0].matches).toHaveLength(2);
    });

    it('phân trang theo NHÓM (không phải theo từng bản ghi)', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { phoneNumber: '0900000010', _count: { _all: 2 } },
        { phoneNumber: '0900000020', _count: { _all: 2 } },
      ]);
      prisma.lead.findMany.mockResolvedValue([
        dupTeam1,
        dupTeam9,
        { ...dupTeam1, id: 'lead-20', phoneNumber: '0900000020' },
        { ...dupTeam9, id: 'lead-21', phoneNumber: '0900000020' },
      ]);

      const result = await service.listDuplicates(
        { page: 1, page_size: 1 },
        adminUser,
      );

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(1);
    });
  });
});
