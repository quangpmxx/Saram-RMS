"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, clientApi } from "@/lib/api-client";
import type { Account, Team } from "@/lib/types";

type ModalState = { mode: "none" } | { mode: "create" } | { mode: "edit"; team: Team };

export function TeamsClient({ initialTeams, leaders }: { initialTeams: Team[]; leaders: Account[] }) {
  const router = useRouter();
  const [teams, setTeams] = useState(initialTeams);
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function refresh() {
    const result = await clientApi<{ items: Team[] }>("/team?page=1&page_size=100");
    setTeams(result.items);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Quản lý nhóm</h1>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Thêm nhóm mới
        </button>
      </div>

      {banner && (
        <div
          role="status"
          className={`mb-4 rounded-md px-4 py-2 text-sm ${
            banner.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tên nhóm</th>
              <th className="px-4 py-3 font-medium">Leader phụ trách</th>
              <th className="px-4 py-3 font-medium">Số thành viên</th>
              <th className="px-4 py-3 font-medium">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">{team.name}</td>
                <td className="px-4 py-3 text-zinc-600">{team.leader_name ?? "Chưa gán"}</td>
                <td className="px-4 py-3 text-zinc-600">{team.member_count}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "edit", team })}
                    className="text-xs font-medium text-zinc-700 hover:underline"
                  >
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  Chưa có nhóm nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal.mode === "create" && (
        <TeamModal
          title="Thêm nhóm mới"
          leaders={leaders}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            await clientApi("/team", { method: "POST", body: JSON.stringify(payload) });
            setModal({ mode: "none" });
            await refresh();
            setBanner({ type: "success", text: "Đã tạo nhóm mới" });
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
            setBanner({ type: "success", text: "Đã cập nhật nhóm" });
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
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Tên nhóm</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Leader phụ trách</span>
            <select
              value={leaderId}
              onChange={(event) => setLeaderId(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">— Chưa gán —</option>
              {leaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.full_name} ({leader.username})
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-400">
              Chỉ hiển thị tài khoản có vai trò Leader (Mục 3, docs/13-api-design.md).
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
