/**
 * Seed dữ liệu khởi tạo cần thiết để hệ thống chạy được:
 *  - Tài khoản Admin đầu tiên (Mục 8, docs/09) — cần vì chỉ Admin mới tạo
 *    được tài khoản khác, nên phải có 1 tài khoản khởi tạo bằng script.
 *  - Danh mục nguồn kênh `lead_sources` (Mục 2, docs/09; Mục 2.6, docs/11).
 *  - Danh mục trạng thái chuẩn hóa `status_catalog` (Mục 7, docs/09;
 *    Mục 2.7, docs/11) — chưa được dùng tới ở Phase 1 (chỉ tồn tại cho FK
 *    hợp lệ của bảng `leads`), nhưng seed trước để Phase 3/4 dùng ngay
 *    không cần thao tác thêm.
 *
 * Đặt trong src/ (thay vì prisma/) để được biên dịch cùng `nest build` —
 * tránh lỗi phân giải module ".js"→".ts" của ts-node với cấu hình
 * "moduleResolution": "nodenext" (xem ghi chú vận hành trong README).
 *
 * Chạy: npm run build && npm run seed
 */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

const SALT_ROUNDS = 10;

async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const defaultPassword = process.env.DEFAULT_PASSWORD ?? '123456';

  const existing = await prisma.account.findUnique({ where: { username } });
  if (existing) {
    console.log(`Tài khoản admin "${username}" đã tồn tại — bỏ qua.`);
    return;
  }

  const passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);
  const admin = await prisma.account.create({
    data: {
      fullName: 'Quản trị viên',
      username,
      passwordHash,
      role: 'admin',
      status: 'active',
    },
  });

  console.log(
    `Đã tạo tài khoản Admin đầu tiên: username="${admin.username}", mật khẩu mặc định="${defaultPassword}"`,
  );
  console.log(
    'Vui lòng đăng nhập và đổi mật khẩu ngay sau lần dùng đầu tiên (Phase 0 chưa hỗ trợ tự đổi mật khẩu — chỉ Admin reset).',
  );
}

/** Mục 2, docs/09: Facebook, TikTok, Zalo, Khác. */
async function seedLeadSources(prisma: PrismaClient): Promise<void> {
  const names = ['Facebook', 'TikTok', 'Zalo', 'Khác'];

  for (const name of names) {
    const existing = await prisma.leadSource.findUnique({ where: { name } });
    if (!existing) {
      await prisma.leadSource.create({ data: { name } });
    }
  }

  console.log(`Đã đảm bảo đủ ${names.length} nguồn kênh: ${names.join(', ')}.`);
}

/** Mục 7, docs/09: toàn bộ giá trị trạng thái chuẩn hóa. */
async function seedStatusCatalog(prisma: PrismaClient): Promise<void> {
  const entries: Array<{
    category:
      'call_status' | 'call_result' | 'interview_status' | 'employment_status';
    code: string;
    name: string;
    sortOrder: number;
  }> = [
    { category: 'call_status', code: 'CALLED', name: 'Đã gọi', sortOrder: 1 },
    {
      category: 'call_status',
      code: 'NOT_CALLED',
      name: 'Chưa gọi',
      sortOrder: 2,
    },
    {
      category: 'call_status',
      code: 'NOT_ANSWERED',
      name: 'Không nghe máy',
      sortOrder: 3,
    },
    {
      category: 'call_status',
      code: 'UNREACHABLE',
      name: 'Thuê bao',
      sortOrder: 4,
    },

    {
      category: 'call_result',
      code: 'POTENTIAL',
      name: 'Tiềm năng',
      sortOrder: 1,
    },
    {
      category: 'call_result',
      code: 'NOT_POTENTIAL',
      name: 'Không tiềm năng',
      sortOrder: 2,
    },
    {
      category: 'call_result',
      code: 'CONSIDERING',
      name: 'Đang cân nhắc',
      sortOrder: 3,
    },
    {
      category: 'call_result',
      code: 'CALLBACK_REQUESTED',
      name: 'Hẹn gọi lại',
      sortOrder: 4,
    },

    {
      category: 'interview_status',
      code: 'SCHEDULED',
      name: 'Đã hẹn PV',
      sortOrder: 1,
    },
    {
      category: 'interview_status',
      code: 'ATTENDED',
      name: 'Đến PV',
      sortOrder: 2,
    },
    {
      category: 'interview_status',
      code: 'NO_SHOW',
      name: 'Bùng PV',
      sortOrder: 3,
    },
    {
      category: 'interview_status',
      code: 'PASSED',
      name: 'Đỗ PV',
      sortOrder: 4,
    },
    {
      category: 'interview_status',
      code: 'FAILED',
      name: 'Trượt PV',
      sortOrder: 5,
    },

    {
      category: 'employment_status',
      code: 'EMPLOYED',
      name: 'Đã đi làm',
      sortOrder: 1,
    },
    {
      category: 'employment_status',
      code: 'NOT_EMPLOYED',
      name: 'Không đi làm',
      sortOrder: 2,
    },
  ];

  for (const entry of entries) {
    const existing = await prisma.statusCatalog.findUnique({
      where: { category_code: { category: entry.category, code: entry.code } },
    });
    if (!existing) {
      await prisma.statusCatalog.create({ data: entry });
    }
  }

  console.log(
    `Đã đảm bảo đủ ${entries.length} trạng thái chuẩn hóa trong status_catalog.`,
  );
}

