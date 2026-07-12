"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Users } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import type { Account, Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/lib/toast-context";

type ModalState = { mode: "none" } | { mode: "create" } | { mode: "edit"; team: Team };

export function TeamsClient({
  initialTeams,
  leaders,
}: {
  initialTeams: Team[];
  leaders: Account[];
}) {
  const router = useRouter();
  const [teams, setTeams] = useState(initialTeams);
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const toast = useToast();

  async function refresh() {
    const result = await clientApi<{ items: Team[] }>("/team?page=1&page_size=100");
    setTeams(result.items);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Quản lý nhóm"
        description="Tổ chức nhóm và phân công Leader phụ trách."
        actions={
          <Button type="button" onClick={() => setModal({ mode: "create" })}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Thêm nhóm mới
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {/* UI Polish — cố định độ rộng cột theo yêu cầu người dùng, bỏ tính năng co giãn. */}
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[220px]" />
              <col className="w-[200px]" />
              <col className="w-[160px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="bg-brand-50/60 text-xs font-semibold tracking-wide text-brand-900 uppercase">
              <tr>
                <th className="px-4 py-3">Tên nhóm</th>
                <th className="px-4 py-3">Leader phụ trách</th>
                <th className="px-4 py-3">Số thành viên</th>
                <th className="px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teams.map((team) => (
                <tr key={team.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{team.name}</td>
                  <td className="px-4 py-3 text-slate-500">{team.leader_name ?? "Chưa gán"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info">
                      <Users className="h-3 w-3" strokeWidth={2.5} />
                      {team.member_count}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setModal({ mode: "edit", team })}>
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Sửa
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {teams.length === 0 && <EmptyState title="Chưa có nhóm nào" />}
      </Card>

      {modal.mode === "create" && (
        <TeamModal
          title="Thêm nhóm mới"
          leaders={leaders}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            await clientApi("/team", { method: "POST", body: JSON.stringify(payload) });
            setModal({ mode: "none" });
            await refresh();
            toast.success("Đã tạo nhóm mới");
          }}
        />
      )}

      {modal.mode === "edit" && (
        <TeamModal
          title={`Sửa nhóm "${modal.team.name}"`}
          leaders={leaders}
          initialTeam={modal.team}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            await clientApi(`/team/${modal.team.id}`, { method: "PUT", body: JSON.stringify(payload) });
            setModal({ mode: "none" });
            await refresh();
            toast.success("Đã cập nhật nhóm");
          }}
        />
      )}
    </div>
  );
}

interface TeamFormPayload {
  name: string;
  leader_id?: string;
}

function TeamModal({
  title,
  leaders,
  initialTeam,
  onClose,
  onSubmit,
}: {
  title: string;
  leaders: Account[];
  initialTeam?: Team;
  onClose: () => void;
  onSubmit: (payload: TeamFormPayload) => Promise<void>;
}) {
  const [name, setName] = useState(initialTeam?.name ?? "");
  const [leaderId, setLeaderId] = useState(initialTeam?.leader_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ name, leader_id: leaderId || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={title}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Tên nhóm">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field label="Leader phụ trách" hint="Chỉ hiển thị tài khoản có vai trò Leader (Mục 3, docs/13-api-design.md).">
          <Select value={leaderId} onChange={(event) => setLeaderId(event.target.value)}>
            <option value="">— Chưa gán —</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.full_name} ({leader.username})
              </option>
            ))}
          </Select>
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
