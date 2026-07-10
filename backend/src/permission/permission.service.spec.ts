import { Test } from '@nestjs/testing';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let prisma: { permission: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { permission: { findMany: jest.fn().mockResolvedValue([]) } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(PermissionService);
  });

  it('Mục 2, docs/13: danh mục quyền cố tình rỗng ở Phase 9 (chưa chốt với chủ doanh nghiệp)', async () => {
    const result = await service.list();
    expect(result).toEqual([]);
  });

  it('ánh xạ đúng đối tượng Permission khi danh mục có dữ liệu (khung sẵn sàng cho tương lai)', async () => {
    prisma.permission.findMany.mockResolvedValue([
      { id: 'perm-1', code: 'ADD_EMPLOYEE', name: 'Thêm nhân viên', description: null },
    ]);

    const result = await service.list();

    expect(result).toEqual([
      { id: 'perm-1', code: 'ADD_EMPLOYEE', name: 'Thêm nhân viên', description: null },
    ]);
  });
});