/**
 * Dữ liệu mẫu Phase 1 để trải nghiệm màn hình Ứng viên ngay sau khi cài đặt:
 *  - 1 tài khoản MKT mẫu (mkt_demo/123456).
 *  - 5 ứng viên mẫu do mkt_demo nhập, trong đó có 1 cặp trùng SĐT để minh
 *    họa cơ chế cảnh báo trùng lặp (Mục 4, docs/09).
 * Idempotent: bỏ qua nếu đã tồn tại, không chạy lại khi seed nhiều lần.
 */
async function seedSampleCandidates(prisma: PrismaClient): Promise<void> {
  const username = 'mkt_demo';
  const defaultPassword = process.env.DEFAULT_PASSWORD ?? '123456';

  let mktDemo = await prisma.account.findUnique({ where: { username } });
  if (!mktDemo) {
    const passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);
    mktDemo = await prisma.account.create({
      data: {
        fullName: 'MKT Demo',
        username,
        passwordHash,
        role: 'mkt',
        status: 'active',
      },
    });
    console.log(
      `Đã tạo tài khoản MKT mẫu: username="${username}", mật khẩu mặc định="${defaultPassword}"`,
    );
  }

  const existingSample = await prisma.lead.findFirst({
    where: { uploadedById: mktDemo.id },
  });
  if (existingSample) {
    console.log('Dữ liệu ứng viên mẫu đã tồn tại — bỏ qua.');
    return;
  }

  const sources = await prisma.leadSource.findMany();
  const sourceByName = new Map(sources.map((s) => [s.name, s.id]));

  const samples: Array<{
    fullName: string;
    phoneNumber: string;
    birthYear?: number;
    address?: string;
    source: string;
    mktNote?: string;
    isDuplicateFlagged?: boolean;
  }> = [
    {
      fullName: 'Nguyễn Văn An',
      phoneNumber: '0901000001',
      birthYear: 1998,
      address: 'Bình Dương',
      source: 'Facebook',
      mktNote: 'Muốn làm công nhân điện tử',
    },
    {
      fullName: 'Trần Thị Bình',
      phoneNumber: '0901000002',
      birthYear: 2000,
      address: 'Đồng Nai',
      source: 'Zalo',
    },
    {
      fullName: 'Lê Văn Cường',
      phoneNumber: '0901000003',
      birthYear: 1995,
      address: 'TP.HCM',
      source: 'TikTok',
      mktNote: 'Đã từng làm KCN Sóng Thần',
    },
    {
      fullName: 'Phạm Thị Duyên',
      phoneNumber: '0901000004',
      source: 'Facebook',
      isDuplicateFlagged: true,
    },
    {
      fullName: 'Phạm Thị Duyên (Zalo)',
      phoneNumber: '0901000004',
      source: 'Zalo',
      mktNote: 'Cùng SĐT với bản ghi Facebook — minh họa cảnh báo trùng lặp',
      isDuplicateFlagged: true,
    },
  ];

  for (const sample of samples) {
    const sourceId = sourceByName.get(sample.source);
    if (!sourceId) continue;
    await prisma.lead.create({
      data: {
        fullName: sample.fullName,
        phoneNumber: sample.phoneNumber,
        birthYear: sample.birthYear,
        address: sample.address,
        sourceId,
        mktNote: sample.mktNote,
        uploadedById: mktDemo.id,
        isDuplicateFlagged: sample.isDuplicateFlagged ?? false,
      },
    });
  }

  console.log(
    `Đã tạo ${samples.length} ứng viên mẫu cho tài khoản "${username}".`,
  );
}

/**
 * Dữ liệu mẫu Phase 2 để trải nghiệm phân chia/chuyển lead + không gian
 * Sale/Leader ngay sau khi cài đặt:
 *  - 1 nhóm mẫu "Nhóm Sale Demo" với 1 Leader (leader_demo/123456) và 2 Sale
 *    (sale_demo_a, sale_demo_b — cùng mật khẩu mặc định).
 *  - Gán 2/5 ứng viên mẫu đã tạo ở Phase 1 cho 2 Sale (minh họa "Đã giao"),
 *    giữ nguyên số còn lại ở trạng thái "Chờ phân chia" để trải nghiệm màn
 *    hình phân chia thủ công/hàng loạt ngay.
 * Idempotent: bỏ qua nếu nhóm mẫu đã tồn tại.
 */
