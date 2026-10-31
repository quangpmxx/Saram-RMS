import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { requirePageAccess } from "@/lib/module-permission";
import { MarketingHubClient } from "./marketing-hub-client";

/**
 * Marketing Hub — CHỈ khung sườn, chưa có nghiệp vụ gì (yêu cầu trực tiếp người
 * dùng, 2026-11-01; sẽ phát triển sau). Mặc định Admin/Quản lý/MKT xem được
 * (defaultRoles ở module-registry.ts).
 */
export default async function MarketingHubPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  await requirePageAccess("marketing-hub");

  return <MarketingHubClient />;
}
