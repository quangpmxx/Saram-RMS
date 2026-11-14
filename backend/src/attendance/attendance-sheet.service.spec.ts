import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AttendanceSheetService,
  summarizeSheet,
} from './attendance-sheet.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

function user(id: string, role: string): AuthenticatedUser {
  return { id, role } as unknown as AuthenticatedUser;
}

describe('AttendanceSheetService', () => {
  const admin = user('admin-1', 'manager');
  const staff = user('staff-1', 'sale');
  let prisma: Record<string, Record<string, jest.Mock> | jest.Mock>;
  let service: AttendanceSheetService;

  beforeEach(() => {
    prisma = {
      account: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ fullName: 'NV A' }),
      },
      attendanceSheet: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn().mockReturnValue('upsert'),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'n1', sender: null }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const realtime = { emitNotificationCreated: jest.fn() };
    service = new AttendanceSheetService(prisma as never, realtime as never);
  });

  it('tính tổng công khớp bảng lương (½ = 0,5; công hưởng lương = đi làm + NP + L)', () => {
    const s = summarizeSheet(2026, 10, [
      'present',
      'present',
      'half',
      'paid_leave',
      'holiday',
      'unpaid_leave',
    ]);
    expect(s.standard).toBe(27);
    expect(s.worked).toBe(2.5);
    expect(s.paid_total).toBe(4.5);
    expect(s.unpaid_leave).toBe(1);
  });

  it('không có quyền Sửa bảng chấm công thì không gửi được', async () => {
    await expect(
      service.send({ year: 2026, month: 10 }, staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('không gửi được bảng công tháng chưa tới', async () => {
    await expect(
      service.send({ year: 2099, month: 1 }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('gửi chung: chỉ gửi người chưa được gửi tháng đó + báo chuông', async () => {
    (prisma.account as Record<string, jest.Mock>).findMany.mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
    ]);
    const res = await service.send({ year: 2026, month: 10 }, admin);
    expect(res.sent).toBe(2);
    const where = (prisma.account as Record<string, jest.Mock>).findMany.mock
      .calls[0][0].where;
    expect(where.attendanceSheets).toEqual({
      none: { year: 2026, month: 10 },
    });
    expect(
      (prisma.notification as Record<string, jest.Mock>).create,
    ).toHaveBeenCalled();
  });

  it('gửi lại cho người ngoài phạm vi bị chặn', async () => {
    (prisma.account as Record<string, jest.Mock>).findMany.mockResolvedValue(
      [],
    );
    await expect(
      service.send(
        {
          year: 2026,
          month: 10,
          account_ids: ['11111111-1111-4111-8111-111111111111'],
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('báo sai phải chọn ít nhất 1 ngày', async () => {
    (
      prisma.attendanceSheet as Record<string, jest.Mock>
    ).findUnique.mockResolvedValue({
      id: 's1',
      status: 'pending',
      sentById: 'admin-1',
    });
    await expect(
      service.respond(
        { year: 2026, month: 10, action: 'dispute', days: [] },
        staff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('báo sai: lưu ngày + báo người gửi', async () => {
    (
      prisma.attendanceSheet as Record<string, jest.Mock>
    ).findUnique.mockResolvedValue({
      id: 's1',
      status: 'pending',
      sentById: 'admin-1',
    });
    await service.respond(
      {
        year: 2026,
        month: 10,
        action: 'dispute',
        note: 'Ngày 22 em đi làm',
        days: [
          { date: '2026-10-22', expected: 'present' },
          { date: '2026-11-01', expected: 'present' },
        ],
      },
      staff,
    );
    const data = (prisma.attendanceSheet as Record<string, jest.Mock>)
      .updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('disputed');
    expect(data.disputedDays).toEqual([
      { date: '2026-10-22', expected: 'present' },
    ]);
    const n = (prisma.notification as Record<string, jest.Mock>).create.mock
      .calls[0][0].data;
    expect(n.accountId).toBe('admin-1');
  });

  it('đã đồng ý thì không đổi được nữa', async () => {
    (
      prisma.attendanceSheet as Record<string, jest.Mock>
    ).findUnique.mockResolvedValue({
      id: 's1',
      status: 'confirmed',
      sentById: 'admin-1',
    });
    await expect(
      service.respond({ year: 2026, month: 10, action: 'confirm' }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
