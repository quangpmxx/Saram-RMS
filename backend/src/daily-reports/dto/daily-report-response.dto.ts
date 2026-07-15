/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-14, ngoài phạm vi Design Freeze
 * docs/09-13 — module mới): kiểu dữ liệu trả về của Báo cáo hằng ngày.
 */

export interface NamedRefWithRole {
  id: string;
  name: string;
  role: string;
}

/**
 * 1 dòng trong bảng "Báo cáo theo nhân viên" (Mục 7, yêu cầu người dùng) —
 * ứng với 1 (nhân viên, ngày) trong phạm vi lọc, DÙ CHƯA CÓ báo cáo (khi đó
 * report_id=null, 7 chỉ số nhập tay = 0, status='not_reported') — để hiện
 * đúng trạng thái "Chưa báo cáo" cho từng người/từng ngày.
 */
export interface DailyReportRowDto {
  date: string;
  account: {
    id: string;
    name: string;
    avatar_url: string | null;
    role: string;
  };
  team: { id: string; name: string } | null;
  report_id: string | null;
  calls: number;
  old_data: number;
  no_answer: number;
  interested: number;
  interview_scheduled: number;
  interview_passed: number;
  employed: number;
  /** Luôn tính trực tiếp từ Lead.uploadedAt — không cho nhập tay. */
  new_leads: number;
  status: 'reported' | 'not_reported';
  created_at: string | null;
  updated_at: string | null;
  created_by: NamedRefWithRole | null;
  updated_by: NamedRefWithRole | null;
}

export interface DailyReportTotals {
  calls: number;
  old_data: number;
  no_answer: number;
  interested: number;
  interview_scheduled: number;
  interview_passed: number;
  employed: number;
  new_leads: number;
}

export interface DailyReportTeamSummaryDto extends DailyReportTotals {
  team_id: string;
  team_name: string;
  reported_count: number;
  not_reported_count: number;
}

export interface DailyReportSummaryDto {
  totals: DailyReportTotals;
  by_team: DailyReportTeamSummaryDto[];
}

export function emptyTotals(): DailyReportTotals {
  return {
    calls: 0,
    old_data: 0,
    no_answer: 0,
    interested: 0,
    interview_scheduled: 0,
    interview_passed: 0,
    employed: 0,
    new_leads: 0,
  };
}
