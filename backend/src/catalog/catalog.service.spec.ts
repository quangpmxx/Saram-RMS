import { Test } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: {
    leadSource: { findMany: jest.Mock };
    statusCatalog: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      leadSource: { findMany: jest.fn() },
      statusCatalog: { findMany: jest.fn() },
    };

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

  describe('listStatusCatalog', () => {
    it('không lọc theo category nếu không truyền vào', async () => {
      prisma.statusCatalog.findMany.mockResolvedValue([]);

      await service.listStatusCatalog();

      expect(prisma.statusCatalog.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      });
    });

    it('lọc theo category khi có truyền vào, map đúng field response', async () => {
      prisma.statusCatalog.findMany.mockResolvedValue([
        {
          id: '1',
          category: 'call_status',
          code: 'CALLED',
          name: 'Đã gọi',
          sortOrder: 1,
        },
      ]);

      const result = await service.listStatusCatalog('call_status');

      expect(prisma.statusCatalog.findMany).toHaveBeenCalledWith({
        where: { category: 'call_status' },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      });
      expect(result).toEqual([
        {
          id: '1',
          category: 'call_status',
          code: 'CALLED',
          name: 'Đã gọi',
          sort_order: 1,
        },
      ]);
    });
  });
});
