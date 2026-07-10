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

  it('Mục 2, docs/13: danh mục rỗng vẫn hoạt động đúng (vd môi trường chưa chạy seed)', async () => {
    const result = await service.list();
    expect(result).toEqual([]);
  });

  it('ánh xạ đúng đối tượng Permission theo danh mục đã seed (Phase 9 — xem seedPhase9Permissions())', async () => {
    prisma.permission.findMany.mockResolvedValue([
      { id: 'perm-1', code: 'ADD_EMPLOYEE', name: 'Thêm nhân viên', description: null },
    ]);

    const result = await service.list();

    expect(result).toEqual([
      { id: 'perm-1', code: 'ADD_EMPLOYEE', name: 'Thêm nhân viên', description: null },
    ]);
  });
});
