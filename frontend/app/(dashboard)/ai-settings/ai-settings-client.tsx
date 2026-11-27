"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSetPageTitle } from "@/lib/page-title-context";
import { cn } from "@/lib/cn";
import { AiAssistantSettings } from "./ai-assistant-settings";
import { AiKnowledgeSettings } from "./ai-knowledge-settings";
import { AiChatLogs } from "./ai-chat-logs";

export type AiSettingsTab = "connect" | "teach" | "logs";

const TAB_LABEL: Record<AiSettingsTab, string> = {
  connect: "Kết nối & chi phí",
  teach: "Dạy trợ lý",
  logs: "Lịch sử chat",
};

/** 3 thẻ theo thứ tự dùng: kết nối Gemini → dạy trợ lý (sổ tay, kỹ năng Sale) → xem nhân viên đã hỏi gì. */
export function AiSettingsClient({ tabs, initialTab }: { tabs: AiSettingsTab[]; initialTab: AiSettingsTab }) {
  useSetPageTitle("Cài đặt trợ lý ảo AI");
  const [tab, setTab] = useState(initialTab);

  function choose(t: AiSettingsTab) {
    setTab(t);
    // Giữ thẻ trên địa chỉ để tải lại / gửi link vẫn mở đúng thẻ.
    window.history.replaceState(null, "", `?tab=${t}`);
  }

  return (
    <div className={cn("mx-auto", tab === "logs" ? "max-w-6xl" : "max-w-3xl")}>
      <Link href="/account-settings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Cài đặt tài khoản
      </Link>

      {tabs.length > 1 && (
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => choose(t)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {tab === "connect" && (
        <Card className="p-5">
          <AiAssistantSettings />
        </Card>
      )}
      {tab === "teach" && (
        <Card className="p-5">
          <AiKnowledgeSettings />
        </Card>
      )}
      {tab === "logs" && <AiChatLogs />}
    </div>
  );
}
