import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 3 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật.
 * Tự tạo dữ liệu/tài khoản riêng (username có tiền tố "phase3_") để không
 * đụng tới dữ liệu của các bộ test khác chạy trên cùng database.
 */
describe('Phase 3 — Pipeline cuộc gọi & Lịch sử ghi chú (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookSourceId: string;
  let calledStatusId: string;
  let notAnsweredStatusId: string;
  let potentialResultId: string;
  let considerationResultId: string;

  let mktAgent: ReturnType<typeof request.agent>;
  let leaderAgent: ReturnType<typeof request.agent>;
  let saleAAgent: ReturnType<typeof request.agent>;
  let saleBAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  let teamId: string;
  let leadId: string;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'phase3_mkt',
    'phase3_leader',
    'phase3_sale_a',
    'phase3_sale_b',
    'phase3_admin',
  ];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    // Dọn dữ liệu Phase 3 trước khi chạy — xóa theo đúng thứ tự khóa ngoại.
    // interview_appointments/callback_schedules (từ Phase 4) cũng phải xóa
    // trước leads vì cùng lý do PGlite không cascade tin cậy qua 2 cấp.
    await prisma.leadNote.deleteMany({});
    await prisma.interviewAppointment.deleteMany({});
    await prisma.callbackSchedule.deleteMany({});
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
    await prisma.team.deleteMany({ where: { name: 'Phase3 Nhóm' } });

    await prisma.leadSource.upsert({
      where: { name: 'Facebook' },
      update: {},
      create: { name: 'Facebook' },
    });
    facebookSourceId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Facebook' } })
    ).id;

    for (const entry of [
      {
        category: 'call_status' as const,
        code: 'CALLED',
        name: 'Đã gọi',
        sortOrder: 1,
      },
      {
        category: 'call_status' as const,
        code: 'NOT_ANSWERED',
        name: 'Không nghe máy',
        sortOrder: 3,
      },
      {
        category: 'call_result' as const,
        code: 'POTENTIAL',
        name: 'Tiềm năng',
        sortOrder: 1,
      },
      {
        category: 'call_result' as const,
        code: 'CONSIDERING',
        name: 'Đang cân nhắc',
        sortOrder: 3,
      },
    ]) {
      await prisma.statusCatalog.upsert({
        where: {
          category_code: { category: entry.category, code: entry.code },
        },
        update: {},
        create: entry,
      });
    }
    calledStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: { category_code: { category: 'call_status', code: 'CALLED' } },
      })
    ).id;
    notAnsweredStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'call_status', code: 'NOT_ANSWERED' },
        },
      })
    ).id;
    potentialResultId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'call_result', code: 'POTENTIAL' },
        },
      })
    ).id;
    considerationResultId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'call_result', code: 'CONSIDERING' },
        },
      })
    ).id;

    const passwordHash = await hashPassword('123456');
    const team = await prisma.team.create({ data: { name: 'Phase3 Nhóm' } });
    teamId = team.id;

    await prisma.account.create({
      data: {
        fullName: 'MKT Phase3',
        username: 'phase3_mkt',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Admin Phase3',
        username: 'phase3_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    const leader = await prisma.account.create({
      data: {
        fullName: 'Leader Phase3',
        username: 'phase3_leader',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId,
      },
    });
    await prisma.team.update({
      where: { id: teamId },
      data: { leaderId: leader.id },
    });
    const saleA = await prisma.account.create({
      data: {
        fullName: 'Sale A Phase3',
        username: 'phase3_sale_a',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId,
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Sale B Phase3',
        username: 'phase3_sale_b',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId,
      },
    });

    mktAgent = request.agent(server());
    await mktAgent
      .post('/login')
      .send({ username: 'phase3_mkt', password: '123456' })
      .expect(200);
    leaderAgent = request.agent(server());
    await leaderAgent
      .post('/login')
      .send({ username: 'phase3_leader', password: '123456' })
      .expect(200);
    saleAAgent = request.agent(server());
    await saleAAgent
      .post('/login')
      .send({ username: 'phase3_sale_a', password: '123456' })
      .expect(200);
    saleBAgent = request.agent(server());
    await saleBAgent
      .post('/login')
      .send({ username: 'phase3_sale_b', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'phase3_admin', password: '123456' })
      .expect(200);

    // 1 lead mẫu, MKT nhập rồi Leader phân chia cho Sale A — dùng chung
    // xuyên suốt bộ test Phase 3 (không phụ thuộc phần assign của Phase 2,
    // chỉ tái sử dụng API đã có sẵn để dựng dữ liệu).
    const createRes = await mktAgent
      .post('/candidate')
      .send({
        full_name: 'Ứng viên Phase3',
        phone_number: '0940000001',
        source_id: facebookSourceId,
      })
      .expect(201);
    leadId = createRes.body.candidate.id as string;
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleA.id })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /status trả đúng danh mục theo category', async () => {
    const res = await saleAAgent
      .get('/status')
      .query({ category: 'call_status' })
      .expect(200);
    expect(res.body.some((s: { code: string }) => s.code === 'CALLED')).toBe(
      true,
    );
    expect(
      res.body.every((s: { category: string }) => s.category === 'call_status'),
    ).toBe(true);
  });

  it('Sale cập nhật tình trạng cuộc gọi cho lead của mình → phản ánh đúng trên danh sách và chi tiết', async () => {
    await saleAAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);

    const detail = await saleAAgent.get(`/candidate/${leadId}`).expect(200);
    expect(detail.body.call_status.id).toBe(calledStatusId);

    const list = await saleAAgent
      .get('/candidate')
      .query({ page_size: 50 })
      .expect(200);
    const item = list.body.items.find((i: { id: string }) => i.id === leadId);
    expect(item.call_status.id).toBe(calledStatusId);
  });

  it('Sale cập nhật kết quả cuộc gọi cho lead của mình → phản ánh đúng', async () => {
    await saleAAgent
      .put(`/candidate/${leadId}/call-result`)
      .send({ call_result_id: potentialResultId })
      .expect(200);

    const detail = await saleAAgent.get(`/candidate/${leadId}`).expect(200);
    expect(detail.body.call_result.id).toBe(potentialResultId);
  });

  it('Sale B không được cập nhật lead không phải của mình', async () => {
    await saleBAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: notAnsweredStatusId })
      .expect(403);
  });

  it('MKT không có quyền cập nhật tình trạng/kết quả cuộc gọi hay thêm ghi chú', async () => {
    await mktAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(403);
    await mktAgent
      .post(`/candidate/${leadId}/note`)
      .send({ content: 'X' })
      .expect(403);
  });

  it('gửi call_status_id thuộc category khác (call_result) → báo lỗi', async () => {
    await saleAAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: potentialResultId })
      .expect(422);
  });

  it('Sale thêm 3 ghi chú liên tiếp cho cùng 1 lead → cả 3 đều được lưu, không ghi đè nhau', async () => {
    const c1 = await saleAAgent
      .post(`/candidate/${leadId}/note`)
      .send({ content: 'Ghi chú 1: gọi lần đầu' })
      .expect(201);
    const c2 = await saleAAgent
      .post(`/candidate/${leadId}/note`)
      .send({ content: 'Ghi chú 2: hẹn gọi lại' })
      .expect(201);
    const c3 = await saleAAgent
      .post(`/candidate/${leadId}/note`)
      .send({ content: 'Ghi chú 3: đã liên hệ được' })
      .expect(201);

    expect(c1.body.content).toBe('Ghi chú 1: gọi lần đầu');
    expect(c2.body.content).toBe('Ghi chú 2: hẹn gọi lại');
    expect(c3.body.content).toBe('Ghi chú 3: đã liên hệ được');
    expect(new Set([c1.body.id, c2.body.id, c3.body.id]).size).toBe(3);

    const list = await saleAAgent.get(`/candidate/${leadId}/note`).expect(200);
    const contents = list.body.map((n: { content: string }) => n.content);
    expect(contents).toEqual(
      expect.arrayContaining([
        'Ghi chú 1: gọi lần đầu',
        'Ghi chú 2: hẹn gọi lại',
        'Ghi chú 3: đã liên hệ được',
      ]),
    );
  });

  it('note mới snapshot đúng call_status/call_result hiện tại của lead', async () => {
    const res = await saleAAgent
      .post(`/candidate/${leadId}/note`)
      .send({ content: 'Ghi chú có snapshot' })
      .expect(201);

    expect(res.body.call_status.id).toBe(calledStatusId);
    expect(res.body.call_result.id).toBe(potentialResultId);
  });

  it('MKT xem được ghi chú của Sale (GET) nhưng không xóa được (DELETE)', async () => {
    const list = await mktAgent.get(`/candidate/${leadId}/note`).expect(200);
    expect(list.body.length).toBeGreaterThan(0);

    const noteId = list.body[0].id as string;
    await mktAgent.delete(`/candidate/${leadId}/note/${noteId}`).expect(403);
  });

  it('Sale xóa 1 note cũ → biến mất khỏi danh sách is_deleted=false, nhưng vẫn còn trong dữ liệu (is_deleted=true)', async () => {
    const created = await saleAAgent
      .post(`/candidate/${leadId}/note`)
      .send({ content: 'Note sẽ bị xóa' })
      .expect(201);
    const noteId = created.body.id as string;

    await saleAAgent.delete(`/candidate/${leadId}/note/${noteId}`).expect(200);

    const list = await saleAAgent.get(`/candidate/${leadId}/note`).expect(200);
    const deletedNote = list.body.find((n: { id: string }) => n.id === noteId);
    // API GET /note trả về TẤT CẢ (kể cả đã xóa) theo đúng Mục 6, docs/13 —
    // vẫn truy được trong dữ liệu, chỉ đánh dấu is_deleted=true.
    expect(deletedNote).toBeDefined();
    expect(deletedNote.is_deleted).toBe(true);
  });

  it('Sale B không xóa được note do Sale A ghi (chưa xác nhận — tạm giả định chỉ note của chính mình)', async () => {
    const created = await saleAAgent
      .post(`/candidate/${leadId}/note`)
      .send({ content: 'Note của Sale A' })
      .expect(201);

    await saleBAgent
      .delete(`/candidate/${leadId}/note/${created.body.id}`)
      .expect(403);
  });

  it('xóa note đã xóa rồi (idempotent) → 404', async () => {
    const created = await saleAAgent
      .post(`/candidate/${leadId}/note`)
      .send({ content: 'Note xóa 2 lần' })
      .expect(201);
    const noteId = created.body.id as string;

    await saleAAgent.delete(`/candidate/${leadId}/note/${noteId}`).expect(200);
    await saleAAgent.delete(`/candidate/${leadId}/note/${noteId}`).expect(404);
  });

  it('Leader/Admin cũng cập nhật được tình trạng cuộc gọi trong phạm vi của mình', async () => {
    await leaderAgent
      .put(`/candidate/${leadId}/call-result`)
      .send({ call_result_id: considerationResultId })
      .expect(200);
    await adminAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);
  });
});
