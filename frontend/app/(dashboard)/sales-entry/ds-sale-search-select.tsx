"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DsSaleSelectOption {
  id: string;
  label: string;
  sublabel?: string | null;
  avatarUrl?: string | null;
}

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-17, yêu cầu trực tiếp người
 * dùng, DS Sale — Mục 4/5/6): ô chọn dạng pill gọn, mở popover tìm kiếm khi
 * bấm — dùng chung cho 3 cột "Công ty làm"/"Sale"/"Đưa đón". Không cho gõ
 * tên tự do (Mục 5: "Không cho nhập tên tự do") — chỉ chọn từ danh sách,
 * lưu bằng id. `options` rỗng (vd chưa có dữ liệu công ty hợp tác) hiện
 * thông báo riêng thay vì danh sách trống im lặng.
 */
export function DsSaleSearchSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  disabled,
}: {
  options: DsSaleSelectOption[];
  value: DsSaleSelectOption | null;
  onChange: (option: DsSaleSelectOption | null) => void;
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) => option.label.toLowerCase().includes(q) || option.sublabel?.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors",
          value
            ? "border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100"
            : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-center">{value ? value.label : placeholder}</span>
        {value && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="shrink-0 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            <X className="h-2.5 w-2.5" strokeWidth={2.5} />
          </span>
        )}
      </button>

      {open && !disabled && (
        <div className="absolute top-full left-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
            <Search className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={2} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="mt-1 max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">{emptyLabel}</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">Không tìm thấy kết quả</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-100",
                    value?.id === option.id && "bg-brand-50 text-brand-800",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.sublabel && <span className="shrink-0 text-[10px] text-slate-400">{option.sublabel}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
