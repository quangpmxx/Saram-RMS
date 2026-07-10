"use client";

import { useEffect, useRef, useState } from "react";
import { clientApi } from "@/lib/api-client";
import type { DuplicateDetail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

/**
 * Mục 2.1, docs/12-ui-design.md: "Tooltip/popup nhanh khi hover/click vào
 * icon cảnh báo trùng SĐT: hiển thị danh sách các lần trùng (ngày up, nhân
 * viên phụ trách)". Phân quyền chi tiết theo Mục 10.4, docs/09 + xác nhận
 * bổ sung của chủ doanh nghiệp (Leader/Sale chỉ xem trong nhóm mình) —
 * toàn bộ logic ẩn/hiện đã xử lý ở backend (GET /candidate/:id/duplicates),
 * component này chỉ hiển thị đúng những gì API trả về.
 */
export function DuplicateDetailBadge({ candidateId }: { candidateId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<DuplicateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function open() {
    setIsOpen(true);
    if (detail || isLoading) return;
    setIsLoading(true);
    setError(null);
    clientApi<DuplicateDetail>(`/candidate/${candidateId}/duplicates`)
      .then((result) => setDetail(result))
      .catch(() => setError("Không tải được thông tin trùng lặp"))
      .finally(() => setIsLoading(false));
  }

  return (
    <span ref={containerRef} className="relative inline-block">
      <Badge
        variant="accent"
        role="button"
        tabIndex={0}
        onMouseEnter={open}
        onMouseLeave={() => setIsOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          if (isOpen) {
            setIsOpen(false);
          } else {
            open();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (isOpen) {
              setIsOpen(false);
            } else {
              open();
            }
          }
        }}
        className="cursor-pointer"
      >
        Trùng SĐT
      </Badge>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute top-full left-0 z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs shadow-xl shadow-slate-900/10"
        >
          {isLoading && <p className="text-slate-500">Đang tải...</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!isLoading && !error && detail && !detail.visible && (
            <p className="text-slate-600">Số điện thoại này đã tồn tại trong hệ thống.</p>
          )}

          {!isLoading && !error && detail?.visible && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-slate-800">Trùng SĐT {detail.phone_number} với:</p>
              {detail.matches.map((match) => (
                <div key={match.lead_id} className="rounded-lg bg-slate-50 p-2">
                  <p className="font-medium text-slate-800">{match.full_name}</p>
                  <p className="text-slate-500">Ngày up: {new Date(match.uploaded_at).toLocaleDateString("vi-VN")}</p>
                  <p className="text-slate-500">
                    Sale phụ trách: {match.assigned_to?.name ?? "Chưa phân chia"}
                    {match.team_name ? ` (${match.team_name})` : ""}
                  </p>
                  <p className="text-slate-500">Trạng thái: {match.status_label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
