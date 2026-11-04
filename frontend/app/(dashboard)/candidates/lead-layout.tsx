"use client";

import { useSyncExternalStore } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kiểu xem danh sách Data lao động (tab Tất cả + Chăm sóc, 2026-11-04):
 * "table" = bảng ngang như cũ, "cards" = lưới ô thẻ chữ nhật (đủ dữ liệu như bảng).
 * Máy tính: người dùng tự chọn (nhớ trên trình duyệt). Điện thoại (<768px): luôn dạng thẻ xếp dọc.
 */
export type LeadLayout = "table" | "cards";

const STORAGE_KEY = "saram.candidates.layout";
const PHONE_QUERY = "(max-width: 767px)";
const listeners = new Set<() => void>();
/** Lựa chọn trong phiên (dùng khi trình duyệt chặn localStorage). */
let memoryChoice: LeadLayout | null = null;

function readChosen(): LeadLayout {
  if (memoryChoice) return memoryChoice;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", callback);
  return () => {
    listeners.delete(callback);
    mq.removeEventListener("change", callback);
  };
}

function snapshot(): string {
  return `${window.matchMedia(PHONE_QUERY).matches ? "phone" : "desk"}:${readChosen()}`;
}

export function useLeadLayout(): { layout: LeadLayout; chosen: LeadLayout; isPhone: boolean; setLayout: (next: LeadLayout) => void } {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "desk:table");
  const [device, chosenRaw] = snap.split(":");
  const chosen = chosenRaw as LeadLayout;
  const isPhone = device === "phone";
  return {
    layout: isPhone ? "cards" : chosen,
    chosen,
    isPhone,
    setLayout(next) {
      memoryChoice = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Trình duyệt chặn lưu: vẫn đổi trong phiên này (memoryChoice).
      }
      listeners.forEach((l) => l());
    },
  };
}

/** Nút chuyển kiểu xem (2 biểu tượng). Ẩn trên điện thoại vì ở đó luôn là dạng thẻ. */
export function LeadLayoutToggle({ value, onChange }: { value: LeadLayout; onChange: (next: LeadLayout) => void }) {
  const options = [
    { key: "table" as const, label: "Dạng bảng ngang", Icon: Rows3 },
    { key: "cards" as const, label: "Dạng ô thẻ", Icon: LayoutGrid },
  ];
  return (
    <div className="hidden h-7 items-center rounded-md border border-slate-200 bg-white p-0.5 md:inline-flex" role="group" aria-label="Kiểu xem">
      {options.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "flex h-full w-7 items-center justify-center rounded transition-colors",
            value === key ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

/** Lưới chứa các ô thẻ: điện thoại 1 cột xếp dọc, máy tính tự chia cột theo độ rộng. */
export const LEAD_CARD_GRID_CLASS = "grid grid-cols-1 gap-2 p-2 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]";

/** Khung 1 ô thẻ. */
export const LEAD_CARD_CLASS =
  "flex cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30";
