import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 5 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật.
 * Tự tạo dữ liệu/tài khoản riêng (username có tiền tố "phase5_") để không
 * đụng tới dữ liệu của các bộ test khác chạy trên cùng database.
 *
 * Yêu cầu trực tiếp người dùng (2026-07-24): đã gỡ bỏ hẳn worker tự động
 * quét-vào-cột-chăm-sóc (CarePoolScannerService, tham số cấu hình
 * CARE_POOL_THRESHOLD_MINUTES) — các test chỉ kiểm tra logic quét đã bị
 * xóa khỏi bộ test này; các test còn lại (khóa/mở khóa, gỡ khỏi cột, phạm
 * vi xem theo nhóm, giữ/bỏ giữ số) chuyển sang seed thẳng
 * `enteredCarePoolAt` qua Prisma (đường DUY NHẤT còn lại để vào cột chăm
 * sóc) thay vì gọi scanner.
 */
describe('Phase 5 — Cột chăm sóc (Care Pool) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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

  /** Đường DUY NHẤT còn lại để 1 lead vào cột chăm sóc, sau khi gỡ bỏ scanner tự động (2026-07-24). */
  async function enterCarePool(leadId: string) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { enteredCarePoolAt: new Date() },
    });
  }

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
    await prisma.account.create({
      data: {
        fullName: 'Admin Phase5',
        username: 'phase5_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
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
    await enterCarePool(leadId);

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
    await enterCarePool(leadId);

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
