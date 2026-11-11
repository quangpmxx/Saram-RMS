import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RecruitmentScheduleService } from './recruitment-schedule.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ModulePermissionService } from '../module-permission/module-permission.service';
import { MODULE_REGISTRY } from '../module-permission/module-registry';
import type { AccountRole } from '../../generated/prisma/enums';

const TEAM_1 = '11111111-1111-4111-8111-111111111111';
const TEAM_2 = '22222222-2222-4222-8222-222222222222';

/** Phân quyền Lịch tuyển dụng (2026-11-11): mỗi nhóm một lịch riêng + quyền mặc định theo vai trò. */
describe('RecruitmentScheduleService — phạm vi theo nhóm', () => {
  let service: RecruitmentScheduleService;
  let prisma: {
    account: { findUnique: jest.Mock };
    team: { findMany: jest.Mock; findUnique: jest.Mock };
    orderRecord: { findFirst: jest.Mock };
    recruitmentPosting: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  const user = (role: AccountRole) => ({
    id: `${role}-1`,
    role,
    sessionId: 's',
  });
  /** Tài khoản đang đăng nhập: thuộc nhóm nào, được Admin chọn riêng lịch nhóm nào. */
  const asAccount = (teamId: string | null, recruitmentTeamId: string | null) =>
    prisma.account.findUnique.mockResolvedValue({ teamId, recruitmentTeamId });
  const posting = (teamId: string | null) => ({
    id: 'p1',
    companyName: 'GOERTEK',
    kind: 'official',
    status: 'open',
    teamId,
    ageMin: 18,
    ageMax: 45,
    team: teamId ? { name: 'Nhóm' } : null,
    orderRecordId: null,
    updatedBy: { fullName: 'Admin' },
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
  });

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn() },
      team: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: TEAM_2, name: 'Nhóm 2' }),
      },
      orderRecord: { findFirst: jest.fn().mockResolvedValue(null) },
      recruitmentPosting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          ...posting(data.teamId as string | null),
          ...data,
        })),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...posting(TEAM_1),
          ...data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        delete: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        RecruitmentScheduleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = module.get(RecruitmentScheduleService);
  });

  const listWhere = () =>
    (
      prisma.recruitmentPosting.findMany.mock.calls[0] as [{ where: unknown }]
    )[0].where;

  it('Admin thấy mọi nhóm, không cần tra tài khoản', async () => {
    await service.list(user('admin'));
    expect(listWhere()).toEqual({});
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it('Sale/Leader chỉ thấy thẻ của nhóm mình', async () => {
    asAccount(TEAM_1, null);
    await service.list(user('sale'));
    expect(listWhere()).toEqual({ teamId: TEAM_1 });
  });

  it('tài khoản được chọn "Lịch tuyển dụng của nhóm" thì thấy đúng nhóm đó, kể cả khi thuộc nhóm khác', async () => {
    asAccount(TEAM_1, TEAM_2);
    await service.list(user('leader'));
    expect(listWhere()).toEqual({ teamId: TEAM_2 });
  });

  it('Quản lý chưa được chọn nhóm thấy mọi nhóm; đã chọn thì chỉ thấy nhóm đó', async () => {
    asAccount(null, null);
    await service.list(user('manager'));
    expect(listWhere()).toEqual({});

    prisma.recruitmentPosting.findMany.mockClear();
    asAccount(null, TEAM_2);
    await service.list(user('manager'));
    expect(listWhere()).toEqual({ teamId: TEAM_2 });
    expect((await service.teams(user('manager'))).can_see_all).toBe(false);
  });

  it('tài khoản không thuộc nhóm nào: không thấy thẻ nào và không thêm được', async () => {
    asAccount(null, null);
    expect(await service.list(user('sale'))).toEqual([]);
    expect(prisma.recruitmentPosting.findMany).not.toHaveBeenCalled();
    await expect(
      service.create({ company_name: 'A', kind: 'official' }, user('leader')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Leader thêm thẻ: luôn vào nhóm mình dù gửi team_id của nhóm khác', async () => {
    asAccount(TEAM_1, null);
    const created = await service.create(
      { company_name: 'A', kind: 'official', team_id: TEAM_2 },
      user('leader'),
    );
    expect(created.team_id).toBe(TEAM_1);
  });

  it('Leader không sửa/xoá được thẻ của nhóm khác (báo không tìm thấy)', async () => {
    asAccount(TEAM_1, null);
    prisma.recruitmentPosting.findUnique.mockResolvedValue(posting(TEAM_2));
    await expect(
      service.update('p1', { status: 'paused' }, user('leader')),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('p1', user('leader'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.recruitmentPosting.update).not.toHaveBeenCalled();
    expect(prisma.recruitmentPosting.delete).not.toHaveBeenCalled();
  });

  it('Leader không thấy/sửa được thẻ chưa gán nhóm', async () => {
    asAccount(TEAM_1, null);
    prisma.recruitmentPosting.findUnique.mockResolvedValue(posting(null));
    await expect(
      service.update('p1', { status: 'paused' }, user('leader')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Leader sửa thẻ nhóm mình: không chuyển được thẻ sang nhóm khác', async () => {
    asAccount(TEAM_1, null);
    prisma.recruitmentPosting.findUnique.mockResolvedValue(posting(TEAM_1));
    await service.update('p1', { team_id: TEAM_2, notes: 'x' }, user('leader'));
    const data = (
      prisma.recruitmentPosting.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ]
    )[0].data;
    expect(data).not.toHaveProperty('teamId');
    expect(data.notes).toBe('x');
  });

  it('Admin chuyển được thẻ sang nhóm khác', async () => {
    prisma.recruitmentPosting.findUnique.mockResolvedValue(posting(TEAM_1));
    await service.update('p1', { team_id: TEAM_2 }, user('admin'));
    const data = (
      prisma.recruitmentPosting.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ]
    )[0].data;
    expect(data.teamId).toBe(TEAM_2);
  });

  it('trùng tên chỉ chặn trong CÙNG nhóm + cùng loại', async () => {
    asAccount(TEAM_1, null);
    prisma.recruitmentPosting.findFirst.mockResolvedValue({ id: 'other' });
    await expect(
      service.create({ company_name: 'A', kind: 'official' }, user('leader')),
    ).rejects.toBeInstanceOf(ConflictException);
    const where = (
      prisma.recruitmentPosting.findFirst.mock.calls[0] as [
        { where: { teamId: string; kind: string } },
      ]
    )[0].where;
    expect(where.teamId).toBe(TEAM_1);
    expect(where.kind).toBe('official');
  });

  it('gán nhóm hàng loạt: chỉ người thấy mọi nhóm', async () => {
    asAccount(TEAM_1, null);
    await expect(
      service.assignUnassigned(TEAM_2, user('leader')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    asAccount(null, TEAM_2);
    await expect(
      service.assignUnassigned(TEAM_2, user('manager')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.recruitmentPosting.updateMany).not.toHaveBeenCalled();

    expect(await service.assignUnassigned(TEAM_2, user('admin'))).toEqual({
      moved: 3,
    });
  });
});

describe('Lịch tuyển dụng — quyền mặc định theo vai trò (module-registry)', () => {
  let perm: ModulePermissionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ModulePermissionService,
        {
          provide: PrismaService,
          useValue: {
            userModulePermission: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          },
        },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    perm = module.get(ModulePermissionService);
  });

  it.each<[AccountRole, string]>([
    ['admin', 'edit'],
    ['manager', 'edit'],
    ['leader', 'edit'],
    ['sup_leader', 'edit'],
    ['sale', 'view'],
    ['mkt', 'none'],
    ['accounting', 'none'],
    ['order_staff', 'none'],
    ['shuttle_staff', 'none'],
  ])('%s → %s', async (role, expected) => {
    expect(await perm.getEffective('acc', role, 'recruitment-schedule')).toBe(
      expected,
    );
  });

  it('có trong danh mục trang Phân quyền', () => {
    expect(
      MODULE_REGISTRY.find((m) => m.code === 'recruitment-schedule')?.label,
    ).toBe('Lịch tuyển dụng');
  });
});