async function seedPhase2Sample(prisma: PrismaClient): Promise<void> {
  const existingTeam = await prisma.team.findFirst({
    where: { name: 'Nhóm Sale Demo' },
  });
  if (existingTeam) {
    console.log('Dữ liệu nhóm/phân chia mẫu Phase 2 đã tồn tại — bỏ qua.');
    return;
  }

  const defaultPassword = process.env.DEFAULT_PASSWORD ?? '123456';
  const passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

  const team = await prisma.team.create({ data: { name: 'Nhóm Sale Demo' } });

  const leader = await prisma.account.create({
    data: {
      fullName: 'Leader Demo',
      username: 'leader_demo',
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
      fullName: 'Sale Demo A',
      username: 'sale_demo_a',
      passwordHash,
      role: 'sale',
      status: 'active',
      teamId: team.id,
    },
  });
  const saleB = await prisma.account.create({
    data: {
      fullName: 'Sale Demo B',
      username: 'sale_demo_b',
      passwordHash,
      role: 'sale',
      status: 'active',
      teamId: team.id,
    },
  });

  console.log(
    `Đã tạo nhóm "Nhóm Sale Demo" với Leader (leader_demo/${defaultPassword}) và 2 Sale (sale_demo_a, sale_demo_b/${defaultPassword}).`,
  );

  const [leadForA, leadForB] = await prisma.lead.findMany({
    where: {
      assignedToId: null,
      phoneNumber: { in: ['0901000001', '0901000002'] },
    },
    orderBy: { phoneNumber: 'asc' },
  });

  if (leadForA) {
    await prisma.lead.update({
      where: { id: leadForA.id },
      data: {
        assignedToId: saleA.id,
        assignedTeamId: team.id,
        assignedAt: new Date(),
        assignmentMethod: 'manual',
      },
    });
  }
  if (leadForB) {
    await prisma.lead.update({
      where: { id: leadForB.id },
      data: {
        assignedToId: saleB.id,
        assignedTeamId: team.id,
        assignedAt: new Date(),
        assignmentMethod: 'manual',
      },
    });
  }

  console.log(
    'Đã phân chia 2 ứng viên mẫu cho Sale Demo A/B — số còn lại vẫn ở trạng thái "Chờ phân chia".',
  );
}

/**
 * Dữ liệu mẫu để trải nghiệm tooltip "Trùng SĐT" với trường hợp trùng ở
 * NHIỀU NHÓM khác nhau (fix bổ sung sau Phase 2 — xem yêu cầu "Improve
 * duplicate phone visibility"):
 *  - Thêm 1 nhóm mẫu thứ 2 "Nhóm Sale Demo 2" với Leader (leader_demo_2) và
 *    1 Sale (sale_demo_c).
 *  - 3 ứng viên cùng SĐT: 1 thuộc "Nhóm Sale Demo" (Sale Demo A), 1 thuộc
 *    "Nhóm Sale Demo 2" (Sale Demo C), 1 chưa phân chia — đủ để tự kiểm tra
 *    cả 3 trường hợp phân quyền xem chi tiết trùng (cùng nhóm/khác nhóm/
 *    Admin-MKT xem toàn bộ).
 * Idempotent: bỏ qua nếu nhóm mẫu thứ 2 đã tồn tại.
 */
