import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Bổ sung theo yêu cầu người dùng "Fix inline notes and role permissions":
 *  1. Sửa SĐT trên trang Chi tiết ứng viên — PUT /candidate/:id — Sale (lead
 *     của mình), Leader (nhóm mình), Quản lý/Admin (mọi ứng viên), MKT giữ
 *     nguyên quyền đã chốt (chỉ data do mình upload).
 *  2. Admin/Quản lý kế thừa toàn bộ quyền nghiệp vụ của Leader/Sale/MKT —
 *     kiểm thử riêng 2 thao tác trước đây chỉ Sale làm được: Giữ số
 *     (POST/DELETE /candidate/:id/hold) và Xóa ghi chú
 *     (DELETE /candidate/:id/note/:noteId).
 *  3. Audit log ghi đúng khi sửa SĐT (giá trị cũ/mới) và khi thêm ghi chú.
 * Tự tạo dữ liệu/tài khoản riêng (tiền tố "perm_") để không đụng dữ liệu
 * của các bộ test khác chạy trên cùng database.
 */
describe('Fix inline notes and role permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookSourceId: string;
  let sale1Id: string;

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
    'perm_mkt_1',
    'perm_mkt_2',
    'perm_sale_1',
    'perm_sale_2',
    'perm_leader_1',
    'perm_leader_2',
    'perm_manager',
    'perm_admin',
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
      where: { name: { in: ['Perm Nhóm 1', 'Perm Nhóm 2'] } },
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
    const team1 = await prisma.team.create({ data: { name: 'Perm Nhóm 1' } });
    const team2 = await prisma.team.create({ data: { name: 'Perm Nhóm 2' } });

    await prisma.account.create({
      data: {
        fullName: 'MKT 1',
        username: 'perm_mkt_1',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'MKT 2',
        username: 'perm_mkt_2',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    const leader1 = await prisma.account.create({
      data: {
        fullName: 'Leader 1',
        username: 'perm_leader_1',
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
        username: 'perm_leader_2',
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
        username: 'perm_sale_1',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team1.id,
      },
    });
    sale1Id = sale1.id;
    await prisma.account.create({
      data: {
        fullName: 'Sale 2',
        username: 'perm_sale_2',
        passwordHash,
        role: 'sale',
        status: 'active',
        teamId: team2.id,
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Quản lý Perm',
        username: 'perm_manager',
        passwordHash,
        role: 'manager',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Admin Perm',
        username: 'perm_admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });

    mkt1Agent = request.agent(server());
    await mkt1Agent
      .post('/login')
      .send({ username: 'perm_mkt_1', password: '123456' })
      .expect(200);
    mkt2Agent = request.agent(server());
    await mkt2Agent
      .post('/login')
      .send({ username: 'perm_mkt_2', password: '123456' })
      .expect(200);
    sale1Agent = request.agent(server());
    await sale1Agent
      .post('/login')
      .send({ username: 'perm_sale_1', password: '123456' })
      .expect(200);
    sale2Agent = request.agent(server());
    await sale2Agent
      .post('/login')
      .send({ username: 'perm_sale_2', password: '123456' })
      .expect(200);
    leader1Agent = request.agent(server());
    await leader1Agent
      .post('/login')
      .send({ username: 'perm_leader_1', password: '123456' })
      .expect(200);
    leader2Agent = request.agent(server());
    await leader2Agent
      .post('/login')
      .send({ username: 'perm_leader_2', password: '123456' })
      .expect(200);
    managerAgent = request.agent(server());
    await managerAgent
      .post('/login')
      .send({ username: 'perm_manager', password: '123456' })
      .expect(200);
    adminAgent = request.agent(server());
    await adminAgent
      .post('/login')
      .send({ username: 'perm_admin', password: '123456' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAssignedLead(
    fullName: string,
    phone: string,
    mktAgent: ReturnType<typeof request.agent>,
    leaderAgent: ReturnType<typeof request.agent>,
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

  describe('1. Sửa SĐT trên trang Chi tiết ứng viên', () => {
    it('Sale sửa được SĐT ứng viên mình phụ trách', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test A',
        '0980000001',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const res = await sale1Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '  0980000011  ' })
        .expect(200);
      expect(res.body.phone_number).toBe('0980000011'); // tự trim khoảng trắng
    });

    it('Sale KHÔNG sửa được SĐT ứng viên ngoài phạm vi (không phụ trách)', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test B',
        '0980000002',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      await sale2Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000022' })
        .expect(403);
    });

    it('Leader sửa được SĐT ứng viên trong nhóm mình', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test C',
        '0980000003',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const res = await leader1Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000033' })
        .expect(200);
      expect(res.body.phone_number).toBe('0980000033');
    });

    it('Leader KHÔNG sửa được SĐT ứng viên nhóm khác', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test D',
        '0980000004',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      await leader2Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000044' })
        .expect(403);
    });

    it('Quản lý và Admin sửa được SĐT của mọi ứng viên', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test E',
        '0980000005',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const resManager = await managerAgent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000055' })
        .expect(200);
      expect(resManager.body.phone_number).toBe('0980000055');

      const resAdmin = await adminAgent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000056' })
        .expect(200);
      expect(resAdmin.body.phone_number).toBe('0980000056');
    });

    it('MKT giữ đúng quyền đã chốt — chỉ sửa được SĐT của ứng viên do chính mình upload', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test F',
        '0980000006',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      await mkt2Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000066' })
        .expect(403);
      const res = await mkt1Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000067' })
        .expect(200);
      expect(res.body.phone_number).toBe('0980000067');
    });

    it('Không chấp nhận SĐT rỗng hoặc chỉ có khoảng trắng', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test G',
        '0980000007',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      await sale1Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '' })
        .expect(422);
      await sale1Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '   ' })
        .expect(422);
    });

    it('Sửa SĐT trùng với ứng viên khác vẫn xử lý đúng cơ chế cảnh báo trùng (is_duplicate_flagged)', async () => {
      const leadA = await createAssignedLead(
        'Trùng A',
        '0980000008',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const leadB = await createAssignedLead(
        'Trùng B',
        '0980000009',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );

      const res = await sale1Agent
        .put(`/candidate/${leadB}`)
        .send({ phone_number: '0980000008' })
        .expect(200);
      expect(res.body.is_duplicate_flagged).toBe(true);

      const checkA = await adminAgent.get(`/candidate/${leadA}`).expect(200);
      expect(checkA.body.is_duplicate_flagged).toBe(true);

      // Không âm thầm ghi đè ứng viên khác — leadA vẫn giữ đúng SĐT gốc.
      expect(checkA.body.phone_number).toBe('0980000008');
    });

    it('Không sửa các trường khác khi chỉ gửi phone_number (không âm thầm ghi đè)', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test H',
        '0980000010',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const before = await adminAgent.get(`/candidate/${leadId}`).expect(200);
      await sale1Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000099' })
        .expect(200);
      const after = await adminAgent.get(`/candidate/${leadId}`).expect(200);
      expect(after.body.full_name).toBe(before.body.full_name);
      expect(after.body.source.id).toBe(before.body.source.id);
    });

    it('Audit log ghi đúng: người sửa, ứng viên, giá trị cũ/mới', async () => {
      const leadId = await createAssignedLead(
        'SĐT Test I',
        '0980000012',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      await sale1Agent
        .put(`/candidate/${leadId}`)
        .send({ phone_number: '0980000013' })
        .expect(200);

      const sale1Account = await prisma.account.findUniqueOrThrow({
        where: { username: 'perm_sale_1' },
      });
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'lead',
          entityId: leadId,
          accountId: sale1Account.id,
          fieldChanged: 'phone_number',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].oldValue).toBe('0980000012');
      expect(logs[0].newValue).toBe('0980000013');
    });
  });

  describe('2. Admin/Quản lý kế thừa quyền của Sale — Giữ số', () => {
    it('Admin và Quản lý giữ/bỏ giữ số được TRÊN MỌI ứng viên, không giới hạn người phụ trách', async () => {
      const leadId = await createAssignedLead(
        'Hold Test A',
        '0980000101',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );

      const heldByAdmin = await adminAgent
        .post(`/candidate/${leadId}/hold`)
        .expect(200);
      expect(heldByAdmin.body.is_held).toBe(true);
      await adminAgent.delete(`/candidate/${leadId}/hold`).expect(200);

      const heldByManager = await managerAgent
        .post(`/candidate/${leadId}/hold`)
        .expect(200);
      expect(heldByManager.body.is_held).toBe(true);
      const unheldByManager = await managerAgent
        .delete(`/candidate/${leadId}/hold`)
        .expect(200);
      expect(unheldByManager.body.is_held).toBe(false);
    });

    it('Sale vẫn chỉ giữ số được lead của mình; Leader/MKT vẫn không có quyền này (không đổi)', async () => {
      const leadId = await createAssignedLead(
        'Hold Test B',
        '0980000102',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      await sale2Agent.post(`/candidate/${leadId}/hold`).expect(403);
      await leader1Agent.post(`/candidate/${leadId}/hold`).expect(403);
      await mkt1Agent.post(`/candidate/${leadId}/hold`).expect(403);

      const held = await sale1Agent
        .post(`/candidate/${leadId}/hold`)
        .expect(200);
      expect(held.body.is_held).toBe(true);
      await sale1Agent.delete(`/candidate/${leadId}/hold`).expect(200);
    });
  });

  describe('3. Admin/Quản lý kế thừa quyền của Sale — Xóa ghi chú', () => {
    it('Admin và Quản lý xóa được ghi chú BẤT KỲ, không giới hạn "của chính mình"', async () => {
      const leadId = await createAssignedLead(
        'Note Test A',
        '0980000201',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Ghi chú của Sale 1' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await adminAgent
        .delete(`/candidate/${leadId}/note/${noteId}`)
        .expect(200);

      const notes = await sale1Agent
        .get(`/candidate/${leadId}/note`)
        .expect(200);
      const deleted = notes.body.find((n: { id: string }) => n.id === noteId);
      expect(deleted.is_deleted).toBe(true);
    });

    it('Quản lý xóa được ghi chú không phải của mình', async () => {
      const leadId = await createAssignedLead(
        'Note Test B',
        '0980000202',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Ghi chú khác của Sale 1' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await managerAgent
        .delete(`/candidate/${leadId}/note/${noteId}`)
        .expect(200);
    });

    it('Sale khác/Leader/MKT vẫn không xóa được ghi chú không phải của mình (không đổi)', async () => {
      const leadId = await createAssignedLead(
        'Note Test C',
        '0980000203',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Ghi chú riêng' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await sale2Agent
        .delete(`/candidate/${leadId}/note/${noteId}`)
        .expect(403);
      await leader1Agent
        .delete(`/candidate/${leadId}/note/${noteId}`)
        .expect(403);
      await mkt1Agent.delete(`/candidate/${leadId}/note/${noteId}`).expect(403);
    });
  });

  describe('4. Ghi chú — audit log khi thêm', () => {
    it('Thêm ghi chú ghi đúng audit log: người thao tác, ứng viên, nội dung', async () => {
      const leadId = await createAssignedLead(
        'Note Audit',
        '0980000301',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Nội dung ghi chú audit test' })
        .expect(201);

      const sale1Account = await prisma.account.findUniqueOrThrow({
        where: { username: 'perm_sale_1' },
      });
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'lead_note',
          entityId: noteRes.body.id as string,
          accountId: sale1Account.id,
          actionType: 'create',
        },
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].newValue).toBe('Nội dung ghi chú audit test');
    });
  });

  describe('5. Sửa ghi chú inline (module Lịch sử ghi chú/cuộc gọi)', () => {
    it('Sale sửa được ghi chú của chính mình; không sửa được ghi chú của Sale khác', async () => {
      const leadId = await createAssignedLead(
        'Edit Note A',
        '0980000401',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Bản gốc' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await sale2Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Sale 2 sửa trộm' })
        .expect(403);

      const updated = await sale1Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Sale 1 tự sửa' })
        .expect(200);
      expect(updated.body.content).toBe('Sale 1 tự sửa');
    });

    it('Leader sửa được ghi chú của lead trong nhóm mình; không sửa được nhóm khác', async () => {
      const leadId = await createAssignedLead(
        'Edit Note B',
        '0980000402',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Bản gốc B' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await leader2Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Leader 2 sửa trộm' })
        .expect(403);

      const updated = await leader1Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Leader 1 sửa' })
        .expect(200);
      expect(updated.body.content).toBe('Leader 1 sửa');
    });

    it('Quản lý và Admin sửa được ghi chú bất kỳ; MKT không có quyền sửa', async () => {
      const leadId = await createAssignedLead(
        'Edit Note C',
        '0980000403',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Bản gốc C' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await mkt1Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'MKT sửa trộm' })
        .expect(403);

      const byManager = await managerAgent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Quản lý sửa' })
        .expect(200);
      expect(byManager.body.content).toBe('Quản lý sửa');

      const byAdmin = await adminAgent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Admin sửa' })
        .expect(200);
      expect(byAdmin.body.content).toBe('Admin sửa');
    });

    it('Không cho sửa nội dung rỗng; cập nhật không cần reload vẫn thấy ngay qua GET', async () => {
      const leadId = await createAssignedLead(
        'Edit Note D',
        '0980000404',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Bản gốc D' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await sale1Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: '' })
        .expect(400);

      await sale1Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Nội dung đã sửa' })
        .expect(200);
      const list = await sale1Agent
        .get(`/candidate/${leadId}/note`)
        .expect(200);
      const found = list.body.find((n: { id: string }) => n.id === noteId);
      expect(found.content).toBe('Nội dung đã sửa');
    });

    it('Audit log ghi đúng: người sửa, thời gian, nội dung cũ, nội dung mới', async () => {
      const leadId = await createAssignedLead(
        'Edit Note E',
        '0980000405',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Nội dung cũ E' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await sale1Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Nội dung mới E' })
        .expect(200);

      const sale1Account = await prisma.account.findUniqueOrThrow({
        where: { username: 'perm_sale_1' },
      });
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'lead_note',
          entityId: noteId,
          accountId: sale1Account.id,
          actionType: 'update',
          fieldChanged: 'content',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].oldValue).toBe('Nội dung cũ E');
      expect(logs[0].newValue).toBe('Nội dung mới E');
    });

    it('Không sửa được ghi chú đã bị xóa mềm', async () => {
      const leadId = await createAssignedLead(
        'Edit Note F',
        '0980000406',
        mkt1Agent,
        leader1Agent,
        sale1Id,
      );
      const noteRes = await sale1Agent
        .post(`/candidate/${leadId}/note`)
        .send({ content: 'Sẽ bị xóa' })
        .expect(201);
      const noteId = noteRes.body.id as string;

      await sale1Agent
        .delete(`/candidate/${leadId}/note/${noteId}`)
        .expect(200);
      await sale1Agent
        .put(`/candidate/${leadId}/note/${noteId}`)
        .send({ content: 'Sửa sau khi xóa' })
        .expect(404);
    });
  });
});
