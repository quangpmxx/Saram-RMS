import { Workbook } from 'exceljs';
import {
  detectColumns,
  normalizePhone,
  parseBirthYear,
  readLegacyRows,
  resultCode,
  suggestAccount,
  zaloFriendCode,
} from './legacy-import.util';
import { mergeByPhone } from './legacy-import.service';

const NOW = new Date('2026-10-30T00:00:00Z');

describe('legacy-import.util', () => {
  it('chuẩn hóa SĐT: chấm/cách, thiếu số 0, đầu 84, ô có 2 số', () => {
    expect(normalizePhone('0912.345.678')).toBe('0912345678');
    expect(normalizePhone('912345678')).toBe('0912345678');
    expect(normalizePhone('84912345678')).toBe('0912345678');
    expect(normalizePhone('0912345678 / 0987654321')).toBe('0912345678');
    expect(normalizePhone('12345')).toBeNull();
  });

  it('đọc năm sinh viết tự do', () => {
    expect(parseBirthYear('1989', NOW)).toBe(1989);
    expect(parseBirthYear('89', NOW)).toBe(1989);
    expect(parseBirthYear('05', NOW)).toBe(2005);
    expect(parseBirthYear('2k5', NOW)).toBe(2005);
    expect(parseBirthYear('k5 ', NOW)).toBe(2005);
    expect(parseBirthYear('82, 2k6', NOW)).toBe(1982);
    expect(parseBirthYear('35t', NOW)).toBeNull();
    expect(parseBirthYear('lạng sơn', NOW)).toBeNull();
  });

  it('Trạng thái Zalo và Kết quả', () => {
    expect(zaloFriendCode('Đã KB Zalo')).toBe('FRIEND');
    expect(zaloFriendCode('Chưa KB Zalo')).toBe('NOT_FRIEND');
    expect(zaloFriendCode('Không có Zalo')).toBe('NO_ZALO');
    expect(zaloFriendCode('')).toBeNull();
    expect(resultCode('Đã gửi CC')).toBe('SENT_CCCD');
    expect(resultCode('')).toBeNull();
  });

  it('gợi ý tài khoản theo tên viết tắt; mơ hồ hoặc không có thì không gợi ý', () => {
    const members = [
      { id: 'anhnn', fullName: 'Nguyễn Ngọc Anh', nickname: null },
      { id: 'anhlm', fullName: 'Lê Minh Ánh', nickname: null },
      { id: 'linhhn', fullName: 'Hoàng Ngọc Linh', nickname: null },
      { id: 'linhlk', fullName: 'Lương Khánh Linh', nickname: null },
      { id: 'hangptb', fullName: 'Phạm Thị Bích Hằng', nickname: 'Bích' },
    ];
    expect(suggestAccount('Ngọc Anh', members)).toBe('anhnn');
    expect(suggestAccount('M.Ánh', members)).toBe('anhlm');
    expect(suggestAccount('K.Linh', members)).toBe('linhlk');
    expect(suggestAccount('P.Hằng', members)).toBe('hangptb');
    expect(suggestAccount('bích', members)).toBe('hangptb');
    expect(suggestAccount('Linh', members)).toBeNull();
    expect(suggestAccount('Huyền', members)).toBeNull();
  });

  it('đọc sheet theo tên cột, đổi chỗ Năm sinh/Địa chỉ bị lệch, giới hạn số dòng', () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet('T9');
    ws.addRow([
      'Ngày',
      'Nhân viên',
      'Họ tên ứng viên',
      'SĐT',
      'Năm sinh',
      'Địa chỉ',
      'Trạng Thái ',
      'Tình trạng cuộc gọi',
    ]);
    ws.addRow([
      '',
      'Vương',
      'A',
      '0912345678',
      'lạng sơn',
      '84',
      'Đã KB Zalo',
      '1/9 gọi\n2/9 gọi lại',
    ]);
    ws.addRow([]);
    ws.addRow(['', 'Uyên', 'B', 'abc', '', '', '', '']);
    ws.addRow(['', 'Uyên', 'C', '0987654321', '2k5', 'hà nội', '', '']);
    ws.addRow(['', 'Uyên', 'D', '0911111111', '', '', '', '']);

    const cols = detectColumns(ws);
    expect(cols.phone).toBe(4);
    expect(cols.zaloFriend).toBe(7);
    const { rows, errors } = readLegacyRows(ws, cols, 3);
    expect(rows.map((r) => r.fullName)).toEqual(['A', 'C']);
    expect(rows[0]).toMatchObject({
      birthYear: 1984,
      address: 'lạng sơn',
      callNotes: '1/9 gọi\n2/9 gọi lại',
    });
    expect(errors).toEqual([{ row: 4, message: 'SĐT không hợp lệ: "abc"' }]);
  });

  it('SĐT lặp trong file: giữ dòng đầu, nối ghi chú', () => {
    const base = {
      staff: 'Vương',
      fullName: 'A',
      phone: '0912345678',
      birthYear: null,
      address: '',
      mktNote: '',
      channel: '',
      zaloFriend: '',
      result: '',
    };
    const { unique, mergedCount } = mergeByPhone([
      { ...base, row: 2, callNotes: '1/9 gọi' },
      { ...base, row: 9, callNotes: '5/9 gọi lại', result: 'Đã gửi CC' },
      { ...base, row: 10, phone: '0987654321', callNotes: '' },
    ]);
    expect(mergedCount).toBe(1);
    expect(unique).toHaveLength(2);
    expect(unique[0]).toMatchObject({
      row: 2,
      callNotes: '1/9 gọi\n5/9 gọi lại',
      result: 'Đã gửi CC',
    });
  });
});
