import { Test } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: { leadSource: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { leadSource: { findMany: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [CatalogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CatalogService);
  });

  it('trả về danh sách nguồn kênh sắp xếp theo tên', async () => {
    prisma.leadSource.findMany.mockResolvedValue([
      { id: '1', name: 'Facebook' },
    ]);

    const result = await service.listLeadSources();

    expect(prisma.leadSource.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([{ id: '1', name: 'Facebook' }]);
  });
});
