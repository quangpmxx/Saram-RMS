import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CarePoolService } from './care-pool.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

describe('CarePoolService', () => {
  let service: CarePoolService;
  let prisma: {
    lead: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    account: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let realtimeService: { emitCandidateChange: jest.Mock };

  const sale: AuthenticatedUser = {
    id: 'sale-1',
    role: 'sale',
    sessionId: 's1',
  };
  const otherSale: AuthenticatedUser = {
    id: 'sale-2',
    role: 'sale',
    sessionId: 's2',
  };
  const admin: AuthenticatedUser = {
    id: 'admin-1',
    role: 'admin',
    sessionId: 's3',
  };

  const carePoolLead = {
    id: 'lead-1',
    deletedAt: null,
    enteredCarePoolAt: new Date('2026-07-01'),
    removedFromCarePoolAt: null,
    assignedTeamId: 'team-1',
    carePoolLockedById: null,
    carePoolLockedAt: null,
  };

  /** Shape đầy đủ cho toCandidateResponse() — khớp mẫu đã dùng ở lead-pipeline.service.spec.ts. */
  const fullCandidateLead = {
    ...carePoolLead,
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
    assignedAt: null,
    assignmentMethod: null,
    callStatusId: null,
    callResultId: null,
    zaloStatusId: null,
    zaloFriendStatusId: null,
    noteColor: null,
    currentInterviewStatusId: null,
    currentEmploymentStatusId: null,
    currentPartnerCompanyName: null,
    isHeld: false,
    heldById: null,
    heldAt: null,
    lastActivityAt: new Date('2026-06-01'),
    isDuplicateFlagged: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    removedFromCarePoolById: null,
    source: { id: 'source-1', name: 'Facebook' },
    uploadedBy: {
      id: 'mkt-1',
      fullName: 'MKT A',
      role: 'mkt',
      avatarUrl: null,
    },
    assignedTo: null,
    heldBy: null,
    carePoolLockedBy: null,
    callStatus: null,
    callResult: null,
    zaloStatus: null,
    zaloFriendStatus: null,
    currentInterviewStatus: null,
    currentEmploymentStatus: null,
  };

  beforeEach(async () => {
    prisma = {
      lead: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(fullCandidateLead),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      account: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    realtimeService = { emitCandidateChange: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CarePoolService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    service = moduleRef.get(CarePoolService);
  });

  describe('lock', () => {
    it('không phải Sale -> ForbiddenException', async () => {
      await expect(service.lock('lead-1', admin)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('không tìm thấy lead trong cột chăm sóc -> NotFoundException', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.lock('lead-1', sale)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('Sale khác nhóm -> ForbiddenException', async () => {
      prisma.lead.findUnique.mockResolvedValue(carePoolLead);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-2' });
      await expect(service.lock('lead-1', sale)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lead đã bị Sale khác khóa (còn hiệu lực) -> ConflictException, KHÔNG phát realtime', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...carePoolLead,
        carePoolLockedById: 'sale-2',
        carePoolLockedAt: new Date(),
      });
      prisma.account.findUnique
        .mockResolvedValueOnce({ teamId: 'team-1' }) // getOwnTeamId(sale)
        .mockResolvedValueOnce({ fullName: 'Sale B' }); // locker

      await expect(service.lock('lead-1', sale)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(realtimeService.emitCandidateChange).not.toHaveBeenCalled();
    });

    it('khóa thành công -> ghi audit log, phát realtime care_pool_locked', async () => {
      prisma.lead.findUnique.mockResolvedValue(carePoolLead);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });

      const result = await service.lock('lead-1', sale);

      expect(result.id).toBe('lead-1');
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: expect.objectContaining({ carePoolLockedById: 'sale-1' }),
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'lock' }),
      );
      expect(realtimeService.emitCandidateChange).toHaveBeenCalledWith(
        'care_pool_locked',
        expect.objectContaining({ id: 'lead-1' }),
        sale,
      );
    });

    it('đã tự khóa từ trước (idempotent) -> KHÔNG ghi audit log, KHÔNG phát realtime lại', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...carePoolLead,
        carePoolLockedById: 'sale-1',
        carePoolLockedAt: new Date(),
      });
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });

      await service.lock('lead-1', sale);

      expect(prisma.lead.update).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
      expect(realtimeService.emitCandidateChange).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('không phải Sale -> ForbiddenException', async () => {
      await expect(service.release('lead-1', admin)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('Sale khác đang giữ khóa -> ForbiddenException', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...carePoolLead,
        carePoolLockedById: 'sale-2',
      });
      await expect(service.release('lead-1', sale)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('giải phóng thành công -> ghi audit log, phát realtime care_pool_released', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...carePoolLead,
        carePoolLockedById: 'sale-1',
      });

      await service.release('lead-1', sale);

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { carePoolLockedById: null, carePoolLockedAt: null },
      });
      expect(realtimeService.emitCandidateChange).toHaveBeenCalledWith(
        'care_pool_released',
        expect.objectContaining({ id: 'lead-1' }),
        sale,
      );
    });

    it('không ai đang khóa (không có gì để giải phóng) -> KHÔNG ghi audit log, KHÔNG phát realtime', async () => {
      prisma.lead.findUnique.mockResolvedValue(carePoolLead);

      await service.release('lead-1', sale);

      expect(prisma.lead.update).not.toHaveBeenCalled();
      expect(realtimeService.emitCandidateChange).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('không phải Admin -> ForbiddenException', async () => {
      await expect(service.remove('lead-1', sale)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.remove('lead-1', otherSale)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('Admin gỡ thành công -> ghi audit log, phát realtime care_pool_removed', async () => {
      prisma.lead.findUnique.mockResolvedValue(carePoolLead);

      await service.remove('lead-1', admin);

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: expect.objectContaining({
          removedFromCarePoolById: 'admin-1',
          carePoolLockedById: null,
        }),
      });
      expect(realtimeService.emitCandidateChange).toHaveBeenCalledWith(
        'care_pool_removed',
        expect.objectContaining({ id: 'lead-1' }),
        admin,
      );
    });
  });
});
