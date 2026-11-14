import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import { MediaClient } from "./media-client";
import type { MediaOptions } from "./media-shared";

/**
 * Media (2026-11-14): kế hoạch nội dung, công việc, duyệt sản phẩm, kho ý
 * tưởng, lịch xuất bản, báo cáo hiệu quả. Quyền: module "media" + quyền nhỏ
 * media.* (capability-catalog) — backend kiểm lại mọi thao tác.
 */
export default async function MediaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const level = await requirePageAccess("media");
  const options = await serverApi<MediaOptions>("/media/options");
  return <MediaClient canEdit={level === "edit"} initialOptions={options} />;
}
