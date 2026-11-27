import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasCap } from "@/lib/capabilities";
import { AiChatLogsClient } from "./ai-chat-logs-client";

export const metadata: Metadata = { title: "Lịch sử chat AI" };

/** Trang Lịch sử chat AI (2026-11-27) — quyền voice.view_chat_logs (mặc định chỉ Admin), mở từ Cài đặt tài khoản. */
export default async function AiChatLogsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasCap(user, "voice.view_chat_logs")) redirect("/");
  return <AiChatLogsClient />;
}
