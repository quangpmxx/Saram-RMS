import { Test } from '@nestjs/testing';
import { LeadDuplicateService } from './lead-duplicate.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeadDuplicateService', () => {
  let service: LeadDuplicateService;
  let prisma: { lead: { findMany: jest.Mock; updateMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { lead: { findMany: jest.fn(), updateMany: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadDuplicateService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(LeadDuplicateService);
  });

  it('không làm gì nếu không có bản ghi nào khớp SĐT', async () => {
    prisma.lead.findMany.mockResolvedValue([]);

    const result = await service.syncDuplicateFlags('0900000000');

    expect(result).toEqual([]);
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
  });

  it('chỉ 1 bản ghi khớp → đặt is_duplicate_flagged = false', async () => {
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1' }]);

    await service.syncDuplicateFlags('0900000000');

    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['lead-1'] } },
      data: { isDuplicateFlagged: false },
    });
  });

  it('nhiều bản ghi khớp trong 7 ngày → đặt is_duplicate_flagged = true; bản ghi cách >7 ngày → false', async () => {
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-old', uploadedAt: new Date('2026-09-20') },
      { id: 'lead-1', uploadedAt: new Date('2026-10-01') },
      { id: 'lead-2', uploadedAt: new Date('2026-10-06') },
    ]);

    await service.syncDuplicateFlags('0900000000');

    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['lead-1', 'lead-2'] } },
      data: { isDuplicateFlagged: true },
    });
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['lead-old'] } },
      data: { isDuplicateFlagged: false },
    });
  });
});
