import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasCap } from "@/lib/capabilities";
import { AiSettingsClient, type AiSettingsTab } from "./ai-settings-client";

export const metadata: Metadata = { title: "Cài đặt trợ lý ảo AI" };

/**
 * Cài đặt trợ lý ảo AI (2026-11-27, yêu cầu người dùng): gom mọi cài đặt AI vào 1 trang, mở từ nút ở
 * Cài đặt tài khoản. Thẻ Kết nối & Dạy AI cần voice.ai_config; thẻ Lịch sử chat cần voice.view_chat_logs.
 */
export default async function AiSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canConfig = hasCap(user, "voice.ai_config");
  const canLogs = hasCap(user, "voice.view_chat_logs");
  if (!canConfig && !canLogs) redirect("/account-settings");
  const { tab } = await searchParams;
  const tabs: AiSettingsTab[] = [...(canConfig ? (["connect", "teach"] as const) : []), ...(canLogs ? (["logs"] as const) : [])];
  const initial = tabs.find((t) => t === tab) ?? tabs[0];
  return <AiSettingsClient tabs={tabs} initialTab={initial} />;
}
