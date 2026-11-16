import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import { WebsiteContactsClient, type WebsiteContactPage } from "./website-contacts-client";

/**
 * Liên hệ từ website (2026-11-16): doanh nghiệp gửi nhu cầu tuyển dụng ở form trên saramvina.com.
 * Quyền: module "website-contacts" (mặc định Admin + Quản lý).
 */
export default async function WebsiteContactsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const permissionLevel = await requirePageAccess("website-contacts");
  const initial = await serverApi<WebsiteContactPage>("/website/contacts?status=all&page=1&page_size=100");
  return <WebsiteContactsClient canEdit={permissionLevel === "edit"} initial={initial} />;
}
