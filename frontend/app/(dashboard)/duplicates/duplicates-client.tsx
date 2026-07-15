"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronLeft, RefreshCw, Users } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import type { DuplicateGroup, PaginatedResult, Team } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, Field } from "@/components/ui/form";
import { useSetPageTitle } from "@/lib/page-title-context";
import { SourceBadge } from "../candidates/source-badge";

const PAGE_SIZE = 20;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

export function DuplicatesClient({
  initialDuplicates,
  canFilterByTeam,
  teams,
}: {
  initialDuplicates: PaginatedResult<DuplicateGroup>;
  canFilterByTeam: boolean;
  teams: Team[];
}) {
  useSetPageTitle(
    "Trùng lặp",
    "Danh sách trùng lặp toàn hệ thống — mở rộng từ cảnh báo trên màn Lao động.",
  );

  const [result, setResult] = useState(initialDuplicates);
  const [teamId, setTeamId] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  async function refresh(page = 1) {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (canFilterByTeam && teamId) query.set("team_id", teamId);
      const next = await clientApi<PaginatedResult<DuplicateGroup>>(`/candidate/duplicate?${query.toString()}`);
      setResult(next);
    } finally {
      setLoading(false);
    }
  }

  function toggle(phone: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));

  return (
    <div className="mx-auto max-w-5xl">
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        {canFilterByTeam && (
          <Field label="Nhóm" uiSize="sm" className="w-48">
            <Select uiSize="sm" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              <option value="">Tất cả nhóm</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void refresh(1)}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2} />
          Làm mới
        </Button>
        <div className="ml-auto flex items-center gap-1.5 text-sm text-slate-500">
          <Users className="h-4 w-4" strokeWidth={2} />
          Tổng số nhóm trùng lặp: <span className="font-semibold text-slate-800">{result.total}</span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState title="Không có dữ liệu trùng lặp" description="Chưa phát hiện số điện thoại nào bị trùng trong phạm vi bạn có thể xem." />
        ) : (
          <div className="divide-y divide-slate-100">
            {result.items.map((group) => {
              const isOpen = expanded.has(group.phone_number);
              return (
                <div key={group.phone_number}>
                  <button
                    type="button"
                    onClick={() => toggle(group.phone_number)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                    )}
                    <span className="font-medium text-slate-800">{group.phone_number}</span>
                    <Badge variant="warning">{group.matches.length} bản ghi</Badge>
                  </button>
                  {isOpen && (
                    <div className="overflow-x-auto bg-slate-50/60 px-4 pb-4">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs text-slate-500">
                            <th className="py-2 pr-3 font-medium">Tên lao động</th>
                            <th className="py-2 pr-3 font-medium">Nguồn</th>
                            <th className="py-2 pr-3 font-medium">Ngày up</th>
                            <th className="py-2 pr-3 font-medium">Nhân viên phụ trách</th>
                            <th className="py-2 pr-3 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {group.matches.map((candidate) => (
                            <tr key={candidate.id}>
                              <td className="py-2 pr-3 font-medium text-slate-800">{candidate.full_name}</td>
                              <td className="py-2 pr-3">
                                <SourceBadge name={candidate.source.name} />
                              </td>
                              <td className="py-2 pr-3 text-slate-500">{formatDateTime(candidate.uploaded_at)}</td>
                              <td className="py-2 pr-3 text-slate-600">
                                {candidate.assigned_to ? candidate.assigned_to.name : "Chờ phân chia"}
                              </td>
                              <td className="py-2 pr-3">
                                <Link
                                  href={`/candidates/${candidate.id}`}
                                  className="text-xs font-medium text-accent-600 hover:underline"
                                >
                                  Xem chi tiết →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {result.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Trang {result.page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={result.page <= 1 || loading} onClick={() => void refresh(result.page - 1)}>
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={result.page >= totalPages || loading}
              onClick={() => void refresh(result.page + 1)}
            >
              Sau
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
