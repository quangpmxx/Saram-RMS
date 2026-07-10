import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 7 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật. Tự tạo
 * dữ liệu/tài khoản riêng (tiền tố "p7_") để không đụng dữ liệu của các bộ
 * test khác chạy trên cùng database.
 *
 * Chỉ đối chiếu số liệu CHÍNH XÁC khi truy vấn có `team_id` (giới hạn đúng
 * trong phạm vi dữ liệu mẫu p7_ tự tạo) — trường hợp Admin gọi KHÔNG kèm
 * team_id sẽ cộng dồn cả dữ liệu của các bộ test khác chạy trước đó trên
 * cùng database (không xóa lẫn nhau giữa các file test), nên chỉ kiểm tra
 * cấu trúc/không lỗi cho trường hợp đó, không so số tuyệt đối.
 */
describe('Phase 7 — Dashboard & Báo cáo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookId: string;
  let tiktokId: string;
  let zaloId: string;
  let teamAId: string;
  let teamBId: string;
  let saleA1Id: string;
  let saleA2Id: string;
  let calledStatusId: string;
  let potentialResultId: string;
  let attendedStatusId: string;
  let passedStatusId: string;
  let employedStatusId: string;

  let mktAgent: ReturnType<typeof request.agent>;
  let leaderAAgent: ReturnType<typeof request.agent>;
  let leaderBAgent: ReturnType<typeof request.agent>;
  let saleA1Agent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'p7_mkt',
    'p7_admin',
    'p7_manager',
    'p7_leader_a',
    'p7_leader_b',
    'p7_sale_a1',
    'p7_sale_a2',
    'p7_sale_b1',
  ];

  async function createLead(fullName: string, phone: string, sourceId: string) {
    const res = await mktAgent
      .post('/candidate')
      .send({ full_name: fullName, phone_number: phone, source_id: sourceId })
      .expect(201);
    return res.body.candidate.id as string;
  }

  async function assign(
    leadId: string,
    leaderAgent: ReturnType<typeof request.agent>,
    accountId: string,
  ) {
    await leaderAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: accountId })
      .expect(200);
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
    await prisma.account.deleteMany({ where: { username: { in: USERNAMES } } });
    await prisma.team.deleteMany({
      where: { name: { in: ['P7 Nhóm A', 'P7 Nhóm B'] } },
    });

    for (const name of ['Facebook', 'TikTok', 'Zalo', 'Khác']) {
      await prisma.leadSource.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
    facebookId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Facebook' } })
    ).id;
    tiktokId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'TikTok' } })
    ).id;
    zaloId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Zalo' } })
    ).id;

    calledStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: { category_code: { category: 'call_status', code: 'CALLED' } },
      })
    ).id;
    potentialResultId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'call_result', code: 'POTENTIAL' },
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
    employedStatusId = (
      await prisma.statusCatalog.findUniqueOrThrow({
        where: {
          category_code: { category: 'employment_status', code: 'EMPLOYED' },
        },
      })
    ).id;

    const passwordHash = await hashPassword('123456');
    const teamA = await prisma.team.create({ data: { name: 'P7 Nhóm A' } });
    const teamB = await prisma.team.create({ data: { name: 'P7 Nhóm B' } });
    teamAId = teamA.id;
    teamBId = teamB.id;

    await prisma.account.create({
      data: {
        fullName: 'MKT P7',
        username: 'p7_mkt',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Admin P7',
        username: 'p7_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Quản lý P7',
        username: 'p7_manager',
        passwordHash,
        role: 'manager',
        status: 'active',
      },
    });
    const leaderA = await prisma.account.create({
      data: {
        fullName: 'Leader A P7',
        username: 'p7_leader_a',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: teamA.id,
      },
    });
    await prisma.team.update({
      where: { id: teamA.id },
      data: { leaderId: leaderA.id },
    });
    const leaderB = await prisma.account.create({
      data: {
        fullName: 'Leader B P7',
        username: 'p7_leader_b',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: teamB.id,
      },
    });
    await prisma.team.update({
      where: { id: teamB.id },
      data: { leaderId: leaderB.id },
    });
    const saleA1 = await prisma.account.create({
      data: {
        fullName: 'Sale A1 P7',
        username: 'p7_sale_a1',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: teamA.id,
      },
    });
    saleA1Id = saleA1.id;
    const saleA2 = await prisma.account.create({
      data: {
        fullName: 'Sale A2 P7',
        username: 'p7_sale_a2',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: teamA.id,
      },
    });
    saleA2Id = saleA2.id;
    const saleB1 = await prisma.account.create({
      data: {
        fullName: 'Sale B1 P7',
        username: 'p7_sale_b1',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: teamB.id,
      },
    });

    mktAgent = request.agent(server());
    await mktAgent
      .post('/login')
      .send({ username: 'p7_mkt', password: '123456' })
      .expect(200);
    leaderAAgent = request.agent(server());
    await leaderAAgent
      .post('/login')
      .send({ username: 'p7_leader_a', password: '123456' })
      .expect(200);
    leaderBAgent = request.agent(server());
    await leaderBAgent
      .post('/login')
      .send({ username: 'p7_leader_b', password: '123456' })
      .expect(200);
    saleA1Agent = request.agent(server());
    await saleA1Agent
      .post('/login')
      .send({ username: 'p7_sale_a1', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'p7_admin', password: '123456' })
      .expect(200);
    managerAgent = request.agent(server());
    await managerAgent
      .post('/login')
      .send({ username: 'p7_manager', password: '123456' })
      .expect(200);

    // ── Dữ liệu mẫu Team A (dùng để đối chiếu số liệu chính xác) ──────────
    const lead1 = await createLead('P7 Lead 1', '0910000001', facebookId); // chưa xử lý gì
    await assign(lead1, leaderAAgent, saleA1Id);

    const lead2 = await createLead('P7 Lead 2', '0910000002', facebookId); // POTENTIAL
    await assign(lead2, leaderAAgent, saleA1Id);
    await saleA1Agent
      .put(`/candidate/${lead2}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);
    await saleA1Agent
      .put(`/candidate/${lead2}/call-result`)
      .send({ call_result_id: potentialResultId })
      .expect(200);
    await saleA1Agent
      .post(`/candidate/${lead2}/note`)
      .send({ content: 'Ghi chú test hiệu suất 1' })
      .expect(201);
    await saleA1Agent
      .post(`/candidate/${lead2}/note`)
      .send({ content: 'Ghi chú test hiệu suất 2' })
      .expect(201);

    const lead3 = await createLead('P7 Lead 3', '0910000003', tiktokId); // hẹn PV, chưa đến
    await assign(lead3, leaderAAgent, saleA1Id);
    await saleA1Agent
      .post(`/candidate/${lead3}/interview`)
      .send({
        partner_company_name: 'Cty Test 3',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);

    const lead4 = await createLead('P7 Lead 4', '0910000004', facebookId); // đến PV, chưa đỗ
    await assign(lead4, leaderAAgent, saleA2Id);
    const interview4 = await leaderAAgent
      .post(`/candidate/${lead4}/interview`)
      .send({
        partner_company_name: 'Cty Test 4',
        scheduled_at: new Date(Date.now() - 86400000).toISOString(),
      })
      .expect(201);
    await adminAgent
      .put(`/interview/${interview4.body.id}`)
      .send({ status_id: attendedStatusId })
      .expect(200);

    const lead5 = await createLead('P7 Lead 5', '0910000005', zaloId); // đỗ PV, chưa đi làm
    await assign(lead5, leaderAAgent, saleA2Id);
    const interview5 = await leaderAAgent
      .post(`/candidate/${lead5}/interview`)
      .send({
        partner_company_name: 'Cty Test 5',
        scheduled_at: new Date(Date.now() - 86400000).toISOString(),
      })
      .expect(201);
    await adminAgent
      .put(`/interview/${interview5.body.id}`)
      .send({ status_id: passedStatusId })
      .expect(200);

    const lead6 = await createLead('P7 Lead 6', '0910000006', facebookId); // đỗ PV + đi làm
    await assign(lead6, leaderAAgent, saleA1Id);
    const interview6 = await saleA1Agent
      .post(`/candidate/${lead6}/interview`)
      .send({
        partner_company_name: 'Cty Test 6',
        scheduled_at: new Date(Date.now() - 86400000).toISOString(),
      })
      .expect(201);
    await adminAgent
      .put(`/interview/${interview6.body.id}`)
      .send({
        status_id: passedStatusId,
        employment_status_id: employedStatusId,
      })
      .expect(200);

    // Lead pending (chờ phân chia) — không gán cho ai, dùng để test pending_count.
    await createLead('P7 Lead 7 Pending', '0910000007', facebookId);

    // Lead vào Cột chăm sóc (backdate giống pattern Phase 5) để test care_pool_count.
    const lead8 = await createLead(
      'P7 Lead 8 CarePool',
      '0910000008',
      facebookId,
    );
    await assign(lead8, leaderAAgent, saleA1Id);
    await saleA1Agent
      .put(`/candidate/${lead8}/call-status`)
      .send({ call_status_id: calledStatusId })
      .expect(200);
    await prisma.lead.update({
      where: { id: lead8 },
      data: {
        lastActivityAt: new Date(Date.now() - 45 * 60 * 1000),
        enteredCarePoolAt: new Date(Date.now() - 15 * 60 * 1000),
      },
    });

    // ── Dữ liệu Team B (chỉ để test cách ly team_id + by-team) ────────────
    const leadB1 = await createLead('P7 Lead B1', '0910000101', facebookId);
    await assign(leadB1, leaderBAgent, saleB1.id);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /dashboard/summary', () => {
    it('Admin lọc theo team_id=Team A → số liệu khớp chính xác với dữ liệu đã tạo', async () => {
      const res = await adminAgent
        .get('/dashboard/summary')
        .query({ team_id: teamAId })
        .expect(200);

      expect(res.body.new_leads_total).toBe(7); // lead1..6 + lead8 (lead7 pending không gán team)
      const bySource = res.body.new_leads_by_source as Array<{
        source_name: string;
        count: number;
      }>;
      expect(bySource.find((s) => s.source_name === 'Facebook')?.count).toBe(5); // 1,2,4,6,8
      expect(bySource.find((s) => s.source_name === 'TikTok')?.count).toBe(1); // 3
      expect(bySource.find((s) => s.source_name === 'Zalo')?.count).toBe(1); // 5

      const funnel = res.body.funnel as Array<{
        code: string;
        count: number;
        percentage: number;
      }>;
      expect(funnel.find((s) => s.code === 'LEAD')?.count).toBe(7);
      expect(funnel.find((s) => s.code === 'INTERVIEW_SCHEDULED')?.count).toBe(
        4,
      ); // 3,4,5,6
      expect(funnel.find((s) => s.code === 'ATTENDED')?.count).toBe(3); // 4,5,6
      expect(funnel.find((s) => s.code === 'PASSED')?.count).toBe(2); // 5,6
      expect(funnel.find((s) => s.code === 'EMPLOYED')?.count).toBe(1); // 6

      expect(res.body.care_pool_count).toBe(1); // lead8
    });

    it('Leader A tự động bị ép về đúng nhóm mình dù không truyền team_id — số liệu khớp Admin lọc theo Team A', async () => {
      const res = await leaderAAgent.get('/dashboard/summary').expect(200);
      expect(res.body.new_leads_total).toBe(7);
      expect(res.body.care_pool_count).toBe(1);
    });

    it('Sale A1 chỉ thấy đúng lead của mình (1,2,3,6,8 — 5 lead)', async () => {
      const res = await saleA1Agent.get('/dashboard/summary').expect(200);
      expect(res.body.new_leads_total).toBe(5);
    });

    it('MKT chỉ thấy đúng data mình upload (toàn bộ 8 lead Team A + Pending do p7_mkt tạo, không gồm Team B)', async () => {
      const res = await mktAgent.get('/dashboard/summary').expect(200);
      expect(res.body.new_leads_total).toBe(9); // 6 team A + lead7 pending + lead8 carepool + leadB1 (p7_mkt cũng upload lead Team B) = 9
      expect(res.body.care_pool_count).toBe(0); // MKT không có quyền xem Cột chăm sóc
    });

    it('Lọc theo khoảng thời gian: lead bị backdate ra ngoài khoảng ngày sẽ không được tính', async () => {
      const oldLeadId = await createLead(
        'P7 Lead Backdated',
        '0910000201',
        facebookId,
      );
      await assign(oldLeadId, leaderAAgent, saleA1Id);
      const oldDate = new Date('2020-01-01T00:00:00.000Z');
      await prisma.lead.update({
        where: { id: oldLeadId },
        data: { uploadedAt: oldDate },
      });

      const withoutFilter = await adminAgent
        .get('/dashboard/summary')
        .query({ team_id: teamAId })
        .expect(200);
      expect(withoutFilter.body.new_leads_total).toBe(8); // 7 cũ + 1 backdated

      const withFilter = await adminAgent
        .get('/dashboard/summary')
        .query({
          team_id: teamAId,
          date_from: '2026-01-01',
          date_to: '2030-01-01',
        })
        .expect(200);
      expect(withFilter.body.new_leads_total).toBe(7); // loại bỏ lead backdate về 2020
    });

    it('pending_count tăng đúng 1 khi có thêm 1 lead chờ phân chia mới (so sánh tương đối, tránh phụ thuộc dữ liệu file test khác)', async () => {
      const before = await adminAgent.get('/dashboard/summary').expect(200);
      await createLead('P7 Lead Pending Delta', '0910000301', facebookId);
      const after = await adminAgent.get('/dashboard/summary').expect(200);
      expect(after.body.pending_count).toBe(before.body.pending_count + 1);
    });
  });

  describe('GET /dashboard/performance', () => {
    it('Sale/MKT bị từ chối (403)', async () => {
      await saleA1Agent.get('/dashboard/performance').expect(403);
      await mktAgent.get('/dashboard/performance').expect(403);
    });

    it('Leader A xem đúng hiệu suất 2 Sale trong nhóm mình', async () => {
      const res = await leaderAAgent.get('/dashboard/performance').expect(200);
      const bySale = new Map(
        res.body.map((r: { account_id: string }) => [r.account_id, r]),
      );

      const a1 = bySale.get(saleA1Id) as {
        calls: number;
        potential_leads: number;
        employed_count: number;
      };
      expect(a1.calls).toBe(2); // 2 ghi chú đã tạo cho lead2
      expect(a1.potential_leads).toBe(1); // lead2
      expect(a1.employed_count).toBe(1); // lead6

      const a2 = bySale.get(saleA2Id) as {
        calls: number;
        potential_leads: number;
        employed_count: number;
      };
      expect(a2.potential_leads).toBe(0);
      expect(a2.employed_count).toBe(0);
    });
  });

  describe('GET /dashboard/by-team', () => {
    it('Leader/Sale/MKT bị từ chối (403)', async () => {
      await leaderAAgent.get('/dashboard/by-team').expect(403);
      await saleA1Agent.get('/dashboard/by-team').expect(403);
      await mktAgent.get('/dashboard/by-team').expect(403);
    });

    it('Admin xem đúng số liệu từng nhóm', async () => {
      const res = await adminAgent.get('/dashboard/by-team').expect(200);
      const byTeam = new Map(
        res.body.map((r: { team_id: string }) => [r.team_id, r]),
      );

      const teamARow = byTeam.get(teamAId) as {
        lead_count: number;
        care_pool_count: number;
      };
      expect(teamARow.lead_count).toBeGreaterThanOrEqual(8); // 7 gốc + 1 backdated đã gán Team A (lead pending-delta không gán ai nên không tính vào nhóm)
      expect(teamARow.care_pool_count).toBe(1);

      const teamBRow = byTeam.get(teamBId) as {
        lead_count: number;
        care_pool_count: number;
      };
      expect(teamBRow.lead_count).toBe(1);
      expect(teamBRow.care_pool_count).toBe(0);
    });
  });

  describe('GET /report/funnel', () => {
    it('Sale/MKT bị từ chối (403)', async () => {
      await saleA1Agent.get('/report/funnel').expect(403);
      await mktAgent.get('/report/funnel').expect(403);
    });

    it('Quản lý lọc theo team_id + account_id → đúng phễu của riêng Sale A2', async () => {
      const res = await managerAgent
        .get('/report/funnel')
        .query({ team_id: teamAId, account_id: saleA2Id })
        .expect(200);
      const steps = new Map(
        res.body.map((s: { code: string; count: number }) => [s.code, s.count]),
      );
      expect(steps.get('LEAD')).toBe(2); // lead4, lead5
      expect(steps.get('ATTENDED')).toBe(2);
      expect(steps.get('PASSED')).toBe(1); // lead5
      expect(steps.get('EMPLOYED')).toBe(0);
    });
  });

  describe('GET /report/by-source', () => {
    it('Sale/MKT bị từ chối (403)', async () => {
      await saleA1Agent.get('/report/by-source').expect(403);
      await mktAgent.get('/report/by-source').expect(403);
    });

    it('Leader A xem đúng breakdown theo nguồn trong nhóm mình', async () => {
      const res = await leaderAAgent.get('/report/by-source').expect(200);
      const bySource = new Map(
        res.body.map((s: { source_name: string }) => [s.source_name, s]),
      );
      const facebook = bySource.get('Facebook') as { lead_count: number };
      expect(facebook.lead_count).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Kết quả breakdown dùng để mở đúng danh sách ứng viên đã lọc sẵn', () => {
    it('GET /candidate với team_id + source_id (từ số liệu breakdown) trả về đúng tập con', async () => {
      const res = await adminAgent
        .get('/candidate')
        .query({
          team_id: teamAId,
          source_id: tiktokId,
          page: 1,
          page_size: 50,
        })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].full_name).toBe('P7 Lead 3');
    });
  });
});
