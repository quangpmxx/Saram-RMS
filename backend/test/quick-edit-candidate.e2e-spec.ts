import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * UI Polish — PUT /candidate/:id/quick-edit: cho phép TẤT CẢ 5 vai trò sửa
 * nhanh Năm sinh/Địa chỉ trên MỌI ứng viên (không giới hạn theo nhóm/người
 * phụ trách), theo yêu cầu trực tiếp người dùng — KHÁC hẳn phạm vi quyền
 * của PUT /candidate/:id đã chốt tại Mục 4, docs/13. Bộ test này cố ý dùng
 * các tài khoản KHÔNG sở hữu/phụ trách lead để chứng minh không còn giới
 * hạn, đồng thời xác nhận PUT /candidate/:id gốc vẫn giữ nguyên hành vi cũ.
 */
describe('UI Polish — Sửa nhanh Năm sinh/Địa chỉ (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookSourceId: string;
  let leadId: string;

  let mkt1Agent: ReturnType<typeof request.agent>;
  let mkt2Agent: ReturnType<typeof request.agent>;
  let sale1Agent: ReturnType<typeof request.agent>;
  let sale2Agent: ReturnType<typeof request.agent>;
  let leader1Agent: ReturnType<typeof request.agent>;
  let leader2Agent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'qe_mkt_1',
    'qe_mkt_2',
    'qe_sale_1',
    'qe_sale_2',
    'qe_leader_1',
    'qe_leader_2',
    'qe_manager',
    'qe_admin',
  ];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    await prisma.interviewAppointment.deleteMany({});
    await prisma.callbackSchedule.deleteMany({});
    await prisma.leadNote.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.session.deleteMany({
      where: { account: { username: { in: USERNAMES } } },
    });
    await prisma.auditLog.deleteMany({
      where: { account: { username: { in: USERNAMES } } },
    });
    await prisma.account.deleteMany({
      where: { username: { in: USERNAMES } },
    });
    await prisma.team.deleteMany({
      where: { name: { in: ['QE Nhóm 1', 'QE Nhóm 2'] } },
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
    const team1 = await prisma.team.create({ data: { name: 'QE Nhóm 1' } });
    const team2 = await prisma.team.create({ data: { name: 'QE Nhóm 2' } });

    await prisma.account.create({
      data: {
        fullName: 'MKT 1',
        username: 'qe_mkt_1',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'MKT 2',
        username: 'qe_mkt_2',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    const leader1 = await prisma.account.create({
      data: {
        fullName: 'Leader 1',
        username: 'qe_leader_1',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: team1.id,
      },
    });
    await prisma.team.update({
      where: { id: team1.id },
      data: { leaderId: leader1.id },
    });
    const leader2 = await prisma.account.create({
      data: {
        fullName: 'Leader 2',
        username: 'qe_leader_2',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: team2.id,
      },
    });
    await prisma.team.update({
      where: { id: team2.id },
      data: { leaderId: leader2.id },
    });
    const sale1 = await prisma.account.create({
      data: {
        fullName: 'Sale 1',
        username: 'qe_sale_1',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team1.id,
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Sale 2',
        username: 'qe_sale_2',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team2.id,
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Quản lý QE',
        username: 'qe_manager',
        passwordHash,
        role: 'manager',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Admin QE',
        username: 'qe_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });

    mkt1Agent = request.agent(server());
    await mkt1Agent
      .post('/login')
      .send({ username: 'qe_mkt_1', password: '123456' })
      .expect(200);
    mkt2Agent = request.agent(server());
    await mkt2Agent
      .post('/login')
      .send({ username: 'qe_mkt_2', password: '123456' })
      .expect(200);
    sale1Agent = request.agent(server());
    await sale1Agent
      .post('/login')
      .send({ username: 'qe_sale_1', password: '123456' })
      .expect(200);
    sale2Agent = request.agent(server());
    await sale2Agent
      .post('/login')
      .send({ username: 'qe_sale_2', password: '123456' })
      .expect(200);
    leader1Agent = request.agent(server());
    await leader1Agent
      .post('/login')
      .send({ username: 'qe_leader_1', password: '123456' })
      .expect(200);
    leader2Agent = request.agent(server());
    await leader2Agent
      .post('/login')
      .send({ username: 'qe_leader_2', password: '123456' })
      .expect(200);
    managerAgent = request.agent(server());
    await managerAgent
      .post('/login')
      .send({ username: 'qe_manager', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'qe_admin', password: '123456' })
      .expect(200);

    // Lead do mkt1 nhập, Leader1 phân chia cho Sale1 — mọi test dưới đây
    // đều dùng các tài khoản KHÔNG liên quan (mkt2/sale2/leader2) để chứng
    // minh quick-edit không bị giới hạn theo nhóm/người phụ trách.
    const createRes = await mkt1Agent
      .post('/candidate')
      .send({
        full_name: 'Ứng viên QuickEdit',
        phone_number: '0960000001',
        source_id: facebookSourceId,
      })
      .expect(201);
    leadId = createRes.body.candidate.id as string;
    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1.id })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('MKT2 (không phải người upload) vẫn sửa được Năm sinh/Địa chỉ', async () => {
    const res = await mkt2Agent
      .put(`/candidate/${leadId}/quick-edit`)
      .send({ birth_year: 1999, address: '  Hà Nội  ' })
      .expect(200);
    expect(res.body.birth_year).toBe(1999);
    expect(res.body.address).toBe('Hà Nội'); // tự trim khoảng trắng đầu/cuối
  });

  it('Sale2 (không phụ trách) vẫn sửa được', async () => {
    const res = await sale2Agent
      .put(`/candidate/${leadId}/quick-edit`)
      .send({ address: 'Đà Nẵng' })
      .expect(200);
    expect(res.body.address).toBe('Đà Nẵng');
    expect(res.body.birth_year).toBe(1999); // trường không gửi lên giữ nguyên
  });

  it('Leader2 (khác nhóm) vẫn sửa được', async () => {
    const res = await leader2Agent
      .put(`/candidate/${leadId}/quick-edit`)
      .send({ birth_year: 2001 })
      .expect(200);
    expect(res.body.birth_year).toBe(2001);
  });

  it('Quản lý và Admin cũng sửa được', async () => {
    await managerAgent
      .put(`/candidate/${leadId}/quick-edit`)
      .send({ address: 'Cần Thơ' })
      .expect(200);
    const res = await adminAgent
      .put(`/candidate/${leadId}/quick-edit`)
      .send({ birth_year: 1995 })
      .expect(200);
    expect(res.body.birth_year).toBe(1995);
  });

  it('Dữ liệu vẫn còn sau khi tải lại (GET /candidate/:id)', async () => {
    const res = await adminAgent.get(`/candidate/${leadId}`).expect(200);
    expect(res.body.birth_year).toBe(1995);
    expect(res.body.address).toBe('Cần Thơ');
  });

  it('Không cho nhập năm sinh trong tương lai', async () => {
    const futureYear = new Date().getFullYear() + 1;
    await mkt2Agent
      .put(`/candidate/${leadId}/quick-edit`)
      .send({ birth_year: futureYear })
      .expect(422);
  });

  it('Có thể để trống (gửi null) cả 2 trường', async () => {
    const res = await sale2Agent
      .put(`/candidate/${leadId}/quick-edit`)
      .send({ birth_year: null, address: null })
      .expect(200);
    expect(res.body.birth_year).toBeNull();
    expect(res.body.address).toBeNull();
  });

  it('Không sửa các trường khác (Tên/SĐT/Nguồn giữ nguyên)', async () => {
    const before = await adminAgent.get(`/candidate/${leadId}`).expect(200);
    await mkt2Agent
      .put(`/candidate/${leadId}/quick-edit`)
      .send({ address: 'Huế' })
      .expect(200);
    const after = await adminAgent.get(`/candidate/${leadId}`).expect(200);
    expect(after.body.full_name).toBe(before.body.full_name);
    expect(after.body.phone_number).toBe(before.body.phone_number);
    expect(after.body.source.id).toBe(before.body.source.id);
  });

  it('Ghi đúng audit log: ai sửa, ứng viên nào, giá trị cũ/mới', async () => {
    const mkt2 = await prisma.account.findUniqueOrThrow({
      where: { username: 'qe_mkt_2' },
    });
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'lead',
        entityId: leadId,
        accountId: mkt2.id,
        fieldChanged: 'address',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(logs.length).toBeGreaterThan(0);
    const latest = logs[0];
    expect(latest.newValue).toBe('Huế');
    expect(latest.actionType).toBe('update');
  });

  it('PUT /candidate/:id (endpoint gốc) vẫn giữ nguyên giới hạn quyền cũ — không bị nới lỏng theo', async () => {
    // Sale2 không phụ trách lead này — endpoint gốc PUT /candidate/:id vẫn
    // phải từ chối (khác hẳn quick-edit), chứng minh không vô tình nới lỏng.
    await sale2Agent
      .put(`/candidate/${leadId}`)
      .send({ full_name: 'Tên bị đổi trái phép' })
      .expect(403);
  });
});
