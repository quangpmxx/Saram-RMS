"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Power, PowerOff, ShieldCheck } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import {
  ACCOUNT_ROLE_LABEL,
  type Account,
  type AccountPermissionGrant,
  type AccountRole,
  type Team,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

const ROLES_REQUIRING_TEAM: AccountRole[] = ["leader", "sale"];
/** Mục 9.1, docs/12-ui-design.md: "Cấu hình quyền chi tiết" chỉ áp dụng cho Quản lý/Leader. */
const PERMISSION_CONFIGURABLE_ROLES: AccountRole[] = ["manager", "leader"];

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit"; account: Account }
  | { mode: "permissions"; account: Account };

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
      <PageHeader
        title="Quản lý tài khoản"
        description="Tạo và phân quyền tài khoản nhân viên trong hệ thống."
        actions={
          <Button type="button" onClick={() => setModal({ mode: "create" })}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Thêm tài khoản mới
          </Button>
        }
      />

      {banner && <Banner type={banner.type} text={banner.text} />}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/60 text-xs font-semibold tracking-wide text-brand-900 uppercase">
              <tr>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Tên đăng nhập</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Nhóm</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => (
                <tr key={account.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{account.full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{account.username}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info">{ACCOUNT_ROLE_LABEL[account.role]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{account.team_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={account.status === "active" ? "success" : "neutral"}>
                      {account.status === "active" ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setModal({ mode: "edit", account })}>
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === account.id}
                        onClick={() =>
                          void (account.status === "active" ? handleDeactivate(account) : handleReactivate(account))
                        }
                      >
                        {account.status === "active" ? (
                          <PowerOff className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : (
                          <Power className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        {account.status === "active" ? "Vô hiệu hóa" : "Kích hoạt lại"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === account.id}
                        onClick={() => void handleResetPassword(account)}
                      >
                        <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                        Reset mật khẩu
                      </Button>
                      {PERMISSION_CONFIGURABLE_ROLES.includes(account.role) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setModal({ mode: "permissions", account })}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                          Cấu hình quyền
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {accounts.length === 0 && <EmptyState title="Chưa có tài khoản nào" />}
      </Card>

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

      {modal.mode === "permissions" && (
        <PermissionModal
          account={modal.account}
          onClose={() => setModal({ mode: "none" })}
          onSaved={() => setBanner({ type: "success", text: "Đã lưu cấu hình quyền" })}
        />
      )}
    </div>
  );
}

/**
 * Mục 9.1, docs/12-ui-design.md ("Popup cấu hình quyền chi tiết") + Mục 2,
 * docs/13-api-design.md (GET /permission, PUT /account/:id/permission).
 *
 * KHUNG PHÂN QUYỀN CHI TIẾT (Phase 9, docs/14-roadmap.md): danh mục quyền
 * cụ thể chưa được chốt với chủ doanh nghiệp thật (Mục 11.1, docs/09) —
 * bảng `permissions` đã seed 5 quyền tạm (xem seedPhase9Permissions() ở
 * backend/src/prisma/seed.ts) để có ngay dữ liệu dùng thử; không phải danh
 * sách chính thức cuối cùng, có thể điều chỉnh sau. Nếu danh mục trống
 * (môi trường chưa chạy seed), popup vẫn hiển thị đúng empty state thay vì
 * lỗi — không cần sửa code khi danh sách quyền thay đổi.
 */
function PermissionModal({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [grants, setGrants] = useState<AccountPermissionGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // PUT /account/:id/permission với danh sách rỗng không ghi/đổi gì
        // (vòng lặp cập nhật trong AccountsService.updatePermissions() rỗng
        // theo đúng "permissions" truyền vào) nhưng vẫn trả về đúng "danh
        // sách Permission hiện tại của tài khoản kèm trạng thái bật/tắt"
        // (Mục 2, docs/13) — tái dùng đúng 1 API đã có để lấy trạng thái
        // hiện tại lúc mở popup, không cần thêm GET /account/:id/permission
        // ngoài phạm vi đã chốt.
        const current = await clientApi<AccountPermissionGrant[]>(`/account/${account.id}/permission`, {
          method: "PUT",
          body: JSON.stringify({ permissions: [] }),
        });
        if (!cancelled) setGrants(current);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  async function handleSave() {
    if (!grants) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await clientApi(`/account/${account.id}/permission`, {
        method: "PUT",
        body: JSON.stringify({
          permissions: grants.map((g) => ({ permission_id: g.id, is_granted: g.is_granted })),
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Cấu hình quyền — ${account.full_name}`}
      description={`Vai trò: ${ACCOUNT_ROLE_LABEL[account.role]}`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {grants && grants.length > 0 && (
            <Button type="button" disabled={isSubmitting} onClick={() => void handleSave()}>
              {isSubmitting ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          )}
        </>
      }
    >
      {isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}

      {!isLoading && grants && grants.length === 0 && (
        <EmptyState
          title="Chưa có quyền nào được định nghĩa"
          description='Danh sách quyền chi tiết cho vai trò Quản lý/Leader chưa được xác nhận với chủ doanh nghiệp (Mục 11.1, tài liệu 09). Khung dữ liệu/API đã sẵn sàng — chỉ cần bổ sung danh mục quyền khi có xác nhận.'
        />
      )}

      {!isLoading && grants && grants.length > 0 && (
        <div className="flex flex-col gap-2">
          {grants.map((grant) => (
            <label key={grant.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5">
              <Checkbox
                checked={grant.is_granted}
                onChange={(event) =>
                  setGrants((prev) =>
                    prev
                      ? prev.map((g) => (g.id === grant.id ? { ...g, is_granted: event.target.checked } : g))
                      : prev,
                  )
                }
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{grant.name}</span>
                {grant.description && <span className="block text-xs text-slate-500">{grant.description}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </Modal>
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
        <Field label="Họ tên">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>

        <Field label="Tên đăng nhập">
          <Input value={username} disabled={isEdit} onChange={(event) => setUsername(event.target.value)} />
        </Field>

        {!isEdit && (
          <Field label="Vai trò">
            <Select value={role} onChange={(event) => setRole(event.target.value as AccountRole)}>
              {Object.entries(ACCOUNT_ROLE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {(isEdit || requiresTeam) && (
          <Field label={`Nhóm ${requiresTeam && !isEdit ? "(bắt buộc)" : "(không bắt buộc)"}`}>
            <Select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              <option value="">— Không thuộc nhóm nào —</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
