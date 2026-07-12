"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Trash2, Unlock, Users } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { AccountRole, Candidate } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionLink } from "./action-link";
import { SourceBadge } from "./source-badge";

/**
 * Mục 3, docs/12-ui-design.md — bảng "Cột chăm sóc": lead dùng chung của
 * nhóm, kèm cờ "Đang được xử lý bởi [Tên Sale]" nếu đang bị khóa. Mục 5,
 * docs/13: Sale chiếm khóa (mở lead) / giải phóng khóa; Admin gỡ khỏi danh
 * sách (không xóa ứng viên).
 */
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

export function CarePoolTable({
  candidates,
  currentUserId,
  currentUserRole,
  teamNameById,
  onChanged,
  onBanner,
}: {
  candidates: Candidate[];
  currentUserId: string;
  currentUserRole: AccountRole;
  teamNameById: Map<string, string>;
  onChanged: () => Promise<void>;
  onBanner: (banner: { type: "error" | "success"; text: string }) => void;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleRelease(candidate: Candidate) {
    setPendingId(candidate.id);
    try {
      await clientApi(`/care-pool/${candidate.id}/release`, { method: "POST" });
      await onChanged();
      onBanner({ type: "success", text: "Đã giải phóng khóa xử lý" });
    } catch (error) {
      onBanner({ type: "error", text: error instanceof ApiError ? error.message : "Có lỗi xảy ra" });
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(candidate: Candidate) {
    if (!window.confirm(`Gỡ "${candidate.full_name}" khỏi cột chăm sóc? Lao động không bị xóa, chỉ ẩn khỏi danh sách này.`)) {
      return;
    }
    setPendingId(candidate.id);
    try {
      await clientApi(`/care-pool/${candidate.id}`, { method: "DELETE" });
      await onChanged();
      onBanner({ type: "success", text: "Đã gỡ khỏi cột chăm sóc" });
    } catch (error) {
      onBanner({ type: "error", text: error instanceof ApiError ? error.message : "Có lỗi xảy ra" });
    } finally {
      setPendingId(null);
    }
  }

  if (candidates.length === 0) {
    return <EmptyState title="Cột chăm sóc đang trống" icon={<Users className="h-5 w-5" strokeWidth={1.75} />} />;
  }

  return (
    <div className="max-h-[calc(100vh-180px)] overflow-auto">
      {/* UI Polish — tinh chỉnh thêm độ rộng cột (đồng bộ với bảng chính):
          Ứng viên/Nguồn/Sale phụ trách/Hành động thu hẹp hết mức trong khi
          vẫn hiển thị đủ dữ liệu — width/min-width/max-width cố định bằng
          px trên <col>. Bảng này không có cột "Tình trạng cuộc gọi" nên phần
          tiết kiệm được không cộng vào đâu — chỉ đơn giản là bảng gọn hơn. */}
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[112px] min-w-[112px] max-w-[112px]" />
          <col className="w-[38px] min-w-[38px] max-w-[38px]" />
          <col className="w-[70px] min-w-[70px] max-w-[70px]" />
          <col className="w-[140px] min-w-[140px] max-w-[140px]" />
          <col className="w-[190px] min-w-[190px] max-w-[190px]" />
          <col className="w-[101px] min-w-[101px] max-w-[101px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-brand-50/95 text-[11px] font-semibold tracking-wider text-brand-900 uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur">
          <tr>
            <th className="border-r border-slate-100 px-1.5 py-3 text-center">Lao động</th>
            <th className="border-r border-slate-100 px-1 py-3 text-center">Nguồn</th>
            <th className="border-r border-slate-100 px-1 py-3 text-center">Sale phụ trách</th>
            <th className="border-r border-slate-100 px-3 py-3 text-center">Vào cột chăm sóc</th>
            <th className="border-r border-slate-100 px-3 py-3 text-center">Trạng thái khóa</th>
            <th className="px-1 py-3 text-center">Hành động</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {candidates.map((candidate, index) => {
            const teamName = candidate.assigned_team_id ? teamNameById.get(candidate.assigned_team_id) : undefined;
            const lockedBySelf = candidate.care_pool_locked_by?.id === currentUserId;
            const lockedByOther = Boolean(candidate.care_pool_locked_by) && !lockedBySelf;
            const isPending = pendingId === candidate.id;

            return (
              <tr
                key={candidate.id}
                className={`align-top transition-colors hover:bg-brand-50/50 ${index % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}
              >
                <td
                  className="cursor-pointer border-r border-slate-100 px-1.5 py-3"
                  onClick={(event) => {
                    // UI Polish — cả ô mở được chi tiết ứng viên, không chỉ riêng tên.
                    const target = event.target as HTMLElement;
                    if (target.closest("a, [role='button']")) return;
                    router.push(`/candidates/${candidate.id}`);
                  }}
                >
                  <Link
                    href={`/candidates/${candidate.id}`}
                    title={candidate.full_name}
                    className="line-clamp-2 font-medium text-slate-800 hover:text-brand-700 hover:underline"
                  >
                    {candidate.full_name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-slate-500">{candidate.phone_number}</p>
                </td>

                <td className="border-r border-slate-100 px-1 py-3 text-center">
                  <SourceBadge name={candidate.source.name} className="text-[10px] px-1.5 py-0" />
                </td>

                <td className="border-r border-slate-100 px-1 py-3">
                  {candidate.assigned_to ? (
                    <div className="flex flex-col items-center gap-0.5 text-center">
                      <Avatar fullName={candidate.assigned_to.name} className="h-6 w-6 shrink-0 text-[10px]" />
                      <div className="min-w-0 w-full leading-tight">
                        <p className="line-clamp-2 font-medium text-slate-800" title={candidate.assigned_to.name}>
                          {candidate.assigned_to.name}
                        </p>
                        {teamName && (
                          <p className="line-clamp-2 text-[10px] text-slate-400" title={teamName}>
                            {teamName}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Badge variant="neutral" className="text-[10px] px-2 py-0">
                      Chờ phân chia
                    </Badge>
                  )}
                </td>

                <td className="border-r border-slate-100 px-3 py-3 text-slate-600">
                  {candidate.entered_care_pool_at ? formatDateTime(candidate.entered_care_pool_at) : "—"}
                </td>

                <td className="border-r border-slate-100 px-3 py-3">
                  {candidate.care_pool_locked_by ? (
                    <Badge variant="warning">
                      Đang xử lý: {lockedBySelf ? "Bạn" : candidate.care_pool_locked_by.name}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Đang rảnh</Badge>
                  )}
                </td>

                <td className="px-1 py-3">
                  <div className="flex flex-wrap items-center gap-0.5">
                    {currentUserRole === "sale" && !lockedByOther && (
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
                      >
                        <LogIn className="h-3.5 w-3.5" strokeWidth={2} />
                        Mở xử lý
                      </Link>
                    )}
                    {currentUserRole === "sale" && lockedBySelf && (
                      <ActionLink
                        icon={<Unlock className="h-3.5 w-3.5" strokeWidth={2} />}
                        disabled={isPending}
                        onClick={() => void handleRelease(candidate)}
                      >
                        Giải phóng
                      </ActionLink>
                    )}
                    {currentUserRole === "sale" && lockedByOther && (
                      <span className="px-1 text-xs text-slate-400">Đang bị khóa</span>
                    )}
                    {currentUserRole === "admin" && (
                      <ActionLink
                        icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
                        tone="danger"
                        disabled={isPending}
                        onClick={() => void handleRemove(candidate)}
                      >
                        Gỡ
                      </ActionLink>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
