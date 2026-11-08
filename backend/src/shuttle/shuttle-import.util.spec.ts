import {
  matchAccount,
  parseShuttleDate,
  parseShuttleTime,
  splitNamePhone,
} from './shuttle-import.util';

describe('parseShuttleDate', () => {
  const now = new Date('2026-11-08T03:00:00Z');
  it('ô ngày Excel (ISO)', () => {
    expect(parseShuttleDate('2026-10-05T00:00:00.000Z', now)).toBe(
      '2026-10-05',
    );
  });
  it('d/m/yyyy và d/m/yy', () => {
    expect(parseShuttleDate('5/10/2026', now)).toBe('2026-10-05');
    expect(parseShuttleDate('05-10-26', now)).toBe('2026-10-05');
  });
  it('d/m không năm: năm nay, ra tương lai thì năm ngoái', () => {
    expect(parseShuttleDate('5/10', now)).toBe('2026-10-05');
    expect(parseShuttleDate('25/12', now)).toBe('2025-12-25');
  });
  it('sai → null', () => {
    expect(parseShuttleDate('31/2/2026', now)).toBeNull();
    expect(parseShuttleDate('hôm qua', now)).toBeNull();
    expect(parseShuttleDate('', now)).toBeNull();
  });
});

describe('parseShuttleTime', () => {
  it('nhiều cách ghi giờ', () => {
    expect(parseShuttleTime('8:30')).toBe('08:30');
    expect(parseShuttleTime('8h30')).toBe('08:30');
    expect(parseShuttleTime('13h')).toBe('13:00');
    expect(parseShuttleTime('1899-12-30T07:45:00.000Z')).toBe('07:45');
    expect(parseShuttleTime('0.5')).toBe('12:00');
  });
  it('không đọc được → null', () => {
    expect(parseShuttleTime('sáng')).toBeNull();
    expect(parseShuttleTime('25:00')).toBeNull();
  });
});

describe('splitNamePhone', () => {
  it('cột riêng', () => {
    expect(splitNamePhone('Nguyễn Văn A', '912.345.678')).toEqual({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
    });
  });
  it('gộp 1 cột tên - SĐT', () => {
    expect(splitNamePhone('Nguyễn Văn A - 0912 345 678', '')).toEqual({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
    });
  });
  it('SĐT không đọc được → rỗng', () => {
    expect(splitNamePhone('Trần B', 'abc')).toEqual({
      fullName: 'Trần B',
      phone: '',
    });
  });
});

describe('matchAccount', () => {
  const accounts = [
    { id: '1', fullName: 'Nguyễn Thu Hương', nickname: 'Hương Sale' },
    { id: '2', fullName: 'Trần Thu Hà', nickname: null },
    { id: '3', fullName: 'Lê Văn Hà', nickname: null },
  ];
  it('theo biệt danh / họ tên không dấu', () => {
    expect(matchAccount('huong sale', accounts)).toBe('1');
    expect(matchAccount('Tran Thu Ha', accounts)).toBe('2');
  });
  it('theo tên gọi, trùng nhiều người → không khớp', () => {
    expect(matchAccount('Thu Hà', accounts)).toBe('2');
    expect(matchAccount('Hà', accounts)).toBeNull();
    expect(matchAccount('Không ai', accounts)).toBeNull();
  });
});
