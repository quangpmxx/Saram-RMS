import {
  ShuttleSheetService,
  pickCurrentMonthTab,
} from './shuttle-sheet.service';
import { extractSpreadsheetId } from './google-sheets.client';
import { stripTrailingPhone } from './shuttle-import.util';
import type { ParsedRow } from './shuttle-import.service';

describe('pickCurrentMonthTab', () => {
  const tabs = ['T10.2026', 'T11.2026', 'Bản sao của T7.2026', 'Trang tính8'];
  it('chọn tab của tháng hiện tại theo giờ VN', () => {
    expect(pickCurrentMonthTab(tabs, new Date('2026-11-10T03:00:00Z'))).toBe(
      'T11.2026',
    );
    // 31/10 18:00 UTC = 01/11 01:00 giờ VN
    expect(pickCurrentMonthTab(tabs, new Date('2026-10-31T18:00:00Z'))).toBe(
      'T11.2026',
    );
  });
  it('không có tab tháng này → null (người dùng tự chọn), không nhận tab "Bản sao"', () => {
    expect(pickCurrentMonthTab(tabs, new Date('2026-07-10T03:00:00Z'))).toBe(
      null,
    );
    expect(pickCurrentMonthTab(tabs, new Date('2026-01-10T03:00:00Z'))).toBe(
      null,
    );
  });
});

describe('extractSpreadsheetId', () => {
  it('lấy mã sheet từ link hoặc mã dán thẳng', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-abcd';
    expect(
      extractSpreadsheetId(
        `https://docs.google.com/spreadsheets/d/${id}/edit?gid=0#gid=0`,
      ),
    ).toBe(id);
    expect(extractSpreadsheetId(id)).toBe(id);
    expect(extractSpreadsheetId('https://example.com/abc')).toBe(null);
  });
});

describe('stripTrailingPhone', () => {
  it('bỏ SĐT đi kèm tên NV đưa đón', () => {
    expect(stripTrailingPhone('Chuyền 0373791063')).toBe('Chuyền');
    expect(stripTrailingPhone('Sơn - 0813 497 768')).toBe('Sơn');
    expect(stripTrailingPhone('Thế')).toBe('Thế');
    expect(stripTrailingPhone('0373791063')).toBe('0373791063');
  });
});

describe('ShuttleSheetService — so sheet với phần mềm', () => {
  const row = (over: Partial<ParsedRow>): ParsedRow => ({
    date: '2026-11-02',
    fullName: 'Mai Thị Huệ',
    phoneNumber: '0392615103',
    companyId: null,
    area: null,
    type: null,
    saleUserId: null,
    interviewTime: null,
    contractor: null,
    status: null,
    interviewResult: null,
    leadSource: null,
    note: null,
    ...over,
  });
  const record = (over: Record<string, unknown>) => ({
    id: 'r1',
    date: new Date('2026-11-02'),
    fullName: 'Mai Thị Huệ',
    phoneNumber: '0392615103',
    companyId: 'c1',
    area: 'QV3',
    type: null,
    saleUserId: null,
    driverUserId: null,
    interviewTime: '07:30',
    contractor: null,
    leadSource: null,
    note: null,
    ...over,
  });
  const plan = (existing: unknown[], rows: ParsedRow[]) => {
    const prisma = {
      shuttleRecord: { findMany: jest.fn().mockResolvedValue(existing) },
    };
    const service = new ShuttleSheetService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return (
      service as unknown as {
        plan: (
          rows: { data: ParsedRow; driverRaw: string }[],
          resolve: (raw: string) => string | null,
        ) => Promise<{
          creates: ParsedRow[];
          updates: { id: string; patch: Record<string, unknown> }[];
          unchanged: number;
        }>;
      }
    ).plan(
      rows.map((data) => ({ data, driverRaw: 'Chuyền' })),
      () => 'd1',
    );
  };

  it('dòng chưa có → thêm; cùng SĐT khác tên là 2 người khác nhau', async () => {
    const p = await plan(
      [record({})],
      [row({}), row({ fullName: 'Hoàng Thị Nguyệt' })],
    );
    expect(p.creates.map((c) => c.fullName)).toEqual(['Hoàng Thị Nguyệt']);
  });

  it('dòng đã có → chỉ cập nhật cột thông tin sheet có giá trị, không đụng Tình trạng/Kết quả', async () => {
    const p = await plan(
      [record({})],
      [
        row({
          fullName: 'mai thi hue',
          area: 'QV1',
          interviewTime: '07:30',
          status: 'Đã đón',
          interviewResult: 'Trượt PV',
        }),
      ],
    );
    expect(p.creates).toEqual([]);
    // companyId trên sheet trống → giữ 'c1' của phần mềm; giờ PV giống → không đổi.
    expect(p.updates).toEqual([
      { id: 'r1', patch: { area: 'QV1', driverUserId: 'd1' } },
    ]);
  });

  it('không có gì khác → không cập nhật', async () => {
    const p = await plan([record({ driverUserId: 'd1' })], [row({})]);
    expect(p.updates).toEqual([]);
    expect(p.unchanged).toBe(1);
  });

  it('chỉ so với dòng chưa xoá (dòng đã xoá mà sheet còn → thêm lại)', async () => {
    const p = await plan([], [row({})]);
    expect(p.creates).toHaveLength(1);
  });

  it('sheet có 2 dòng trùng nhau, phần mềm mới có 1 → thêm 1', async () => {
    const p = await plan([record({ driverUserId: 'd1' })], [row({}), row({})]);
    expect(p.creates).toHaveLength(1);
    expect(p.unchanged).toBe(1);
  });
});
