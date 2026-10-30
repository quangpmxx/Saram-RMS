import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ShuttleService } from './shuttle.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ModulePermissionService } from '../module-permission/module-permission.service';
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
    orderRecord: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    account: { findMany: jest.Mock };
    notification: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let realtimeService: {
    emitTransportationChange: jest.Mock;
    emitTransportationDeleted: jest.Mock;
    emitNotificationCreated: jest.Mock;
  };
  let modulePermission: { getEffective: jest.Mock };

  const currentUser = { id: 'user-1', role: 'sale' as const, sessionId: 's' };

  const record = {
    id: 'record-1',
    date: new Date('2026-07-13'),
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0901000001',
    companyId: 'company-1',
    area: 'Bắc Ninh',
    type: 'Chính thức',
    saleUserId: 'sale-1',
    driverUserId: 'driver-1',
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
    saleUser: { id: 'sale-1', fullName: 'Sale A', nickname: null },
    driverUser: { id: 'driver-1', fullName: 'Anh Hùng', nickname: null },
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
      orderRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ name: 'Foxconn' }),
      },
      account: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'admin-1', role: 'admin' },
          { id: 'sale-9', role: 'sale' },
          { id: 'acc-9', role: 'accounting' },
        ]),
      },
      notification: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: `n-${data.accountId}`,
            leadId: null,
            leaveRequestId: null,
            sender: null,
            sentAt: data.sentAt,
            createdAt: data.scheduledAt,
            ...data,
          }),
        ),
      },
      $transaction: jest.fn(),
    };
    // Kế toán bị tắt quyền xem Đưa đón trong ví dụ này.
    modulePermission = {
      getEffective: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(id === 'acc-9' ? 'none' : 'view'),
        ),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    realtimeService = {
      emitTransportationChange: jest.fn(),
      emitTransportationDeleted: jest.fn(),
      emitNotificationCreated: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ShuttleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: RealtimeService, useValue: realtimeService },
        { provide: ModulePermissionService, useValue: modulePermission },
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
      expect(result.first_day_offset).toBe(0);
      // Trang 1 không cần đếm thêm (chỉ 1 lần count tổng trong transaction).
      expect(prisma.shuttleRecord.count).toHaveBeenCalledTimes(1);
    });

    it('trang sau: first_day_offset = số dòng cùng ngày đầu trang đã ở các trang trước', async () => {
      prisma.$transaction.mockResolvedValue([45, [record]]);
      // 20 dòng đã bỏ qua, 17 dòng thuộc các ngày mới hơn → 3 dòng của ngày này ở trang 1.
      prisma.shuttleRecord.count.mockResolvedValue(17);

      const result = await service.list({ page: 2, page_size: 20 });

      expect(result.first_day_offset).toBe(3);
      expect(prisma.shuttleRecord.count).toHaveBeenCalledWith({
        where: { AND: [{}, { date: { gt: record.date } }] },
      });
    });

    it('bấm tiêu đề Ngày tăng dần: offset đếm các ngày CŨ hơn', async () => {
      prisma.$transaction.mockResolvedValue([45, [record]]);
      prisma.shuttleRecord.count.mockResolvedValue(18);

      const result = await service.list({
        page: 2,
        page_size: 20,
        sort: 'date',
        order: 'asc',
      });

      expect(result.first_day_offset).toBe(2);
      expect(prisma.shuttleRecord.count).toHaveBeenCalledWith({
        where: { AND: [{}, { date: { lt: record.date } }] },
      });
      expect(prisma.shuttleRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ date: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('STT giảm dần: đảo thứ tự trong ngày, trả tổng số dòng từng ngày', async () => {
      prisma.$transaction.mockResolvedValue([1, [record]]);
      prisma.shuttleRecord.groupBy = jest
        .fn()
        .mockResolvedValue([{ date: record.date, _count: { _all: 7 } }]);

      const result = await service.list({
        page: 1,
        page_size: 20,
        sort: 'stt',
        order: 'desc',
      });

      expect(result.day_counts).toEqual({ '2026-07-13': 7 });
      expect(prisma.shuttleRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ date: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('lọc theo keyword (tên hoặc SĐT), company_id, type, sale_user_id, driver_user_id, status, khoảng ngày', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await service.list({
        page: 1,
        page_size: 20,
        keyword: '0901',
        company_id: 'company-1',
        type: 'Chính thức',
        sale_user_id: 'sale-1',
        driver_user_id: 'driver-1',
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
          companyId: 'company-1',
          type: 'Chính thức',
          saleUserId: 'sale-1',
          driverUserId: 'driver-1',
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
        { id: 'opt-1', field: 'driver', value: 'Anh Hùng', colorKey: 'green' },
        { id: 'opt-2', field: 'status', value: 'Đã đón', colorKey: 'green' },
        { id: 'opt-3', field: 'driver', value: 'Anh Tuấn', colorKey: null },
      ]);

      const result = await service.getOptions();

      expect(result.drivers).toEqual([
        { id: 'opt-1', value: 'Anh Hùng', color_key: 'green' },
        { id: 'opt-3', value: 'Anh Tuấn', color_key: null },
      ]);
      expect(result.statuses).toEqual([
        { id: 'opt-2', value: 'Đã đón', color_key: 'green' },
      ]);
      expect(result.areas).toEqual([]);
      expect(result.types).toEqual([]);
      expect(result.sales).toEqual([]);
      expect(result.contractors).toEqual([]);
      expect(result.interviewResults).toEqual([]);
      expect(result.interviewTimes).toEqual([]);
    });
  });

  describe('listCompanies', () => {
    it('đọc từ order_records (công ty chính là đơn hàng), trả đúng hình dạng ShuttleOptionItemDto', async () => {
      prisma.orderRecord.findMany.mockResolvedValue([
        {
          id: 'company-1',
          name: 'Foxconn',
          colorKey: 'blue-base',
          textColorKey: null,
        },
        {
          id: 'company-2',
          name: 'Samsung',
          colorKey: null,
          textColorKey: null,
        },
      ]);

      const result = await service.listCompanies();

      expect(prisma.orderRecord.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        {
          id: 'company-1',
          value: 'Foxconn',
          color_key: 'blue-base',
          text_color_key: null,
        },
        {
          id: 'company-2',
          value: 'Samsung',
          color_key: null,
          text_color_key: null,
        },
      ]);
    });
  });

  describe('addOption', () => {
    it('upsert theo (field, value), ghi audit log', async () => {
      prisma.shuttleOption.upsert.mockResolvedValue({
        id: 'opt-new',
        field: 'area',
        value: 'Bắc Ninh',
        colorKey: 'blue',
      });

      const result = await service.addOption(
        { field: 'area', value: 'Bắc Ninh', color_key: 'blue' },
        currentUser,
      );

      expect(prisma.shuttleOption.upsert).toHaveBeenCalledWith({
        where: { field_value: { field: 'area', value: 'Bắc Ninh' } },
        update: { colorKey: 'blue', textColorKey: undefined },
        create: {
          field: 'area',
          value: 'Bắc Ninh',
          colorKey: 'blue',
          textColorKey: null,
        },
      });
      expect(result).toEqual({
        id: 'opt-new',
        value: 'Bắc Ninh',
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
        field: 'area',
        value: 'Bắc Ninh',
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

  describe('thông báo Đưa đón (lưu vào chuông + bật nổi)', () => {
    const leader = { id: 'leader-1', role: 'leader' as const, sessionId: 's' };
    const created = () =>
      prisma.notification.create.mock.calls.map(
        ([arg]: [{ data: Record<string, unknown> }]) => arg.data,
      );

    it('nhập dòng mới → lưu thông báo cho mọi tài khoản có quyền xem Đưa đón', async () => {
      prisma.shuttleRecord.create.mockResolvedValue({
        ...record,
        createdBy: { id: 'leader-1', fullName: 'Đỗ Thị Thảo' },
      });

      await service.create(
        {
          date: '2026-07-13',
          full_name: 'Nguyễn Văn A',
          phone_number: '0901000001',
        },
        leader,
      );

      const rows = created();
      expect(rows.map((r) => r.accountId)).toEqual(['admin-1', 'sale-9']);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          type: 'shuttle_update',
          channel: 'in_app',
          senderId: 'leader-1',
          content:
            'Đỗ Thị Thảo (Leader) đã nhập đưa đón Nguyễn Văn A (Foxconn)',
          meta: expect.objectContaining({
            kind: 'created',
            worker_name: 'Nguyễn Văn A',
            company_name: 'Foxconn',
          }),
        }),
      );
      expect(realtimeService.emitNotificationCreated).toHaveBeenCalledTimes(2);
    });

    it('đổi Tình trạng → nội dung "Lao động … - giá trị" kèm màu đã cài', async () => {
      prisma.shuttleRecord.findUnique.mockResolvedValue({
        ...record,
        status: 'Hẹn lại',
      });
      prisma.shuttleRecord.update.mockResolvedValue({
        ...record,
        status: 'Đã đón',
      });
      prisma.shuttleOption.findUnique.mockResolvedValue({
        colorKey: 'green-base',
        textColorKey: null,
      });

      await service.update('record-1', { status: 'Đã đón' }, leader);

      expect(prisma.shuttleOption.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { field_value: { field: 'status', value: 'Đã đón' } },
        }),
      );
      expect(created()[0]).toEqual(
        expect.objectContaining({
          content: 'Lao động Nguyễn Văn A (Foxconn) - Đã đón',
          meta: expect.objectContaining({
            kind: 'status',
            value: 'Đã đón',
            color_key: 'green-base',
          }),
        }),
      );
    });

    it('đổi Kết quả → kind=interview_result', async () => {
      prisma.shuttleRecord.findUnique.mockResolvedValue({
        ...record,
        interviewResult: null,
      });
      prisma.shuttleRecord.update.mockResolvedValue({
        ...record,
        interviewResult: 'Trượt phỏng vấn',
      });
      prisma.shuttleOption.findUnique.mockResolvedValue(null);

      await service.update(
        'record-1',
        { interview_result: 'Trượt phỏng vấn' },
        leader,
      );

      expect(created()[0]).toEqual(
        expect.objectContaining({
          content: 'Lao động Nguyễn Văn A (Foxconn) - Trượt phỏng vấn',
          meta: expect.objectContaining({
            kind: 'interview_result',
            color_key: null,
          }),
        }),
      );
    });

    it('sửa ô khác (Ghi chú) hoặc giữ nguyên Tình trạng → không thông báo', async () => {
      prisma.shuttleRecord.findUnique.mockResolvedValue(record);
      prisma.shuttleRecord.update.mockResolvedValue({ ...record, note: 'Mới' });

      await service.update(
        'record-1',
        { note: 'Mới', status: 'Đã đón' },
        leader,
      );

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('lỗi khi tạo thông báo không làm hỏng việc lưu', async () => {
      prisma.shuttleRecord.findUnique.mockResolvedValue({
        ...record,
        status: 'Hẹn lại',
      });
      prisma.shuttleRecord.update.mockResolvedValue(record);
      prisma.orderRecord.findUnique.mockRejectedValue(new Error('DB down'));

      await expect(
        service.update('record-1', { status: 'Đã đón' }, leader),
      ).resolves.toEqual(expect.objectContaining({ status: 'Đã đón' }));
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
