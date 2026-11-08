import {
  buildSequence,
  customerName,
  normalizePhone,
  pageIdFromToken,
  pickPhone,
  pickPost,
} from './pancake.util';
import { parsePancakeTime } from './pancake.client';

describe('buildSequence', () => {
  it('1 nhóm: mọi số vào nhóm đó', () => {
    expect(buildSequence([{ teamId: 'A', weight: 1 }])).toEqual(['A']);
  });
  it('1-1: xen kẽ', () => {
    expect(
      buildSequence([
        { teamId: 'A', weight: 1 },
        { teamId: 'B', weight: 1 },
      ]),
    ).toEqual(['A', 'B']);
  });
  it('1-2: A, B, B', () => {
    expect(
      buildSequence([
        { teamId: 'A', weight: 1 },
        { teamId: 'B', weight: 2 },
      ]),
    ).toEqual(['A', 'B', 'B']);
  });
  it('2-3 đan xen, bỏ nhóm tỉ lệ 0', () => {
    expect(
      buildSequence([
        { teamId: 'A', weight: 2 },
        { teamId: 'X', weight: 0 },
        { teamId: 'B', weight: 3 },
      ]),
    ).toEqual(['A', 'B', 'A', 'B', 'B']);
  });
  it('không nhóm nào → rỗng', () => {
    expect(buildSequence([{ teamId: 'A', weight: 0 }])).toEqual([]);
  });
});

describe('normalizePhone', () => {
  it.each([
    ['0912345678', '0912345678'],
    ['+84 912 345 678', '0912345678'],
    ['84912345678', '0912345678'],
    ['912345678', '0912345678'],
    ['0912.345.678', '0912345678'],
    ['12345', null],
    ['', null],
  ])('%s → %s', (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });
});

describe('pickPhone / customerName', () => {
  it('lấy SĐT hợp lệ đầu tiên và tên khách', () => {
    const c = {
      id: '1',
      type: 'INBOX',
      inserted_at: '',
      updated_at: '',
      recent_phone_numbers: [
        { phone_number: '123' },
        { phone_number: '0987654321' },
      ],
      page_customer: { name: ' Nguyễn Văn A ' },
    };
    expect(pickPhone(c)).toBe('0987654321');
    expect(customerName(c)).toBe('Nguyễn Văn A');
    expect(customerName({ ...c, page_customer: null })).toBe('Khách Pancake');
  });
});

describe('pageIdFromToken', () => {
  it('đọc id page từ payload JWT', () => {
    const payload = Buffer.from(
      JSON.stringify({ id: '111020691358187', timestamp: 1 }),
    ).toString('base64url');
    expect(pageIdFromToken(`h.${payload}.s`)).toBe('111020691358187');
    expect(pageIdFromToken('khong-phai-jwt')).toBeNull();
  });
});

describe('parsePancakeTime', () => {
  it('giờ không có Z được hiểu là UTC', () => {
    expect(parsePancakeTime('2026-11-04T03:07:51.858000').toISOString()).toBe(
      '2026-11-04T03:07:51.858Z',
    );
  });
});

describe('pickPost', () => {
  const base = { id: 'c', type: 'INBOX', inserted_at: '', updated_at: '' };
  it('bình luận: lấy bài được bình luận', () => {
    expect(pickPost({ ...base, type: 'COMMENT', post_id: '1_2' })).toEqual({
      postId: '1_2',
      adId: null,
    });
  });
  it('inbox qua quảng cáo: lấy quảng cáo bấm gần nhất và bài của nó', () => {
    expect(
      pickPost({
        ...base,
        post_id: null,
        ads: [
          { ad_id: 'A1', post_id: '1_10', inserted_at: '2026-11-01T00:00:00' },
          { ad_id: 'A2', post_id: '1_20', inserted_at: '2026-11-05T00:00:00' },
        ],
      }),
    ).toEqual({ postId: '1_20', adId: 'A2' });
  });
  it('inbox tự nhiên: không có bài', () => {
    expect(pickPost({ ...base, post_id: null, ads: [] })).toEqual({
      postId: null,
      adId: null,
    });
  });
});
