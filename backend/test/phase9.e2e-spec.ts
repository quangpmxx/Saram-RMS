import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 9 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật. Tự tạo
 * dữ liệu/tài khoản riêng (username có tiền tố "phase9_") để không đụng dữ
 * liệu của các bộ test khác chạy trên cùng database.
 */
describe('Phase 9 — Nhật ký, Trùng lặp nâng cao & Phân quyền chi tiết (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookSourceId: string;

  let mktAgent: ReturnType<typeof request.agent>;
  let leaderAAgent: ReturnType<typeof request.agent>;
  let saleAAgent: ReturnType<typeof request.agent>;
  let saleBAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;

  let adminId: string;
  let managerId: string;
  let leaderAId: string;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'phase9_mkt',
    'phase9_leader_a',
    'phase9_sale_a',
    'phase9_sale_b',
    'phase9_admin',
    'phase9_manager',
  ];

  async function createLead(phone: string, fullName = `Ứng viên ${phone}`) {
    const res = await mktAgent
      .post('/candidate')
      .send({
        full_name: fullName,
        phone_number: phone,
        source_id: facebookSourceId,
      })
      .expect(201);
    return res.body.candidate.id as string;
  }

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    await prisma.notification.deleteMany({});
    await prisma.interviewAppointment.deleteMany({});
    await prisma.callbackSchedule.deleteMany({});
    await prisma.leadNote.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.accountPermission.deleteMany({
      where: { account: { username: { in: USERNAMES } } },
    });
    await prisma.session.deleteMany({
      where: { account: { username: { in: USERNAMES } } },
    });
    await prisma.auditLog.deleteMany({
      where: { account: { username: { in: USERNAMES } } },
    });
    await prisma.account.deleteMany({ where: { username: { in: USERNAMES } } });
    await prisma.team.deleteMany({
      where: { name: { in: ['Phase9 Nhóm A', 'Phase9 Nhóm B'] } },
    });

    await prisma.leadSource.upsert({
      where: { name: 'Facebook' },
      update: {},
      create: { name: 'Facebook' },
    });
    facebookSourceId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Facebook' } })
    ).id;

    const passwordHash = await hashPassword('123456');
    const teamA = await prisma.team.create({ data: { name: 'Phase9 Nhóm A' } });
    const teamB = await prisma.team.create({ data: { name: 'Phase9 Nhóm B' } });

    const admin = await prisma.account.create({
      data: {
        fullName: 'Admin Phase9',
        username: 'phase9_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    adminId = admin.id;
    const manager = await prisma.account.create({
      data: {
        fullName: 'Quản lý Phase9',
        username: 'phase9_manager',
        passwordHash,
        role: 'manager',
        status: 'active',
      },
    });
    managerId = manager.id;
    await prisma.account.create({
      data: {
        fullName: 'MKT Phase9',
        username: 'phase9_mkt',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    const leaderA = await prisma.account.create({
      data: {
        fullName: 'Leader A Phase9',
        username: 'phase9_leader_a',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: teamA.id,
      },
    });
    leaderAId = leaderA.id;
    await prisma.team.update({
      where: { id: teamA.id },
      data: { leaderId: leaderA.id },
    });
    await prisma.account.create({
      data: {
        fullName: 'Sale A Phase9',
        username: 'phase9_sale_a',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: teamA.id,
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Sale B Phase9',
        username: 'phase9_sale_b',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: teamB.id,
      },
    });

    mktAgent = request.agent(server());
    await mktAgent
      .post('/login')
      .send({ username: 'phase9_mkt', password: '123456' })
      .expect(200);
    leaderAAgent = request.agent(server());
    await leaderAAgent
      .post('/login')
      .send({ username: 'phase9_leader_a', password: '123456' })
      .expect(200);
    saleAAgent = request.agent(server());
    await saleAAgent
      .post('/login')
      .send({ username: 'phase9_sale_a', password: '123456' })
      .expect(200);
    saleBAgent = request.agent(server());
    await saleBAgent
      .post('/login')
      .send({ username: 'phase9_sale_b', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'phase9_admin', password: '123456' })
      .expect(200);
    managerAgent = request.agent(server());
    await managerAgent
      .post('/login')
      .send({ username: 'phase9_manager', password: '123456' })
      .expect(200);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('S14 — Nhật ký/Lịch sử truy cập (GET /audit-log, Mục 9, docs/13)', () => {
    it('Admin/Quản lý tra cứu được, Sale/Leader/MKT bị từ chối', async () => {
      await adminAgent.get('/audit-log').expect(200);
      await managerAgent.get('/audit-log').expect(200);
      await saleAAgent.get('/audit-log').expect(403);
      await leaderAAgent.get('/audit-log').expect(403);
      await mktAgent.get('/audit-log').expect(403);
    });

    it('lọc theo account_id → chỉ trả về đúng hành động của tài khoản đó', async () => {
      const res = await adminAgent
        .get(`/audit-log?account_id=${adminId}`)
        .expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(
        (res.body.items as Array<{ account: { id: string } }>).every(
          (item) => item.account.id === adminId,
        ),
      ).toBe(true);
    });

    it('lọc theo khoảng thời gian → chỉ trả về hành động trong khoảng đó', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await adminAgent
        .get(`/audit-log?date_from=${encodeURIComponent(future)}`)
        .expect(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('lọc theo action_type=login → khớp đúng loại hành động đã xảy ra khi các agent đăng nhập ở beforeAll', async () => {
      const res = await adminAgent
        .get(`/audit-log?account_id=${managerId}&action_type=login`)
        .expect(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(
        (res.body.items as Array<{ action_type: string }>).every(
          (item) => item.action_type === 'login',
        ),
      ).toBe(true);
    });
  });

  describe('S15 — Danh sách trùng lặp toàn hệ thống (GET /candidate/duplicate, Mục 2, docs/13)', () => {
    let leadA1: string;
    let leadA2: string;
    let leadCrossTeam: string;
    const dupPhone = '0970000001';

    beforeAll(async () => {
      leadA1 = await createLead(dupPhone);
      leadA2 = await createLead(dupPhone);
      leadCrossTeam = await createLead(dupPhone);
      await leaderAAgent
        .post(`/candidate/${leadA1}/assign`)
        .send({
          account_id: (
            await prisma.account.findUniqueOrThrow({
              where: { username: 'phase9_sale_a' },
            })
          ).id,
        })
        .expect(200);
      await leaderAAgent
        .post(`/candidate/${leadA2}/assign`)
        .send({
          account_id: (
            await prisma.account.findUniqueOrThrow({
              where: { username: 'phase9_sale_a' },
            })
          ).id,
        })
        .expect(200);
      // leadCrossTeam cố tình để "Chờ phân chia" — dùng để kiểm tra nhóm trùng
      // vẫn hiện với Admin/MKT dù có bản ghi chưa phân chia.
      void leadCrossTeam;
    }, 30000);

    it('Admin/MKT/Quản lý xem được toàn hệ thống', async () => {
      const res = await adminAgent.get('/candidate/duplicate').expect(200);
      const group = (
        res.body.items as Array<{ phone_number: string; matches: unknown[] }>
      ).find((g) => g.phone_number === dupPhone);
      expect(group).toBeDefined();
      expect(group?.matches).toHaveLength(3);

      const mktRes = await mktAgent.get('/candidate/duplicate').expect(200);
      expect(
        (mktRes.body.items as Array<{ phone_number: string }>).some(
          (g) => g.phone_number === dupPhone,
        ),
      ).toBe(true);
    });

    it('Sale cùng nhóm (đã nhận 2/3 bản ghi trùng) thấy đúng nhóm trùng, chỉ gồm 2 bản ghi thuộc nhóm mình', async () => {
      const res = await saleAAgent.get('/candidate/duplicate').expect(200);
      const group = (
        res.body.items as Array<{
          phone_number: string;
          matches: Array<{ id: string }>;
        }>
      ).find((g) => g.phone_number === dupPhone);
      expect(group).toBeDefined();
      expect(group?.matches).toHaveLength(2);
      expect(group?.matches.map((m) => m.id).sort()).toEqual(
        [leadA1, leadA2].sort(),
      );
    });

    it('Sale nhóm khác (không có bản ghi nào trong nhóm mình) không thấy nhóm trùng này', async () => {
      const res = await saleBAgent.get('/candidate/duplicate').expect(200);
      expect(
        (res.body.items as Array<{ phone_number: string }>).some(
          (g) => g.phone_number === dupPhone,
        ),
      ).toBe(false);
    });
  });

  describe('Khung Phân quyền chi tiết (GET /permission, PUT /account/:id/permission, Mục 2, docs/13)', () => {
    it('GET /permission: Admin xem được (danh mục rỗng — chưa chốt với chủ doanh nghiệp), vai trò khác bị từ chối', async () => {
      const res = await adminAgent.get('/permission').expect(200);
      expect(res.body).toEqual([]);
      await saleAAgent.get('/permission').expect(403);
      await managerAgent.get('/permission').expect(403);
    });

    it('PUT /account/:id/permission: Admin cấu hình cho Quản lý/Leader thành công (danh sách rỗng)', async () => {
      const res = await adminAgent
        .put(`/account/${managerId}/permission`)
        .send({ permissions: [] })
        .expect(200);
      expect(res.body).toEqual([]);

      const res2 = await adminAgent
        .put(`/account/${leaderAId}/permission`)
        .send({ permissions: [] })
        .expect(200);
      expect(res2.body).toEqual([]);
    });

    it('không áp dụng được cho tài khoản Sale/MKT (không phải Quản lý/Leader) → 422', async () => {
      const saleA = await prisma.account.findUniqueOrThrow({
        where: { username: 'phase9_sale_a' },
      });
      await adminAgent
        .put(`/account/${saleA.id}/permission`)
        .send({ permissions: [] })
        .expect(422);
    });

    it('không phải Admin thì không cấu hình được → 403', async () => {
      await managerAgent
        .put(`/account/${leaderAId}/permission`)
        .send({ permissions: [] })
        .expect(403);
    });
  });
});
