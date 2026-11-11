import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { requirePageAccess } from "@/lib/module-permission";
import type { RecruitmentPosting, RecruitmentTeamScope } from "@/lib/types";
import { RecruitmentScheduleClient } from "./recruitment-schedule-client";

/**
 * Lịch tuyển dụng (2026-11-11, yêu cầu người dùng): thay sheet "Lịch tuyển
 * dụng" — Sale vừa gọi điện vừa nhìn để tư vấn lao động. Quyền: module
 * "recruitment-schedule" (Admin/Quản lý/Leader/Sup Leader sửa; Sale chỉ xem).
 */
export default async function RecruitmentSchedulePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const permissionLevel = await requirePageAccess("recruitment-schedule");
  // Mỗi nhóm một lịch riêng: backend đã tự giới hạn theo nhóm; `scope` cho biết có được chọn nhóm khác không.
  const [initialPostings, scope] = await Promise.all([
    serverApi<RecruitmentPosting[]>("/recruitment-schedule"),
    serverApi<RecruitmentTeamScope>("/recruitment-schedule/teams"),
  ]);

  return <RecruitmentScheduleClient canEdit={permissionLevel === "edit"} initialPostings={initialPostings} scope={scope} />;
}
