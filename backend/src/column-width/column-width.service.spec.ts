import { UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ColumnWidthService } from './column-width.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('ColumnWidthService', () => {
  let service: ColumnWidthService;
  let prisma: {
    columnWidthConfig: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let auditLog: { log: jest.Mock };

  const adminUser = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };

  const baseConfig = {
    id: 'cfg-1',
    tableKey: 'candidates_list',
    columnWidths: JSON.stringify({ name: 220, source: 110 }),
    updatedById: 'admin-1',
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      columnWidthConfig: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ColumnWidthService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(ColumnWidthService);
  });

  describe('list', () => {
    it('trả về danh sách đã parse JSON column_widths', async () => {
      prisma.columnWidthConfig.findMany.mockResolvedValue([baseConfig]);

      const result = await service.list();

      expect(result).toEqual([
        {
          table_key: 'candidates_list',
          column_widths: { name: 220, source: 110 },
          updated_at: baseConfig.updatedAt.toISOString(),
        },
      ]);
    });

    it('danh mục rỗng vẫn hoạt động đúng', async () => {
      prisma.columnWidthConfig.findMany.mockResolvedValue([]);
      const result = await service.list();
      expect(result).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('từ chối nếu column_widths rỗng', async () => {
      await expect(
        service.upsert('candidates_list', { column_widths: {} }, adminUser),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('từ chối nếu có độ rộng không phải số nguyên', async () => {
      await expect(
        service.upsert(
          'candidates_list',
          { column_widths: { name: 220.5 } },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('từ chối nếu độ rộng nhỏ hơn 20px', async () => {
      await expect(
        service.upsert(
          'candidates_list',
          { column_widths: { name: 10 } },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('từ chối nếu độ rộng lớn hơn 4000px', async () => {
      await expect(
        service.upsert(
          'candidates_list',
          { column_widths: { name: 5000 } },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('UI Polish — chấp nhận độ rộng lớn (vd 3000px) trong biên đã nới rộng', async () => {
      prisma.columnWidthConfig.findUnique.mockResolvedValue(baseConfig);
      prisma.columnWidthConfig.upsert.mockResolvedValue({
        ...baseConfig,
        columnWidths: JSON.stringify({ name: 3000 }),
      });

      await expect(
        service.upsert(
          'candidates_list',
          { column_widths: { name: 3000 } },
          adminUser,
        ),
      ).resolves.toBeDefined();
    });

    it('upsert thành công, ghi audit log với old/new value, trả về đúng dữ liệu đã lưu', async () => {
      prisma.columnWidthConfig.findUnique.mockResolvedValue(baseConfig);
      const updated = {
        ...baseConfig,
        columnWidths: JSON.stringify({ name: 250, source: 120 }),
      };
      prisma.columnWidthConfig.upsert.mockResolvedValue(updated);

      const result = await service.upsert(
        'candidates_list',
        { column_widths: { name: 250, source: 120 } },
        adminUser,
      );

      expect(prisma.columnWidthConfig.upsert).toHaveBeenCalledWith({
        where: { tableKey: 'candidates_list' },
        create: {
          tableKey: 'candidates_list',
          columnWidths: JSON.stringify({ name: 250, source: 120 }),
          updatedById: 'admin-1',
        },
        update: {
          columnWidths: JSON.stringify({ name: 250, source: 120 }),
          updatedById: 'admin-1',
        },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          entityType: 'column_width_config',
          fieldChanged: 'candidates_list',
          oldValue: baseConfig.columnWidths,
          newValue: JSON.stringify({ name: 250, source: 120 }),
        }),
      );
      expect(result.column_widths).toEqual({ name: 250, source: 120 });
    });

    it('tạo mới thành công khi bảng chưa có config (chưa từng lưu)', async () => {
      prisma.columnWidthConfig.findUnique.mockResolvedValue(null);
      prisma.columnWidthConfig.upsert.mockResolvedValue(baseConfig);

      await service.upsert(
        'candidates_list',
        { column_widths: { name: 220, source: 110 } },
        adminUser,
      );

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ oldValue: undefined }),
      );
    });
  });
});
