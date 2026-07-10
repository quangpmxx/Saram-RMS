import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DistributionRuleService } from './distribution-rule.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('DistributionRuleService', () => {
  let service: DistributionRuleService;
  let prisma: {
    team: { findUnique: jest.Mock };
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    distributionRule: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    distributionMember: { deleteMany: jest.Mock; createMany: jest.Mock };
    lead: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  const leaderUser = {
    id: 'leader-1',
    role: 'leader' as const,
    sessionId: 's',
  };
  const otherLeaderUser = {
    id: 'leader-2',
    role: 'leader' as const,
    sessionId: 's',
  };
  const adminUser = { id: 'admin-1', role: 'admin' as const, sessionId: 's' };
  const managerUser = {
    id: 'manager-1',
    role: 'manager' as const,
    sessionId: 's',
  };
  const saleUser = { id: 'sale-1', role: 'sale' as const, sessionId: 's' };

  const team = { id: 'team-1', name: 'Nhóm 1' };

  beforeEach(async () => {
    prisma = {
      team: { findUnique: jest.fn() },
      account: { findUnique: jest.fn(), findMany: jest.fn() },
      distributionRule: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      distributionMember: { deleteMany: jest.fn(), createMany: jest.fn() },
      lead: { update: jest.fn() },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DistributionRuleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(DistributionRuleService);
  });

  describe('getRule', () => {
    it('ném NotFoundException nếu nhóm không tồn tại', async () => {
      prisma.team.findUnique.mockResolvedValue(null);
      await expect(service.getRule('ghost', adminUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('trả về đối tượng mặc định (id=null) nếu nhóm chưa từng cấu hình', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.distributionRule.findUnique.mockResolvedValue(null);

      const result = await service.getRule('team-1', adminUser);
      expect(result).toEqual({
        id: null,
        team_id: 'team-1',
        is_active: false,
        last_assigned_position: 0,
        members: [],
      });
    });

    it('Leader chỉ xem được cấu hình nhóm mình', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-2' });

      await expect(
        service.getRule('team-1', leaderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Sale/MKT không có quyền xem', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      await expect(service.getRule('team-1', saleUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('Quản lý/Admin xem được mọi nhóm', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.distributionRule.findUnique.mockResolvedValue(null);
      await expect(
        service.getRule('team-1', managerUser),
      ).resolves.toBeDefined();
      await expect(service.getRule('team-1', adminUser)).resolves.toBeDefined();
    });
  });

  describe('updateRule', () => {
    it('Chỉ Leader (nhóm mình) mới được cấu hình', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      await expect(
        service.updateRule('team-1', { account_ids: [] }, adminUser),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-2' });
      await expect(
        service.updateRule('team-1', { account_ids: [] }, otherLeaderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('từ chối nếu account_ids chứa tài khoản không phải Sale của đúng nhóm', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.account.findMany.mockResolvedValue([{ id: 'sale-a' }]); // chỉ 1/2 hợp lệ

      await expect(
        service.updateRule(
          'team-1',
          { account_ids: ['sale-a', 'sale-b'] },
          leaderUser,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('upsert cấu hình, xóa member cũ, tạo member mới đúng thứ tự, reset vị trí về 0', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-a' },
        { id: 'sale-b' },
      ]);
      prisma.distributionRule.upsert.mockResolvedValue({ id: 'rule-1' });
      prisma.distributionRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        teamId: 'team-1',
        isActive: false,
        lastAssignedPosition: 0,
        members: [
          {
            accountId: 'sale-a',
            orderIndex: 0,
            account: { id: 'sale-a', fullName: 'Sale A' },
          },
          {
            accountId: 'sale-b',
            orderIndex: 1,
            account: { id: 'sale-b', fullName: 'Sale B' },
          },
        ],
      });

      const result = await service.updateRule(
        'team-1',
        { account_ids: ['sale-a', 'sale-b'] },
        leaderUser,
      );

      expect(prisma.distributionRule.upsert).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        create: {
          teamId: 'team-1',
          createdById: 'leader-1',
          isActive: false,
          lastAssignedPosition: 0,
        },
        update: { lastAssignedPosition: 0 },
      });
      expect(prisma.distributionMember.deleteMany).toHaveBeenCalledWith({
        where: { ruleId: 'rule-1' },
      });
      expect(prisma.distributionMember.createMany).toHaveBeenCalledWith({
        data: [
          { ruleId: 'rule-1', accountId: 'sale-a', orderIndex: 0 },
          { ruleId: 'rule-1', accountId: 'sale-b', orderIndex: 1 },
        ],
      });
      expect(result.members).toEqual([
        { account_id: 'sale-a', name: 'Sale A', order_index: 0 },
        { account_id: 'sale-b', name: 'Sale B', order_index: 1 },
      ]);
    });

    it('cho phép danh sách rỗng — xóa toàn bộ member, không gọi createMany', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.distributionRule.upsert.mockResolvedValue({ id: 'rule-1' });
      prisma.distributionRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        teamId: 'team-1',
        isActive: false,
        lastAssignedPosition: 0,
        members: [],
      });

      await service.updateRule('team-1', { account_ids: [] }, leaderUser);

      expect(prisma.distributionMember.deleteMany).toHaveBeenCalled();
      expect(prisma.distributionMember.createMany).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('từ chối nếu chưa cấu hình hoặc chưa có thành viên nào', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.distributionRule.findUnique.mockResolvedValue(null);

      await expect(
        service.activate('team-1', leaderUser),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('kích hoạt thành công khi có ít nhất 1 thành viên', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.distributionRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        teamId: 'team-1',
        isActive: false,
        lastAssignedPosition: 0,
        members: [
          {
            accountId: 'sale-a',
            orderIndex: 0,
            account: { id: 'sale-a', fullName: 'Sale A' },
          },
        ],
      });

      await service.activate('team-1', leaderUser);

      expect(prisma.distributionRule.update).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        data: { isActive: true },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldChanged: 'is_active',
          newValue: 'true',
        }),
      );
    });
  });

  describe('pause', () => {
    it('ném NotFoundException nếu chưa có cấu hình', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.distributionRule.findUnique.mockResolvedValue(null);

      await expect(service.pause('team-1', leaderUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('tạm dừng thành công', async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.account.findUnique.mockResolvedValue({ teamId: 'team-1' });
      prisma.distributionRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        teamId: 'team-1',
        isActive: true,
        lastAssignedPosition: 1,
        members: [
          {
            accountId: 'sale-a',
            orderIndex: 0,
            account: { id: 'sale-a', fullName: 'Sale A' },
          },
        ],
      });

      await service.pause('team-1', leaderUser);

      expect(prisma.distributionRule.update).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        data: { isActive: false },
      });
    });
  });

  describe('tryAutoAssign', () => {
    const rule = (
      overrides: Partial<{
        lastAssignedPosition: number;
        members: unknown[];
      }> = {},
    ) => ({
      id: 'rule-1',
      teamId: 'team-1',
      isActive: true,
      createdById: 'leader-1',
      lastAssignedPosition: 0,
      members: [
        { accountId: 'sale-a', orderIndex: 0 },
        { accountId: 'sale-b', orderIndex: 1 },
        { accountId: 'sale-c', orderIndex: 2 },
      ],
      ...overrides,
    });

    it('trả về nguyên lead nếu đã được phân chia rồi', async () => {
      const lead = { id: 'lead-1', assignedToId: 'someone' };
      const result = await service.tryAutoAssign(lead as never);
      expect(result).toBe(lead);
      expect(prisma.distributionRule.findMany).not.toHaveBeenCalled();
    });

    it('trả về nguyên lead nếu không có nhóm nào đang bật', async () => {
      prisma.distributionRule.findMany.mockResolvedValue([]);
      const lead = { id: 'lead-1', assignedToId: null };

      const result = await service.tryAutoAssign(lead as never);
      expect(result).toBe(lead);
    });

    it('lỗi hạ tầng (vd CSDL thoáng qua) không được ném ra ngoài — trả về nguyên lead, không làm hỏng luồng tạo lead chính', async () => {
      prisma.distributionRule.findMany.mockRejectedValue(new Error('DB down'));
      const lead = { id: 'lead-1', assignedToId: null };

      const result = await service.tryAutoAssign(lead as never);
      expect(result).toBe(lead);
    });

    it('gán 3 lead liên tiếp đúng thứ tự A→B→C, lead thứ 4 quay lại A', async () => {
      const activeAccounts = [
        { id: 'sale-a', status: 'active', teamId: 'team-1' },
        { id: 'sale-b', status: 'active', teamId: 'team-1' },
        { id: 'sale-c', status: 'active', teamId: 'team-1' },
      ];
      prisma.account.findMany.mockResolvedValue(activeAccounts);
      prisma.lead.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'lead-x', ...data }),
      );
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );

      let currentRule = rule({ lastAssignedPosition: 0 });
      prisma.distributionRule.findMany.mockImplementation(() =>
        Promise.resolve([currentRule]),
      );
      prisma.distributionRule.update.mockImplementation(({ data }) => {
        currentRule = {
          ...currentRule,
          lastAssignedPosition: data.lastAssignedPosition,
        };
        return Promise.resolve(currentRule);
      });

      const assigned: string[] = [];
      for (let i = 0; i < 4; i++) {
        const lead = { id: `lead-${i}`, assignedToId: null };
        const result = await service.tryAutoAssign(lead as never);
        assigned.push(
          (result as unknown as { assignedToId: string }).assignedToId,
        );
      }

      expect(assigned).toEqual(['sale-a', 'sale-b', 'sale-c', 'sale-a']);
    });

    it('bỏ qua thành viên đã bị vô hiệu hóa (auto-skip), gán cho người kế tiếp còn hợp lệ', async () => {
      // sale-a (vị trí 0) đã inactive — phải bỏ qua, gán cho sale-b.
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-a', status: 'inactive', teamId: 'team-1' },
        { id: 'sale-b', status: 'active', teamId: 'team-1' },
        { id: 'sale-c', status: 'active', teamId: 'team-1' },
      ]);
      prisma.distributionRule.findMany.mockResolvedValue([
        rule({ lastAssignedPosition: 0 }),
      ]);
      prisma.lead.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'lead-1', ...data }),
      );
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );

      const result = (await service.tryAutoAssign({
        id: 'lead-1',
        assignedToId: null,
      } as never)) as unknown as { assignedToId: string };

      expect(result.assignedToId).toBe('sale-b');
    });

    it('bỏ qua thành viên đã rời khỏi nhóm (teamId khác)', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-a', status: 'active', teamId: 'team-OTHER' }, // đã chuyển nhóm khác
        { id: 'sale-b', status: 'active', teamId: 'team-1' },
        { id: 'sale-c', status: 'active', teamId: 'team-1' },
      ]);
      prisma.distributionRule.findMany.mockResolvedValue([
        rule({ lastAssignedPosition: 0 }),
      ]);
      prisma.lead.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'lead-1', ...data }),
      );
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );

      const result = (await service.tryAutoAssign({
        id: 'lead-1',
        assignedToId: null,
      } as never)) as unknown as { assignedToId: string };

      expect(result.assignedToId).toBe('sale-b');
    });

    it('không gán được (mọi thành viên đều không hợp lệ) → giữ nguyên lead, không lỗi', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-a', status: 'inactive', teamId: 'team-1' },
        { id: 'sale-b', status: 'inactive', teamId: 'team-1' },
        { id: 'sale-c', status: 'inactive', teamId: 'team-1' },
      ]);
      prisma.distributionRule.findMany.mockResolvedValue([
        rule({ lastAssignedPosition: 0 }),
      ]);

      const lead = { id: 'lead-1', assignedToId: null };
      const result = await service.tryAutoAssign(lead as never);

      expect(result).toBe(lead);
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });

    it('nhiều nhóm cùng bật — nhóm kích hoạt sớm hơn (updated_at tăng dần, đứng trước trong findMany) được ưu tiên', async () => {
      const ruleTeam1 = rule({ lastAssignedPosition: 0 });
      const ruleTeam2 = {
        id: 'rule-2',
        teamId: 'team-2',
        isActive: true,
        createdById: 'leader-2',
        lastAssignedPosition: 0,
        members: [{ accountId: 'sale-x', orderIndex: 0 }],
      };
      // orderBy updatedAt asc đã được xử lý ở tầng Prisma thật; ở unit test giả
      // lập kết quả đã sắp xếp sẵn — rule của team-1 kích hoạt trước nên đứng đầu.
      prisma.distributionRule.findMany.mockResolvedValue([
        ruleTeam1,
        ruleTeam2,
      ]);
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-a', status: 'active', teamId: 'team-1' },
        { id: 'sale-b', status: 'active', teamId: 'team-1' },
        { id: 'sale-c', status: 'active', teamId: 'team-1' },
      ]);
      prisma.lead.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'lead-1', ...data }),
      );
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );

      const result = (await service.tryAutoAssign({
        id: 'lead-1',
        assignedToId: null,
      } as never)) as unknown as {
        assignedToId: string;
        assignedTeamId: string;
      };

      expect(result.assignedTeamId).toBe('team-1');
      expect(result.assignedToId).toBe('sale-a');
    });

    it('ghi audit log với account_id là người tạo cấu hình (created_by của rule)', async () => {
      prisma.distributionRule.findMany.mockResolvedValue([
        rule({ lastAssignedPosition: 0 }),
      ]);
      prisma.account.findMany.mockResolvedValue([
        { id: 'sale-a', status: 'active', teamId: 'team-1' },
      ]);
      prisma.lead.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'lead-1', ...data }),
      );
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );

      await service.tryAutoAssign({
        id: 'lead-1',
        assignedToId: null,
      } as never);

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'leader-1',
          actionType: 'assign',
          entityType: 'lead',
          entityId: 'lead-1',
          newValue: 'sale-a',
        }),
      );
    });
  });
});
