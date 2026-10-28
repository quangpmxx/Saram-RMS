"use client";

import { useState } from "react";
import type { AccountRole, Team, TeamMember } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { CareProgressBlock } from "@/components/care-progress/care-progress-block";

/**
 * Kho chăm sóc (2026-10-28) — tab "Tiến độ chăm sóc" trong Báo cáo. Dùng
 * lại đúng CareProgressBlock của Dashboard (cùng API GET /care-progress)
 * nên số liệu 2 nơi luôn khớp; tab này chỉ thêm bộ lọc Nhóm/Sale/Trạng thái.
 * Ngày/Tháng chọn ngay trong khối.
 */
export function CareProgressPanel({
  currentUserRole,
  canFilterByTeam,
  canFilterBySale,
  teams,
  saleMembers,
}: {
  currentUserRole: AccountRole;
  canFilterByTeam: boolean;
  canFilterBySale: boolean;
  teams: Team[];
  saleMembers: TeamMember[];
}) {
  const [teamId, setTeamId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState<"" | "pending" | "done">("");

  const sales = saleMembers.filter((m) => m.role === "sale" && (!teamId || m.team_id === teamId));
  const showFilters = currentUserRole !== "sale";

  return (
    <div className="space-y-3">
      {showFilters && (
        <Card className="p-3">
          <div className="flex flex-wrap items-end gap-2.5">
            {canFilterByTeam && (
              <Field label="Nhóm Sale" uiSize="sm" className="w-40">
                <Select
                  uiSize="sm"
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    setAccountId("");
                  }}
                >
                  <option value="">Tất cả nhóm</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {canFilterBySale && (
              <Field label="Nhân viên Sale" uiSize="sm" className="w-44">
                <Select uiSize="sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Tất cả Sale</option>
                  {sales.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Trạng thái chăm sóc" uiSize="sm" className="w-52">
              <Select uiSize="sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="">Tất cả</option>
                <option value="pending">Còn data chưa xử lý</option>
                <option value="done">Đã hoàn thành</option>
              </Select>
            </Field>
          </div>
        </Card>
      )}
      <CareProgressBlock currentUserRole={currentUserRole} teamId={teamId} accountId={accountId} status={status} />
    </div>
  );
}
