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

  it('nhiều bản ghi khớp → đặt is_duplicate_flagged = true cho tất cả', async () => {
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1' },
      { id: 'lead-2' },
    ]);

    await service.syncDuplicateFlags('0900000000');

    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['lead-1', 'lead-2'] } },
      data: { isDuplicateFlagged: true },
    });
  });
});
