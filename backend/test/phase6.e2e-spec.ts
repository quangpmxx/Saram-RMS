import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 6 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật.
 * Tự tạo dữ liệu/tài khoản riêng (tiền tố "p6_") để không đụng dữ liệu của
 * các bộ test khác chạy trên cùng database.
 */
describe('Phase 6 — Tự động phân chia lead (Round-robin) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookSourceId: string;
  let team1Id: string;
  let saleAId: string;
  let saleBId: string;
  let saleCId: string;
  let sale2Id: string;

  let mktAgent: ReturnType<typeof request.agent>;
  let leader1Agent: ReturnType<typeof request.agent>;
  let leader2Agent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;
  let saleAAgent: ReturnType<typeof request.agent>;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'p6_mkt',
    'p6_leader_1',
    'p6_leader_2',
    'p6_admin',
    'p6_manager',
    'p6_sale_a',
    'p6_sale_b',
    'p6_sale_c',
    'p6_sale_2',
  ];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    await prisma.distributionMember.deleteMany({});
    await prisma.distributionRule.deleteMany({});
    await prisma.interviewAppointment.deleteMany({});
    await prisma.callbackSchedule.deleteMany({});
    await prisma.leadNote.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.importJob.deleteMany({
      where: { uploadedBy: { username: { in: USERNAMES } } },
    });
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
      where: { name: { in: ['P6 Nhóm 1', 'P6 Nhóm 2'] } },
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
    const team1 = await prisma.team.create({ data: { name: 'P6 Nhóm 1' } });
    const team2 = await prisma.team.create({ data: { name: 'P6 Nhóm 2' } });
    team1Id = team1.id;

    await prisma.account.create({
      data: {
        fullName: 'MKT P6',
        username: 'p6_mkt',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Admin P6',
        username: 'p6_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Quản lý P6',
        username: 'p6_manager',
        passwordHash,
        role: 'manager',
        status: 'active',
      },
    });
    const leader1 = await prisma.account.create({
      data: {
        fullName: 'Leader 1 P6',
        username: 'p6_leader_1',
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
        fullName: 'Leader 2 P6',
        username: 'p6_leader_2',
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

    const saleA = await prisma.account.create({
      data: {
        fullName: 'Sale A P6',
        username: 'p6_sale_a',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team1.id,
      },
    });
    saleAId = saleA.id;
    const saleB = await prisma.account.create({
      data: {
        fullName: 'Sale B P6',
        username: 'p6_sale_b',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team1.id,
      },
    });
    saleBId = saleB.id;
    const saleC = await prisma.account.create({
      data: {
        fullName: 'Sale C P6',
        username: 'p6_sale_c',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team1.id,
      },
    });
    saleCId = saleC.id;
    const sale2 = await prisma.account.create({
      data: {
        fullName: 'Sale 2 P6',
        username: 'p6_sale_2',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team2.id,
      },
    });
    sale2Id = sale2.id;

    mktAgent = request.agent(server());
    await mktAgent
      .post('/login')
      .send({ username: 'p6_mkt', password: '123456' })
      .expect(200);
    leader1Agent = request.agent(server());
    await leader1Agent
      .post('/login')
      .send({ username: 'p6_leader_1', password: '123456' })
      .expect(200);
    leader2Agent = request.agent(server());
    await leader2Agent
      .post('/login')
      .send({ username: 'p6_leader_2', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'p6_admin', password: '123456' })
      .expect(200);
    managerAgent = request.agent(server());
    await managerAgent
      .post('/login')
      .send({ username: 'p6_manager', password: '123456' })
      .expect(200);
    saleAAgent = request.agent(server());
    await saleAAgent
      .post('/login')
      .send({ username: 'p6_sale_a', password: '123456' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createLead(fullName: string, phone: string) {
    const res = await mktAgent
      .post('/candidate')
      .send({
        full_name: fullName,
        phone_number: phone,
        source_id: facebookSourceId,
      })
      .expect(201);
    return res.body.candidate as {
      id: string;
      assigned_to: { id: string; name: string } | null;
    };
  }

  it('GET /distribution-rule/:teamId trả về mặc định (chưa cấu hình) trước khi Leader thiết lập', async () => {
    const res = await leader1Agent
      .get(`/distribution-rule/${team1Id}`)
      .expect(200);
    expect(res.body.id).toBeNull();
    expect(res.body.is_active).toBe(false);
    expect(res.body.members).toEqual([]);
  });

  it('Sale không có quyền xem/cấu hình; Leader nhóm khác không xem được', async () => {
    await saleAAgent.get(`/distribution-rule/${team1Id}`).expect(403);
    await leader2Agent.get(`/distribution-rule/${team1Id}`).expect(403);
  });

  it('Quản lý/Admin xem được, nhưng KHÔNG được cấu hình/kích hoạt (chỉ Leader nhóm mình)', async () => {
    await adminAgent.get(`/distribution-rule/${team1Id}`).expect(200);
    await managerAgent.get(`/distribution-rule/${team1Id}`).expect(200);
    await adminAgent
      .put(`/distribution-rule/${team1Id}`)
      .send({ account_ids: [saleAId] })
      .expect(403);
    await managerAgent
      .post(`/distribution-rule/${team1Id}/activate`)
      .expect(403);
  });

  it('từ chối cấu hình với tài khoản không phải Sale của đúng nhóm', async () => {
    await leader1Agent
      .put(`/distribution-rule/${team1Id}`)
      .send({ account_ids: [sale2Id] }) // Sale thuộc nhóm khác
      .expect(422);
  });

  it('từ chối kích hoạt khi chưa có thành viên nào', async () => {
    await leader1Agent
      .put(`/distribution-rule/${team1Id}`)
      .send({ account_ids: [] })
      .expect(200);
    await leader1Agent
      .post(`/distribution-rule/${team1Id}/activate`)
      .expect(422);
  });

  it('Leader cấu hình vòng quay 3 Sale (A,B,C), kích hoạt → 3 lead mới liên tiếp gán đúng thứ tự A→B→C, lead thứ 4 quay lại A', async () => {
    const configured = await leader1Agent
      .put(`/distribution-rule/${team1Id}`)
      .send({ account_ids: [saleAId, saleBId, saleCId] })
      .expect(200);
    expect(
      configured.body.members.map((m: { account_id: string }) => m.account_id),
    ).toEqual([saleAId, saleBId, saleCId]);
    expect(configured.body.last_assigned_position).toBe(0);

    const activated = await leader1Agent
      .post(`/distribution-rule/${team1Id}/activate`)
      .expect(200);
    expect(activated.body.is_active).toBe(true);

    const lead1 = await createLead('RR Lead 1', '0990000001');
    const lead2 = await createLead('RR Lead 2', '0990000002');
    const lead3 = await createLead('RR Lead 3', '0990000003');
    const lead4 = await createLead('RR Lead 4', '0990000004');

    expect(lead1.assigned_to?.id).toBe(saleAId);
    expect(lead2.assigned_to?.id).toBe(saleBId);
    expect(lead3.assigned_to?.id).toBe(saleCId);
    expect(lead4.assigned_to?.id).toBe(saleAId);
  });

  it('Tạm dừng giữa chừng → lead mới tiếp theo KHÔNG tự gán, quay về luồng thủ công (Phase 2)', async () => {
    const paused = await leader1Agent
      .post(`/distribution-rule/${team1Id}/pause`)
      .expect(200);
    expect(paused.body.is_active).toBe(false);

    const lead = await createLead('RR Lead Sau Pause', '0990000005');
    expect(lead.assigned_to).toBeNull();

    // Vẫn phân chia thủ công được bình thường (Phase 2 không bị phá vỡ).
    const assigned = await leader1Agent
      .post(`/candidate/${lead.id}/assign`)
      .send({ account_id: saleBId })
      .expect(200);
    expect(assigned.body.assigned_to.id).toBe(saleBId);
    expect(assigned.body.assignment_method).toBe('manual');
  });

  it('Chạy song song không phá vỡ Phase 2: nhóm chưa bật auto vẫn phân chia thủ công bình thường', async () => {
    const lead = await createLead('RR Nhóm Khác Chưa Bật Auto', '0990000006');
    expect(lead.assigned_to).toBeNull(); // team2 chưa từng cấu hình — vẫn "Chờ phân chia"

    const assigned = await leader2Agent
      .post(`/candidate/${lead.id}/assign`)
      .send({ account_id: sale2Id })
      .expect(200);
    expect(assigned.body.assigned_to.id).toBe(sale2Id);
  });

  it('Tài khoản trong vòng quay bị vô hiệu hóa → tự động bỏ qua khi đến lượt, không chặn cả vòng quay', async () => {
    // Kích hoạt lại vòng quay A,B,C — vị trí đã reset về 0 sau lần PUT gần nhất của Leader1.
    await leader1Agent
      .put(`/distribution-rule/${team1Id}`)
      .send({ account_ids: [saleAId, saleBId, saleCId] })
      .expect(200);
    await leader1Agent
      .post(`/distribution-rule/${team1Id}/activate`)
      .expect(200);

    // Vô hiệu hóa Sale B (vị trí thứ 2 trong vòng quay).
    await adminAgent.delete(`/account/${saleBId}`).expect(200);

    const lead1 = await createLead('RR Skip 1', '0990000007');
    const lead2 = await createLead('RR Skip 2', '0990000008');
    const lead3 = await createLead('RR Skip 3', '0990000009');

    expect(lead1.assigned_to?.id).toBe(saleAId);
    expect(lead2.assigned_to?.id).toBe(saleCId); // bỏ qua B (đã vô hiệu hóa)
    expect(lead3.assigned_to?.id).toBe(saleAId); // quay lại từ đầu

    // Dọn trạng thái: kích hoạt lại Sale B, tạm dừng vòng quay để không ảnh hưởng test khác.
    await prisma.account.update({
      where: { id: saleBId },
      data: { status: 'active' },
    });
    await leader1Agent.post(`/distribution-rule/${team1Id}/pause`).expect(200);
  });

  it('Lead từ import Excel cũng được tự động phân chia giống hệt lead nhập tay', async () => {
    await leader1Agent
      .put(`/distribution-rule/${team1Id}`)
      .send({ account_ids: [saleAId] })
      .expect(200);
    await leader1Agent
      .post(`/distribution-rule/${team1Id}/activate`)
      .expect(200);

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ứng viên');
    sheet.addRow([
      'Tên lao động',
      'Số điện thoại',
      'Nguồn',
      'Năm sinh',
      'Địa chỉ',
      'Ghi chú',
    ]);
    sheet.addRow(['RR Import Lead', '0990000010', 'Facebook', '', '', '']);
    const buffer = (await workbook.xlsx.writeBuffer()) as Buffer;

    const importRes = await mktAgent
      .post('/candidate/import')
      .attach('file', buffer, 'import.xlsx')
      .expect(201);
    const jobId = importRes.body.job_id as string;

    let status = 'pending';
    for (let attempt = 0; attempt < 30 && status !== 'completed'; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const statusRes = await mktAgent
        .get(`/candidate/import/${jobId}`)
        .expect(200);
      status = statusRes.body.status as string;
    }
    expect(status).toBe('completed');

    const list = await adminAgent
      .get('/candidate')
      .query({ keyword: 'RR Import Lead', page: 1, page_size: 5 })
      .expect(200);
    expect(list.body.items[0].assigned_to?.id).toBe(saleAId);

    await leader1Agent.post(`/distribution-rule/${team1Id}/pause`).expect(200);
  });
});
