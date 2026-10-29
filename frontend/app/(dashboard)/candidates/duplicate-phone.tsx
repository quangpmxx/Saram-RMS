"use client";

import { formatDMY } from "@/lib/date-format";
import { useEffect, useRef, useState } from "react";
import { clientApi } from "@/lib/api-client";
import type { DuplicateDetail } from "@/lib/types";

/**
 * Mục 2.1, docs/12-ui-design.md: "Tooltip/popup nhanh khi hover/click vào
 * icon cảnh báo trùng SĐT: hiển thị danh sách các lần trùng (ngày up, nhân
 * viên phụ trách)". Phân quyền chi tiết theo Mục 10.4, docs/09 + xác nhận
 * bổ sung của chủ doanh nghiệp (Leader/Sale chỉ xem trong nhóm mình) —
 * toàn bộ logic ẩn/hiện đã xử lý ở backend (GET /candidate/:id/duplicates),
 * component này chỉ hiển thị đúng những gì API trả về.
 *
 * Yêu cầu người dùng 2026-10-29: bỏ nhãn chéo "Trùng" — data trùng thì bôi
 * nền CAM ngay trên số điện thoại; rê chuột/bấm vào số vẫn xem được chi tiết
 * các lần trùng như trước.
 */
export function DuplicatePhone({
  candidateId,
  phoneNumber,
}: {
  candidateId: string;
  phoneNumber: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<DuplicateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
    <span ref={containerRef} className="relative min-w-0">
      <span
        role="button"
        tabIndex={0}
        title="Trùng SĐT — bấm để xem chi tiết"
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
        className="block cursor-pointer truncate rounded bg-orange-300 px-1 font-medium text-orange-950"
      >
        {phoneNumber}
      </span>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute top-5 left-0 z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs shadow-xl shadow-slate-900/10"
        >
          {isLoading && <p className="text-slate-500">Đang tải...</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!isLoading && !error && detail && !detail.visible && (
            <p className="text-slate-600">
              Số điện thoại này đã tồn tại trong hệ thống.
            </p>
          )}

          {!isLoading && !error && detail?.visible && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-slate-800">
                Trùng SĐT {detail.phone_number} với:
              </p>
              {detail.matches.map((match) => (
                <div key={match.lead_id} className="rounded-lg bg-slate-50 p-2">
                  <p className="font-medium text-slate-800">
                    {match.full_name}
                  </p>
                  <p className="text-slate-500">
                    Ngày up: {formatDMY(match.uploaded_at)}
                  </p>
                  <p className="text-slate-500">
                    Sale phụ trách:{" "}
                    {match.assigned_to?.name ?? "Chưa phân chia"}
                    {match.team_name ? ` (${match.team_name})` : ""}
                  </p>
                  <p className="text-slate-500">
                    Trạng thái: {match.status_label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
