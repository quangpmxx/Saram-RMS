import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành" của Phase 4 trong
 * docs/14-roadmap.md. Cần kết nối DATABASE_URL thật. Tự tạo dữ liệu/tài
 * khoản riêng (username có tiền tố "phase4_") để không đụng dữ liệu của
 * các bộ test khác chạy trên cùng database.
 */
describe('Phase 4 — Lịch phỏng vấn, lịch gọi lại & Calendar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookSourceId: string;
  let scheduledStatusId: string;
  let noShowStatusId: string;
  let attendedStatusId: string;
  let passedStatusId: string;
  let failedStatusId: string;
  let employedStatusId: string;
  let notEmployedStatusId: string;

  let mktAgent: ReturnType<typeof request.agent>;
  let leaderAgent: ReturnType<typeof request.agent>;
  let saleAAgent: ReturnType<typeof request.agent>;
  let saleBAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  let saleAId: string;
  let leadId: string;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'phase4_mkt',
    'phase4_leader',
    'phase4_sale_a',
    'phase4_sale_b',
    'phase4_admin',
  ];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    // Dọn dữ liệu Phase 4 trước khi chạy — interview_appointments/
    // callback_schedules phải xóa trước leads (PGlite không cascade tin cậy
    // qua 2 cấp quan hệ accounts → leads → ...).
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
    await prisma.account.deleteMany({
      where: { username: { in: USERNAMES } },
    });
    await prisma.team.deleteMany({ where: { name: 'Phase4 Nhóm' } });

    await prisma.leadSource.upsert({
      where: { name: 'Facebook' },
      update: {},
      create: { name: 'Facebook' },
    });
    facebookSourceId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Facebook' } })
    ).id;

    scheduledStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'interview_status', code: 'SCHEDULED' },
        },
      })
    ).id;
    noShowStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'interview_status', code: 'NO_SHOW' },
        },
      })
    ).id;
    attendedStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'interview_status', code: 'ATTENDED' },
        },
      })
    ).id;
    passedStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'interview_status', code: 'PASSED' },
        },
      })
    ).id;
    failedStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'interview_status', code: 'FAILED' },
        },
      })
    ).id;
    employedStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'employment_status', code: 'EMPLOYED' },
        },
      })
    ).id;
    notEmployedStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: {
            category: 'employment_status',
            code: 'NOT_EMPLOYED',
          },
        },
      })
    ).id;

    const passwordHash = await hashPassword('123456');
    const team = await prisma.team.create({ data: { name: 'Phase4 Nhóm' } });

    await prisma.account.create({
      data: {
        fullName: 'MKT Phase4',
        username: 'phase4_mkt',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Admin Phase4',
        username: 'phase4_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    const leader = await prisma.account.create({
      data: {
        fullName: 'Leader Phase4',
        username: 'phase4_leader',
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
        fullName: 'Sale A Phase4',
        username: 'phase4_sale_a',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team.id,
      },
    });
    saleAId = saleA.id;
    await prisma.account.create({
      data: {
        fullName: 'Sale B Phase4',
        username: 'phase4_sale_b',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team.id,
      },
    });

    mktAgent = request.agent(server());
    await mktAgent
      .post('/login')
      .send({ username: 'phase4_mkt', password: '123456' })
      .expect(200);
    leaderAgent = request.agent(server());
    await leaderAgent
      .post('/login')
      .send({ username: 'phase4_leader', password: '123456' })
      .expect(200);
    saleAAgent = request.agent(server());
    await saleAAgent
      .post('/login')
      .send({ username: 'phase4_sale_a', password: '123456' })
      .expect(200);
    saleBAgent = request.agent(server());
    await saleBAgent
      .post('/login')
      .send({ username: 'phase4_sale_b', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'phase4_admin', password: '123456' })
      .expect(200);

    const createRes = await mktAgent
      .post('/candidate')
      .send({
        full_name: 'Ứng viên Phase4',
        phone_number: '0950000001',
        source_id: facebookSourceId,
      })
      .expect(201);
    leadId = createRes.body.candidate.id as string;
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: saleAId })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Sale đặt lịch hẹn PV cho lead của mình → attempt_no=1, trạng thái "Đã hẹn PV"', async () => {
    const res = await saleAAgent
      .post(`/candidate/${leadId}/interview`)
      .send({
        partner_company_name: 'Công ty TNHH Đối Tác A',
        scheduled_at: '2026-08-01T09:00:00.000Z',
      })
      .expect(201);

    expect(res.body.attempt_no).toBe(1);
    expect(res.body.status.id).toBe(scheduledStatusId);
    expect(res.body.partner_company_name).toBe('Công ty TNHH Đối Tác A');

    const detail = await saleAAgent.get(`/candidate/${leadId}`).expect(200);
    expect(detail.body.current_interview_status.id).toBe(scheduledStatusId);
    expect(detail.body.current_partner_company_name).toBe(
      'Công ty TNHH Đối Tác A',
    );
  });

  it('Lịch hẹn PV vừa tạo xuất hiện trên Calendar', async () => {
    const res = await saleAAgent
      .get('/calendar')
      .query({ date_from: '2026-07-01', date_to: '2026-08-31' })
      .expect(200);

    const event = res.body.find(
      (e: { type: string; candidate: { id: string } }) =>
        e.type === 'interview' && e.candidate.id === leadId,
    );
    expect(event).toBeDefined();
    expect(event.candidate.full_name).toBe('Ứng viên Phase4');
  });

  it('Sale B không được đặt lịch PV cho lead không phải của mình', async () => {
    await saleBAgent
      .post(`/candidate/${leadId}/interview`)
      .send({
        partner_company_name: 'Công ty X',
        scheduled_at: '2026-08-01T09:00:00.000Z',
      })
      .expect(403);
  });

  it('Bùng PV (NO_SHOW) → hẹn lại lần 2 → cả 2 lần hẹn đều được giữ lại', async () => {
    const list1 = await saleAAgent
      .get(`/candidate/${leadId}/interview`)
      .expect(200);
    const firstInterviewId = list1.body[0].id as string;

    await saleAAgent
      .put(`/interview/${firstInterviewId}`)
      .send({ status_id: noShowStatusId })
      .expect(200);

    const detailAfterNoShow = await saleAAgent
      .get(`/candidate/${leadId}`)
      .expect(200);
    expect(detailAfterNoShow.body.current_interview_status.id).toBe(
      noShowStatusId,
    );

    const rescheduled = await saleAAgent
      .post(`/candidate/${leadId}/interview`)
      .send({
        partner_company_name: 'Công ty TNHH Đối Tác A',
        scheduled_at: '2026-08-05T09:00:00.000Z',
      })
      .expect(201);
    expect(rescheduled.body.attempt_no).toBe(2);

    const list2 = await saleAAgent
      .get(`/candidate/${leadId}/interview`)
      .expect(200);
    expect(list2.body.length).toBe(2);
    expect(list2.body.map((i: { attempt_no: number }) => i.attempt_no)).toEqual(
      [1, 2],
    );
    // Lần hẹn đầu (bùng PV) vẫn còn nguyên trong lịch sử.
    const firstAttempt = list2.body.find(
      (i: { attempt_no: number }) => i.attempt_no === 1,
    );
    expect(firstAttempt.status.id).toBe(noShowStatusId);

    const detailAfterReschedule = await saleAAgent
      .get(`/candidate/${leadId}`)
      .expect(200);
    // Snapshot trên Candidate luôn phản ánh lần hẹn MỚI NHẤT (attempt_no=2).
    expect(detailAfterReschedule.body.current_interview_status.id).toBe(
      scheduledStatusId,
    );
  });

  it('employment_status_id chỉ hợp lệ khi trạng thái PV là "Đỗ PV"', async () => {
    const list = await saleAAgent
      .get(`/candidate/${leadId}/interview`)
      .expect(200);
    const secondAttemptId = list.body.find(
      (i: { attempt_no: number }) => i.attempt_no === 2,
    ).id as string;

    await saleAAgent
      .put(`/interview/${secondAttemptId}`)
      .send({
        status_id: attendedStatusId,
        employment_status_id: employedStatusId,
      })
      .expect(422);
  });

  it('Chuỗi đến PV → đỗ PV → đi làm phản ánh đúng trên Candidate list', async () => {
    const list = await saleAAgent
      .get(`/candidate/${leadId}/interview`)
      .expect(200);
    const secondAttemptId = list.body.find(
      (i: { attempt_no: number }) => i.attempt_no === 2,
    ).id as string;

    await saleAAgent
      .put(`/interview/${secondAttemptId}`)
      .send({ status_id: attendedStatusId })
      .expect(200);
    await saleAAgent
      .put(`/interview/${secondAttemptId}`)
      .send({ status_id: passedStatusId })
      .expect(200);
    await saleAAgent
      .put(`/interview/${secondAttemptId}`)
      .send({
        status_id: passedStatusId,
        employment_status_id: employedStatusId,
      })
      .expect(200);

    const candidateList = await saleAAgent
      .get('/candidate')
      .query({ page_size: 50 })
      .expect(200);
    const item = candidateList.body.items.find(
      (i: { id: string }) => i.id === leadId,
    );
    expect(item.current_interview_status.id).toBe(passedStatusId);
    expect(item.current_employment_status.id).toBe(employedStatusId);

    const filtered = await saleAAgent
      .get('/candidate')
      .query({ employment_status_id: employedStatusId })
      .expect(200);
    expect(
      filtered.body.items.some((i: { id: string }) => i.id === leadId),
    ).toBe(true);
  });

  it('Đỗ PV nhưng "Không đi làm" → bắt buộc nhập lý do', async () => {
    const list = await saleAAgent
      .get(`/candidate/${leadId}/interview`)
      .expect(200);
    const secondAttemptId = list.body.find(
      (i: { attempt_no: number }) => i.attempt_no === 2,
    ).id as string;

    await saleAAgent
      .put(`/interview/${secondAttemptId}`)
      .send({
        status_id: passedStatusId,
        employment_status_id: notEmployedStatusId,
      })
      .expect(422);

    const res = await saleAAgent
      .put(`/interview/${secondAttemptId}`)
      .send({
        status_id: passedStatusId,
        employment_status_id: notEmployedStatusId,
        employment_reason: 'Ứng viên đổi ý, không muốn đi làm xa nhà',
      })
      .expect(200);
    expect(res.body.employment_status.id).toBe(notEmployedStatusId);
    expect(res.body.employment_reason).toBe(
      'Ứng viên đổi ý, không muốn đi làm xa nhà',
    );

    const detail = await saleAAgent.get(`/candidate/${leadId}`).expect(200);
    expect(detail.body.current_employment_status.id).toBe(notEmployedStatusId);
  });

  it('Đặt lịch gọi lại → xuất hiện trên Calendar', async () => {
    const created = await saleAAgent
      .post(`/candidate/${leadId}/callback`)
      .send({ scheduled_at: '2026-08-10T08:00:00.000Z' })
      .expect(201);
    expect(created.body.is_completed).toBe(false);

    const res = await saleAAgent
      .get('/calendar')
      .query({ date_from: '2026-07-01', date_to: '2026-08-31' })
      .expect(200);
    const event = res.body.find(
      (e: { type: string; id: string }) =>
        e.type === 'callback' && e.id === created.body.id,
    );
    expect(event).toBeDefined();
  });

  it('Sale chỉ sửa được lịch gọi lại do chính mình đặt', async () => {
    const created = await saleAAgent
      .post(`/candidate/${leadId}/callback`)
      .send({ scheduled_at: '2026-08-11T08:00:00.000Z' })
      .expect(201);

    await saleBAgent
      .put(`/callback/${created.body.id}`)
      .send({ is_completed: true })
      .expect(403);

    const updated = await saleAAgent
      .put(`/callback/${created.body.id}`)
      .send({ is_completed: true })
      .expect(200);
    expect(updated.body.is_completed).toBe(true);
  });

  it('Leader/Admin cũng thao tác được lịch hẹn PV/gọi lại trong phạm vi của mình', async () => {
    await leaderAgent
      .post(`/candidate/${leadId}/callback`)
      .send({ scheduled_at: '2026-08-12T08:00:00.000Z' })
      .expect(201);
    const interviewList = await adminAgent
      .get(`/candidate/${leadId}/interview`)
      .expect(200);
    expect(interviewList.body.length).toBeGreaterThan(0);
  });

  it('MKT không có quyền đặt lịch hẹn PV/gọi lại (chỉ xem)', async () => {
    await mktAgent
      .post(`/candidate/${leadId}/interview`)
      .send({
        partner_company_name: 'Công ty X',
        scheduled_at: '2026-08-01T09:00:00.000Z',
      })
      .expect(403);
    await mktAgent
      .post(`/candidate/${leadId}/callback`)
      .send({ scheduled_at: '2026-08-01T09:00:00.000Z' })
      .expect(403);
  });

  it('Sale B không thấy lịch hẹn của Sale A trên Calendar (phạm vi lead của mình)', async () => {
    const res = await saleBAgent
      .get('/calendar')
      .query({ date_from: '2026-07-01', date_to: '2026-08-31' })
      .expect(200);
    expect(
      res.body.some(
        (e: { candidate: { id: string } }) => e.candidate.id === leadId,
      ),
    ).toBe(false);
  });

  it('gửi status_id thuộc category khác (employment_status) cho PUT /interview/:id → báo lỗi', async () => {
    const list = await saleAAgent
      .get(`/candidate/${leadId}/interview`)
      .expect(200);
    const interviewId = list.body[0].id as string;

    await saleAAgent
      .put(`/interview/${interviewId}`)
      .send({ status_id: employedStatusId })
      .expect(422);
  });

  it('Trượt PV → snapshot current_employment_status trở về rỗng (không còn "Đỗ PV")', async () => {
    const list = await saleAAgent
      .get(`/candidate/${leadId}/interview`)
      .expect(200);
    const secondAttemptId = list.body.find(
      (i: { attempt_no: number }) => i.attempt_no === 2,
    ).id as string;

    await saleAAgent
      .put(`/interview/${secondAttemptId}`)
      .send({ status_id: failedStatusId })
      .expect(200);

    const detail = await saleAAgent.get(`/candidate/${leadId}`).expect(200);
    expect(detail.body.current_interview_status.id).toBe(failedStatusId);
    expect(detail.body.current_employment_status).toBeNull();
  });
});
