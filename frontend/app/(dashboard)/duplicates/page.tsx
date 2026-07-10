import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import type { DuplicateGroup, PaginatedResult, Team } from "@/lib/types";
import { DuplicatesClient } from "./duplicates-client";

/**
 * Phase 9 (docs/14-roadmap.md) — S15: "Màn hình Danh sách trùng lặp chuyên
 * biệt toàn hệ thống", mở rộng từ cảnh báo cơ bản đã có ở Phase 1 (badge +
 * tooltip trên màn Ứng viên). GET /candidate/duplicate cho phép cả 5 vai trò
 * gọi (Mục 2, docs/13) — MKT/Quản lý/Admin xem toàn hệ thống, Sale/Leader
 * chỉ xem trong phạm vi nhóm mình (tự động lọc phía backend, không cần chọn
 * gì thêm ở đây).
 */
export default async function DuplicatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canFilterByTeam = ["admin", "manager"].includes(user.role);

  const [duplicates, teamsResult] = await Promise.all([
    serverApi<PaginatedResult<DuplicateGroup>>("/candidate/duplicate?page=1&page_size=20"),
    canFilterByTeam
      ? serverApi<PaginatedResult<Team>>("/team?page=1&page_size=100")
      : Promise.resolve<PaginatedResult<Team>>({ total: 0, page: 1, page_size: 100, items: [] }),
  ]);

  return (
    <DuplicatesClient
      initialDuplicates={duplicates}
      canFilterByTeam={canFilterByTeam}
      teams={teamsResult.items}
    />
  );
}
