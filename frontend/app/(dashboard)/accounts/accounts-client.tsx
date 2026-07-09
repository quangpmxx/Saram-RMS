"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, clientApi } from "@/lib/api-client";
import { ACCOUNT_ROLE_LABEL, type Account, type AccountRole, type Team } from "@/lib/types";

const ROLES_REQUIRING_TEAM: AccountRole[] = ["leader", "sale"];

type ModalState = { mode: "none" } | { mode: "create" } | { mode: "edit"; account: Account };

export function AccountsClient({
  initialAccounts,
  teams,
}: {
  initialAccounts: Account[];
  teams: Team[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function refresh() {
    const result = await clientApi<{ items: Account[] }>("/account?page=1&page_size=100");
    setAccounts(result.items);
    router.refresh();
  }

  async function handleDeactivate(account: Account) {
    setPendingId(account.id);
    setBanner(null);
    try {
      await clientApi(`/account/${account.id}`, { method: "DELETE" });
      await refresh();
      setBanner({ type: "success", text: `Đã vô hiệu hóa tài khoản "${account.username}"` });
    } catch (error) {
      setBanner({ type: "error", text: error instanceof ApiError ? error.message : "Có lỗi xảy ra" });
    } finally {
      setPendingId(null);
    }
  }

  async function handleReactivate(account: Account) {
    setPendingId(account.id);
    setBanner(null);
    try {
      await clientApi(`/account/${account.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "active" }),
      });
      await refresh();
      setBanner({ type: "success", text: `Đã kích hoạt lại tài khoản "${account.username}"` });
    } catch (error) {
      setBanner({ type: "error", text: error instanceof ApiError ? error.message : "Có lỗi xảy ra" });
    } finally {
      setPendingId(null);
    }
  }

  async function handleResetPassword(account: Account) {
    setPendingId(account.id);
    setBanner(null);
    try {
      await clientApi(`/account/${account.id}/reset-password`, { method: "POST" });
      setBanner({ type: "success", text: `Đã đặt lại mật khẩu mặc định cho "${account.username}"` });
    } catch (error) {
      setBanner({ type: "error", text: error instanceof ApiError ? error.message : "Có lỗi xảy ra" });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Quản lý tài khoản</h1>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Thêm tài khoản mới
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
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Tên đăng nhập</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
              <th className="px-4 py-3 font-medium">Nhóm</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">{account.full_name}</td>
                <td className="px-4 py-3 text-zinc-600">{account.username}</td>
                <td className="px-4 py-3">{ACCOUNT_ROLE_LABEL[account.role]}</td>
                <td className="px-4 py-3 text-zinc-600">{account.team_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      account.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {account.status === "active" ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModal({ mode: "edit", account })}
                      className="text-xs font-medium text-zinc-700 hover:underline"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === account.id}
                      onClick={() =>
                        void (account.status === "active"
                          ? handleDeactivate(account)
                          : handleReactivate(account))
                      }
                      className="text-xs font-medium text-zinc-700 hover:underline disabled:opacity-50"
                    >
                      {account.status === "active" ? "Vô hiệu hóa" : "Kích hoạt lại"}
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === account.id}
                      onClick={() => void handleResetPassword(account)}
                      className="text-xs font-medium text-zinc-700 hover:underline disabled:opacity-50"
                    >
                      Reset mật khẩu
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                  Chưa có tài khoản nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal.mode === "create" && (
        <AccountModal
          title="Thêm tài khoản mới"
          teams={teams}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            await clientApi("/account", { method: "POST", body: JSON.stringify(payload) });
            setModal({ mode: "none" });
            await refresh();
            setBanner({ type: "success", text: "Đã tạo tài khoản mới" });
          }}
        />
      )}

      {modal.mode === "edit" && (
        <AccountModal
          title={`Sửa tài khoản "${modal.account.username}"`}
          teams={teams}
          initialAccount={modal.account}
          onClose={() => setModal({ mode: "none" })}
          onSubmit={async (payload) => {
            await clientApi(`/account/${modal.account.id}`, {
              method: "PUT",
              body: JSON.stringify({ full_name: payload.full_name, team_id: payload.team_id ?? null }),
            });
            setModal({ mode: "none" });
            await refresh();
            setBanner({ type: "success", text: "Đã cập nhật tài khoản" });
          }}
        />
      )}
    </div>
  );
}

interface AccountFormPayload {
  full_name: string;
  username: string;
  role: AccountRole;
  team_id?: string;
}

function AccountModal({
  title,
  teams,
  initialAccount,
  onClose,
  onSubmit,
}: {
  title: string;
  teams: Team[];
  initialAccount?: Account;
  onClose: () => void;
  onSubmit: (payload: AccountFormPayload) => Promise<void>;
}) {
  const isEdit = Boolean(initialAccount);
  const [fullName, setFullName] = useState(initialAccount?.full_name ?? "");
  const [username, setUsername] = useState(initialAccount?.username ?? "");
  const [role, setRole] = useState<AccountRole>(initialAccount?.role ?? "sale");
  const [teamId, setTeamId] = useState(initialAccount?.team_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiresTeam = ROLES_REQUIRING_TEAM.includes(role);

  async function handleSubmit() {
    setError(null);

    if (!isEdit && requiresTeam && !teamId) {
      setError("Vai trò leader/sale bắt buộc phải thuộc 1 nhóm");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName,
        username,
        role,
        team_id: teamId || undefined,
      });
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
            <span className="font-medium text-zinc-700">Họ tên</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Tên đăng nhập</span>
            <input
              value={username}
              disabled={isEdit}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
            />
          </label>

          {!isEdit && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700">Vai trò</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as AccountRole)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                {Object.entries(ACCOUNT_ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(isEdit || requiresTeam) && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700">
                Nhóm {requiresTeam && !isEdit ? "(bắt buộc)" : "(không bắt buộc)"}
              </span>
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">— Không thuộc nhóm nào —</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          )}

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
