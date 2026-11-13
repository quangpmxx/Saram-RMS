import { PancakeService } from './pancake.service';
import type { PancakeConversation } from './pancake.client';

const page = {
  id: 'page-1',
  pageId: '111',
  name: 'Page A',
  ownerId: 'owner-1',
  mktSourceId: 'mkt-1',
};
const conv = (id: string, phone?: string): PancakeConversation => ({
  id,
  type: 'INBOX',
  inserted_at: '2026-11-04T03:00:00',
  updated_at: '2026-11-04T03:05:00',
  recent_phone_numbers: phone ? [{ phone_number: phone }] : [],
  page_customer: { name: `Khách ${id}` },
});

function setup(opts: {
  active?: boolean;
  origin?: { id: string; name: string } | null;
  existing?: { id: string; phoneNumber: string | null } | null;
}) {
  let position = 0;
  const prisma = {
    pancakeConversation: {
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      create: jest.fn().mockResolvedValue({ id: 'row-1' }),
      update: jest.fn().mockResolvedValue({ id: 'row-1' }),
    },
    pancakeAutoUpConfig: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'cfg', isActive: opts.active ?? true }),
      update: jest.fn().mockImplementation(() => {
        position += 1;
        return Promise.resolve({ position });
      }),
    },
    pancakeAutoUpTeam: {
      findMany: jest.fn().mockResolvedValue([
        { teamId: 'A', weight: 1 },
        { teamId: 'B', weight: 2 },
      ]),
    },
    leadSource: { findFirst: jest.fn().mockResolvedValue({ id: 'src-fb' }) },
    account: {
      findUnique: jest.fn().mockResolvedValue({ id: 'owner-1', role: 'mkt' }),
    },
  };
  const candidates = {
    create: jest.fn().mockResolvedValue({
      candidate: { id: 'lead-1' },
      duplicate_warning: null,
    }),
  };
  const duplicates = {
    findOriginTeam: jest.fn().mockResolvedValue(opts.origin ?? null),
  };
  const service = new PancakeService(
    prisma as never,
    {} as never,
    {} as never,
    candidates as never,
    duplicates as never,
  );
  const record = (c: PancakeConversation, allowLead = true) =>
    (
      service as unknown as {
        recordConversation: (
          p: typeof page,
          c: PancakeConversation,
          a: boolean,
        ) => Promise<void>;
      }
    ).recordConversation(page, c, allowLead);
  return { service, prisma, candidates, record };
}

describe('PancakeService — Up tự động', () => {
  it('chia theo tỉ lệ 1-2: A, B, B, A', async () => {
    const { candidates, record } = setup({});
    for (const [i, p] of [
      '0911111111',
      '0922222222',
      '0933333333',
      '0944444444',
    ].entries())
      await record(conv(`c${i}`, p));
    expect(
      candidates.create.mock.calls.map(
        (c) => (c[0] as { team_id: string }).team_id,
      ),
    ).toEqual(['A', 'B', 'B', 'A']);
    const [dto, user] = candidates.create.mock.calls[0] as [
      Record<string, unknown>,
      { id: string },
    ];
    expect(dto).toMatchObject({
      full_name: 'Khách c0',
      phone_number: '0911111111',
      source_id: 'src-fb',
      mkt_source_id: 'mkt-1',
    });
    expect(user.id).toBe('owner-1'); // người up = người phụ trách page
  });

  it('số trùng 7 ngày về nhóm giữ số gốc, không tính lượt', async () => {
    const { prisma, candidates, record } = setup({
      origin: { id: 'C', name: 'Nhóm C' },
    });
    await record(conv('c1', '0911111111'));
    expect(candidates.create.mock.calls[0][0]).toMatchObject({ team_id: 'C' });
    expect(prisma.pancakeAutoUpConfig.update).not.toHaveBeenCalled();
  });

  it('Up tự động đang tắt: chỉ ghi nhận, không tạo data', async () => {
    const { prisma, candidates, record } = setup({ active: false });
    await record(conv('c1', '0911111111'));
    expect(prisma.pancakeConversation.create).toHaveBeenCalled();
    expect(candidates.create).not.toHaveBeenCalled();
  });

  it('lấy dữ liệu nền lần đầu: không tạo data', async () => {
    const { candidates, record } = setup({});
    await record(conv('c1', '0911111111'), false);
    expect(candidates.create).not.toHaveBeenCalled();
  });

  it('hội thoại đã có SĐT từ trước: không up lại', async () => {
    const { prisma, candidates, record } = setup({
      existing: { id: 'row-1', phoneNumber: '0911111111' },
    });
    await record(conv('c1', '0911111111'));
    expect(prisma.pancakeConversation.update).not.toHaveBeenCalled();
    expect(candidates.create).not.toHaveBeenCalled();
  });

  it('hội thoại cũ mới để lại SĐT: up', async () => {
    const { prisma, candidates, record } = setup({
      existing: { id: 'row-1', phoneNumber: null },
    });
    await record(conv('c1', '0911111111'));
    expect(prisma.pancakeConversation.update).toHaveBeenCalled();
    expect(candidates.create).toHaveBeenCalledTimes(1);
  });

  it('hội thoại chưa có SĐT: không up', async () => {
    const { candidates, record } = setup({});
    await record(conv('c1'));
    expect(candidates.create).not.toHaveBeenCalled();
  });
});