async function seedCrossTeamDuplicateSample(
  prisma: PrismaClient,
): Promise<void> {
  const existingTeam2 = await prisma.team.findFirst({
    where: { name: 'Nhóm Sale Demo 2' },
  });
  if (existingTeam2) {
    console.log('Dữ liệu mẫu trùng SĐT đa nhóm đã tồn tại — bỏ qua.');
    return;
  }

  const team1 = await prisma.team.findFirst({
    where: { name: 'Nhóm Sale Demo' },
  });
  const saleA = await prisma.account.findUnique({
    where: { username: 'sale_demo_a' },
  });
  if (!team1 || !saleA) {
    console.log(
      'Chưa có "Nhóm Sale Demo" — bỏ qua seed dữ liệu trùng SĐT đa nhóm (chạy lại sau khi seedPhase2Sample xong).',
    );
    return;
  }

  const defaultPassword = process.env.DEFAULT_PASSWORD ?? '123456';
  const passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

  const team2 = await prisma.team.create({
    data: { name: 'Nhóm Sale Demo 2' },
  });
  const leader2 = await prisma.account.create({
    data: {
      fullName: 'Leader Demo 2',
      username: 'leader_demo_2',
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
  const saleC = await prisma.account.create({
    data: {
      fullName: 'Sale Demo C',
      username: 'sale_demo_c',
      passwordHash,
      role: 'sale',
      status: 'active',
      teamId: team2.id,
    },
  });

  console.log(
    `Đã tạo nhóm "Nhóm Sale Demo 2" với Leader (leader_demo_2/${defaultPassword}) và Sale (sale_demo_c/${defaultPassword}).`,
  );

  const source = await prisma.leadSource.findFirst({
    where: { name: 'Facebook' },
  });
  if (!source) return;

  const mktDemo = await prisma.account.findUnique({
    where: { username: 'mkt_demo' },
  });
  if (!mktDemo) return;

  const dupPhone = '0901000005';

  await prisma.lead.create({
    data: {
      fullName: 'Võ Thị Em (Nhóm 1)',
      phoneNumber: dupPhone,
      sourceId: source.id,
      uploadedById: mktDemo.id,
      isDuplicateFlagged: true,
      assignedToId: saleA.id,
      assignedTeamId: team1.id,
      assignedAt: new Date(),
      assignmentMethod: 'manual',
    },
  });
  await prisma.lead.create({
    data: {
      fullName: 'Võ Thị Em (Nhóm 2)',
      phoneNumber: dupPhone,
      sourceId: source.id,
      uploadedById: mktDemo.id,
      isDuplicateFlagged: true,
      assignedToId: saleC.id,
      assignedTeamId: team2.id,
      assignedAt: new Date(),
      assignmentMethod: 'manual',
    },
  });
  await prisma.lead.create({
    data: {
      fullName: 'Võ Thị Em (Chờ phân chia)',
      phoneNumber: dupPhone,
      sourceId: source.id,
      uploadedById: mktDemo.id,
      isDuplicateFlagged: true,
    },
  });

  console.log(
    `Đã tạo 3 ứng viên trùng SĐT ${dupPhone} ở 2 nhóm khác nhau + 1 chưa phân chia để thử tooltip "Trùng SĐT".`,
  );
}

/**
 * Dữ liệu mẫu Phase 3 để trải nghiệm ngay màn hình Chi tiết ứng viên:
 *  - Cập nhật tình trạng/kết quả cuộc gọi cho ứng viên đã seed sẵn ở Phase 2
 *    (Nguyễn Văn An — do sale_demo_a phụ trách).
 *  - Thêm 3 ghi chú liên tiếp (đúng tiêu chí "không ghi đè nhau"), trong đó
 *    1 ghi chú bị đánh dấu xóa mềm để minh họa "vẫn lưu lịch sử".
 * Idempotent: bỏ qua nếu ứng viên này đã có ghi chú.
 */
async function seedPhase3Sample(prisma: PrismaClient): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { phoneNumber: '0901000001' }, // Nguyễn Văn An, đã gán cho sale_demo_a ở seedPhase2Sample
  });
  const saleA = await prisma.account.findUnique({
    where: { username: 'sale_demo_a' },
  });
  if (!lead || !saleA) {
    console.log(
      'Chưa có ứng viên mẫu Phase 2 cho sale_demo_a — bỏ qua seed dữ liệu Phase 3 (chạy lại sau khi seedPhase2Sample xong).',
    );
    return;
  }

  const existingNote = await prisma.leadNote.findFirst({
    where: { leadId: lead.id },
  });
  if (existingNote) {
    console.log('Dữ liệu mẫu Phase 3 (cuộc gọi/ghi chú) đã tồn tại — bỏ qua.');
    return;
  }

  const calledStatus = await prisma.statusCatalog.findUniqueOrThrow({
    where: { category_code: { category: 'call_status', code: 'CALLED' } },
  });
  const potentialResult = await prisma.statusCatalog.findUniqueOrThrow({
    where: { category_code: { category: 'call_result', code: 'POTENTIAL' } },
  });
  const callbackResult = await prisma.statusCatalog.findUniqueOrThrow({
    where: {
      category_code: { category: 'call_result', code: 'CALLBACK_REQUESTED' },
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      callStatusId: calledStatus.id,
      callResultId: callbackResult.id,
      lastActivityAt: new Date(),
    },
  });

  await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      createdById: saleA.id,
      content: 'Gọi lần 1: bắt máy, đang tìm hiểu thêm về công việc.',
      callStatusId: calledStatus.id,
      callResultId: potentialResult.id,
    },
  });
  await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      createdById: saleA.id,
      content: 'Gọi lần 2: ứng viên xin hẹn gọi lại vào tuần sau.',
      callStatusId: calledStatus.id,
      callResultId: callbackResult.id,
    },
  });
  const noteToDelete = await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      createdById: saleA.id,
      content: 'Ghi nhầm số điện thoại liên hệ — đã xóa.',
      callStatusId: calledStatus.id,
      callResultId: callbackResult.id,
    },
  });
  await prisma.leadNote.update({
    where: { id: noteToDelete.id },
    data: { isDeleted: true, deletedById: saleA.id, deletedAt: new Date() },
  });

  console.log(
    'Đã cập nhật tình trạng/kết quả cuộc gọi + 3 ghi chú (1 đã xóa mềm) cho ứng viên "Nguyễn Văn An".',
  );
}

