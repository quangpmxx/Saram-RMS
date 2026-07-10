import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 0 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật (không
 * mock) — xem README/backend để biết cách chuẩn bị database trước khi chạy.
 */
describe('Phase 0 — Nền tảng hệ thống & Tài khoản (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminCreds = { username: 'e2e_admin', password: '123456' };
  const createdAccounts: Record<
    string,
    { username: string; password: string }
  > = {};
  let teamId: string;
  let adminAgent: ReturnType<typeof request.agent>;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    // Dọn sạch dữ liệu Phase 0 trước khi chạy, để bộ test tự chứa và lặp lại được.
    // Liệt kê rõ toàn bộ bảng phụ thuộc (lead_notes, interview_appointments,
    // callback_schedules, system_configs, auto_distribution_members/_rules,
    // leads, import_jobs) thay vì chỉ dựa vào CASCADE — PGlite (npx prisma dev)
    // không cascade tin cậy qua nhiều cấp quan hệ (accounts → leads →
    // lead_notes/... , accounts/teams → auto_distribution_rules → _members).
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE lead_notes, interview_appointments, callback_schedules, system_configs, auto_distribution_members, auto_distribution_rules, import_jobs, leads, audit_logs, sessions, accounts, teams RESTART IDENTITY CASCADE',
    );

    const passwordHash = await hashPassword(adminCreds.password);
    await prisma.account.create({
      data: {
        fullName: 'E2E Admin',
        username: adminCreds.username,
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });

    adminAgent = request.agent(server());
  });

  afterAll(async () => {
    await app.close();
  });

  it('từ chối đăng nhập sai mật khẩu', async () => {
    await request(server())
      .post('/login')
      .send({ username: adminCreds.username, password: 'sai-mat-khau' })
      .expect(401);
  });

  it('Admin đăng nhập thành công và nhận cookie phiên đăng nhập', async () => {
    const res = await adminAgent.post('/login').send(adminCreds).expect(200);

    expect(res.body.account.username).toBe(adminCreds.username);
    expect(res.body.account).not.toHaveProperty('passwordHash');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('Admin tạo 1 nhóm mới', async () => {
    const res = await adminAgent
      .post('/team')
      .send({ name: 'Nhóm E2E' })
      .expect(201);

    teamId = res.body.id;
    expect(res.body.name).toBe('Nhóm E2E');
    expect(res.body.member_count).toBe(0);
  });

  it.each([
    ['manager', 'e2e_manager'],
    ['mkt', 'e2e_mkt'],
  ])(
    'Admin tạo tài khoản vai trò %s (không bắt buộc thuộc nhóm)',
    async (role, username) => {
      const res = await adminAgent
        .post('/account')
        .send({ full_name: `Test ${role}`, username, role })
        .expect(201);

      expect(res.body.role).toBe(role);
      expect(res.body.team_id).toBeNull();
      createdAccounts[role] = { username, password: '123456' };
    },
  );

  it('từ chối tạo tài khoản Sale nếu thiếu team_id', async () => {
    await adminAgent
      .post('/account')
      .send({
        full_name: 'Thiếu nhóm',
        username: 'e2e_sale_no_team',
        role: 'sale',
      })
      .expect(422);
  });

  it('Admin tạo tài khoản Leader gắn với nhóm vừa tạo', async () => {
    const res = await adminAgent
      .post('/account')
      .send({
        full_name: 'Test Leader',
        username: 'e2e_leader',
        role: 'leader',
        team_id: teamId,
      })
      .expect(201);

    expect(res.body.team_id).toBe(teamId);
    createdAccounts.leader = { username: 'e2e_leader', password: '123456' };
  });

  it('Admin tạo tài khoản Sale gắn với nhóm vừa tạo', async () => {
    const res = await adminAgent
      .post('/account')
      .send({
        full_name: 'Test Sale',
        username: 'e2e_sale',
        role: 'sale',
        team_id: teamId,
      })
      .expect(201);

    expect(res.body.team_id).toBe(teamId);
    createdAccounts.sale = { username: 'e2e_sale', password: '123456' };
  });

  it('Admin gán tài khoản Leader vừa tạo làm leader chính thức của nhóm', async () => {
    const listRes = await adminAgent
      .get('/account')
      .query({ role: 'leader' })
      .expect(200);
    const leaderAccount = listRes.body.items.find(
      (item: { username: string }) => item.username === 'e2e_leader',
    );
    expect(leaderAccount).toBeDefined();

    const res = await adminAgent
      .put(`/team/${teamId}`)
      .send({ leader_id: leaderAccount.id })
      .expect(200);
    expect(res.body.leader_id).toBe(leaderAccount.id);
  });

  it('Tài khoản Manager vừa tạo đăng nhập được, GET /me trả đúng vai trò', async () => {
    const res = await request(server())
      .post('/login')
      .send(createdAccounts.manager)
      .expect(200);
    expect(res.body.account.role).toBe('manager');
  });

  it('Tài khoản MKT vừa tạo đăng nhập được, GET /me trả đúng vai trò', async () => {
    const res = await request(server())
      .post('/login')
      .send(createdAccounts.mkt)
      .expect(200);
    expect(res.body.account.role).toBe('mkt');
  });

  it('Tài khoản Leader vừa tạo đăng nhập được, GET /me trả đúng vai trò và nhóm', async () => {
    const res = await request(server())
      .post('/login')
      .send(createdAccounts.leader)
      .expect(200);
    expect(res.body.account.role).toBe('leader');
    expect(res.body.account.team_id).toBe(teamId);
  });

  it('Tài khoản Sale vừa tạo đăng nhập được, GET /me trả đúng vai trò và nhóm', async () => {
    const res = await request(server())
      .post('/login')
      .send(createdAccounts.sale)
      .expect(200);
    expect(res.body.account.role).toBe('sale');
    expect(res.body.account.team_id).toBe(teamId);
  });

  it('Sale không có quyền gọi GET /account (chỉ Admin)', async () => {
    const saleAgent = request.agent(server());
    await saleAgent.post('/login').send(createdAccounts.sale).expect(200);
    await saleAgent.get('/account').expect(403);
  });

  it('Leader chỉ thấy nhóm của mình, không thấy nhóm khác', async () => {
    const otherTeamRes = await adminAgent
      .post('/team')
      .send({ name: 'Nhóm Khác' })
      .expect(201);

    const leaderAgent = request.agent(server());
    await leaderAgent.post('/login').send(createdAccounts.leader).expect(200);

    const listRes = await leaderAgent.get('/team').expect(200);
    const teamIds = listRes.body.items.map((t: { id: string }) => t.id);
    expect(teamIds).toContain(teamId);
    expect(teamIds).not.toContain(otherTeamRes.body.id);

    await leaderAgent.get(`/team/${otherTeamRes.body.id}/member`).expect(403);
    await leaderAgent.get(`/team/${teamId}/member`).expect(200);
  });

  it('chỉ Admin được reset mật khẩu, Quản lý/Leader không có quyền này', async () => {
    const listRes = await adminAgent
      .get('/account')
      .query({ role: 'sale' })
      .expect(200);
    const saleId = listRes.body.items[0].id;

    const managerAgent = request.agent(server());
    await managerAgent.post('/login').send(createdAccounts.manager).expect(200);
    await managerAgent.post(`/account/${saleId}/reset-password`).expect(403);

    await adminAgent.post(`/account/${saleId}/reset-password`).expect(200);
  });

  it('vô hiệu hóa tài khoản (xóa mềm) khiến không đăng nhập được nữa', async () => {
    const listRes = await adminAgent
      .get('/account')
      .query({ role: 'mkt' })
      .expect(200);
    const mktId = listRes.body.items[0].id;

    await adminAgent.delete(`/account/${mktId}`).expect(200);

    await request(server())
      .post('/login')
      .send(createdAccounts.mkt)
      .expect(401);
  });

  it('cho phép đăng nhập đồng thời trên nhiều thiết bị với cùng 1 tài khoản', async () => {
    const deviceA = request.agent(server());
    const deviceB = request.agent(server());

    await deviceA
      .post('/login')
      .set('User-Agent', 'device-A')
      .send(createdAccounts.leader)
      .expect(200);
    await deviceB
      .post('/login')
      .set('User-Agent', 'device-B')
      .send(createdAccounts.leader)
      .expect(200);

    await deviceA.get('/me').expect(200);
    await deviceB.get('/me').expect(200);
  });

  it('đăng xuất chỉ thu hồi đúng phiên hiện tại, không ảnh hưởng thiết bị khác', async () => {
    const deviceA = request.agent(server());
    const deviceB = request.agent(server());

    await deviceA.post('/login').send(createdAccounts.leader).expect(200);
    await deviceB.post('/login').send(createdAccounts.leader).expect(200);

    await deviceA.post('/logout').expect(200);
    await deviceA.get('/me').expect(401);
    await deviceB.get('/me').expect(200);
  });

  it('không truy cập được route cần đăng nhập nếu chưa đăng nhập', async () => {
    await request(server()).get('/me').expect(401);
    await request(server()).get('/account').expect(401);
  });
});
