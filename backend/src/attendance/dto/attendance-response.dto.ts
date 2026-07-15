/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới): kiểu dữ liệu trả về của "Chấm công thủ công".
 */

export type AttendanceStatusValue =
  | 'present'
  | 'half'
  | 'paid_leave'
  | 'unpaid_leave'
  | 'holiday'
  | 'compensatory_leave';

/**
 * 1 nhân viên trong bảng. Cột "Vị trí" hiện `position` nếu đã đặt tay
 * (Account.position, thêm 2026-07-15, yêu cầu trực tiếp người dùng: "cho
 * phép sửa tay tên vị trí"), ngược lại frontend tự map `role` sang nhãn
 * tiếng Việt qua ACCOUNT_ROLE_LABEL (lib/types.ts) làm giá trị mặc định.
 */
export interface AttendanceEmployeeDto {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  /** Chức vụ tùy chỉnh — null nghĩa là chưa đặt tay, dùng nhãn vai trò mặc định. */
  position: string | null;
  team_id: string | null;
  team_name: string | null;
  status: 'active' | 'inactive';
  /**
   * 5 field hồ sơ nhân sự (2026-07-15, yêu cầu trực tiếp người dùng: nối
   * sang modal "Thông tin nhân viên") — CHỈ ĐỌC ở đây, sửa qua trang Quản
   * lý tài khoản (PUT /account/:id), xem accounts.controller.ts.
   */
  date_of_birth: string | null;
  hire_date: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  remaining_leave_days: number | null;
  /** Bổ sung 2026-07-15 (yêu cầu trực tiếp người dùng): CCCD + STK — cùng quy tắc chỉ đọc như 5 field trên. */
  citizen_id: string | null;
  bank_account_number: string | null;
}

/** 1 cột ngày trong tháng đang xem. */
export interface AttendanceDayDto {
  /** "YYYY-MM-DD" */
  date: string;
  day: number;
  /** "CN"/"T2".."T7" */
  weekday_label: string;
  is_sunday: boolean;
}

/** 1 ô đã có trạng thái (mảng thưa — ngày/nhân viên không có bản ghi nghĩa là "trống/chưa chấm"). */
export interface AttendanceCellDto {
  account_id: string;
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatusValue;
  note: string | null;
  updated_at: string;
}

export interface AttendanceGridDto {
  year: number;
  month: number;
  days: AttendanceDayDto[];
  employees: AttendanceEmployeeDto[];
  records: AttendanceCellDto[];
  /** Vai trò của người xem — Mục 8: frontend dùng để bật/tắt chỉnh sửa (BE luôn chặn lại lần nữa ở endpoint lưu). */
  can_edit: boolean;
}
