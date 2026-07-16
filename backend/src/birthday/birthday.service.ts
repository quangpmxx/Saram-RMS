import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { ListBirthdayQueryDto } from './dto/list-birthday-query.dto';
import {
  BirthdayEmployeeDto,
  BirthdayTodayResponseDto,
} from './dto/birthday-response.dto';

/** Cùng quy ước timezone hệ thống dùng xuyên suốt dự án (daily-reports.service.ts, checkin.service.ts, report-penalty.service.ts...) — không phát minh quy ước mới. */
const TIMEZONE = 'Asia/Ho_Chi_Minh';

const ACCOUNT_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  position: true,
  dateOfBirth: true,
  team: { select: { name: true } },
} satisfies Prisma.AccountSelect;

type BirthdayAccount = Prisma.AccountGetPayload<{
  select: typeof ACCOUNT_SELECT;
}>;

function todayMonthDay(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function todayYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
    }).format(new Date()),
  );
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Mục 1, yêu cầu người dùng: "Ngày 29/02: trong năm nhuận áp dụng ngày
 * 29/02. Năm không nhuận... nếu chưa có quy định thì dùng ngày 28/02" — hệ
 * thống chưa có quy định nào khác nên áp dụng đúng phương án dự phòng này.
 * `dateOfBirth` là cột @db.Date (không có giờ/múi giờ) — cắt trực tiếp từ
 * ISO string là an toàn, khớp đúng cách account-response.dto.ts đã làm.
 */
function effectiveBirthMonthDay(dateOfBirth: Date, year: number): string {
  const monthDay = dateOfBirth.toISOString().slice(5, 10);
  if (monthDay === '02-29' && !isLeapYear(year)) return '02-28';
  return monthDay;
}

function toEmployeeDto(account: BirthdayAccount): BirthdayEmployeeDto {
  return {
    account_id: account.id,
    full_name: account.fullName,
    avatar_url: account.avatarUrl,
    role: account.role,
    position: account.position,
    team_name: account.team?.name ?? null,
  };
}

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16, ngoài phạm vi Design Freeze
 * docs/09-13 — tính năng hoàn toàn mới): "Giao diện chúc mừng sinh nhật
 * nhân viên" — tái sử dụng dữ liệu Account.dateOfBirth đã có sẵn (Mục 0:
 * "phải tái sử dụng dữ liệu hiện tại"), không tạo bảng/field ngày sinh mới.
 */
@Injectable()
export class BirthdayService {
  constructor(private readonly prisma: PrismaService) {}

  async listToday(
    query: ListBirthdayQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<BirthdayTodayResponseDto> {
    // Mục 11: chế độ xem thử — CHỈ Admin, CHỈ ngoài production. Người khác
    // gửi kèm tham số này vẫn được phục vụ bình thường như không truyền gì.
    const allowPreview =
      currentUser.role === 'admin' && process.env.NODE_ENV !== 'production';

    const year = todayYear();
    const targetMonthDay =
      allowPreview && query.simulated_date
        ? query.simulated_date
        : todayMonthDay();
    const isPreview = Boolean(
      allowPreview && (query.simulated_date || query.force_account_id),
    );

    // Mục 1: "Chỉ áp dụng với tài khoản đang hoạt động" — status=active,
    // khớp đúng AccountStatus thật (chỉ có active/inactive, không có trạng
    // thái "khóa" riêng — inactive đã bao trùm mọi trường hợp ngừng hoạt động).
    const accounts = await this.prisma.account.findMany({
      where: { status: 'active' },
      select: ACCOUNT_SELECT,
    });

    const employees = accounts
      // Mục 1: "Nếu ngày sinh bị thiếu hoặc không hợp lệ thì bỏ qua tài khoản đó."
      .filter((account) => account.dateOfBirth !== null)
      .filter(
        (account) =>
          effectiveBirthMonthDay(account.dateOfBirth!, year) === targetMonthDay,
      )
      .map(toEmployeeDto);

    if (
      allowPreview &&
      query.force_account_id &&
      !employees.some((e) => e.account_id === query.force_account_id)
    ) {
      const forced = accounts.find((a) => a.id === query.force_account_id);
      if (forced) {
        employees.push(toEmployeeDto(forced));
      }
    }

    return { date: targetMonthDay, is_preview: isPreview, employees };
  }
}
