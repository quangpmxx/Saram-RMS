import { Test } from '@nestjs/testing';
import { CarePoolScannerService } from './care-pool-scanner.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { RealtimeService } from '../realtime/realtime.service';

describe('CarePoolScannerService', () => {
  let service: CarePoolScannerService;
  let prisma: {
    lead: { findMany: jest.Mock; updateMany: jest.Mock };
  };
  let systemConfigService: { getCarePoolThresholdMinutes: jest.Mock };
  let realtimeService: { emitCandidateChange: jest.Mock };

  const fullCandidateLead = {
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
    assignedTeamId: 'team-1',
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
    enteredCarePoolAt: new Date(),
    carePoolLockedById: null,
    carePoolLockedAt: null,
    removedFromCarePoolById: null,
    removedFromCarePoolAt: null,
    isDuplicateFlagged: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    deletedById: null,
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
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    systemConfigService = {
      getCarePoolThresholdMinutes: jest.fn().mockResolvedValue(60),
    };
    realtimeService = { emitCandidateChange: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CarePoolScannerService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemConfigService, useValue: systemConfigService },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    service = moduleRef.get(CarePoolScannerService);
  });

  it('không có lead nào đủ điều kiện -> trả về 0, KHÔNG gọi updateMany/phát realtime', async () => {
    prisma.lead.findMany.mockResolvedValueOnce([]);

    const count = await service.runScan();

    expect(count).toBe(0);
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
    expect(realtimeService.emitCandidateChange).not.toHaveBeenCalled();
  });

  it('có lead đủ điều kiện -> cập nhật entered_care_pool_at, phát realtime care_pool_entered với actor=null cho TỪNG lead', async () => {
    prisma.lead.findMany
      .mockResolvedValueOnce([{ id: 'lead-1' }, { id: 'lead-2' }]) // bước 1: lấy id đủ điều kiện
      .mockResolvedValueOnce([
        fullCandidateLead,
        { ...fullCandidateLead, id: 'lead-2' },
      ]); // bước 2: tải lại đầy đủ CANDIDATE_INCLUDE sau khi ghi
    prisma.lead.updateMany.mockResolvedValue({ count: 2 });

    const count = await service.runScan();

    expect(count).toBe(2);
    expect(prisma.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { enteredCarePoolAt: expect.any(Date) },
      }),
    );
    expect(realtimeService.emitCandidateChange).toHaveBeenCalledTimes(2);
    expect(realtimeService.emitCandidateChange).toHaveBeenCalledWith(
      'care_pool_entered',
      expect.objectContaining({ id: 'lead-1' }),
      null,
    );
    expect(realtimeService.emitCandidateChange).toHaveBeenCalledWith(
      'care_pool_entered',
      expect.objectContaining({ id: 'lead-2' }),
      null,
    );
  });

  it('dùng đúng ngưỡng thời gian từ SystemConfigService để tính cutoff', async () => {
    systemConfigService.getCarePoolThresholdMinutes.mockResolvedValue(120);
    prisma.lead.findMany.mockResolvedValueOnce([]);

    await service.runScan();

    expect(systemConfigService.getCarePoolThresholdMinutes).toHaveBeenCalled();
    const where = prisma.lead.findMany.mock.calls[0][0].where;
    expect(where.assignedTeamId).toEqual({ not: null });
    expect(where.enteredCarePoolAt).toBeNull();
  });
});
