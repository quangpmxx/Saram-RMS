import { CareWarehouseService } from './care-warehouse.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeService } from '../realtime/realtime.service';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import type { ListCareWarehouseQueryDto } from './dto/list-care-warehouse-query.dto';

/**
 * Gộp lượt tính Kho (2026-11-25, VPS lag): nhiều người cùng nhóm tải Kho cùng lúc → chỉ đọc DB 1 lần;
 * lượt sau khi lượt trước đã xong thì đọc lại (không dùng kết quả cũ).
 */
describe('CareWarehouseService.list — gộp lượt tính trùng', () => {
  const user = { id: 'u1', role: 'sale' } as AuthenticatedUser;
  const query = { page: 1, page_size: 20 } as ListCareWarehouseQueryDto;

  function setup() {
    const findMany = jest.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve([{ id: 'l1', uploadedAt: new Date(), noteColor: null }]),
            20,
          ),
        ),
    );
    const prisma = {
      lead: { findMany, count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    const service = new CareWarehouseService(prisma, {} as RealtimeService);
    const s = service as unknown as Record<string, jest.Mock>;
    s.resolveTeamScope = jest.fn().mockResolvedValue('team-1');
    s.loadLeadSummaries = jest.fn().mockResolvedValue({
      summaries: new Map([
        [
          'l1',
          {
            month_status: 'cared',
            assigned_pending: false,
            month_care_count: 1,
            open_assignment: null,
          },
        ],
      ]),
      totals: new Map(),
      lastAssigned: new Map(),
    });
    s.progressStats = jest.fn().mockResolvedValue({ in_warehouse: 1 });
    s.buildItems = jest.fn().mockResolvedValue([]);
    return { service, findMany, s };
  }

  it('2 lượt cùng lúc, cùng nhóm → đọc DB 1 lần, cả 2 đều có kết quả', async () => {
    const { service, findMany, s } = setup();
    const [a, b] = await Promise.all([
      service.list(query, user),
      service.list(query, user),
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(s.loadLeadSummaries).toHaveBeenCalledTimes(1);
    expect(a.stats.total).toBe(1);
    expect(b.stats.total).toBe(1);
  });

  it('lượt sau khi lượt trước đã xong → đọc lại DB (không trả số cũ)', async () => {
    const { service, findMany } = setup();
    await service.list(query, user);
    await service.list(query, user);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('khác ô tìm kiếm → không gộp', async () => {
    const { service, findMany } = setup();
    await Promise.all([
      service.list(query, user),
      service.list({ ...query, search: 'lan' }, user),
    ]);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
