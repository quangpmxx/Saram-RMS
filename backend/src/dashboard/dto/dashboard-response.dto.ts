/**
 * Các kiểu dữ liệu trả về của Dashboard/Report — Mục 8, docs/13-api-design.md
 * mô tả "các chỉ số tổng hợp theo đúng Mục 9, tài liệu 09" mà không cố định
 * tên trường cụ thể; định nghĩa dưới đây bám sát đúng 5 chỉ số đã chốt tại
 * Mục 9, docs/09, không thêm số liệu nào ngoài phạm vi đó.
 */

export interface FunnelStep {
  code: 'LEAD' | 'INTERVIEW_SCHEDULED' | 'ATTENDED' | 'PASSED' | 'EMPLOYED';
  label: string;
  count: number;
  /** % so với bước "Lead" (bước đầu tiên) — làm tròn 1 chữ số thập phân. */
  percentage: number;
}

/**
 * Dự án phụ — nâng cấp toàn diện (ngoài phạm vi Design Freeze docs/09-13,
 * riêng giao diện Dashboard — yêu cầu trực tiếp người dùng): 7 chỉ số đầy đủ.
 *
 * ĐỔI NGUỒN DỮ LIỆU (2026-07-14, yêu cầu trực tiếp người dùng) — 5/7 chỉ số
 * giờ lấy từ module "Danh sách đưa đón" (ShuttleRecord), KHÔNG còn lấy từ
 * Candidates/InterviewAppointment nữa:
 * - interview_scheduled ("Hẹn PV") = tổng số dòng đưa đón của Sale đó (bất
 *   kể Tình trạng gì, kể cả "Hẹn lại"/để trống).
 * - attended ("Đến PV") = dòng có Tình trạng = "Đã đón".
 * - no_show ("Bùng PV") = dòng có Tình trạng = "Chưa đón được".
 * - passed ("Đỗ PV") = dòng có Kết quả = "Đỗ PV".
 * - failed ("Trượt PV") = dòng có Kết quả = "Trượt PV".
 * Dòng có Tình trạng = "Hẹn lại" hoặc để trống KHÔNG tính vào attended lẫn
 * no_show (vẫn tính vào interview_scheduled). Xem computeShuttleKpi() và
 * các hằng số SHUTTLE_STATUS_... / SHUTTLE_RESULT_... trong
 * dashboard.service.ts — LƯU Ý: đây là 4 giá trị chuỗi tự do trong bảng
 * shuttle_options (người dùng
 * có thể đổi tên qua "Chỉnh sửa danh sách"), không phải enum cố định — nếu
 * đổi tên/xóa 1 trong 4 giá trị này ở trang Đưa đón, việc khớp sẽ âm thầm
 * sai. new_leads ("Data mới") GIỮ NGUYÊN từ Lead (không đổi).
 *
 * employed/employed_rate/performance_rate = null (yêu cầu trực tiếp người
 * dùng 2026-07-14: "để trống", chờ module Quản lý lao động mới cung cấp API
 * sau này) — Đưa đón không có trường lưu kết quả đi làm.
 *
 * Khi có lọc theo Nguồn (source_id): Đưa đón không liên kết Nguồn nên 5 chỉ
 * số Shuttle-based trên trả về 0 (yêu cầu trực tiếp người dùng — "số về 0
 * khi có lọc Nguồn"), KHÁC new_leads (vẫn lọc theo Nguồn bình thường).
 */
export interface KpiBreakdown {
  new_leads: number;
  interview_scheduled: number;
  attended: number;
  no_show: number;
  passed: number;
  failed: number;
  /** null = chưa có nguồn dữ liệu (chờ module Quản lý lao động). */
  employed: number | null;
  /** % so với new_leads — làm tròn 1 chữ số thập phân. */
  schedule_rate: number;
  attend_rate: number;
  pass_rate: number;
  employed_rate: number | null;
  /** Đi làm ÷ Data mới — công thức "Hiệu suất (%)" người dùng đã chốt. null = chưa có dữ liệu Đi làm. */
  performance_rate: number | null;
}

export interface DashboardSummaryDto {
  new_leads_total: number;
  new_leads_by_source: Array<{
    source_id: string;
    source_name: string;
    count: number;
  }>;
  pending_count: number;
  funnel: FunnelStep[];
  care_pool_count: number;
  kpi: KpiBreakdown;
  /** Cùng kỳ liền trước (độ dài bằng khoảng đã lọc) — null nếu chưa chọn khoảng ngày (không có gì để so sánh). */
  kpi_previous: KpiBreakdown | null;
}

export interface SalePerformanceDto {
  account_id: string;
  full_name: string;
  avatar_url: string | null;
  team_id: string | null;
  calls: number;
  potential_leads: number;
  interview_count: number;
  employed_count: number;
  kpi: KpiBreakdown;
}

export interface TeamSummaryDto {
  team_id: string;
  team_name: string;
  lead_count: number;
  conversion_rate: number;
  care_pool_count: number;
  kpi: KpiBreakdown;
}

export interface BySourceReportDto {
  source_id: string;
  source_name: string;
  lead_count: number;
  potential_rate: number;
  employed_rate: number;
}
