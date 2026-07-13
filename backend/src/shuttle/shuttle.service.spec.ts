import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ShuttleService } from './shuttle.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Prisma } from '../../generated/prisma/client';

describe('ShuttleService', () => {
  let service: ShuttleService;
  let prisma: {
    shuttleRecord: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    shuttleOption: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  const currentUser = { id: 'user-1', role: 'sale' as const, sessionId: 's' };

  const record = {
    id: 'record-1',
    date: new Date('2026-07-13'),
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0901000001',
    company: 'Goertek',
    area: 'Bắc Ninh',
    type: 'Chính thức',
    sale: 'Sale A',
    driver: 'Anh Hùng',
    interviewTime: '08:30',
    contractor: 'Nhà thầu Minh Phát',
    status: 'Đã đón',
    note: 'Ghi chú',
    createdById: 'user-1',
    updatedById: 'user-1',
    createdAt: new Date('2026-07-13'),
    updatedAt: new Date('2026-07-13'),
    createdBy: { id: 'user-1', fullName: 'Sale Demo A' },
    updatedBy: { id: 'user-1', fullName: 'Sale Demo A' },
  };

  beforeEach(async () => {
    prisma = {
      shuttleRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      shuttleOption: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ShuttleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(ShuttleService);
  });

  describe('list', () => {
    it('phân trang đúng, trả về total/page/page_size/items', async () => {
      prisma.$transaction.mockResolvedValue([1, [record]]);

      const result = await service.list({ page: 1, page_size: 20 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(20);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].full_name).toBe('Nguyễn Văn A');
      expect(result.items[0].date).toBe('2026-07-13');
    });

    it('lọc theo keyword (tên hoặc SĐT), company, type, sale, driver, status, khoảng ngày', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.list({
        page: 1,
        page_size: 20,
        keyword: '0901',
        company: 'Goertek',
        type: 'Chính thức',
        sale: 'Sale A',
        driver: 'Anh Hùng',
        status: 'Đã đón',
        date_from: '2026-07-13',
        date_to: '2026-07-14',
      });

      expect(prisma.shuttleRecord.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { fullName: { contains: '0901', mode: 'insensitive' } },
            { phoneNumber: { contains: '0901', mode: 'insensitive' } },
          ],
          date: { gte: new Date('2026-07-13'), lte: new Date('2026-07-14') },
          company: 'Goertek',
          type: 'Chính thức',
          sale: 'Sale A',
          driver: 'Anh Hùng',
          status: 'Đã đón',
        },
      });
    });
  });

  describe('create', () => {
    it('tạo dòng mới với created_by/updated_by = người thực hiện, ghi audit log', async () => {
      prisma.shuttleRecord.create.mockResolvedValue(record);

      const result = await service.create(
        {
          date: '2026-07-13',
          full_name: 'Nguyễn Văn A',
          phone_number: '0901000001',
          status: 'Đã đón',
        },
        currentUser,
      );

      expect(prisma.shuttleRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById: 'user-1',
            updatedById: 'user-1',
            fullName: 'Nguyễn Văn A',
            phoneNumber: '0901000001',
          }),
        }),
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'create',
          entityType: 'shuttle_record',
        }),
      );
      expect(result.full_name).toBe('Nguyễn Văn A');
    });
  });

  describe('update', () => {
    it('ném NotFoundException nếu không tìm thấy', async () => {
      prisma.shuttleRecord.findUnique.mockResolvedValue(null);
      await expect(
        service.update('ghost', { status: 'Đã đón' }, currentUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cập nhật thành công, updated_by = người thực hiện, ghi audit log', async () => {
      prisma.shuttleRecord.findUnique.mockResolvedValue(record);
      prisma.shuttleRecord.update.mockResolvedValue({
        ...record,
        status: 'Đã phỏng vấn',
      });

      const result = await service.update(
        'record-1',
        { status: 'Đã phỏng vấn' },
        { id: 'user-2', role: 'admin' as const, sessionId: 's' },
      );

      expect(prisma.shuttleRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'record-1' },
          data: expect.objectContaining({
            status: 'Đã phỏng vấn',
            updatedById: 'user-2',
          }),
        }),
      );
      expect(result.status).toBe('Đã phỏng vấn');
    });
  });

  describe('remove', () => {
    it('ném NotFoundException nếu không tìm thấy', async () => {
      prisma.shuttleRecord.findUnique.mockResolvedValue(null);
      await expect(service.remove('ghost', currentUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('xóa thành công (hard delete), ghi audit log', async () => {
      prisma.shuttleRecord.findUnique.mockResolvedValue(record);
      prisma.shuttleRecord.delete.mockResolvedValue(record);

      await service.remove('record-1', currentUser);

      expect(prisma.shuttleRecord.delete).toHaveBeenCalledWith({
        where: { id: 'record-1' },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'delete',
          entityType: 'shuttle_record',
        }),
      );
    });
  });

  describe('getOptions', () => {
    it('nhóm các dòng shuttle_options theo field, kèm màu', async () => {
      prisma.shuttleOption.findMany.mockResolvedValue([
        { id: 'opt-1', field: 'company', value: 'Goertek', colorKey: 'green' },
        { id: 'opt-2', field: 'status', value: 'Đã đón', colorKey: 'green' },
        { id: 'opt-3', field: 'company', value: 'Samsung', colorKey: null },
      ]);

      const result = await service.getOptions();

      expect(result.companies).toEqual([
        { id: 'opt-1', value: 'Goertek', color_key: 'green' },
        { id: 'opt-3', value: 'Samsung', color_key: null },
      ]);
      expect(result.statuses).toEqual([
        { id: 'opt-2', value: 'Đã đón', color_key: 'green' },
      ]);
      expect(result.areas).toEqual([]);
      expect(result.types).toEqual([]);
      expect(result.sales).toEqual([]);
      expect(result.drivers).toEqual([]);
      expect(result.contractors).toEqual([]);
      expect(result.interviewResults).toEqual([]);
      expect(result.interviewTimes).toEqual([]);
    });
  });

  describe('addOption', () => {
    it('upsert theo (field, value), ghi audit log', async () => {
      prisma.shuttleOption.upsert.mockResolvedValue({
        id: 'opt-new',
        field: 'company',
        value: 'Foxconn',
        colorKey: 'blue',
      });

      const result = await service.addOption(
        { field: 'company', value: 'Foxconn', color_key: 'blue' },
        currentUser,
      );

      expect(prisma.shuttleOption.upsert).toHaveBeenCalledWith({
        where: { field_value: { field: 'company', value: 'Foxconn' } },
        update: { colorKey: 'blue', textColorKey: undefined },
        create: {
          field: 'company',
          value: 'Foxconn',
          colorKey: 'blue',
          textColorKey: null,
        },
      });
      expect(result).toEqual({
        id: 'opt-new',
        value: 'Foxconn',
        color_key: 'blue',
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'create',
          entityType: 'shuttle_option',
        }),
      );
    });
  });

  describe('updateOption', () => {
    it('ném NotFoundException nếu không tìm thấy', async () => {
      prisma.shuttleOption.findUnique.mockResolvedValue(null);
      await expect(
        service.updateOption('ghost', { value: 'X' }, currentUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sửa tên/màu thành công, ghi audit log', async () => {
      prisma.shuttleOption.findUnique.mockResolvedValue({
        id: 'opt-1',
        field: 'driver',
        value: 'Anh Hùng',
        colorKey: 'blue',
      });
      prisma.shuttleOption.update.mockResolvedValue({
        id: 'opt-1',
        field: 'driver',
        value: 'Anh Hùng (mới)',
        colorKey: 'teal',
      });

      const result = await service.updateOption(
        'opt-1',
        { value: 'Anh Hùng (mới)', color_key: 'teal' },
        currentUser,
      );

      expect(prisma.shuttleOption.update).toHaveBeenCalledWith({
        where: { id: 'opt-1' },
        data: { value: 'Anh Hùng (mới)', colorKey: 'teal' },
      });
      expect(result).toEqual({
        id: 'opt-1',
        value: 'Anh Hùng (mới)',
        color_key: 'teal',
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          entityType: 'shuttle_option',
        }),
      );
    });

    it('báo lỗi trùng (ConflictException) nếu đổi tên trùng giá trị đã có trong cùng field', async () => {
      prisma.shuttleOption.findUnique.mockResolvedValue({
        id: 'opt-1',
        field: 'driver',
        value: 'Anh Hùng',
        colorKey: 'blue',
      });
      prisma.shuttleOption.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      await expect(
        service.updateOption('opt-1', { value: 'Anh Tuấn' }, currentUser),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('không truyền color_key thì giữ nguyên (không ghi đè thành null)', async () => {
      prisma.shuttleOption.findUnique.mockResolvedValue({
        id: 'opt-1',
        field: 'driver',
        value: 'Anh Hùng',
        colorKey: 'blue',
      });
      prisma.shuttleOption.update.mockResolvedValue({
        id: 'opt-1',
        field: 'driver',
        value: 'Anh Hùng (mới)',
        colorKey: 'blue',
      });

      await service.updateOption(
        'opt-1',
        { value: 'Anh Hùng (mới)' },
        currentUser,
      );

      expect(prisma.shuttleOption.update).toHaveBeenCalledWith({
        where: { id: 'opt-1' },
        data: { value: 'Anh Hùng (mới)', colorKey: undefined },
      });
    });
  });

  describe('removeOption', () => {
    it('ném NotFoundException nếu không tìm thấy', async () => {
      prisma.shuttleOption.findUnique.mockResolvedValue(null);
      await expect(
        service.removeOption('ghost', currentUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('xóa khỏi danh sách gợi ý, KHÔNG đụng shuttle_record, ghi audit log', async () => {
      prisma.shuttleOption.findUnique.mockResolvedValue({
        id: 'opt-1',
        field: 'company',
        value: 'Goertek',
        colorKey: 'green',
      });
      prisma.shuttleOption.delete.mockResolvedValue({});

      await service.removeOption('opt-1', currentUser);

      expect(prisma.shuttleOption.delete).toHaveBeenCalledWith({
        where: { id: 'opt-1' },
      });
      expect(prisma.shuttleRecord.update).not.toHaveBeenCalled();
      expect(prisma.shuttleRecord.delete).not.toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'delete',
          entityType: 'shuttle_option',
        }),
      );
    });
  });
});
