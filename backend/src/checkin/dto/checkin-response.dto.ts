import { CheckinStatus as CheckinStatusValue } from '../../../generated/prisma/client';

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-15, ngoài phạm vi Design Freeze
 * docs/09-13, yêu cầu trực tiếp người dùng): "Check in GPS" — PHASE 1+2+3.
 * voided/reset (Phase 4) sẽ bổ sung vào ĐÚNG DTO này sau, không tạo DTO
 * riêng theo Phase.
 *
 * Các field GPS/IP/thiết bị khai báo `| null` dù bản ghi TỰ CHECK-IN (GET
 * /checkin/status, POST /checkin) luôn có giá trị thật — lý do: DTO này
 * dùng CHUNG cho danh sách quản lý (GET /checkin/records), nơi Leader xem
 * bản ghi của người KHÁC (không phải chính mình) sẽ bị ẩn các field này
 * (redactRecordResponse() ở checkin.service.ts, Mục 10: chỉ Admin/Quản lý
 * "xem chi tiết GPS, IP, thiết bị").
 */
export interface CheckinRecordResponseDto {
  id: string;
  account_id: string;
  /** "YYYY-MM-DD" theo timezone hệ thống (Asia/Ho_Chi_Minh). */
  attendance_date: string;
  /** ISO — lấy từ đồng hồ server tại thời điểm ghi record. */
  checked_in_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  resolved_address: string | null;
  /** Snapshot cấu hình công ty TẠI THỜI ĐIỂM check-in (Mục 6) — không đổi dù Admin sửa cấu hình sau đó. */
  company_latitude: number | null;
  company_longitude: number | null;
  allowed_radius_meters: number;
  distance_from_company_meters: number;
  status: CheckinStatusValue;
  ip_address: string | null;
  user_agent: string | null;
  device: string | null;
  operating_system: string | null;
  browser: string | null;
  created_at: string;
}

export interface CheckinStatusResponseDto {
  checked_in_today: boolean;
  today_record: CheckinRecordResponseDto | null;
  /** ISO — giờ server hiện tại, frontend dùng để đồng bộ đồng hồ hiển thị (Mục 2, yêu cầu người dùng: "không tin thời gian trên thiết bị người dùng"). */
  server_time: string;
  /** Mục 7: chưa cấu hình vị trí công ty thì Nhân viên không được Check in. */
  company_location_configured: boolean;
  /** Preview thông tin sẽ được lưu nếu Check in ngay bây giờ (Mục 2/5) — suy từ chính request GET này, KHÔNG lưu gì. */
  ip_address: string | null;
  device: string;
  operating_system: string;
  browser: string;
}

/**
 * Mục 2/3, yêu cầu người dùng: hiển thị khoảng cách/trạng thái TRƯỚC khi
 * xác nhận Check in — tính bằng đúng công thức/service dùng khi lưu thật,
 * nhưng KHÔNG ghi gì xuống DB và KHÔNG lộ tọa độ công ty ra response (Mục 7:
 * "Chỉ Admin được xem... cấu hình này").
 */
export interface CheckinPreviewResponseDto {
  company_location_configured: boolean;
  distance_from_company_meters: number | null;
  status: CheckinStatusValue | null;
  /** "Công ty" khi status=valid, ngược lại null (frontend tự hiển thị resolved_address thay thế). */
  location_label: string | null;
}

export interface CompanyLocationResponseDto {
  address: string;
  latitude: number;
  longitude: number;
  allowed_radius_meters: number;
  updated_at: string;
  updated_by_name: string;
}

/** Mục 11: 1 dòng trong "trang quản lý Check in" — 1 nhân viên + bản ghi Check in của họ (null nếu chưa Check in ngày đang xem). */
export interface CheckinListEmployeeDto {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  position: string | null;
  team_id: string | null;
  team_name: string | null;
  checkin: CheckinRecordResponseDto | null;
}

export interface CheckinListResponseDto {
  /** "YYYY-MM-DD" */
  date: string;
  employees: CheckinListEmployeeDto[];
}
