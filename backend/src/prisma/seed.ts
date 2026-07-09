/**
 * Seed tài khoản Admin đầu tiên — vì hệ thống yêu cầu Admin mới tạo được
 * tài khoản khác (Mục 8, docs/09-business-specification.md), cần 1 tài
 * khoản khởi tạo bằng script thay vì qua giao diện.
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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Thiếu biến môi trường DATABASE_URL');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const defaultPassword = process.env.DEFAULT_PASSWORD ?? '123456';

  const existing = await prisma.account.findUnique({ where: { username } });
  if (existing) {
    console.log(`Tài khoản admin "${username}" đã tồn tại — bỏ qua seed.`);
    await prisma.$disconnect();
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

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});
