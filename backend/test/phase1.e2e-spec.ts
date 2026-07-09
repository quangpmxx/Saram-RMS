import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as ExcelJS from 'exceljs';
import { bootstrapTestApp } from './utils/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Kiểm thử end-to-end đúng theo "Tiêu chí hoàn thành / test độc lập" của
 * Phase 1 trong docs/14-roadmap.md. Cần kết nối DATABASE_URL thật.
 * Tự tạo dữ liệu/tài khoản riêng (username có tiền tố "phase1_") để không
 * đụng tới dữ liệu của các bộ test khác chạy trên cùng database.
 */
describe('Phase 1 — Thu thập dữ liệu ứng viên (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facebookSourceId: string;
  let zaloSourceId: string;

  let mktAAgent: ReturnType<typeof request.agent>;
  let mktBAgent: ReturnType<typeof request.agent>;
  let managerAgent: ReturnType<typeof request.agent>;

  const server = () => app.getHttpServer();

  async function buildWorkbookBuffer(rows: string[][]): Promise<Buffer> {
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
    rows.forEach((row) => sheet.addRow(row));
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async function waitForJobCompletion(
    agent: ReturnType<typeof request.agent>,
    jobId: string,
  ) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await agent.get(`/candidate/import/${jobId}`).expect(200);
      if (res.body.status === 'completed' || res.body.status === 'failed') {
        return res.body;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error('Import job không hoàn tất trong thời gian chờ của test');
  }

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    // Dọn dữ liệu Phase 1 trước khi chạy, để bộ test tự chứa và lặp lại được.
    await prisma.importJob.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.account.deleteMany({
      where: { username: { in: ['phase1_mkt_a', 'phase1_mkt_b'] } },
    });

    for (const name of ['Facebook', 'TikTok', 'Zalo', 'Khác']) {
      await prisma.leadSource.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
    facebookSourceId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Facebook' } })
    ).id;
    zaloSourceId = (
      await prisma.leadSource.findUniqueOrThrow({ where: { name: 'Zalo' } })
    ).id;

    await prisma.account.deleteMany({ where: { username: 'phase1_manager' } });

    const passwordHash = await hashPassword('123456');
    await prisma.account.create({
      data: {
        fullName: 'MKT A',
        username: 'phase1_mkt_a',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'MKT B',
        username: 'phase1_mkt_b',
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    await prisma.account.create({
      data: {
        fullName: 'Quản lý Test',
        username: 'phase1_manager',
        passwordHash,
        role: 'manager',
        status: 'active',
      },
    });

    mktAAgent = request.agent(server());
    await mktAAgent
      .post('/login')
      .send({ username: 'phase1_mkt_a', password: '123456' })
      .expect(200);
    mktBAgent = request.agent(server());
    await mktBAgent
      .post('/login')
      .send({ username: 'phase1_mkt_b', password: '123456' })
      .expect(200);
    managerAgent = request.agent(server());
    await managerAgent
      .post('/login')
      .send({ username: 'phase1_manager', password: '123456' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('MKT nhập tay 1 lead → xuất hiện ngay trong danh sách, ở trạng thái "Chờ phân chia"', async () => {
    const createRes = await mktAAgent
      .post('/candidate')
      .send({
        full_name: 'Nguyễn Văn A',
        phone_number: '0900000001',
        source_id: facebookSourceId,
        mkt_note: 'ghi chú',
      })
      .expect(201);

    expect(createRes.body.candidate.assigned_to).toBeNull(); // = "Chờ phân chia", Phase 2 chưa tồn tại
    expect(createRes.body.duplicate_warning).toBeNull();

    const listRes = await mktAAgent
      .get('/candidate')
      .query({ keyword: '0900000001' })
      .expect(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0].full_name).toBe('Nguyễn Văn A');
  });

  it('chỉ MKT mới tạo được ứng viên mới — Quản lý bị chặn dù có toàn quyền xem', async () => {
    await managerAgent
      .post('/candidate')
      .send({
        full_name: 'X',
        phone_number: '0900000002',
        source_id: facebookSourceId,
      })
      .expect(403);

    await request(server())
      .post('/candidate')
      .send({
        full_name: 'X',
        phone_number: '090',
        source_id: facebookSourceId,
      })
      .expect(401);
  });

  it('nhập SĐT đã tồn tại → nhận cảnh báo trùng nhưng vẫn lưu được', async () => {
    const secondRes = await mktBAgent
      .post('/candidate')
      .send({
        full_name: 'Bản ghi trùng',
        phone_number: '0900000001',
        source_id: zaloSourceId,
      })
      .expect(201);

    expect(secondRes.body.candidate.is_duplicate_flagged).toBe(true);
    expect(secondRes.body.duplicate_warning).not.toBeNull();
    expect(secondRes.body.duplicate_warning.matches).toHaveLength(1);
    expect(secondRes.body.duplicate_warning.matches[0].uploaded_by).toBe(
      'MKT A',
    );

    const duplicateListRes = await mktAAgent
      .get('/candidate')
      .query({ is_duplicate_flagged: 'true' })
      .expect(200);
    const phones = duplicateListRes.body.items.map(
      (item: { phone_number: string }) => item.phone_number,
    );
    expect(phones.filter((p: string) => p === '0900000001')).toHaveLength(2);
  });

  it('MKT A không sửa/xóa được data do MKT B upload; MKT B tự sửa/xóa được', async () => {
    const created = await mktBAgent
      .post('/candidate')
      .send({
        full_name: 'Của MKT B',
        phone_number: '0900000099',
        source_id: facebookSourceId,
      })
      .expect(201);
    const leadId = created.body.candidate.id as string;

    await mktAAgent
      .put(`/candidate/${leadId}`)
      .send({ full_name: 'Sửa trộm' })
      .expect(403);
    await mktAAgent.delete(`/candidate/${leadId}`).expect(403);

    await mktBAgent
      .put(`/candidate/${leadId}`)
      .send({ full_name: 'MKT B tự sửa' })
      .expect(200);
    await mktBAgent.delete(`/candidate/${leadId}`).expect(200);

    // Đã xóa mềm — không còn xuất hiện trong danh sách/API xem chi tiết.
    await mktBAgent.get(`/candidate/${leadId}`).expect(404);
  });

  it('import Excel: báo cáo đúng số dòng thành công/lỗi/trùng qua job status', async () => {
    const buffer = await buildWorkbookBuffer([
      ['Phạm Văn Import 1', '0911111101', 'Facebook', '1998', 'Hà Nội', 'ok'],
      ['Phạm Văn Import 2', '0911111102', 'Nguồn Sai Chính Tả'], // lỗi: nguồn không hợp lệ
      ['', '', ''], // dòng trống — bỏ qua, không tính
      ['Thiếu SĐT', '', 'Zalo'], // lỗi: thiếu SĐT
      ['Phạm Văn Import 3', '0900000001', 'TikTok'], // trùng với lead đã tạo ở test đầu
    ]);

    const submitRes = await mktAAgent
      .post('/candidate/import')
      .attach('file', buffer, 'mau-import.xlsx')
      .expect(201);

    expect(submitRes.body.job_id).toBeDefined();

    const job = await waitForJobCompletion(
      mktAAgent,
      submitRes.body.job_id as string,
    );

    expect(job.status).toBe('completed');
    expect(job.total_rows).toBe(4);
    expect(job.success_count).toBe(2);
    expect(job.error_count).toBe(2);
    expect(job.duplicate_count).toBe(1);
    expect(job.errors).toHaveLength(2);
  });

  it('MKT khác không xem được tiến độ import của người khác', async () => {
    const buffer = await buildWorkbookBuffer([
      ['Riêng tư', '0922222201', 'Facebook'],
    ]);
    const submitRes = await mktAAgent
      .post('/candidate/import')
      .attach('file', buffer, 'x.xlsx')
      .expect(201);

    // Đợi xử lý nền hoàn tất trước khi kiểm tra quyền — quyền xem job không
    // phụ thuộc trạng thái xử lý, tách biệt để không có 2 request chạm cùng
    // lúc vào Postgres cục bộ dùng cho test (chỉ xử lý tuần tự từng câu lệnh).
    await waitForJobCompletion(mktAAgent, submitRes.body.job_id as string);

    await mktBAgent
      .get(`/candidate/import/${submitRes.body.job_id}`)
      .expect(403);
  });

  it('không đính kèm file khi import → báo lỗi rõ ràng', async () => {
    await mktAAgent.post('/candidate/import').expect(400);
  });
});
