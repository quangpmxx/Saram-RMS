"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, History, PencilLine } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { LeadActivityItem } from "@/lib/types";
import { useLeadRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { NameWithRoleHint } from "@/components/name-with-role-hint";

/**
 * Yêu cầu người dùng (2026-10-29): khung bên phải trang Chi tiết data —
 * lịch sử truy cập + thao tác công khai ("Admin đã truy cập lúc...", "Sale A
 * đã cập nhật trạng thái... lúc 10:47"). Mở trang = ghi 1 lượt truy cập.
 *
 * Tự cập nhật: khi có sự kiện realtime của data này (ai đó vừa thao tác),
 * khi kết nối lại, và định kỳ khi tab đang hiển thị (lượt truy cập của
 * người khác không phát sự kiện realtime).
 */
const POLL_MS = 30_000;

type Filter = "all" | "view" | "action";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "view", label: "Truy cập" },
  { key: "action", label: "Thao tác" },
];

function dayKey(date: Date): string {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = dayKey(date);
  if (key === dayKey(today)) return `Hôm nay · ${key}`;
  if (key === dayKey(yesterday)) return `Hôm qua · ${key}`;
  return key;
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function ActivityPanel({ candidateId, className }: { candidateId: string; className?: string }) {
  const [items, setItems] = useState<LeadActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const reloadTimerRef = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const result = await clientApi<{ items: LeadActivityItem[] }>(`/candidate/${candidateId}/activity`);
      setItems(result.items);
      setError(false);
    } catch {
      setError(true);
    }
  }, [candidateId]);

  // Ghi lượt truy cập rồi mới tải, để dòng "đã truy cập" của chính mình có
  // ngay. Backend tự bỏ qua nếu vừa ghi trong 5 phút (F5, StrictMode chạy 2 lần).
  useEffect(() => {
    let cancelled = false;
    void clientApi(`/candidate/${candidateId}/view`, { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) void load();
      });
    return () => {
      cancelled = true;
    };
  }, [candidateId, load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(reloadTimerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Gộp nhiều sự kiện liên tiếp (vd lưu nhiều trường cùng lúc) thành 1 lần tải.
  useLeadRealtime((event) => {
    if (event.lead_id !== candidateId) return;
    window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => void load(), 600);
  });
  useRealtimeReconnect(() => void load());

  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      all: list.length,
      view: list.filter((i) => i.kind === "view").length,
      action: list.filter((i) => i.kind === "action").length,
    };
  }, [items]);

  const groups = useMemo(() => {
    const visible = (items ?? []).filter((i) => filter === "all" || i.kind === filter);
    const result: Array<{ key: string; label: string; items: LeadActivityItem[] }> = [];
    for (const item of visible) {
      const date = new Date(item.at);
      const key = dayKey(date);
      const last = result[result.length - 1];
      if (last?.key === key) last.items.push(item);
      else result.push({ key, label: dayLabel(date), items: [item] });
    }
    return result;
  }, [items, filter]);

  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="border-b border-slate-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" strokeWidth={2} />
          <p className="text-sm font-semibold text-slate-800">Lịch sử truy cập & thao tác</p>
        </div>
        <div className="mt-3 flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {f.label}
              {items && <span className="ml-1 opacity-75">{counts[f.key]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {items === null && !error && <p className="py-6 text-center text-sm text-slate-400">Đang tải...</p>}
        {items === null && error && (
          <p className="py-6 text-center text-sm text-slate-500">Không tải được lịch sử, đang thử lại...</p>
        )}
        {items !== null && groups.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">Chưa có hoạt động nào</p>
        )}
        {groups.map((group) => (
          <div key={group.key} className="mb-3 last:mb-0">
            <p className="sticky top-0 z-10 -mx-4 bg-white/95 px-4 py-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase backdrop-blur-sm">
              {group.label}
            </p>
            <ol className="mt-1 flex flex-col">
              {group.items.map((item) => (
                <li key={item.id} className="flex gap-2.5 py-1.5">
                  <div className="relative shrink-0">
                    {item.actor ? (
                      <Avatar
                        fullName={item.actor.name}
                        avatarUrl={item.actor.avatar_url}
                        className="h-7 w-7 text-[10px]"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-slate-200" />
                    )}
                    <span
                      className={cn(
                        "absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white",
                        item.kind === "view" ? "bg-slate-400" : "bg-brand-600",
                      )}
                    >
                      {item.kind === "view" ? (
                        <Eye className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                      ) : (
                        <PencilLine className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                      )}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 text-[13px] leading-snug">
                    <p className={cn("break-words", item.kind === "view" ? "text-slate-500" : "text-slate-700")}>
                      {item.actor ? (
                        <NameWithRoleHint account={item.actor} className="font-semibold text-slate-800" />
                      ) : (
                        <span className="font-semibold text-slate-800">Hệ thống</span>
                      )}{" "}
                      {item.text}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">lúc {timeLabel(new Date(item.at))}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Card>
  );
}
