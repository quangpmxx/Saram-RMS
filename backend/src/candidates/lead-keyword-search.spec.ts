import { buildLeadKeywordWhere } from './lead-keyword-search';

describe('buildLeadKeywordWhere', () => {
  it('từ khóa rỗng → không lọc', () => {
    expect(buildLeadKeywordWhere(undefined)).toBeNull();
    expect(buildLeadKeywordWhere('   ')).toBeNull();
  });

  it('khớp tên, SĐT, địa chỉ, ghi chú MKT, ghi chú chăm sóc chưa xóa', () => {
    const where = buildLeadKeywordWhere('  Long An ');
    expect(where?.OR).toEqual([
      { fullName: { contains: 'Long An', mode: 'insensitive' } },
      { phoneNumber: { contains: 'Long An' } },
      { address: { contains: 'Long An', mode: 'insensitive' } },
      { mktNote: { contains: 'Long An', mode: 'insensitive' } },
      {
        notes: {
          some: {
            content: { contains: 'Long An', mode: 'insensitive' },
            isDeleted: false,
          },
        },
      },
      { birthYear: { contains: 'Long An', mode: 'insensitive' } },
    ]);
  });

  it('năm sinh là chữ nhập tự do → tìm kiểu "có chứa" (2026-11-06)', () => {
    expect(buildLeadKeywordWhere('1997')?.OR).toContainEqual({
      birthYear: { contains: '1997', mode: 'insensitive' },
    });
  });
});
