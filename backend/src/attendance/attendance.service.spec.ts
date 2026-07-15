import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: {
    account: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    attendanceRecord: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let auditLog: { log: jest.Mock };

  const adminUser = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };
  const managerUser = {
    id: 'manager-1',
    role: 'manager' as const,
    sessionId: 's',
  };
  const leaderUser = {
    id: 'leader-1',
    role: 'leader' as const,
    sessionId: 's',
  };
  const saleUser = { id: 'sale-1', role: 'sale' as const, sessionId: 's' };
  const mktUser = { id: 'mkt-1', role: 'mkt' as const, sessionId: 's' };

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(AttendanceService);
  });

  describe('getGrid — sinh đúng số ngày/thứ trong tháng (Mục 1/10/12)', () => {
    it('1) Tháng 31 ngày (tháng 7/2026) → 31 cột, ngày 1 là "T4"', async () => {
      const grid = await service.getGrid({ year: 2026, month: 7 }, adminUser);
      expect(grid.days).toHaveLength(31);
      expect(grid.days[0]).toEqual({
        date: '2026-07-01',
        day: 1,
        weekday_label: 'T4',
        is_sunday: false,
      });
      expect(grid.days[30].date).toBe('2026-07-31');
    });

    it('2) Tháng 30 ngày (tháng 6/2026) → 30 cột', async () => {
      const grid = await service.getGrid({ year: 2026, month: 6 }, adminUser);
      expect(grid.days).toHaveLength(30);
    });

    it('3) Tháng 2 năm thường (2026, không nhuận) → 28 cột', async () => {
      const grid = await service.getGrid({ year: 2026, month: 2 }, adminUser);
      expect(grid.days).toHaveLength(28);
    });

    it('4) Tháng 2 năm nhuận (2028) → 29 cột', async () => {
      const grid = await service.getGrid({ year: 2028, month: 2 }, adminUser);
      expect(grid.days).toHaveLength(29);
    });

    it('5) Chủ nhật được đánh dấu is_sunday=true đúng ngày (2026-07-05 là Chủ nhật)', async () => {
      const grid = await service.getGrid({ year: 2026, month: 7 }, adminUser);
      const sunday = grid.days.find((d) => d.date === '2026-07-05');
      expect(sunday).toMatchObject({ weekday_label: 'CN', is_sunday: true });
      const nonSunday = grid.days.find((d) => d.date === '2026-07-06');
      expect(nonSunday).toMatchObject({ is_sunday: false });
    });
  });

  describe('getGrid — phạm vi theo vai trò (Mục 3/8)', () => {
    it('6) Sale chỉ thấy chính mình, bỏ qua team_id/account_id truyền vào', async () => {
      await service.getGrid(
        { year: 2026, month: 7, team_id: 'other-team', account_id: 'other-1' },
        saleUser,
      );
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-1', role: { in: ['leader', 'mkt', 'sale'] } },
        }),
      );
    });

    it('7) MKT cũng chỉ thấy chính mình', async () => {
      await service.getGrid({ year: 2026, month: 7 }, mktUser);
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mkt-1', role: { in: ['leader', 'mkt', 'sale'] } },
        }),
      );
    });

    it('8) Leader bị ép về đúng nhóm mình, bỏ qua team_id truyền vào', async () => {
      prisma.account.findUnique.mockResolvedValueOnce({ teamId: 'team-A' });
      await service.getGrid(
        { year: 2026, month: 7, team_id: 'team-B' },
        leaderUser,
      );
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teamId: 'team-A',
            role: { in: ['leader', 'mkt', 'sale'] },
          }),
        }),
      );
    });

    it('9) Admin/Quản lý lọc tự do theo team_id/account_id', async () => {
      await service.getGrid(
        { year: 2026, month: 7, team_id: 'team-X', account_id: 'acc-1' },
        managerUser,
      );
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teamId: 'team-X',
            id: 'acc-1',
          }),
        }),
      );
    });

    it('10) Mặc định ẩn tài khoản inactive; include_inactive=true thì không lọc status', async () => {
      await service.getGrid({ year: 2026, month: 7 }, adminUser);
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );

      await service.getGrid(
        { year: 2026, month: 7, include_inactive: true },
        adminUser,
      );
      const lastCallWhere = prisma.account.findMany.mock.calls[1][0].where;
      expect(lastCallWhere.status).toBeUndefined();
    });

    it('11) can_edit=true cho Admin/Quản lý/Leader, false cho Sale/MKT', async () => {
      const adminGrid = await service.getGrid(
        { year: 2026, month: 7 },
        adminUser,
      );
      expect(adminGrid.can_edit).toBe(true);
      const saleGrid = await service.getGrid(
        { year: 2026, month: 7 },
        saleUser,
      );
      expect(saleGrid.can_edit).toBe(false);
    });
  });

  describe('bulkSave — Mục 2/7/11', () => {
    const cell = {
      account_id: 'sale-1',
      date: '2026-07-14',
      status: 'present' as const,
    };

    beforeEach(() => {
      prisma.attendanceRecord.upsert.mockResolvedValue({
        id: 'rec-1',
        status: 'present',
        note: null,
      });
    });

    it('12) Sale/MKT không có quyền lưu chấm công → ForbiddenException', async () => {
      await expect(
        service.bulkSave({ upserts: [cell], deletes: [] }, saleUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.bulkSave({ upserts: [cell], deletes: [] }, mktUser),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
    });

    it('13) Leader lưu công cho nhân viên NGOÀI nhóm mình → ForbiddenException', async () => {
      prisma.account.findUnique.mockResolvedValueOnce({ teamId: 'team-A' });
      prisma.account.findMany.mockResolvedValueOnce([]); // không ai thuộc phạm vi
      await expect(
        service.bulkSave({ upserts: [cell], deletes: [] }, leaderUser),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
    });

    it('14) Admin lưu thành công → gọi upsert đúng khóa (account_id, date), ghi audit log', async () => {
      prisma.account.findMany.mockResolvedValueOnce([{ id: 'sale-1' }]);
      const result = await service.bulkSave(
        { upserts: [cell], deletes: [] },
        adminUser,
      );
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId_date: {
              accountId: 'sale-1',
              date: new Date('2026-07-14T00:00:00.000Z'),
            },
          },
          create: expect.objectContaining({
            status: 'present',
            createdById: 'admin-1',
            updatedById: 'admin-1',
          }),
          update: expect.objectContaining({
            status: 'present',
            updatedById: 'admin-1',
          }),
        }),
      );
      expect(result).toEqual({ saved: 1, deleted: 0 });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          entityType: 'attendance_record',
          entityId: 'rec-1',
        }),
      );
    });

    it('15) Xóa ô (trả về trống) → gọi deleteMany, ghi audit log actionType=delete', async () => {
      prisma.account.findMany.mockResolvedValueOnce([{ id: 'sale-1' }]);
      const result = await service.bulkSave(
        {
          upserts: [],
          deletes: [{ account_id: 'sale-1', date: '2026-07-14' }],
        },
        adminUser,
      );
      expect(prisma.attendanceRecord.deleteMany).toHaveBeenCalledWith({
        where: {
          accountId: 'sale-1',
          date: new Date('2026-07-14T00:00:00.000Z'),
        },
      });
      expect(result).toEqual({ saved: 0, deleted: 1 });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'delete' }),
      );
    });

    it('16) Leader lưu công cho đúng nhân viên trong nhóm mình → thành công', async () => {
      prisma.account.findUnique.mockResolvedValueOnce({ teamId: 'team-A' });
      prisma.account.findMany.mockResolvedValueOnce([{ id: 'sale-1' }]);
      const result = await service.bulkSave(
        { upserts: [cell], deletes: [] },
        leaderUser,
      );
      expect(result).toEqual({ saved: 1, deleted: 0 });
    });
  });

  describe('bulkSave — trừ/chặn NP theo số dư phép ("tick NP thì trừ 1 ngày, hết phép thì không tick được nữa")', () => {
    const npCell = {
      account_id: 'sale-1',
      date: '2026-07-14',
      status: 'paid_leave' as const,
    };

    beforeEach(() => {
      prisma.attendanceRecord.upsert.mockResolvedValue({
        id: 'rec-1',
        status: 'paid_leave',
        note: null,
      });
    });

    it('24) Đặt NP mới cho nhân viên đủ phép (còn 2) → trừ 1, còn lại 1, ghi audit log remaining_leave_days', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-1', fullName: 'Sale One', remainingLeaveDays: 2 },
      ]);
      const result = await service.bulkSave(
        { upserts: [npCell], deletes: [] },
        adminUser,
      );
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'sale-1' },
        data: { remainingLeaveDays: 1 },
      });
      expect(result).toEqual({ saved: 1, deleted: 0 });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'account',
          fieldChanged: 'remaining_leave_days',
          oldValue: '2',
          newValue: '1',
        }),
      );
    });

    it('25) Nhân viên hết phép (còn 0) → ForbiddenException, KHÔNG lưu ô nào (kể cả ô hợp lệ khác trong cùng lô)', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-1', fullName: 'Sale One', remainingLeaveDays: 0 },
      ]);
      const otherCell = {
        account_id: 'sale-1',
        date: '2026-07-15',
        status: 'present' as const,
      };
      await expect(
        service.bulkSave(
          { upserts: [npCell, otherCell], deletes: [] },
          adminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it('26) remaining_leave_days = null (Admin chưa đặt số ban đầu) → coi như 0 → chặn NP', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-1', fullName: 'Sale One', remainingLeaveDays: null },
      ]);
      await expect(
        service.bulkSave({ upserts: [npCell], deletes: [] }, adminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('27) Xóa 1 ô đang là NP → hoàn lại 1 ngày phép (balance tăng)', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        {
          accountId: 'sale-1',
          date: new Date('2026-07-14T00:00:00.000Z'),
          status: 'paid_leave',
        },
      ]);
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-1', fullName: 'Sale One', remainingLeaveDays: 1 },
      ]);
      const result = await service.bulkSave(
        {
          upserts: [],
          deletes: [{ account_id: 'sale-1', date: '2026-07-14' }],
        },
        adminUser,
      );
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'sale-1' },
        data: { remainingLeaveDays: 2 },
      });
      expect(result).toEqual({ saved: 0, deleted: 1 });
    });

    it('28) Đổi 1 ô từ NP sang trạng thái khác (present) → hoàn lại 1 ngày phép', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        {
          accountId: 'sale-1',
          date: new Date('2026-07-14T00:00:00.000Z'),
          status: 'paid_leave',
        },
      ]);
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-1', fullName: 'Sale One', remainingLeaveDays: 0 },
      ]);
      prisma.attendanceRecord.upsert.mockResolvedValue({
        id: 'rec-1',
        status: 'present',
        note: null,
      });
      await service.bulkSave(
        {
          upserts: [{ ...npCell, status: 'present' }],
          deletes: [],
        },
        adminUser,
      );
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'sale-1' },
        data: { remainingLeaveDays: 1 },
      });
    });

    it('29) Đặt nhiều ô NP cùng lúc cho 1 nhân viên trong 1 lô → trừ đúng TỔNG, vượt số dư thì chặn cả lô', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-1', fullName: 'Sale One', remainingLeaveDays: 1 },
      ]);
      const npCell2 = { ...npCell, date: '2026-07-15' };
      await expect(
        service.bulkSave(
          { upserts: [npCell, npCell2], deletes: [] },
          adminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
    });

    it('30) Đổi ô đã là NP nhưng vẫn giữ nguyên NP (re-save cùng giá trị) → không trừ thêm, không gọi account.update', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        {
          accountId: 'sale-1',
          date: new Date('2026-07-14T00:00:00.000Z'),
          status: 'paid_leave',
        },
      ]);
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-1', fullName: 'Sale One', remainingLeaveDays: 3 },
      ]);
      await service.bulkSave(
        { upserts: [{ ...npCell, note: 'ghi chú mới' }], deletes: [] },
        adminUser,
      );
      expect(prisma.account.update).not.toHaveBeenCalled();
    });
  });

  describe('exportXlsx — Mục "tải xuống Excel cho bảng chấm công"', () => {
    it('17) Trả về file .xlsx hợp lệ (magic bytes PK) đúng tên file theo tháng/năm', async () => {
      prisma.account.findMany.mockResolvedValueOnce([
        {
          id: 'sale-1',
          fullName: 'Sale One',
          avatarUrl: null,
          role: 'sale',
          teamId: 'team-1',
          status: 'active',
          team: { id: 'team-1', name: 'Nhóm 1' },
        },
      ]);
      const { buffer, filename } = await service.exportXlsx(
        { year: 2026, month: 7 },
        adminUser,
      );
      // File .xlsx thực chất là 1 file ZIP — 2 byte đầu luôn là "PK" (0x50 0x4B).
      expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK');
      expect(filename).toBe('cham-cong-thang-7-2026.xlsx');
    });

    it('18) Nội dung Excel khớp đúng dữ liệu chấm công: header 2 hàng, ký hiệu ✓, Tổng công đúng', async () => {
      prisma.account.findMany.mockResolvedValueOnce([
        {
          id: 'sale-1',
          fullName: 'Sale One',
          avatarUrl: null,
          role: 'sale',
          teamId: 'team-1',
          status: 'active',
          team: { id: 'team-1', name: 'Nhóm 1' },
        },
      ]);
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        {
          accountId: 'sale-1',
          date: new Date('2026-07-01T00:00:00.000Z'),
          status: 'present',
          note: null,
          updatedAt: new Date(),
        },
        {
          accountId: 'sale-1',
          date: new Date('2026-07-02T00:00:00.000Z'),
          status: 'half',
          note: null,
          updatedAt: new Date(),
        },
      ]);
      const { buffer } = await service.exportXlsx(
        { year: 2026, month: 7 },
        adminUser,
      );

      // Đọc lại chính file vừa tạo — xác nhận nội dung thật, không chỉ tin cấu trúc code.
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.getCell(1, 1).value).toBe('STT');
      expect(sheet.getCell(1, 2).value).toBe('Họ và tên');
      expect(sheet.getCell(1, 3).value).toBe('Vị trí');
      expect(sheet.getCell(1, 4).value).toBe('01');
      expect(sheet.getCell(2, 4).value).toBe('T4');

      const dataRow = 3; // hàng dữ liệu đầu tiên (sau 2 hàng tiêu đề)
      expect(sheet.getCell(dataRow, 2).value).toBe('Sale One');
      expect(sheet.getCell(dataRow, 3).value).toBe('Sale');
      expect(sheet.getCell(dataRow, 4).value).toBe('✓'); // 01/07 = present
      expect(sheet.getCell(dataRow, 5).value).toBe('½'); // 02/07 = half
      const totalColumn = 3 + 31 + 1;
      expect(sheet.getCell(dataRow, totalColumn).value).toBe(1.5); // 1 + 0.5
    });

    it('19) "Vị trí" ưu tiên position tùy chỉnh thay vì nhãn vai trò mặc định', async () => {
      prisma.account.findMany.mockResolvedValueOnce([
        {
          id: 'sale-1',
          fullName: 'Sale One',
          avatarUrl: null,
          role: 'sale',
          position: 'Trưởng nhóm khu vực A',
          teamId: 'team-1',
          status: 'active',
          team: { id: 'team-1', name: 'Nhóm 1' },
        },
      ]);
      const { buffer } = await service.exportXlsx(
        { year: 2026, month: 7 },
        adminUser,
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      expect(sheet.getCell(3, 3).value).toBe('Trưởng nhóm khu vực A');
    });
  });

  describe('updateEmployeePosition — "sửa tay tên các vị trí"', () => {
    it('20) Sale/MKT không có quyền sửa vị trí → ForbiddenException', async () => {
      await expect(
        service.updateEmployeePosition('sale-1', 'Vị trí mới', saleUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateEmployeePosition('mkt-1', 'Vị trí mới', mktUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('21) Leader sửa vị trí nhân viên NGOÀI nhóm mình → ForbiddenException', async () => {
      prisma.account.findUnique.mockResolvedValueOnce({ teamId: 'team-A' });
      prisma.account.findMany.mockResolvedValueOnce([]); // không ai thuộc phạm vi
      await expect(
        service.updateEmployeePosition('sale-1', 'Vị trí mới', leaderUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('22) Admin sửa thành công → lưu đúng chuỗi đã trim, ghi audit log', async () => {
      prisma.account.findMany.mockResolvedValueOnce([{ id: 'sale-1' }]);
      prisma.account.update.mockResolvedValueOnce({
        id: 'sale-1',
        position: 'Trưởng nhóm khu vực A',
      });
      const result = await service.updateEmployeePosition(
        'sale-1',
        '  Trưởng nhóm khu vực A  ',
        adminUser,
      );
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'sale-1' },
        data: { position: 'Trưởng nhóm khu vực A' },
        select: { id: true, position: true },
      });
      expect(result).toEqual({
        account_id: 'sale-1',
        position: 'Trưởng nhóm khu vực A',
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'update',
          entityType: 'account',
          fieldChanged: 'position',
        }),
      );
    });

    it('23) Chuỗi rỗng/toàn khoảng trắng → lưu null (xóa, quay về nhãn vai trò mặc định)', async () => {
      prisma.account.findMany.mockResolvedValueOnce([{ id: 'sale-1' }]);
      prisma.account.update.mockResolvedValueOnce({
        id: 'sale-1',
        position: null,
      });
      const result = await service.updateEmployeePosition(
        'sale-1',
        '   ',
        adminUser,
      );
      expect(prisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { position: null } }),
      );
      expect(result).toEqual({ account_id: 'sale-1', position: null });
    });
  });
});
