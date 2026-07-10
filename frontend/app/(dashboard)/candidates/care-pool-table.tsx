"use client";

import { useState } from "react";
import Link from "next/link";
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
    if (!window.confirm(`Gỡ "${candidate.full_name}" khỏi cột chăm sóc? Ứng viên không bị xóa, chỉ ẩn khỏi danh sách này.`)) {
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
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[220px]" />
          <col className="w-[112px]" />
          <col className="w-[170px]" />
          <col className="w-[140px]" />
          <col className="w-[190px]" />
          <col className="w-[160px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-brand-50/95 text-[11px] font-semibold tracking-wider text-brand-900 uppercase shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur">
          <tr>
            <th className="border-r border-slate-100 px-4 py-3">Ứng viên</th>
            <th className="border-r border-slate-100 px-3 py-3">Nguồn</th>
            <th className="border-r border-slate-100 px-3 py-3">Sale phụ trách</th>
            <th className="border-r border-slate-100 px-3 py-3">Vào cột chăm sóc</th>
            <th className="border-r border-slate-100 px-3 py-3">Trạng thái khóa</th>
            <th className="px-2 py-3">Hành động</th>
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
                <td className="border-r border-slate-100 px-4 py-3">
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                  >
                    {candidate.full_name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{candidate.phone_number}</p>
                </td>

                <td className="border-r border-slate-100 px-3 py-3">
                  <SourceBadge name={candidate.source.name} />
                </td>

                <td className="border-r border-slate-100 px-3 py-3">
                  {candidate.assigned_to ? (
                    <div className="flex items-start gap-1.5">
                      <Avatar fullName={candidate.assigned_to.name} className="h-7 w-7 shrink-0 text-[11px]" />
                      <div className="min-w-0 leading-tight">
                        <p className="font-medium break-words text-slate-800">{candidate.assigned_to.name}</p>
                        {teamName && <p className="text-xs break-words text-slate-400">{teamName}</p>}
                      </div>
                    </div>
                  ) : (
                    <Badge variant="neutral">Chờ phân chia</Badge>
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

                <td className="px-2 py-3">
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
