import { DashboardQueryDto } from './dashboard-query.dto';

/**
 * Mục 8, docs/13-api-design.md — GET /report/funnel (query). `account_id`
 * giờ kế thừa thẳng từ DashboardQueryDto (thêm ở đó phục vụ riêng bộ lọc
 * "Nhân viên" của Dashboard) — cùng field, không đổi hành vi endpoint này.
 */
export class ReportFunnelQueryDto extends DashboardQueryDto {}
