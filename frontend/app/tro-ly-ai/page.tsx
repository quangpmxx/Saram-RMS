import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { requirePageAccess } from "@/lib/module-permission";
import { CapabilityProvider } from "@/lib/capability-context";
import { ToastProvider, ToastSlot } from "@/lib/toast-context";
import { VoiceAssistant } from "@/components/voice-assistant";

export const metadata: Metadata = { title: "Trợ lý AI" };

/**
 * Trang chat Trợ lý AI riêng (2026-11-26, yêu cầu người dùng): điện thoại mở trang này thay cho
 * popup. Nằm NGOÀI khung (dashboard) — không có header/menu/trang nào phía sau, nên khi bàn phím
 * iPhone (trong suốt) bật lên không bị lộ nền Dashboard như popup.
 */
export default async function AiChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/doi-mat-khau");
  await requirePageAccess("ai-assistant");

  return (
    <CapabilityProvider capabilities={user.capabilities ?? []}>
      <ToastProvider>
        <ToastSlot />
        <div className="min-h-dvh bg-white" />
        <VoiceAssistant userName={user.full_name} page />
      </ToastProvider>
    </CapabilityProvider>
  );
}
