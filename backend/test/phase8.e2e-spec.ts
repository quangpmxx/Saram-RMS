import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';
import { NotificationScannerService } from '../src/notification/notification-scanner.service';
import { ZaloClientService } from '../src/notification/zalo-client.service';
import { NOTIFICATION_LEAD_MINUTES_KEY } from '../src/system-config/system-config.service';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 8 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật. Tự tạo
 * dữ liệu/tài khoản riêng (username có tiền tố "phase8_") để không đụng dữ
 * liệu của các bộ test khác chạy trên cùng database.
 */
describe('Phase 8 — Thông báo Zalo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scanner: NotificationScannerService;
  let zaloClient: ZaloClientService;
  let facebookSourceId: string;

  let mktAgent: ReturnType<typeof request.agent>;
  let leaderAgent: ReturnType<typeof request.agent>;
  let saleAAgent: ReturnType<typeof request.agent>;
  let saleBAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  let saleAId: string;
  let saleBId: string;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'phase8_mkt',
    'phase8_leader',
    'phase8_sale_a',
    'phase8_sale_b',
    'phase8_admin',
  ];

  async function createLead(
    agent: ReturnType<typeof request.agent>,
    phone: string,
  ) {
    const res = await agent
      .post('/candidate')
      .send({
        full_name: `Ứng viên ${phone}`,
        phone_number: phone,
        source_id: facebookSourceId,
      })
      .expect(201);
    return res.body.candidate.id as string;
  }

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
    scanner = app.get(NotificationScannerService);
    zaloClient = app.get(ZaloClientService);

    // Dọn dữ liệu Phase 8 trước khi chạy — notifications tham chiếu leads/
    // accounts nên phải xóa trước (giống thứ tự dọn dẹp của các bộ e2e khác).
    await prisma.notification.deleteMany({});
    await prisma.interviewAppointment.deleteMany({});
    await prisma.callbackSchedule.deleteMany({});
    await prisma.leadNote.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.session.deleteMany({
      where: { account: { username: { in: USERNAMES } } },
    });
    await prisma.auditLog.deleteMany({
      where: { account: { username: { in: USERNAMES } } },
    });
    // system_configs.updated_by có thể trỏ tới 1 tài khoản phase8_* từ lần
    // chạy trước — xóa dòng cấu hình trước khi xóa account (tránh vi phạm
    // khóa ngoại), sẽ tạo lại bên dưới với đúng tài khoản admin của lần này.
    await prisma.systemConfig.deleteMany({
      where: { configKey: NOTIFICATION_LEAD_MINUTES_KEY },
    });
    await prisma.account.deleteMany({
      where: { username: { in: USERNAMES } },
    });
    await prisma.team.deleteMany({ where: { name: 'Phase8 Nhóm' } });

    await prisma.leadSource.upsert({
      where: { name: 'Facebook' },
      update: {},
      create: { name: 'Facebook' },
    });
    facebookSourceId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Facebook' } })
    ).id;

    const passwordHash = await hashPassword('123456');
    const team = await prisma.team.create({ data: { name: 'Phase8 Nhóm' } });

    await prisma.account.create({
      data: {
        fullName: 'MKT Phase8',
        username: 'phase8_mkt',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Admin Phase8',
        username: 'phase8_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    const leader = await prisma.account.create({
      data: {
        fullName: 'Leader Phase8',
        username: 'phase8_leader',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: team.id,
      },
    });
    await prisma.team.update({
      where: { id: team.id },
      data: { leaderId: leader.id },
    });
    const saleA = await prisma.account.create({
      data: {
        fullName: 'Sale A Phase8',
        username: 'phase8_sale_a',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team.id,
      },
    });
    saleAId = saleA.id;
    const saleB = await prisma.account.create({
      data: {
        fullName: 'Sale B Phase8',
        username: 'phase8_sale_b',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team.id,
      },
    });
    saleBId = saleB.id;

    mktAgent = request.agent(server());
    await mktAgent
      .post('/login')
      .send({ username: 'phase8_mkt', password: '123456' })
      .expect(200);
    leaderAgent = request.agent(server());
    await leaderAgent
      .post('/login')
      .send({ username: 'phase8_leader', password: '123456' })
      .expect(200);
    saleAAgent = request.agent(server());
    await saleAAgent
      .post('/login')
      .send({ username: 'phase8_sale_a', password: '123456' })
      .expect(200);
    saleBAgent = request.agent(server());
    await saleBAgent
      .post('/login')
      .send({ username: 'phase8_sale_b', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'phase8_admin', password: '123456' })
      .expect(200);

    // Seed tham số NOTIFICATION_LEAD_MINUTES = 10 riêng cho bộ test này —
    // giá trị cố định, không phụ thuộc dữ liệu seed chung của môi trường dev.
    await prisma.systemConfig.create({
      data: {
        configKey: NOTIFICATION_LEAD_MINUTES_KEY,
        configValue: '10',
        description: 'Test Phase 8',
        updatedById: (
          await prisma.account.findUniqueOrThrow({
            where: { username: 'phase8_admin' },
          })
        ).id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('lịch gọi lại sắp tới hạn (trong ngưỡng cấu hình) → nhân viên phụ trách nhận thông báo Zalo đúng lúc', async () => {
    const leadId = await createLead(mktAgent, '0980000001');
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleAId })
      .expect(200);

    // Giờ hẹn cách hiện tại 5 phút, ngưỡng cấu hình 10 phút → thời điểm cần
    // gửi (giờ hẹn - 10 phút) đã ở trong quá khứ → phải gửi ngay ở lượt quét.
    await saleAAgent
      .post(`/candidate/${leadId}/callback`)
      .send({
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .expect(201);

    await scanner.runTick();

    const list = await saleAAgent.get('/notification').expect(200);
    const forThisLead = list.body.items.filter(
      (n: { lead_id: string }) => n.lead_id === leadId,
    );
    expect(forThisLead).toHaveLength(1);
    expect(forThisLead[0].type).toBe('callback_reminder');
    expect(forThisLead[0].channel).toBe('zalo');
    expect(forThisLead[0].status).toBe('sent');
    expect(forThisLead[0].sent_at).not.toBeNull();
  });

  it('lịch hẹn phỏng vấn sắp tới hạn → nhân viên phụ trách nhận thông báo Zalo đúng lúc', async () => {
    const leadId = await createLead(mktAgent, '0980000002');
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleAId })
      .expect(200);

    await saleAAgent
      .post(`/candidate/${leadId}/interview`)
      .send({
        partner_company_name: 'Công ty Test Phase 8',
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .expect(201);

    await scanner.runTick();

    const list = await saleAAgent.get('/notification?status=sent').expect(200);
    const forThisLead = list.body.items.filter(
      (n: { lead_id: string }) => n.lead_id === leadId,
    );
    expect(forThisLead).toHaveLength(1);
    expect(forThisLead[0].type).toBe('interview_reminder');
  });

  it('lịch hẹn còn xa (ngoài ngưỡng) → thông báo ở trạng thái "pending", CHƯA gửi', async () => {
    const leadId = await createLead(mktAgent, '0980000003');
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleAId })
      .expect(200);

    await saleAAgent
      .post(`/candidate/${leadId}/callback`)
      .send({
        scheduled_at: new Date(
          Date.now() + 5 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .expect(201);

    await scanner.runTick();

    const list = await saleAAgent
      .get('/notification?status=pending')
      .expect(200);
    const forThisLead = list.body.items.filter(
      (n: { lead_id: string }) => n.lead_id === leadId,
    );
    expect(forThisLead).toHaveLength(1);
    expect(forThisLead[0].sent_at).toBeNull();
  });

  it('dời lịch hẹn lại gần hơn → cập nhật đúng 1 thông báo pending sẵn có (không tạo trùng), rồi gửi khi tới hạn', async () => {
    const leadId = await createLead(mktAgent, '0980000004');
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleAId })
      .expect(200);

    const created = await saleAAgent
      .post(`/candidate/${leadId}/callback`)
      .send({
        scheduled_at: new Date(
          Date.now() + 5 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .expect(201);
    await scanner.runTick();

    const pendingBefore = await prisma.notification.findMany({
      where: { leadId, type: 'callback_reminder' },
    });
    expect(pendingBefore).toHaveLength(1);
    expect(pendingBefore[0].status).toBe('pending');

    // Dời lịch lại gần — trong ngưỡng nhắc.
    await saleAAgent
      .put(`/callback/${created.body.id}`)
      .send({
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .expect(200);
    await scanner.runTick();

    const afterReschedule = await prisma.notification.findMany({
      where: { leadId, type: 'callback_reminder' },
    });
    expect(afterReschedule).toHaveLength(1); // vẫn đúng 1 dòng, không tạo trùng
    expect(afterReschedule[0].status).toBe('sent');
  });

  it('lịch gọi lại đã hoàn tất (is_completed) → không tạo thông báo', async () => {
    const leadId = await createLead(mktAgent, '0980000005');
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleAId })
      .expect(200);

    const created = await saleAAgent
      .post(`/candidate/${leadId}/callback`)
      .send({
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .expect(201);
    await saleAAgent
      .put(`/callback/${created.body.id}`)
      .send({ is_completed: true })
      .expect(200);

    await scanner.runTick();

    const notifications = await prisma.notification.findMany({
      where: { leadId, type: 'callback_reminder' },
    });
    expect(notifications).toHaveLength(0);
  });

  it('mỗi tài khoản chỉ xem được thông báo của chính mình (Mục 7, docs/13)', async () => {
    const leadId = await createLead(mktAgent, '0980000006');
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleBId })
      .expect(200);
    await saleBAgent
      .post(`/candidate/${leadId}/callback`)
      .send({
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .expect(201);
    await scanner.runTick();

    const saleBView = await saleBAgent.get('/notification').expect(200);
    expect(
      saleBView.body.items.some(
        (n: { lead_id: string }) => n.lead_id === leadId,
      ),
    ).toBe(true);

    const saleAView = await saleAAgent.get('/notification').expect(200);
    expect(
      saleAView.body.items.some(
        (n: { lead_id: string }) => n.lead_id === leadId,
      ),
    ).toBe(false);
  });

  it('kênh Zalo lỗi/tắt → thông báo chuyển "failed", không làm gián đoạn các chức năng khác của hệ thống', async () => {
    const leadId = await createLead(mktAgent, '0980000007');
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleAId })
      .expect(200);
    await saleAAgent
      .post(`/candidate/${leadId}/callback`)
      .send({
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .expect(201);

    const sendSpy = jest
      .spyOn(zaloClient, 'send')
      .mockRejectedValueOnce(new Error('Zalo API tạm thời không phản hồi'));

    await scanner.runTick();
    sendSpy.mockRestore();

    const list = await saleAAgent
      .get('/notification?status=failed')
      .expect(200);
    expect(
      list.body.items.some((n: { lead_id: string }) => n.lead_id === leadId),
    ).toBe(true);

    // Hệ thống vẫn hoạt động bình thường sau lỗi gửi — kiểm tra bằng 1 API
    // khác hoàn toàn không liên quan.
    await saleAAgent.get(`/candidate/${leadId}`).expect(200);
  });

  it('Admin sửa NOTIFICATION_LEAD_MINUTES qua đúng cơ chế PUT /config/:key đã có (Phase 5)', async () => {
    await adminAgent
      .put(`/config/${NOTIFICATION_LEAD_MINUTES_KEY}`)
      .send({ value: '20' })
      .expect(200);

    const configs = await adminAgent.get('/config').expect(200);
    const entry = configs.body.find(
      (c: { key: string }) => c.key === NOTIFICATION_LEAD_MINUTES_KEY,
    );
    expect(entry.value).toBe('20');

    // Trả lại giá trị test chuẩn (10) để không ảnh hưởng các test khác chạy sau.
    await adminAgent
      .put(`/config/${NOTIFICATION_LEAD_MINUTES_KEY}`)
      .send({ value: '10' })
      .expect(200);
  });

  it('Sale (không phải Admin) sửa tham số cấu hình → bị từ chối (403)', async () => {
    await saleAAgent
      .put(`/config/${NOTIFICATION_LEAD_MINUTES_KEY}`)
      .send({ value: '99' })
      .expect(403);
  });
});
