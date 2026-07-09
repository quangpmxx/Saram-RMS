// Kiểu dữ liệu khớp với "Đối tượng dữ liệu dùng chung" — Mục 0.1, docs/13-api-design.md.

export type AccountRole = "admin" | "manager" | "leader" | "mkt" | "sale";
export type AccountStatus = "active" | "inactive";

export const ACCOUNT_ROLE_LABEL: Record<AccountRole, string> = {
  admin: "Admin",
  manager: "Quản lý",
  leader: "Leader",
  mkt: "MKT",
  sale: "Sale",
};

export interface Account {
  id: string;
  full_name: string;
  username: string;
  role: AccountRole;
  team_id: string | null;
  team_name: string | null;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string | null;
  leader_name: string | null;
  member_count: number;
  created_at: string;
}

export interface PaginatedResult<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface ApiErrorBody {
  error_code: string;
  message: string;
}
