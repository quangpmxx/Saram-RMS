import { Test } from '@nestjs/testing';
import { BirthdayService } from './birthday.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

describe('BirthdayService — "Giao diện chúc mừng sinh nhật nhân viên" (2026-07-16)', () => {
  let service: BirthdayService;
  let prisma: { account: { findMany: jest.Mock } };

  // 10:00 giờ VN (03:00 UTC) ngày 15/07/2026 (không nhuận) — cùng ngày ở cả UTC lẫn Asia/Ho_Chi_Minh.
  const NOW = new Date('2026-07-15T03:00:00.000Z');

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    role: 'admin',
    sessionId: 's1',
  };
  const sale: AuthenticatedUser = {
    id: 'sale-1',
    role: 'sale',
    sessionId: 's2',
  };

  function account(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'acc-1',
      fullName: 'Nguyễn Văn A',
      avatarUrl: null,
      role: 'sale',
      position: null,
      dateOfBirth: new Date('1995-07-15'),
      team: { name: 'Nhóm 1' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    prisma = { account: { findMany: jest.fn().mockResolvedValue([]) } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BirthdayService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(BirthdayService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1) Đúng 1 nhân viên sinh nhật hôm nay -> trả về đúng người đó, không lộ năm sinh/tuổi', async () => {
    prisma.account.findMany.mockResolvedValue([account()]);

    const result = await service.listToday({}, sale);

    expect(result.date).toBe('07-15');
    expect(result.is_preview).toBe(false);
    expect(result.employees).toEqual([
      {
        account_id: 'acc-1',
        full_name: 'Nguyễn Văn A',
        avatar_url: null,
        role: 'sale',
        position: null,
        team_name: 'Nhóm 1',
      },
    ]);
    // Không có field nào chứa ngày sinh/năm sinh/tuổi trong response.
    expect(JSON.stringify(result)).not.toMatch(/1995|date_of_birth|age/i);
  });

  it('2) Nhiều nhân viên cùng sinh nhật hôm nay -> trả về ĐỦ tất cả, không bỏ sót', async () => {
    prisma.account.findMany.mockResolvedValue([
      account({ id: 'acc-1', fullName: 'Người A' }),
      account({
        id: 'acc-2',
        fullName: 'Người B',
        dateOfBirth: new Date('1990-07-15'),
      }),
      account({
        id: 'acc-3',
        fullName: 'Người C (khác ngày)',
        dateOfBirth: new Date('1990-08-01'),
      }),
    ]);

    const result = await service.listToday({}, sale);

    expect(result.employees.map((e) => e.account_id).sort()).toEqual([
      'acc-1',
      'acc-2',
    ]);
  });

  it('3) Không ai sinh nhật hôm nay -> danh sách rỗng', async () => {
    prisma.account.findMany.mockResolvedValue([
      account({ dateOfBirth: new Date('1990-01-01') }),
    ]);

    const result = await service.listToday({}, sale);

    expect(result.employees).toEqual([]);
  });

  it('4) Thiếu avatar -> vẫn trả về, avatar_url=null (không lỗi)', async () => {
    prisma.account.findMany.mockResolvedValue([account({ avatarUrl: null })]);

    const result = await service.listToday({}, sale);

    expect(result.employees[0].avatar_url).toBeNull();
  });

  it('Mục 1: tài khoản inactive KHÔNG được tính dù trùng ngày sinh (where đã lọc status=active ở tầng query)', async () => {
    // Service luôn where:{status:'active'} — kiểm tra đúng where đã gửi.
    prisma.account.findMany.mockResolvedValue([]);
    await service.listToday({}, sale);

    expect(prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'active' } }),
    );
  });

  it('Mục 1: ngày sinh null (thiếu dữ liệu) -> bỏ qua tài khoản đó, không lỗi', async () => {
    prisma.account.findMany.mockResolvedValue([account({ dateOfBirth: null })]);

    const result = await service.listToday({}, sale);

    expect(result.employees).toEqual([]);
  });

  describe('Mục 1 — quy tắc 29/02', () => {
    it('5a) Năm nhuận (2026 không nhuận -> test riêng năm nhuận 2028), hôm nay 29/02, nhân viên sinh 29/02 -> khớp đúng ngày', async () => {
      jest.setSystemTime(new Date('2028-02-29T03:00:00.000Z')); // 2028 là năm nhuận
      prisma.account.findMany.mockResolvedValue([
        account({ dateOfBirth: new Date('1996-02-29') }),
      ]);

      const result = await service.listToday({}, sale);

      expect(result.date).toBe('02-29');
      expect(result.employees).toHaveLength(1);
    });

    it('5b) Năm KHÔNG nhuận, hôm nay 28/02, nhân viên sinh 29/02 -> vẫn khớp (quy tắc dự phòng dùng 28/02)', async () => {
      jest.setSystemTime(new Date('2026-02-28T03:00:00.000Z')); // 2026 không nhuận
      prisma.account.findMany.mockResolvedValue([
        account({ dateOfBirth: new Date('1996-02-29') }),
      ]);

      const result = await service.listToday({}, sale);

      expect(result.employees).toHaveLength(1);
    });

    it('5c) Năm KHÔNG nhuận, hôm nay 01/03, nhân viên sinh 29/02 -> KHÔNG khớp (không tính bù sang 1/3)', async () => {
      jest.setSystemTime(new Date('2026-03-01T03:00:00.000Z'));
      prisma.account.findMany.mockResolvedValue([
        account({ dateOfBirth: new Date('1996-02-29') }),
      ]);

      const result = await service.listToday({}, sale);

      expect(result.employees).toEqual([]);
    });
  });

  describe('Mục 11 — chế độ xem thử', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('Admin + development + simulated_date -> đổi "hôm nay" theo ngày giả lập, is_preview=true', async () => {
      process.env.NODE_ENV = 'development';
      prisma.account.findMany.mockResolvedValue([
        account({ id: 'acc-9', dateOfBirth: new Date('1988-12-25') }),
      ]);

      const result = await service.listToday(
        { simulated_date: '12-25' },
        admin,
      );

      expect(result.date).toBe('12-25');
      expect(result.is_preview).toBe(true);
      expect(result.employees.map((e) => e.account_id)).toEqual(['acc-9']);
    });

    it('Admin + development + force_account_id -> ép 1 tài khoản xuất hiện dù ngày sinh không khớp hôm nay', async () => {
      process.env.NODE_ENV = 'development';
      prisma.account.findMany.mockResolvedValue([
        account({
          id: 'acc-9',
          fullName: 'Bị ép sinh nhật',
          dateOfBirth: new Date('1988-01-01'),
        }),
      ]);

      const result = await service.listToday(
        { force_account_id: 'acc-9' },
        admin,
      );

      expect(result.is_preview).toBe(true);
      expect(result.employees.map((e) => e.account_id)).toEqual(['acc-9']);
    });

    it('Sale (không phải Admin) gửi kèm simulated_date -> ÂM THẦM bỏ qua, dùng đúng ngày thật', async () => {
      process.env.NODE_ENV = 'development';
      prisma.account.findMany.mockResolvedValue([account()]); // sinh 07-15, khớp NOW thật

      const result = await service.listToday({ simulated_date: '12-25' }, sale);

      expect(result.date).toBe('07-15');
      expect(result.is_preview).toBe(false);
      expect(result.employees).toHaveLength(1);
    });

    it('Admin nhưng đang production -> ÂM THẦM bỏ qua simulated_date/force_account_id, KHÔNG ảnh hưởng người dùng khác', async () => {
      process.env.NODE_ENV = 'production';
      prisma.account.findMany.mockResolvedValue([account()]); // sinh 07-15, khớp NOW thật

      const result = await service.listToday(
        { simulated_date: '12-25', force_account_id: 'acc-999' },
        admin,
      );

      expect(result.date).toBe('07-15');
      expect(result.is_preview).toBe(false);
      expect(result.employees.map((e) => e.account_id)).toEqual(['acc-1']);
    });
  });
});
