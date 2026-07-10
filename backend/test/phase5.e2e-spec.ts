import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';
import { CarePoolScannerService } from '../src/care-pool/care-pool-scanner.service';
import { CARE_POOL_THRESHOLD_KEY } from '../src/system-config/system-config.service';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 5 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật.
 * Tự tạo dữ liệu/tài khoản riêng (username có tiền tố "phase5_") để không
 * đụng tới dữ liệu của các bộ test khác chạy trên cùng database.
 */
describe('Phase 5 — Cột chăm sóc tự động (Care Pool) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scanner: CarePoolScannerService;
  let facebookSourceId: string;
  let calledStatusId: string;
  let teamId: string;
  let saleAId: string;

  let mktAgent: ReturnType<typeof request.agent>;
  let leaderAgent: ReturnType<typeof request.agent>;
  let saleAAgent: ReturnType<typeof request.agent>;
  let saleBAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'phase5_mkt',
    'phase5_leader',
    'phase5_sale_a',
    'phase5_sale_b',
    'phase5_admin',
    // Tài khoản tạm được tạo ngay trong thân 1 số test case (Sale C, Leader
    // nhóm ngoài) — dọn luôn ở đây để bộ test tự phục hồi nếu lần chạy
    // trước bị dừng giữa chừng trước đoạn dọn dẹp cuối test case đó.
    'phase5_sale_c',
    'phase5_leader_outside',
  ];

  async function backdateActivity(leadId: string, minutesAgo: number) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: new Date(Date.now() - minutesAgo * 60 * 1000) },
    });
  }

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
    scanner = app.get(CarePoolScannerService);

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
    // system_configs.updated_by có thể đang trỏ tới 1 tài khoản phase5_* từ
    // lần chạy trước — xóa trước để không vi phạm khóa ngoại khi xóa account,
    // sẽ tạo lại ngay bên dưới sau khi có tài khoản admin mới của lần chạy này.
    await prisma.systemConfig.deleteMany({
      where: { configKey: CARE_POOL_THRESHOLD_KEY },
    });
    await prisma.account.deleteMany({
      where: { username: { in: USERNAMES } },
    });
    await prisma.team.deleteMany({
      where: { name: { in: ['Phase5 Nhóm', 'Phase5 Nhóm Khác'] } },
    });

    await prisma.leadSource.upsert({
      where: { name: 'Facebook' },
      update: {},
      create: { name: 'Facebook' },
    });
    facebookSourceId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Facebook' } })
    ).id;
    calledStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: { category_code: { category: 'call_status', code: 'CALLED' } },
      })
    ).id;

    const passwordHash = await hashPassword('123456');
    const team = await prisma.team.create({ data: { name: 'Phase5 Nhóm' } });
    teamId = team.id;

    await prisma.account.create({
      data: {
        fullName: 'MKT Phase5',
        username: 'phase5_mkt',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    const adminAccount = await prisma.account.create({
      data: {
        fullName: 'Admin Phase5',
        username: 'phase5_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    // Ngưỡng mặc định 30 phút — luôn tạo mới sạch cho mỗi lần chạy bộ test này.
    await prisma.systemConfig.create({
      data: {
        configKey: CARE_POOL_THRESHOLD_KEY,
        configValue: '30',
        description:
          'Ngưỡng thời gian (phút) trước khi lead bị bỏ quên vào cột chăm sóc',
        updatedById: adminAccount.id,
      },
    });
    const leader = await prisma.account.create({
      data: {
        fullName: 'Leader Phase5',
        username: 'phase5_leader',
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
        fullName: 'Sale A Phase5',
        username: 'phase5_sale_a',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId,
      },
    });
    saleAId = saleA.id;
    await prisma.account.create({
      data: {
        fullName: 'Sale B Phase5',
        username: 'phase5_sale_b',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId,
      },
    });

    mktAgent = request.agent(server());
    await mktAgent
      .post('/login')
      .send({ username: 'phase5_mkt', password: '123456' })
      .expect(200);
    leaderAgent = request.agent(server());
    await leaderAgent
      .post('/login')
      .send({ username: 'phase5_leader', password: '123456' })
      .expect(200);
    saleAAgent = request.agent(server());
    await saleAAgent
      .post('/login')
      .send({ username: 'phase5_sale_a', password: '123456' })
      .expect(200);
    saleBAgent = request.agent(server());
    await saleBAgent
      .post('/login')
      .send({ username: 'phase5_sale_b', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'phase5_admin', password: '123456' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAssignedLead(
    fullName: string,
    phone: string,
    assigneeId: string,
  ) {
    const createRes = await mktAgent
      .post('/candidate')
      .send({
        full_name: fullName,
        phone_number: phone,
        source_id: facebookSourceId,
      })
      .expect(201);
    const leadId = createRes.body.candidate.id as string;
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: assigneeId })
      .expect(200);
    return leadId;
  }

  it('Lead đã xử lý (có last_activity_at), bỏ quên quá ngưỡng → tự động vào cột chăm sóc', async () => {
    const leadId = await createAssignedLead('Bỏ Quên A', '0970000001', saleAId);
    await saleAAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);
    await backdateActivity(leadId, 31);

    await scanner.runScan();

    const list = await saleBAgent
      .get('/care-pool')
      .query({ page_size: 50 })
      .expect(200);
    expect(list.body.items.some((i: { id: string }) => i.id === leadId)).toBe(
      true,
    );
  });

  it('Lead hoàn toàn mới (chưa xử lý lần nào) → KHÔNG vào cột chăm sóc dù để lâu', async () => {
    const leadId = await createAssignedLead(
      'Lead Mới Chưa Gọi',
      '0970000002',
      saleAId,
    );
    // Không cập nhật call-status/call-result gì cả — lastActivityAt vẫn null.

    await scanner.runScan();

    const list = await saleBAgent
      .get('/care-pool')
      .query({ page_size: 50 })
      .expect(200);
    expect(list.body.items.some((i: { id: string }) => i.id === leadId)).toBe(
      false,
    );
  });

  it('Sale giữ số → lead không bị đẩy vào cột chăm sóc dù quá ngưỡng', async () => {
    const leadId = await createAssignedLead('Đã Giữ Số', '0970000003', saleAId);
    await saleAAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);
    await saleAAgent.post(`/candidate/${leadId}/hold`).expect(200);
    await backdateActivity(leadId, 31);

    await scanner.runScan();

    const list = await saleBAgent
      .get('/care-pool')
      .query({ page_size: 50 })
      .expect(200);
    expect(list.body.items.some((i: { id: string }) => i.id === leadId)).toBe(
      false,
    );

    const detail = await saleAAgent.get(`/candidate/${leadId}`).expect(200);
    expect(detail.body.is_held).toBe(true);

    // Bỏ giữ số để dọn trạng thái cho các test khác không phụ thuộc lead này.
    await saleAAgent.delete(`/candidate/${leadId}/hold`).expect(200);
    const afterUnhold = await saleAAgent
      .get(`/candidate/${leadId}`)
      .expect(200);
    expect(afterUnhold.body.is_held).toBe(false);
  });

  it('2 Sale cùng mở 1 lead trong cột chăm sóc → người thứ 2 bị chặn (409) tới khi người thứ 1 giải phóng', async () => {
    const leadId = await createAssignedLead(
      'Cạnh Tranh Khóa',
      '0970000004',
      saleAId,
    );
    await saleAAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);
    await backdateActivity(leadId, 31);
    await scanner.runScan();

    // Sale B chiếm khóa trước. Cần thêm Sale C (không phải chủ sở hữu gốc,
    // khác Sale B) để đúng kịch bản "người thứ 2" — Sale A là chủ sở hữu
    // gốc nên luôn sửa được qua đường "lead của mình", không phản ánh đúng
    // tình huống khóa cần kiểm tra.
    await saleBAgent.post(`/care-pool/${leadId}/lock`).expect(200);

    const passwordHash = await hashPassword('123456');
    const saleC = await prisma.account.create({
      data: {
        fullName: 'Sale C Phase5',
        username: 'phase5_sale_c',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId,
      },
    });
    const saleCAgent = request.agent(server());
    await saleCAgent
      .post('/login')
      .send({ username: 'phase5_sale_c', password: '123456' })
      .expect(200);

    const conflict = await saleCAgent
      .post(`/care-pool/${leadId}/lock`)
      .expect(409);
    expect(conflict.body.message).toContain('Sale B Phase5');

    // Sale C cũng không sửa được vì chưa chiếm khóa (và không phải chủ sở hữu).
    await saleCAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(409);

    // Sale B giải phóng khóa.
    await saleBAgent.post(`/care-pool/${leadId}/release`).expect(200);

    // Giờ Sale C chiếm khóa được.
    await saleCAgent.post(`/care-pool/${leadId}/lock`).expect(200);
    await saleCAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);

    await prisma.session.deleteMany({
      where: { account: { username: 'phase5_sale_c' } },
    });
    await prisma.auditLog.deleteMany({
      where: { account: { username: 'phase5_sale_c' } },
    });
    await prisma.account.delete({ where: { id: saleC.id } });
  });

  it('Admin gỡ lead khỏi cột chăm sóc — không xóa ứng viên, chỉ ẩn khỏi danh sách', async () => {
    const leadId = await createAssignedLead('Sẽ Bị Gỡ', '0970000005', saleAId);
    await saleAAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);
    await backdateActivity(leadId, 31);
    await scanner.runScan();

    let list = await adminAgent
      .get('/care-pool')
      .query({ page_size: 50 })
      .expect(200);
    expect(list.body.items.some((i: { id: string }) => i.id === leadId)).toBe(
      true,
    );

    await saleBAgent.delete(`/care-pool/${leadId}`).expect(403);
    await adminAgent.delete(`/care-pool/${leadId}`).expect(200);

    list = await adminAgent
      .get('/care-pool')
      .query({ page_size: 50 })
      .expect(200);
    expect(list.body.items.some((i: { id: string }) => i.id === leadId)).toBe(
      false,
    );

    const stillExists = await adminAgent
      .get(`/candidate/${leadId}`)
      .expect(200);
    expect(stillExists.body.full_name).toBe('Sẽ Bị Gỡ');
  });

  it('GET /care-pool giới hạn theo nhóm cho Sale/Leader, MKT không có quyền', async () => {
    await mktAgent.get('/care-pool').expect(403);

    // Leader/Sale trong nhóm khác không thấy lead của Phase5 Nhóm.
    const otherTeam = await prisma.team.create({
      data: { name: 'Phase5 Nhóm Khác' },
    });
    const passwordHash = await hashPassword('123456');
    const outsiderLeader = await prisma.account.create({
      data: {
        fullName: 'Leader Ngoài',
        username: 'phase5_leader_outside',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: otherTeam.id,
      },
    });
    const outsiderAgent = request.agent(server());
    await outsiderAgent
      .post('/login')
      .send({ username: 'phase5_leader_outside', password: '123456' })
      .expect(200);

    const outsiderList = await outsiderAgent
      .get('/care-pool')
      .query({ page_size: 50 })
      .expect(200);
    expect(outsiderList.body.total).toBe(0);

    await prisma.session.deleteMany({
      where: { account: { username: 'phase5_leader_outside' } },
    });
    await prisma.auditLog.deleteMany({
      where: { account: { username: 'phase5_leader_outside' } },
    });
    await prisma.account.delete({ where: { id: outsiderLeader.id } });
    await prisma.team.delete({ where: { id: otherTeam.id } });
  });

  it('Đổi ngưỡng thời gian trong Cấu hình hệ thống → hành vi quét áp dụng theo giá trị mới', async () => {
    const leadId = await createAssignedLead(
      'Ngưỡng Mới',
      '0970000006',
      saleAId,
    );
    await saleAAgent
      .put(`/candidate/${leadId}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);
    await backdateActivity(leadId, 10); // chỉ 10 phút — chưa đủ ngưỡng mặc định 30 phút

    await scanner.runScan();
    let list = await saleBAgent
      .get('/care-pool')
      .query({ page_size: 50 })
      .expect(200);
    expect(list.body.items.some((i: { id: string }) => i.id === leadId)).toBe(
      false,
    );

    // Admin đổi ngưỡng xuống 5 phút.
    await adminAgent
      .put(`/config/${CARE_POOL_THRESHOLD_KEY}`)
      .send({ value: '5' })
      .expect(200);

    await scanner.runScan();
    list = await saleBAgent
      .get('/care-pool')
      .query({ page_size: 50 })
      .expect(200);
    expect(list.body.items.some((i: { id: string }) => i.id === leadId)).toBe(
      true,
    );

    // Khôi phục lại ngưỡng mặc định để không ảnh hưởng các test khác.
    await adminAgent
      .put(`/config/${CARE_POOL_THRESHOLD_KEY}`)
      .send({ value: '30' })
      .expect(200);
  });

  it('GET/PUT /config chỉ Admin được dùng', async () => {
    await leaderAgent.get('/config').expect(403);
    await leaderAgent
      .put(`/config/${CARE_POOL_THRESHOLD_KEY}`)
      .send({ value: '20' })
      .expect(403);

    const list = await adminAgent.get('/config').expect(200);
    expect(
      list.body.some((c: { key: string }) => c.key === CARE_POOL_THRESHOLD_KEY),
    ).toBe(true);
  });

  it('Hold/unhold chỉ Sale (lead của mình) được thao tác', async () => {
    const leadId = await createAssignedLead(
      'Test Hold Permission',
      '0970000007',
      saleAId,
    );

    await mktAgent.post(`/candidate/${leadId}/hold`).expect(403);
    await saleBAgent.post(`/candidate/${leadId}/hold`).expect(403); // không phụ trách

    const held = await saleAAgent.post(`/candidate/${leadId}/hold`).expect(200);
    expect(held.body.is_held).toBe(true);

    const unheld = await saleAAgent
      .delete(`/candidate/${leadId}/hold`)
      .expect(200);
    expect(unheld.body.is_held).toBe(false);
  });
});
