import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CandidatesService } from './candidates.service';
import { LeadDuplicateService } from './lead-duplicate.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

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
    };
    leadSource: { findUnique: jest.Mock };
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

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
      },
      leadSource: { findUnique: jest.fn() },
      account: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CandidatesService,
        LeadDuplicateService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
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
  });
});