/**
 * Dữ liệu mẫu Phase 4 để trải nghiệm ngay Lịch hẹn PV/gọi lại + màn hình
 * Chi tiết ứng viên:
 *  - Nguyễn Văn An (sale_demo_a): 1 lần hẹn PV đã đi qua trọn chuỗi đến PV →
 *    đỗ PV → đi làm (minh họa tiêu chí "chuỗi đến→đỗ→đi làm phản ánh đúng
 *    trên Candidate list" qua các cột snapshot).
 *  - Trần Thị Bình (sale_demo_b): 3 lần hẹn PV liên tiếp — lần 1 bùng PV,
 *    lần 2 đỗ PV nhưng không đi làm (kèm lý do bắt buộc), lần 3 hẹn lại sắp
 *    tới (minh họa "bùng PV vẫn hẹn lại được" + xuất hiện trên Lịch hẹn) —
 *    kèm 1 lịch gọi lại riêng để Lịch hẹn có cả 2 loại sự kiện.
 * Idempotent: bỏ qua nếu ứng viên "Nguyễn Văn An" đã có lịch hẹn PV.
 */
async function seedPhase4Sample(prisma: PrismaClient): Promise<void> {
  const leadAn = await prisma.lead.findFirst({
    where: { phoneNumber: '0901000001' },
  });
  const leadBinh = await prisma.lead.findFirst({
    where: { phoneNumber: '0901000002' },
  });
  const saleA = await prisma.account.findUnique({
    where: { username: 'sale_demo_a' },
  });
  const saleB = await prisma.account.findUnique({
    where: { username: 'sale_demo_b' },
  });
  if (!leadAn || !leadBinh || !saleA || !saleB) {
    console.log(
      'Chưa có ứng viên/Sale mẫu Phase 2 — bỏ qua seed dữ liệu Phase 4 (chạy lại sau khi seedPhase2Sample xong).',
    );
    return;
  }

  const existingInterview = await prisma.interviewAppointment.findFirst({
    where: { leadId: leadAn.id },
  });
  if (existingInterview) {
    console.log(
      'Dữ liệu mẫu Phase 4 (lịch hẹn PV/gọi lại) đã tồn tại — bỏ qua.',
    );
    return;
  }

  const scheduledStatus = await prisma.statusCatalog.findUniqueOrThrow({
    where: {
      category_code: { category: 'interview_status', code: 'SCHEDULED' },
    },
  });
  const noShowStatus = await prisma.statusCatalog.findUniqueOrThrow({
    where: { category_code: { category: 'interview_status', code: 'NO_SHOW' } },
  });
  const passedStatus = await prisma.statusCatalog.findUniqueOrThrow({
    where: { category_code: { category: 'interview_status', code: 'PASSED' } },
  });
  const employedStatus = await prisma.statusCatalog.findUniqueOrThrow({
    where: {
      category_code: { category: 'employment_status', code: 'EMPLOYED' },
    },
  });
  const notEmployedStatus = await prisma.statusCatalog.findUniqueOrThrow({
    where: {
      category_code: { category: 'employment_status', code: 'NOT_EMPLOYED' },
    },
  });

  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Nguyễn Văn An: 1 lần hẹn, trọn chuỗi đến → đỗ → đi làm.
  await prisma.interviewAppointment.create({
    data: {
      leadId: leadAn.id,
      attemptNo: 1,
      partnerCompanyName: 'Công ty TNHH Cơ Khí Sài Gòn',
      scheduledAt: new Date(now - 3 * dayMs),
      statusId: passedStatus.id,
      employmentStatusId: employedStatus.id,
      createdById: saleA.id,
    },
  });
  await prisma.lead.update({
    where: { id: leadAn.id },
    data: {
      currentInterviewStatusId: passedStatus.id,
      currentEmploymentStatusId: employedStatus.id,
      currentPartnerCompanyName: 'Công ty TNHH Cơ Khí Sài Gòn',
      lastActivityAt: new Date(),
    },
  });

  // Trần Thị Bình: bùng PV → hẹn lại (đỗ nhưng không đi làm) → hẹn lại lần nữa (sắp tới).
  const partnerBinh = 'Công ty CP May Mặc Đồng Nai';
  await prisma.interviewAppointment.create({
    data: {
      leadId: leadBinh.id,
      attemptNo: 1,
      partnerCompanyName: partnerBinh,
      scheduledAt: new Date(now - 10 * dayMs),
      statusId: noShowStatus.id,
      createdById: saleB.id,
    },
  });
  await prisma.interviewAppointment.create({
    data: {
      leadId: leadBinh.id,
      attemptNo: 2,
      partnerCompanyName: partnerBinh,
      scheduledAt: new Date(now - 5 * dayMs),
      statusId: passedStatus.id,
      employmentStatusId: notEmployedStatus.id,
      employmentReason:
        'Ứng viên xin nghỉ vì lý do gia đình, không thể đi làm xa nhà.',
      createdById: saleB.id,
    },
  });
  const upcomingInterview = await prisma.interviewAppointment.create({
    data: {
      leadId: leadBinh.id,
      attemptNo: 3,
      partnerCompanyName: partnerBinh,
      scheduledAt: new Date(now + 4 * dayMs),
      statusId: scheduledStatus.id,
      createdById: saleB.id,
    },
  });
  await prisma.lead.update({
    where: { id: leadBinh.id },
    data: {
      currentInterviewStatusId: upcomingInterview.statusId,
      currentEmploymentStatusId: upcomingInterview.employmentStatusId,
      currentPartnerCompanyName: upcomingInterview.partnerCompanyName,
      lastActivityAt: new Date(),
    },
  });

  await prisma.callbackSchedule.create({
    data: {
      leadId: leadBinh.id,
      scheduledAt: new Date(now + 2 * dayMs),
      createdById: saleB.id,
    },
  });

  console.log(
    'Đã tạo dữ liệu mẫu Phase 4: lịch hẹn PV cho "Nguyễn Văn An" (đã đi làm) và "Trần Thị Bình" (bùng PV → đỗ nhưng không đi làm → hẹn lại sắp tới) + 1 lịch gọi lại.',
  );
}

