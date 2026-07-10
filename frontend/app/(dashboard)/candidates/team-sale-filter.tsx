"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Team, TeamMember } from "@/lib/types";

export interface TeamSaleValue {
  type: "team" | "sale";
  id: string;
}

/**
 * UI Polish — bộ lọc "Nhóm / Nhân viên" thay cho checkbox "Chỉ hiện trùng
 * SĐT" cũ. Dạng combobox tìm kiếm được (không dùng <select> gốc) vì danh
 * sách nhóm + Sale gộp chung có thể dài. Chỉ 1 lựa chọn tại 1 thời điểm
 * (theo nhóm HOẶC theo 1 Sale cụ thể — không kết hợp cả 2), khớp đúng cách
 * GET /candidate đang hỗ trợ (team_id/assigned_to).
 */
export function TeamSaleFilter({
  teams,
  saleMembers,
  value,
  onChange,
}: {
  teams: Team[];
  saleMembers: TeamMember[];
  value: TeamSaleValue | null;
  onChange: (value: TeamSaleValue | null) => void;
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

  const normalizedSearch = search.trim().toLowerCase();
  const filteredTeams = teams.filter((team) => team.name.toLowerCase().includes(normalizedSearch));
  const filteredSales = saleMembers.filter((member) => member.full_name.toLowerCase().includes(normalizedSearch));

  const selectedLabel = (() => {
    if (!value) return "Tất cả";
    if (value.type === "team") return teams.find((team) => team.id === value.id)?.name ?? "Nhóm";
    return saleMembers.find((member) => member.id === value.id)?.full_name ?? "Sale";
  })();

  function select(next: TeamSaleValue | null) {
    onChange(next);
    setIsOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-left text-xs text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
          {teams.length + saleMembers.length > 6 && (
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300"
                strokeWidth={2}
              />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm nhóm hoặc Sale..."
                className="w-full rounded-lg border border-slate-200 py-1.5 pr-2 pl-7 text-xs focus:border-brand-500 focus:outline-none"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => select(null)}
              className={cn(
                "block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium",
                !value ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50",
              )}
            >
              Tất cả
            </button>

            {filteredTeams.length > 0 && (
              <div className="mt-1.5">
                <p className="px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Nhóm</p>
                {filteredTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => select({ type: "team", id: team.id })}
                    className={cn(
                      "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs",
                      value?.type === "team" && value.id === team.id
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            )}

            {filteredSales.length > 0 && (
              <div className="mt-1.5">
                <p className="px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Nhân viên</p>
                {filteredSales.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => select({ type: "sale", id: member.id })}
                    className={cn(
                      "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs",
                      value?.type === "sale" && value.id === member.id
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {member.full_name}
                    {member.team_name && <span className="text-slate-400"> · {member.team_name}</span>}
                  </button>
                ))}
              </div>
            )}

            {filteredTeams.length === 0 && filteredSales.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-slate-400">Không tìm thấy</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
