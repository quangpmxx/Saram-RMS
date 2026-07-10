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
}

export interface SalePerformanceDto {
  account_id: string;
  full_name: string;
  calls: number;
  potential_leads: number;
  interview_count: number;
  employed_count: number;
}

export interface TeamSummaryDto {
  team_id: string;
  team_name: string;
  lead_count: number;
  conversion_rate: number;
  care_pool_count: number;
}

export interface BySourceReportDto {
  source_id: string;
  source_name: string;
  lead_count: number;
  potential_rate: number;
  employed_rate: number;
}