/**
 * Dữ liệu mẫu Phase 5 để trải nghiệm ngay tab "Cột chăm sóc" + màn hình Cấu
 * hình vận hành:
 *  - Tham số CARE_POOL_THRESHOLD_MINUTES (mặc định 30 phút) — seed sẵn để
 *    Admin có ít nhất 1 dòng sửa được trên màn hình Cấu hình (Mục 9.2,
 *    docs/12-ui-design.md — màn hình này chỉ sửa tham số có sẵn, không có
 *    nút "Thêm tham số").
 *  - 1 ứng viên "Hoàng Văn Đạt" (0901000006) thuộc Sale Demo B, đã gọi 1 lần
 *    rồi bị bỏ quên quá ngưỡng — set thẳng `enteredCarePoolAt` (thay vì chờ
 *    CarePoolScannerService quét theo chu kỳ 2 phút) để thấy ngay trong tab
 *    "Cột chăm sóc" mà không cần đợi worker chạy.
 * Idempotent: bỏ qua nếu ứng viên/tham số đã tồn tại.
 */
async function seedPhase5Sample(prisma: PrismaClient): Promise<void> {
  const admin = await prisma.account.findUnique({
    where: { username: 'admin' },
  });
  if (admin) {
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { configKey: 'CARE_POOL_THRESHOLD_MINUTES' },
    });
    // Nếu dòng cấu hình đang trỏ tới 1 tài khoản admin khác (vd: tài khoản
    // tạm của bộ test e2e chạy chung DB dev — xem README mục cảnh báo
    // test:e2e) thì gán lại về đúng tài khoản admin seed, KHÔNG đổi giá trị
    // đang có (tránh ghi đè thay đổi thật của người dùng qua màn hình Cấu hình).
    if (existingConfig && existingConfig.updatedById !== admin.id) {
      await prisma.systemConfig.update({
        where: { configKey: 'CARE_POOL_THRESHOLD_MINUTES' },
        data: { updatedById: admin.id },
      });
    }
    if (!existingConfig) {
      await prisma.systemConfig.create({
        data: {
          configKey: 'CARE_POOL_THRESHOLD_MINUTES',
          configValue: '30',
          description:
            'Ngưỡng thời gian (phút) trước khi lead bị bỏ quên tự động vào cột chăm sóc',
          updatedById: admin.id,
        },
      });
      console.log('Đã seed tham số cấu hình CARE_POOL_THRESHOLD_MINUTES = 30.');
    }
  }

  const existingLead = await prisma.lead.findFirst({
    where: { phoneNumber: '0901000006' },
  });
  if (existingLead) {
    console.log('Dữ liệu mẫu Phase 5 (cột chăm sóc) đã tồn tại — bỏ qua.');
    return;
  }

  const team = await prisma.team.findFirst({
    where: { name: 'Nhóm Sale Demo' },
  });
  const saleB = await prisma.account.findUnique({
    where: { username: 'sale_demo_b' },
  });
  const mktDemo = await prisma.account.findUnique({
    where: { username: 'mkt_demo' },
  });
  const facebookSource = await prisma.leadSource.findUnique({
    where: { name: 'Facebook' },
  });
  if (!team || !saleB || !mktDemo || !facebookSource) {
    console.log(
      'Chưa có nhóm/Sale/nguồn mẫu — bỏ qua seed dữ liệu Phase 5 (chạy lại sau khi các bước seed trước hoàn tất).',
    );
    return;
  }
  const calledStatus = await prisma.statusCatalog.findUniqueOrThrow({
    where: { category_code: { category: 'call_status', code: 'CALLED' } },
  });

  const lead = await prisma.lead.create({
    data: {
      fullName: 'Hoàng Văn Đạt',
      phoneNumber: '0901000006',
      birthYear: 1997,
      address: 'Long An',
      sourceId: facebookSource.id,
      uploadedById: mktDemo.id,
      assignedToId: saleB.id,
      assignedTeamId: team.id,
      assignedAt: new Date(),
      assignmentMethod: 'manual',
      callStatusId: calledStatus.id,
    },
  });

  const now = Date.now();
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      lastActivityAt: new Date(now - 45 * 60 * 1000),
      enteredCarePoolAt: new Date(now - 15 * 60 * 1000),
    },
  });

  console.log(
    'Đã tạo ứng viên mẫu "Hoàng Văn Đạt" (Sale Demo B) đang ở Cột chăm sóc do bỏ quên quá ngưỡng.',
  );
}

