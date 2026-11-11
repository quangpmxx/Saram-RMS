"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { shuttleColorStyle } from "@/lib/shuttle-colors";
import type { LeadCompanyOption } from "@/lib/types";

/** Bỏ dấu + chữ thường để gõ "cong ty" vẫn ra "Công ty". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/**
 * Ô chọn Công ty gõ để tìm (2026-11-11) — thay <select> gốc vì danh sách công ty
 * (= Đơn hàng) có thể lên cả trăm dòng. Dùng cho dòng "Công ty" ở trang Chi tiết
 * data và ô lọc "Công ty" ở danh sách. Từng dòng tô đúng màu đã cài ở Quản lý đơn hàng.
 */
export function CompanyPicker({
  options,
  value,
  selected,
  onChange,
  emptyLabel,
  size = "sm",
  disabled = false,
}: {
  options: LeadCompanyOption[];
  /** id công ty đang chọn; "" = chưa chọn. */
  value: string;
  /** Công ty đang chọn (để hiện đúng tên + màu cả khi danh sách chưa tải xong). */
  selected?: LeadCompanyOption | null;
  onChange: (companyId: string) => void;
  /** Chữ hiện khi chưa chọn, cũng là dòng đầu để bỏ chọn. */
  emptyLabel: string;
  size?: "sm" | "xs";
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const current = options.find((c) => c.id === value) ?? (selected && selected.id === value ? selected : null);
  const keyword = fold(search.trim());
  const filtered = keyword ? options.filter((c) => fold(c.name).includes(keyword)) : options;

  function select(companyId: string) {
    setIsOpen(false);
    setSearch("");
    if (companyId !== value) onChange(companyId);
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        title={current?.name}
        style={current ? shuttleColorStyle(current.color_key, current.text_color_key) : undefined}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white text-left text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
          size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-2 py-1 text-xs",
        )}
      >
        <span className="truncate">{current?.name ?? emptyLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-30 mt-1 w-64 max-w-[80vw] rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
          <div className="relative mb-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300"
              strokeWidth={2}
            />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                // Enter chọn luôn công ty đầu tiên khớp chữ đang gõ; Esc đóng.
                if (event.key === "Enter" && keyword && filtered.length > 0) select(filtered[0].id);
                if (event.key === "Escape") {
                  setIsOpen(false);
                  setSearch("");
                }
              }}
              placeholder="Gõ tên công ty…"
              className="w-full rounded-lg border border-slate-200 py-1.5 pr-2 pl-7 text-xs focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {!keyword && (
              <button
                type="button"
                onClick={() => select("")}
                className={cn(
                  "block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium",
                  !value ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50",
                )}
              >
                {emptyLabel}
              </button>
            )}
            {filtered.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => select(company.id)}
                style={shuttleColorStyle(company.color_key, company.text_color_key)}
                className={cn(
                  "block w-full shrink-0 truncate rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:brightness-95",
                  !company.color_key && "hover:bg-slate-50",
                  company.id === value && "font-semibold ring-2 ring-slate-500 ring-inset",
                )}
              >
                {company.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-400">Không tìm thấy</p>}
          </div>
        </div>
      )}
    </div>
  );
}
