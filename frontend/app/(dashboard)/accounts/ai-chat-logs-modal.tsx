"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Mic } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { ACCOUNT_ROLE_LABEL, type AccountRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

interface LogCount {
  account_id: string;
  name: string;
  role: AccountRole | null;
  count: number;
}
interface LogMessage {
  at: string;
  question: string;
  answer: string;
  via_voice: boolean;
}

/** Hôm nay theo giờ VN, dạng YYYY-MM-DD. */
function vnToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Lịch sử chat Trợ lý AI (2026-11-27, yêu cầu người dùng): chọn ngày → số lượt hỏi của từng nhân viên;
 * bấm 1 người → các câu đã hỏi + AI trả lời. Quyền voice.view_chat_logs (mặc định chỉ Admin).
 */
export function AiChatLogsModal({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(vnToday);
  const [person, setPerson] = useState<LogCount | null>(null);
  const [items, setItems] = useState<LogCount[] | null>(null);
  const [messages, setMessages] = useState<LogMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ date });
    if (person) q.set("account_id", person.account_id);
    clientApi<{ items?: LogCount[]; messages?: LogMessage[] }>(`/ai-assistant/logs?${q.toString()}`)
      .then((r) => {
        if (cancelled) return;
        setError(null);
        if (person) setMessages(r.messages ?? []);
        else setItems(r.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Không tải được lịch sử chat");
      });
    return () => {
      cancelled = true;
    };
  }, [date, person]);

  const total = items?.reduce((s, i) => s + i.count, 0) ?? 0;

  return (
    <Modal
      title={person ? `Chat AI của ${person.name}` : "Lịch sử chat AI"}
      description="Câu nhân viên đã hỏi Trợ lý AI và câu AI trả lời (lưu từ 27/11/2026)."
      maxWidth="max-w-3xl"
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {person && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPerson(null);
              setMessages(null);
            }}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Tất cả nhân viên
          </Button>
        )}
        <Input
          type="date"
          aria-label="Ngày"
          value={date}
          max={vnToday()}
          onChange={(e) => {
            if (!e.target.value) return;
            setDate(e.target.value);
            setMessages(null);
            setItems(null);
          }}
          className="w-auto"
        />
        {!person && items && <span className="text-sm text-slate-500">Tổng {total} lượt hỏi</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!person &&
        (items === null ? (
          <p className="text-sm text-slate-400">Đang tải…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">Ngày này chưa ai hỏi AI.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="py-2 font-medium">Nhân viên</th>
                <th className="py-2 font-medium">Vai trò</th>
                <th className="py-2 text-right font-medium">Số lượt hỏi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr
                  key={i.account_id}
                  onClick={() => setPerson(i)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="py-2 font-medium text-brand-700">{i.name}</td>
                  <td className="py-2 text-slate-500">{i.role ? ACCOUNT_ROLE_LABEL[i.role] : "—"}</td>
                  <td className="py-2 text-right font-semibold text-slate-800">{i.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

      {person &&
        (messages === null ? (
          <p className="text-sm text-slate-400">Đang tải…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-400">Ngày này người này chưa hỏi AI.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">{messages.length} lượt hỏi</p>
            {messages.map((m) => (
              <div key={m.at + m.question} className="rounded-lg border border-slate-200 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                  {formatTime(m.at)}
                  {m.via_voice && (
                    <span className="inline-flex items-center gap-0.5 text-amber-600">
                      <Mic className="h-3 w-3" /> nói
                    </span>
                  )}
                </p>
                <p className="text-sm font-medium text-slate-800">Hỏi: {m.question}</p>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-600">AI: {m.answer}</p>
              </div>
            ))}
          </div>
        ))}
    </Modal>
  );
}
