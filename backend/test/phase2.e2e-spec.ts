import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 2 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật.
 * Tự tạo dữ liệu/tài khoản riêng (username có tiền tố "phase2_") để không
 * đụng tới dữ liệu của các bộ test khác chạy trên cùng database.
 *
 * LƯU Ý (ghi trong báo cáo hoàn thành Phase 2): roadmap ghi "Leader nhóm 1
 * không thấy được data chờ phân chia của nhóm 2", nhưng theo đúng API đã
 * Design Freeze (Mục 4, docs/13 — GET /candidate/pending không có tham số
 * team_id) và database (docs/11 — lead chưa phân chia không có cột nào gắn
 * với 1 nhóm cụ thể), danh sách "Chờ phân chia" vốn dùng CHUNG cho mọi
 * Leader/MKT/Quản lý/Admin (đúng Mục 3.2, docs/09: MKT nhập lead không gắn
 * sẵn cho nhóm nào, Leader nào cũng có thể nhận). Bộ test dưới đây kiểm
 * chứng đúng theo tài liệu đã chốt (không tự bịa cột/tham số mới).
 */
describe('Phase 2 — Phân chia thủ công & Không gian Sale/Leader (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookSourceId: string;

  let mktAgent: ReturnType<typeof request.agent>;
  let leader1Agent: ReturnType<typeof request.agent>;
  let leader2Agent: ReturnType<typeof request.agent>;
  let sale1aAgent: ReturnType<typeof request.agent>;
  let sale1bAgent: ReturnType<typeof request.agent>;
  let sale2aAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  let team1Id: string;
  let team2Id: string;
  let sale1aId: string;
  let sale1bId: string;
  let sale2aId: string;

  const server = () => app.getHttpServer();
  const USERNAMES = [
    'phase2_mkt',
    'phase2_leader1',
    'phase2_leader2',
    'phase2_sale1a',
    'phase2_sale1b',
    'phase2_sale2a',
    'phase2_admin',
  ];

  async function createLead(
    agent: ReturnType<typeof request.agent>,
    phone: string,
  ): Promise<string> {
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

    // Dọn dữ liệu Phase 2 trước khi chạy, để bộ test tự chứa và lặp lại được.
    // Xóa session + audit_logs trước accounts — nếu chạy lại bộ test này
    // nhiều lần, các tài khoản từ lần chạy trước vẫn còn bản ghi tham chiếu
    // tới, xóa accounts trước sẽ vi phạm khóa ngoại. Xóa lead_notes/
    // interview_appointments/callback_schedules trước leads (từ Phase 3/4) —
    // không dựa vào TRUNCATE CASCADE vì PGlite không cascade tin cậy qua 2
    // cấp quan hệ (accounts → leads → ...).
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
    await prisma.team.deleteMany({
      where: { name: { in: ['Phase2 Nhóm 1', 'Phase2 Nhóm 2'] } },
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

    const team1 = await prisma.team.create({ data: { name: 'Phase2 Nhóm 1' } });
    const team2 = await prisma.team.create({ data: { name: 'Phase2 Nhóm 2' } });
    team1Id = team1.id;
    team2Id = team2.id;

    await prisma.account.create({
      data: {
        fullName: 'MKT Phase2',
        username: 'phase2_mkt',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Admin Phase2',
        username: 'phase2_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    const leader1 = await prisma.account.create({
      data: {
        fullName: 'Leader Nhóm 1',
        username: 'phase2_leader1',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: team1Id,
      },
    });
    const leader2 = await prisma.account.create({
      data: {
        fullName: 'Leader Nhóm 2',
        username: 'phase2_leader2',
        passwordHash,
        role: 'leader',
        status: 'active',
        teamId: team2Id,
      },
    });
    await prisma.team.update({
      where: { id: team1Id },
      data: { leaderId: leader1.id },
    });
    await prisma.team.update({
      where: { id: team2Id },
      data: { leaderId: leader2.id },
    });
    const sale1a = await prisma.account.create({
      data: {
        fullName: 'Sale 1A',
        username: 'phase2_sale1a',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team1Id,
      },
    });
    const sale1b = await prisma.account.create({
      data: {
        fullName: 'Sale 1B',
        username: 'phase2_sale1b',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team1Id,
      },
    });
    const sale2a = await prisma.account.create({
      data: {
        fullName: 'Sale 2A',
        username: 'phase2_sale2a',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team2Id,
      },
    });
    sale1aId = sale1a.id;
    sale1bId = sale1b.id;
    sale2aId = sale2a.id;

    mktAgent = request.agent(server());
    await mktAgent
      .post('/login')
      .send({ username: 'phase2_mkt', password: '123456' })
      .expect(200);
    leader1Agent = request.agent(server());
    await leader1Agent
      .post('/login')
      .send({ username: 'phase2_leader1', password: '123456' })
      .expect(200);
    leader2Agent = request.agent(server());
    await leader2Agent
      .post('/login')
      .send({ username: 'phase2_leader2', password: '123456' })
      .expect(200);
    sale1aAgent = request.agent(server());
    await sale1aAgent
      .post('/login')
      .send({ username: 'phase2_sale1a', password: '123456' })
      .expect(200);
    sale1bAgent = request.agent(server());
    await sale1bAgent
      .post('/login')
      .send({ username: 'phase2_sale1b', password: '123456' })
      .expect(200);
    sale2aAgent = request.agent(server());
    await sale2aAgent
      .post('/login')
      .send({ username: 'phase2_sale2a', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'phase2_admin', password: '123456' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lead mới từ MKT xuất hiện ở "Chờ phân chia" cho MKT/Leader/Admin, không cho Sale', async () => {
    const leadId = await createLead(mktAgent, '0930000001');

    const forLeader1 = await leader1Agent.get('/candidate/pending').expect(200);
    expect(
      forLeader1.body.items.some((item: { id: string }) => item.id === leadId),
    ).toBe(true);

    const forAdmin = await adminAgent.get('/candidate/pending').expect(200);
    expect(
      forAdmin.body.items.some((item: { id: string }) => item.id === leadId),
    ).toBe(true);

    await sale1aAgent.get('/candidate/pending').expect(403);
  });

  it('MKT không có quyền phân chia/chuyển lead', async () => {
    const leadId = await createLead(mktAgent, '0930000002');

    await mktAgent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1aId })
      .expect(403);
  });

  it('Leader chỉ được phân chia cho Sale trong nhóm mình — khác nhóm bị chặn', async () => {
    const leadId = await createLead(mktAgent, '0930000003');

    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale2aId })
      .expect(403);
  });

  it('Leader gán 1 lead cho Sale A → Sale A thấy trong "của tôi", Sale B không thấy, hết "chờ phân chia"', async () => {
    const leadId = await createLead(mktAgent, '0930000004');

    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1aId })
      .expect(200);

    const sale1aList = await sale1aAgent
      .get('/candidate')
      .query({ page_size: 50 })
      .expect(200);
    expect(
      sale1aList.body.items.some((item: { id: string }) => item.id === leadId),
    ).toBe(true);

    const sale1bList = await sale1bAgent
      .get('/candidate')
      .query({ page_size: 50 })
      .expect(200);
    expect(
      sale1bList.body.items.some((item: { id: string }) => item.id === leadId),
    ).toBe(false);

    const pending = await leader1Agent
      .get('/candidate/pending')
      .query({ page_size: 50 })
      .expect(200);
    expect(
      pending.body.items.some((item: { id: string }) => item.id === leadId),
    ).toBe(false);
  });

  it('gán lại lead đã được phân chia → báo lỗi, phải dùng transfer', async () => {
    const leadId = await createLead(mktAgent, '0930000005');
    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1aId })
      .expect(200);

    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1bId })
      .expect(400);
  });

  it('Leader chuyển lead từ Sale A sang Sale B → Sale A không còn thấy, Sale B thấy', async () => {
    const leadId = await createLead(mktAgent, '0930000006');
    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1aId })
      .expect(200);

    await leader1Agent
      .post(`/candidate/${leadId}/transfer`)
      .send({ new_account_id: sale1bId, reason: 'Kiểm thử chuyển lead' })
      .expect(200);

    const sale1aList = await sale1aAgent
      .get('/candidate')
      .query({ page_size: 50 })
      .expect(200);
    expect(
      sale1aList.body.items.some((item: { id: string }) => item.id === leadId),
    ).toBe(false);

    const sale1bList = await sale1bAgent
      .get('/candidate')
      .query({ page_size: 50 })
      .expect(200);
    expect(
      sale1bList.body.items.some((item: { id: string }) => item.id === leadId),
    ).toBe(true);
  });

  it('không chuyển được cho Sale khác nhóm với lead hiện tại', async () => {
    const leadId = await createLead(mktAgent, '0930000007');
    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1aId })
      .expect(200);

    await leader1Agent
      .post(`/candidate/${leadId}/transfer`)
      .send({ new_account_id: sale2aId })
      .expect(403);
  });

  it('Leader nhóm 2 không được phân chia/chuyển lead thuộc nhóm 1', async () => {
    const leadId = await createLead(mktAgent, '0930000008');
    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1aId })
      .expect(200);

    await leader2Agent
      .post(`/candidate/${leadId}/transfer`)
      .send({ new_account_id: sale1bId })
      .expect(403);
  });

  it('phân chia hàng loạt: gán nhiều lead cùng lúc cho 1 Sale, bỏ qua lead không hợp lệ', async () => {
    const leadId1 = await createLead(mktAgent, '0930000009');
    const leadId2 = await createLead(mktAgent, '0930000010');
    // lead đã phân chia từ trước — phải bị bỏ qua trong đợt bulk này.
    const alreadyAssignedId = await createLead(mktAgent, '0930000011');
    await leader1Agent
      .post(`/candidate/${alreadyAssignedId}/assign`)
      .send({ account_id: sale1bId })
      .expect(200);

    const res = await leader1Agent
      .post('/candidate/assign-bulk')
      .send({
        candidate_ids: [leadId1, leadId2, alreadyAssignedId],
        account_id: sale1aId,
      })
      .expect(200);

    expect(res.body.assigned_count).toBe(2);

    const sale1aList = await sale1aAgent
      .get('/candidate')
      .query({ page_size: 50 })
      .expect(200);
    const ids = sale1aList.body.items.map((item: { id: string }) => item.id);
    expect(ids).toEqual(expect.arrayContaining([leadId1, leadId2]));
    expect(ids).not.toContain(alreadyAssignedId);
  });

  it('GET /team/:id/member trả đúng assigned_count, chỉ Leader đúng nhóm mới xem được', async () => {
    const leadId = await createLead(mktAgent, '0930000012');
    await leader1Agent
      .post(`/candidate/${leadId}/assign`)
      .send({ account_id: sale1aId })
      .expect(200);

    const membersRes = await leader1Agent
      .get(`/team/${team1Id}/member`)
      .expect(200);
    const sale1aMember = membersRes.body.find(
      (member: { id: string }) => member.id === sale1aId,
    );
    expect(sale1aMember).toBeDefined();
    expect(sale1aMember.assigned_count).toBeGreaterThanOrEqual(1);
    expect(sale1aMember.care_pool_count).toBe(0);
    // Chỉ trả về Sale, không lẫn Leader của nhóm.
    expect(
      membersRes.body.some(
        (member: { role: string }) => member.role === 'leader',
      ),
    ).toBe(false);

    await leader2Agent.get(`/team/${team1Id}/member`).expect(403);
    await adminAgent.get(`/team/${team1Id}/member`).expect(200);
  });

  describe('GET /candidate/:id/duplicates — tooltip chi tiết trùng SĐT trên nhiều nhóm', () => {
    const DUP_PHONE = '0930099999';
    let leadTeam1AId: string; // nhóm 1, Sale 1A
    let leadTeam1BId: string; // nhóm 1, Sale 1B — cùng nhóm với leadTeam1AId
    let leadTeam2Id: string; // nhóm 2, Sale 2A
    let leadPendingId: string; // chưa phân chia

    beforeAll(async () => {
      // 2 lead cùng nhóm 1 (khác sale), 1 lead nhóm 2, 1 lead chưa phân chia
      // — đủ tình huống "trùng cùng nhóm" lẫn "trùng khác nhóm" cho cùng 1 SĐT.
      leadTeam1AId = await createLead(mktAgent, DUP_PHONE);
      await leader1Agent
        .post(`/candidate/${leadTeam1AId}/assign`)
        .send({ account_id: sale1aId })
        .expect(200);

      leadTeam1BId = await createLead(mktAgent, DUP_PHONE);
      await leader1Agent
        .post(`/candidate/${leadTeam1BId}/assign`)
        .send({ account_id: sale1bId })
        .expect(200);

      leadTeam2Id = await createLead(mktAgent, DUP_PHONE);
      await leader2Agent
        .post(`/candidate/${leadTeam2Id}/assign`)
        .send({ account_id: sale2aId })
        .expect(200);

      leadPendingId = await createLead(mktAgent, DUP_PHONE);
    });

    it('Admin xem được toàn bộ các lần trùng, không giới hạn nhóm', async () => {
      const res = await adminAgent
        .get(`/candidate/${leadPendingId}/duplicates`)
        .expect(200);

      expect(res.body.visible).toBe(true);
      const ids = res.body.matches.map((m: { lead_id: string }) => m.lead_id);
      expect(ids).toEqual(
        expect.arrayContaining([leadTeam1AId, leadTeam1BId, leadTeam2Id]),
      );
      const team1Match = res.body.matches.find(
        (m: { lead_id: string }) => m.lead_id === leadTeam1AId,
      );
      expect(team1Match.team_name).toBe('Phase2 Nhóm 1');
      expect(team1Match.status_label).toContain('Sale 1A');
    });

    it('MKT xem được toàn bộ các lần trùng, không giới hạn nhóm (Mục 10.4, docs/09)', async () => {
      const res = await mktAgent
        .get(`/candidate/${leadPendingId}/duplicates`)
        .expect(200);

      expect(res.body.visible).toBe(true);
      expect(res.body.matches).toHaveLength(3);
    });

    it('Leader 1 chỉ xem được chi tiết bản ghi trùng thuộc đúng nhóm mình', async () => {
      const res = await leader1Agent
        .get(`/candidate/${leadTeam1AId}/duplicates`)
        .expect(200);

      expect(res.body.visible).toBe(true);
      expect(res.body.matches).toHaveLength(1);
      expect(res.body.matches[0].lead_id).toBe(leadTeam1BId);
      expect(
        res.body.matches.some(
          (m: { lead_id: string }) => m.lead_id === leadTeam2Id,
        ),
      ).toBe(false);
    });

    it('Sale 1A xem được chi tiết bản ghi trùng cùng nhóm (Sale 1B), không thấy nhóm khác', async () => {
      const res = await sale1aAgent
        .get(`/candidate/${leadTeam1AId}/duplicates`)
        .expect(200);

      expect(res.body.visible).toBe(true);
      expect(res.body.matches).toHaveLength(1);
      expect(res.body.matches[0].lead_id).toBe(leadTeam1BId);
      expect(res.body.matches[0].status_label).toContain('Sale 1B');
    });

    it('Sale 2A xem lead của mình nhưng không có bản ghi trùng cùng nhóm → visible=false', async () => {
      const res = await sale2aAgent
        .get(`/candidate/${leadTeam2Id}/duplicates`)
        .expect(200);

      expect(res.body.visible).toBe(false);
      expect(res.body.matches).toHaveLength(0);
    });

    it('Sale 2A không xem được chi tiết trùng của lead ngoài phạm vi mình (403)', async () => {
      await sale2aAgent
        .get(`/candidate/${leadTeam1AId}/duplicates`)
        .expect(403);
    });

    it('Sale không có quyền xem lead chưa phân chia (403)', async () => {
      await sale1aAgent
        .get(`/candidate/${leadPendingId}/duplicates`)
        .expect(403);
    });
  });
});
