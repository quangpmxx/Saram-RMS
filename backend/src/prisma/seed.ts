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

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});
