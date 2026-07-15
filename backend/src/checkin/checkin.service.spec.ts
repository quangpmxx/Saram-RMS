import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CheckinService } from './checkin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

const CHROME_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('CheckinService (Phase 1+2+3+4)', () => {
  let service: CheckinService;
  let prisma: {
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    checkinRecord: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    companyLocationConfig: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let auditLog: { log: jest.Mock };

  // 10:00 giờ VN (03:00 UTC) ngày 15/07/2026 — cùng ngày ở cả UTC lẫn Asia/Ho_Chi_Minh.
  const NOW = new Date('2026-07-15T03:00:00.000Z');
  const TODAY_UTC_MIDNIGHT = new Date('2026-07-15T00:00:00.000Z');

  const sale: AuthenticatedUser = {
    id: 'sale-1',
    role: 'sale',
    sessionId: 's1',
  };
  const leader: AuthenticatedUser = {
    id: 'leader-1',
    role: 'leader',
    sessionId: 's2',
  };
  const admin: AuthenticatedUser = {
    id: 'admin-1',
    role: 'admin',
    sessionId: 's3',
  };
  const manager: AuthenticatedUser = {
    id: 'manager-1',
    role: 'manager',
    sessionId: 's4',
  };

  const COMPANY_LOCATION = {
    id: 'company-1',
    address: '123 Đường ABC, Quận 1, TP.HCM',
    latitude: 10.0,
    longitude: 106.0,
    allowedRadius: 100,
    updatedById: 'admin-1',
    updatedAt: NOW,
    updatedBy: { fullName: 'Admin Root' },
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    prisma = {
      account: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'leader-1', teamId: 'team-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      checkinRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      companyLocationConfig: {
        findFirst: jest.fn().mockResolvedValue(COMPANY_LOCATION),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckinService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(CheckinService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createDto(
    overrides: Partial<{
      latitude: number;
      longitude: number;
      accuracy: number;
    }> = {},
  ) {
    return {
      latitude: 10.0,
      longitude: 106.0,
      accuracy: 15,
      ...overrides,
    };
  }

  it('1) Trong bán kính, accuracy tốt, CÓ User-Agent -> "valid", lưu đúng IP + thiết bị/trình duyệt parse từ header', async () => {
    prisma.checkinRecord.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'rec-1', ...data, createdAt: NOW }),
    );

    const result = await service.checkin(
      createDto({ latitude: 10.0001, longitude: 106.0001 }),
      sale,
      '203.0.113.5',
      CHROME_WINDOWS_UA,
    );

    expect(result.status).toBe('valid');
    expect(result.ip_address).toBe('203.0.113.5');
    expect(result.operating_system).toBe('Windows');
    expect(result.browser).toBe('Chrome 126.0.0.0');
    expect(result.user_agent).toBe(CHROME_WINDOWS_UA);
  });

  it('2) Ngoài bán kính, accuracy tốt -> "outside_company", VẪN check-in thành công', async () => {
    prisma.checkinRecord.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'rec-2', ...data, createdAt: NOW }),
    );

    const result = await service.checkin(
      createDto({ latitude: 10.005, longitude: 106.005 }),
      sale,
      '203.0.113.5',
      CHROME_WINDOWS_UA,
    );

    expect(result.status).toBe('outside_company');
    expect(result.distance_from_company_meters).toBeGreaterThan(500);
  });

  it('3) Accuracy > 100m -> "needs_verification" dù trong bán kính', async () => {
    prisma.checkinRecord.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'rec-3', ...data, createdAt: NOW }),
    );

    const result = await service.checkin(
      createDto({ latitude: 10.0001, longitude: 106.0001, accuracy: 150 }),
      sale,
      '203.0.113.5',
      CHROME_WINDOWS_UA,
    );

    expect(result.status).toBe('needs_verification');
  });

  it('4) THIẾU User-Agent -> "needs_verification" dù accuracy tốt và trong bán kính (Mục 9: "thiếu thông tin thiết bị")', async () => {
    prisma.checkinRecord.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'rec-4', ...data, createdAt: NOW }),
    );

    const result = await service.checkin(
      createDto({ latitude: 10.0001, longitude: 106.0001 }),
      sale,
      '203.0.113.5',
      undefined,
    );

    expect(result.status).toBe('needs_verification');
  });

  it('5) Chưa cấu hình vị trí công ty -> chặn Check in', async () => {
    prisma.companyLocationConfig.findFirst.mockResolvedValue(null);

    await expect(
      service.checkin(createDto(), sale, '1.2.3.4', CHROME_WINDOWS_UA),
    ).rejects.toThrow('Quản trị viên chưa thiết lập vị trí công ty');
  });

  it('6) Admin không được Check in', async () => {
    await expect(
      service.checkin(createDto(), admin, '1.2.3.4', CHROME_WINDOWS_UA),
    ).rejects.toThrow(ForbiddenException);
  });

  it('7) Check-in lần 2 trong ngày bị từ chối, ghi audit log "reject" (Mục 9)', async () => {
    prisma.checkinRecord.findFirst.mockResolvedValue({
      id: 'rec-existing',
      accountId: 'sale-1',
      attendanceDate: TODAY_UTC_MIDNIGHT,
      isVoided: false,
    });

    await expect(
      service.checkin(createDto(), sale, '1.2.3.4', CHROME_WINDOWS_UA),
    ).rejects.toThrow('Bạn đã Check in hôm nay rồi');
    expect(prisma.checkinRecord.create).not.toHaveBeenCalled();
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'reject',
        entityType: 'checkin_record',
      }),
    );
  });

  it('7b) Check-in thành công ghi audit log "create" (Mục 9)', async () => {
    prisma.checkinRecord.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'rec-7b', ...data, createdAt: NOW }),
    );

    await service.checkin(
      createDto({ latitude: 10.0001, longitude: 106.0001 }),
      sale,
      '1.2.3.4',
      CHROME_WINDOWS_UA,
    );

    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'create',
        entityType: 'checkin_record',
        entityId: 'rec-7b',
      }),
    );
  });

  describe('getStatus()', () => {
    it('8) Trả về IP/thiết bị/trình duyệt PREVIEW suy từ request hiện tại (không lưu gì)', async () => {
      const status = await service.getStatus(
        sale,
        '198.51.100.9',
        CHROME_WINDOWS_UA,
      );

      expect(status.ip_address).toBe('198.51.100.9');
      expect(status.operating_system).toBe('Windows');
      expect(status.browser).toBe('Chrome 126.0.0.0');
      expect(prisma.checkinRecord.create).not.toHaveBeenCalled();
    });
  });

  describe('listRecords() — Mục 11', () => {
    const teamMember = (
      id: string,
      overrides: Partial<Record<string, unknown>> = {},
    ) => ({
      id,
      fullName: `Nhân viên ${id}`,
      avatarUrl: null,
      role: 'sale',
      position: null,
      teamId: 'team-1',
      status: 'active',
      team: { id: 'team-1', name: 'Nhóm Sale 1' },
      ...overrides,
    });

    const fullCheckinRecord = (
      accountId: string,
      overrides: Partial<Record<string, unknown>> = {},
    ) => ({
      id: `rec-${accountId}`,
      accountId,
      attendanceDate: TODAY_UTC_MIDNIGHT,
      checkedInAt: NOW,
      latitude: 10.0001,
      longitude: 106.0001,
      accuracy: 15,
      resolvedAddress: 'Địa chỉ test',
      companyLatitude: 10.0,
      companyLongitude: 106.0,
      allowedRadius: 100,
      distanceFromCompany: 15,
      status: 'valid',
      ipAddress: '203.0.113.5',
      userAgent: CHROME_WINDOWS_UA,
      device: 'Máy tính',
      operatingSystem: 'Windows',
      browser: 'Chrome 126.0.0.0',
      createdAt: NOW,
      ...overrides,
    });

    it('9) Admin xem được toàn bộ, ĐẦY ĐỦ chi tiết GPS/IP/thiết bị của người khác (Mục 10)', async () => {
      prisma.account.findMany.mockResolvedValue([
        teamMember('sale-1'),
        teamMember('sale-2'),
      ]);
      prisma.checkinRecord.findMany.mockResolvedValue([
        fullCheckinRecord('sale-1'),
      ]);

      const result = await service.listRecords({ date: '2026-07-15' }, admin);

      expect(result.employees).toHaveLength(2);
      const row = result.employees.find((e) => e.account_id === 'sale-1');
      expect(row?.checkin?.latitude).toBe(10.0001);
      expect(row?.checkin?.ip_address).toBe('203.0.113.5');
    });

    it('10) Leader xem đồng đội KHÁC trong nhóm -> GPS/IP/thiết bị bị ẩn (null), nhưng vẫn thấy trạng thái/khoảng cách/giờ', async () => {
      prisma.account.findMany.mockResolvedValue([teamMember('sale-1')]);
      prisma.checkinRecord.findMany.mockResolvedValue([
        fullCheckinRecord('sale-1'),
      ]);

      const result = await service.listRecords({ date: '2026-07-15' }, leader);

      const row = result.employees[0];
      expect(row.checkin?.latitude).toBeNull();
      expect(row.checkin?.ip_address).toBeNull();
      expect(row.checkin?.user_agent).toBeNull();
      expect(row.checkin?.status).toBe('valid');
      expect(row.checkin?.distance_from_company_meters).toBe(15);
    });

    it('11) Leader xem CHÍNH MÌNH -> vẫn thấy đầy đủ chi tiết (không tự ẩn dữ liệu của chính mình)', async () => {
      prisma.account.findMany.mockResolvedValue([
        teamMember('leader-1', { role: 'leader' }),
      ]);
      prisma.checkinRecord.findMany.mockResolvedValue([
        fullCheckinRecord('leader-1'),
      ]);

      const result = await service.listRecords({ date: '2026-07-15' }, leader);

      expect(result.employees[0].checkin?.latitude).toBe(10.0001);
      expect(result.employees[0].checkin?.ip_address).toBe('203.0.113.5');
    });

    it('12) Leader thử xem người NGOÀI nhóm (query.account_id) -> danh sách rỗng, không rò rỉ (kịch bản 8, Mục 13)', async () => {
      prisma.account.findMany.mockResolvedValue([]);

      const result = await service.listRecords(
        { date: '2026-07-15', account_id: 'sale-ngoai-nhom' },
        leader,
      );

      expect(result.employees).toHaveLength(0);
    });

    it('13) Nhân viên (sale) chỉ xem được chính mình', async () => {
      await service.listRecords({ date: '2026-07-15' }, sale);

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-1', role: { in: ['leader', 'mkt', 'sale'] } },
        }),
      );
    });

    it('14) Lọc trạng thái "not_checked_in" -> chỉ trả nhân viên CHƯA có bản ghi ngày đó', async () => {
      prisma.account.findMany.mockResolvedValue([
        teamMember('sale-1'),
        teamMember('sale-2'),
      ]);
      prisma.checkinRecord.findMany.mockResolvedValue([
        fullCheckinRecord('sale-1'),
      ]);

      const result = await service.listRecords(
        { date: '2026-07-15', status_filter: 'not_checked_in' },
        admin,
      );

      expect(result.employees).toHaveLength(1);
      expect(result.employees[0].account_id).toBe('sale-2');
    });

    it('15) Lọc trạng thái "outside_company" -> chỉ trả bản ghi đúng trạng thái đó', async () => {
      prisma.account.findMany.mockResolvedValue([
        teamMember('sale-1'),
        teamMember('sale-2'),
      ]);
      prisma.checkinRecord.findMany.mockResolvedValue([
        fullCheckinRecord('sale-1', { status: 'outside_company' }),
        fullCheckinRecord('sale-2', { status: 'valid' }),
      ]);

      const result = await service.listRecords(
        { date: '2026-07-15', status_filter: 'outside_company' },
        admin,
      );

      expect(result.employees).toHaveLength(1);
      expect(result.employees[0].account_id).toBe('sale-1');
    });

    it('16) Không phân trang — trả toàn bộ nhân viên trong phạm vi 1 lần (yêu cầu trực tiếp người dùng: quy mô chỉ vài chục nhân viên/ngày)', async () => {
      prisma.account.findMany.mockResolvedValue([
        teamMember('sale-1'),
        teamMember('sale-2'),
        teamMember('sale-3'),
      ]);

      const result = await service.listRecords({ date: '2026-07-15' }, admin);
      expect(result.employees).toHaveLength(3);
      expect(result).not.toHaveProperty('total');
      expect(result).not.toHaveProperty('page');
    });
  });

  describe('company location config (Mục 7)', () => {
    it('16) Chỉ Admin xem/sửa được cấu hình vị trí công ty', async () => {
      await expect(service.getCompanyLocation(sale)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getCompanyLocation(manager)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getCompanyLocation(admin)).resolves.toBeDefined();

      const dto = {
        address: 'Địa chỉ mới',
        latitude: 10.1,
        longitude: 106.1,
        allowed_radius_meters: 150,
      };
      await expect(service.updateCompanyLocation(dto, leader)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('preview()', () => {
    it('17) Thiếu User-Agent -> preview cũng trả "needs_verification" (nhất quán với checkin())', async () => {
      const result = await service.preview(
        createDto({ latitude: 10.0001, longitude: 106.0001 }),
        sale,
        undefined,
      );
      expect(result.status).toBe('needs_verification');
    });
  });

  describe('updateCompanyLocation() — ghi audit log (Mục 9)', () => {
    it('18) Đổi cấu hình vị trí công ty được ghi audit log "update"', async () => {
      prisma.companyLocationConfig.update.mockResolvedValue({
        ...COMPANY_LOCATION,
        address: 'Địa chỉ sửa',
      });

      await service.updateCompanyLocation(
        {
          address: 'Địa chỉ sửa',
          latitude: 10.2,
          longitude: 106.2,
          allowed_radius_meters: 200,
        },
        admin,
      );

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          entityType: 'company_location_config',
        }),
      );
    });
  });

  describe('reset() — Mục 8 (Admin Reset)', () => {
    const activeRecord = {
      id: 'rec-active',
      accountId: 'sale-1',
      attendanceDate: TODAY_UTC_MIDNIGHT,
      isVoided: false,
    };

    it('19) Admin Reset kèm lý do -> đánh dấu is_voided=true, KHÔNG xóa cứng, ghi audit log đầy đủ (kịch bản 7, Mục 13)', async () => {
      prisma.checkinRecord.findUnique.mockResolvedValue(activeRecord);

      const result = await service.reset(
        'rec-active',
        'Nhân viên báo mất GPS, cần chấm lại',
        admin,
      );

      expect(result).toEqual({ success: true });
      expect(prisma.checkinRecord.update).toHaveBeenCalledWith({
        where: { id: 'rec-active' },
        data: expect.objectContaining({
          isVoided: true,
          voidedById: 'admin-1',
          voidReason: 'Nhân viên báo mất GPS, cần chấm lại',
        }),
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'admin-1',
          actionType: 'update',
          entityType: 'checkin_record',
          entityId: 'rec-active',
        }),
      );
      // KHÔNG có lệnh xóa nào được gọi — bản ghi cũ vẫn còn lại làm lịch sử.
      expect(prisma.checkinRecord.create).not.toHaveBeenCalled();
    });

    it('20) Leader/Nhân viên KHÔNG được tự Reset (Mục 8: "Không cho Leader hoặc nhân viên tự Reset")', async () => {
      await expect(
        service.reset('rec-active', 'lý do', leader),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.reset('rec-active', 'lý do', sale)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.checkinRecord.update).not.toHaveBeenCalled();
    });

    it('21) Reset bản ghi không tồn tại hoặc đã bị voided trước đó -> NotFoundException', async () => {
      prisma.checkinRecord.findUnique.mockResolvedValue(null);
      await expect(
        service.reset('rec-khong-ton-tai', 'lý do', admin),
      ).rejects.toThrow(NotFoundException);

      prisma.checkinRecord.findUnique.mockResolvedValue({
        ...activeRecord,
        isVoided: true,
      });
      await expect(service.reset('rec-active', 'lý do', admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('22) Sau khi Reset, nhân viên Check in lại được trong ngày (checkin() không còn thấy bản ghi active cũ)', async () => {
      // Mô phỏng: sau Reset, findFirst({isVoided:false}) không tìm thấy gì nữa.
      prisma.checkinRecord.findFirst.mockResolvedValue(null);
      prisma.checkinRecord.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'rec-new-after-reset', ...data, createdAt: NOW }),
      );

      const result = await service.checkin(
        createDto({ latitude: 10.0001, longitude: 106.0001 }),
        sale,
        '1.2.3.4',
        CHROME_WINDOWS_UA,
      );

      expect(result.id).toBe('rec-new-after-reset');
    });
  });
});
