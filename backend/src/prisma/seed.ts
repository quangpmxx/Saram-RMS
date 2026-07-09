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

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});