/**
 * Dữ liệu mẫu Phase 6 để trải nghiệm ngay popup "Cấu hình tự động phân
 * chia" trên trang Ứng viên (Leader). Seed sẵn danh sách vòng quay
 * [Sale Demo A, Sale Demo B] cho "Nhóm Sale Demo" nhưng CỐ Ý để
 * `is_active = false` (chưa kích hoạt) — nếu bật sẵn sẽ âm thầm đổi hành
 * vi "Chờ phân chia" mà các bước kiểm thử thủ công của Phase 2 trong
 * README đang dựa vào (tự động gán ngay lead mới, không còn ở trạng thái
 * chờ để demo phân chia thủ công) — vi phạm yêu cầu "giữ nguyên chức năng
 * các Phase trước". Leader tự bấm Kích hoạt khi muốn thử nghiệm Phase 6.
 * Idempotent: bỏ qua nếu đã tồn tại.
 */
async function seedPhase6Sample(prisma: PrismaClient): Promise<void> {
  const team = await prisma.team.findFirst({
    where: { name: 'Nhóm Sale Demo' },
  });
  const leader = await prisma.account.findUnique({
    where: { username: 'leader_demo' },
  });
  const saleA = await prisma.account.findUnique({
    where: { username: 'sale_demo_a' },
  });
  const saleB = await prisma.account.findUnique({
    where: { username: 'sale_demo_b' },
  });
  if (!team || !leader || !saleA || !saleB) {
    console.log(
      'Chưa có nhóm/Sale mẫu Phase 2 — bỏ qua seed dữ liệu Phase 6 (chạy lại sau khi seedPhase2Sample xong).',
    );
    return;
  }

  const existingRule = await prisma.distributionRule.findUnique({
    where: { teamId: team.id },
  });
  if (existingRule) {
    console.log(
      'Dữ liệu mẫu Phase 6 (cấu hình tự động phân chia) đã tồn tại — bỏ qua.',
    );
    return;
  }

  const rule = await prisma.distributionRule.create({
    data: {
      teamId: team.id,
      createdById: leader.id,
      isActive: false,
      lastAssignedPosition: 0,
    },
  });
  await prisma.distributionMember.createMany({
    data: [
      { ruleId: rule.id, accountId: saleA.id, orderIndex: 0 },
      { ruleId: rule.id, accountId: saleB.id, orderIndex: 1 },
    ],
  });

  console.log(
    'Đã tạo cấu hình vòng quay mẫu [Sale Demo A → Sale Demo B] cho "Nhóm Sale Demo" (đang TẮT — Leader tự kích hoạt khi muốn thử).',
  );
}

/**
 * Dữ liệu mẫu Phase 8 để trải nghiệm ngay Thông báo Zalo:
 *  - Tham số NOTIFICATION_LEAD_MINUTES (mặc định 15 phút) — seed sẵn để
 *    Admin có dòng sửa được trên màn hình Cấu hình (tái dùng đúng màn hình
 *    đã có từ Phase 5, không có màn hình riêng cho Phase 8).
 *  - 1 ứng viên "Đặng Văn Phúc" (0901000007) thuộc Sale Demo A, có lịch gọi
 *    lại đặt CHỈ 5 PHÚT sau thời điểm seed (dưới ngưỡng nhắc 15 phút) — để
 *    NotificationScannerService tạo thông báo "pending" rồi gửi ngay ở lượt
 *    quét đầu tiên (chu kỳ 2 phút) sau khi backend khởi động, không cần đợi
 *    nhiều ngày như lịch hẹn PV mẫu của Phase 4.
 * Idempotent: bỏ qua nếu ứng viên/tham số đã tồn tại.
 */
