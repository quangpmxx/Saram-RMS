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
    ]);
  });

  it('gõ đúng 4 chữ số → khớp thêm năm sinh', () => {
    expect(buildLeadKeywordWhere('1997')?.OR).toContainEqual({
      birthYear: 1997,
    });
  });

  it.each(['0901', '12345', '199'])(
    '"%s" không phải năm 19xx/20xx → không khớp năm sinh',
    (term) => {
      const or = buildLeadKeywordWhere(term)?.OR as object[];
      expect(or.some((c) => 'birthYear' in c)).toBe(false);
    },
  );
});
