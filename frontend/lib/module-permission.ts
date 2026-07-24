import "server-only";
import { redirect } from "next/navigation";
import { serverApi } from "./api-server";
import type { ModulePermissionLevel } from "./types";

export type { ModulePermissionLevel };

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): "Phân quyền" phiên bản đơn giản. Gọi GET /module-permission/me —
 * BE tự trả 'edit' cho mọi module nếu là Admin, còn lại lấy override đã
 * cấu hình hoặc suy ra theo vai trò mặc định (xem
 * module-permission.service.ts#getEffectiveMap phía backend — nguồn sự
 * thật duy nhất, file này chỉ gọi lại, KHÔNG tự tính toán gì thêm ở
 * frontend để tránh lệch logic 2 nơi).
 */
export async function getMyModulePermissions(): Promise<Record<string, ModulePermissionLevel>> {
  try {
    return await serverApi<Record<string, ModulePermissionLevel>>("/module-permission/me");
  } catch {
    // Lỗi mạng/BE tạm thời — an toàn hơn là coi như không có quyền gì thay
    // vì lỡ cho qua (server component gọi hàm này TRƯỚC KHI render trang).
    return {};
  }
}

/**
 * Gọi ở ĐẦU mỗi page.tsx (Server Component) của module cần gate — 'none'
 * (hoặc chưa có trong map) thì chuyển hướng sang /access-denied, chặn hẳn
 * không render trang. Trả về level thật ('view'|'edit') để trang tự quyết
 * định ẩn/disable nút thêm/sửa/xóa khi 'view' (Mục 2/6, yêu cầu người
 * dùng) — 'view' KHÔNG bị chặn ở đây, trang vẫn mở được, chỉ readonly.
 */
export async function requirePageAccess(moduleCode: string): Promise<ModulePermissionLevel> {
  const permissions = await getMyModulePermissions();
  const level = permissions[moduleCode] ?? "none";
  if (level === "none") {
    redirect("/access-denied");
  }
  return level;
}