async function seedPhase8Sample(prisma: PrismaClient): Promise<void> {
  const admin = await prisma.account.findUnique({
    where: { username: 'admin' },
  });
  if (admin) {
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { configKey: 'NOTIFICATION_LEAD_MINUTES' },
    });
    if (existingConfig && existingConfig.updatedById !== admin.id) {
      await prisma.systemConfig.update({
        where: { configKey: 'NOTIFICATION_LEAD_MINUTES' },
        data: { updatedById: admin.id },
      });
    }
    if (!existingConfig) {
      await prisma.systemConfig.create({
        data: {
          configKey: 'NOTIFICATION_LEAD_MINUTES',
          configValue: '15',
          description:
            'Số phút nhắc trước giờ hẹn (gọi lại/phỏng vấn) qua Zalo',
          updatedById: admin.id,
        },
      });
      console.log('Đã seed tham số cấu hình NOTIFICATION_LEAD_MINUTES = 15.');
    }
  }

  const existingLead = await prisma.lead.findFirst({
    where: { phoneNumber: '0901000007' },
  });
  if (existingLead) {
    console.log('Dữ liệu mẫu Phase 8 (thông báo Zalo) đã tồn tại — bỏ qua.');
    return;
  }

  const team = await prisma.team.findFirst({
    where: { name: 'Nhóm Sale Demo' },
  });
  const saleA = await prisma.account.findUnique({
    where: { username: 'sale_demo_a' },
  });
  const mktDemo = await prisma.account.findUnique({
    where: { username: 'mkt_demo' },
  });
  const zaloSource = await prisma.leadSource.findUnique({
    where: { name: 'Zalo' },
  });
  if (!team || !saleA || !mktDemo || !zaloSource) {
    console.log(
      'Chưa có nhóm/Sale/nguồn mẫu — bỏ qua seed dữ liệu Phase 8 (chạy lại sau khi các bước seed trước hoàn tất).',
    );
    return;
  }

  const lead = await prisma.lead.create({
    data: {
      fullName: 'Đặng Văn Phúc',
      phoneNumber: '0901000007',
      birthYear: 1999,
      address: 'Cần Thơ',
      sourceId: zaloSource.id,
      uploadedById: mktDemo.id,
      assignedToId: saleA.id,
      assignedTeamId: team.id,
      assignedAt: new Date(),
      assignmentMethod: 'manual',
    },
  });

  await prisma.callbackSchedule.create({
    data: {
      leadId: lead.id,
      scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
      createdById: saleA.id,
    },
  });

  console.log(
    'Đã tạo ứng viên mẫu "Đặng Văn Phúc" (Sale Demo A) với lịch gọi lại 5 phút sau khi seed — sẽ có thông báo Zalo mô phỏng ở lượt quét đầu tiên.',
  );
}

/**
 * Danh mục quyền chi tiết (Phase 9, khung Phân quyền chi tiết). Tài liệu 09
 * (Mục 11.1) tự xác nhận danh sách quyền cụ thể "chưa được chốt với chủ
 * doanh nghiệp" — 5 quyền dưới đây do người dùng trực tiếp DUYỆT trong
 * phiên làm việc xây dựng Phase 9 (không phải danh sách chính thức cuối
 * cùng từ chủ doanh nghiệp thật, có thể điều chỉnh sau), dựa trên đúng 3
 * hành động đã xác nhận là "chỉ Admin làm được" tại Mục 8, tài liệu 09
 * (thêm/xóa nhân viên, xóa data, reset mật khẩu nhân viên) + 2 ví dụ mã
 * quyền chính tài liệu 11 (Mục 2.4) đã gợi ý sẵn (DELETE_LEAD,
 * EDIT_SYSTEM_CONFIG). Idempotent theo `code` (UNIQUE).
 */
async function seedPhase9Permissions(prisma: PrismaClient): Promise<void> {
  const permissions = [
    {
      code: 'ADD_EMPLOYEE',
      name: 'Thêm nhân viên',
      description: 'Tạo tài khoản nhân viên mới',
    },
    {
      code: 'DEACTIVATE_EMPLOYEE',
      name: 'Vô hiệu hóa/kích hoạt lại nhân viên',
      description: 'Vô hiệu hóa hoặc kích hoạt lại tài khoản nhân viên',
    },
    {
      code: 'RESET_PASSWORD',
      name: 'Reset mật khẩu nhân viên',
      description: 'Đặt lại mật khẩu về mặc định cho tài khoản khác',
    },
    {
      code: 'DELETE_LEAD',
      name: 'Xóa ứng viên',
      description: 'Xóa (mềm) 1 ứng viên khỏi hệ thống',
    },
    {
      code: 'EDIT_SYSTEM_CONFIG',
      name: 'Sửa cấu hình vận hành',
      description:
        'Sửa tham số hệ thống (ngưỡng Cột chăm sóc, số phút nhắc Zalo...)',
    },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: permission,
    });
  }

  console.log(
    `Đã seed ${permissions.length} quyền chi tiết (khung Phân quyền, Phase 9) — chờ chủ doanh nghiệp xác nhận chính thức.`,
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Thiếu biến môi trường DATABASE_URL');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  await seedAdmin(prisma);
  await seedLeadSources(prisma);
  await seedStatusCatalog(prisma);
  await seedSampleCandidates(prisma);
  await seedPhase2Sample(prisma);
  await seedCrossTeamDuplicateSample(prisma);
  await seedPhase3Sample(prisma);
  await seedPhase4Sample(prisma);
  await seedPhase5Sample(prisma);
  await seedPhase6Sample(prisma);
  await seedPhase8Sample(prisma);
  await seedPhase9Permissions(prisma);

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});
