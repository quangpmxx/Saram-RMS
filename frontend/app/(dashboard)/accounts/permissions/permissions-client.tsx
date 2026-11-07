"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Search, ShieldCheck } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import {
  ACCOUNT_ROLE_LABEL,
  type Account,
  type AccountModulePermissions,
  type CapabilitySummary,
  type ModulePermissionLevel,
  type ModulePermissionSummary,
} from "@/lib/types";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";

const LEVEL_OPTIONS: Array<{ value: ModulePermissionLevel; label: string }> = [
  { value: "none", label: "Không có quyền" },
  { value: "view", label: "Chỉ xem" },
  { value: "edit", label: "Chỉnh sửa" },
];

/** Quyền nhỏ: null = theo vai trò, true = cho phép, false = không cho phép. */
type CapChoice = boolean | null;
const CAP_OPTIONS: Array<{ value: CapChoice; label: string }> = [
  { value: null, label: "Theo vai trò" },
  { value: true, label: "Cho phép" },
  { value: false, label: "Không cho phép" },
];

/** Nhóm quyền "Khác" (không thuộc trang nào). */
const OTHER_MODULE: ModulePermissionSummary = { code: "other", label: "Khác (thông báo, nhóm)" };

const capOf = (overrides: Record<string, CapChoice> | undefined, code: string): CapChoice => overrides?.[code] ?? null;

/**
 * Dự án phụ — nâng cấp toàn diện (2026-07-24, yêu cầu trực tiếp người
 * dùng): trang "Phân quyền" — Mục 1, bản đặc tả: bên trái danh sách tài
 * khoản + tìm kiếm, bên phải toàn bộ module với radio 3 lựa chọn. Admin
 * KHÔNG cấu hình được (luôn toàn quyền — Mục 7).
 *
 * Phân quyền chi tiết (2026-11-07): dưới mỗi trang là các quyền nhỏ — Theo
 * vai trò / Cho phép / Không cho phép (vd cho 1 Sale thêm quyền xem hiệu quả
 * cả nhóm). Nút "Theo vai trò" ghi rõ vai trò hiện tại mặc định Có hay Không.
 */
export function PermissionsClient({
  accounts,
  modules,
  capabilities,
  currentAdminId,
}: {
  accounts: Account[];
  modules: ModulePermissionSummary[];
  capabilities: CapabilitySummary[];
  currentAdminId: string;
}) {
  useSetPageTitle("Quản lý tài khoản", "Phân quyền");
  const toast = useToast();
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountModulePermissions | null>(null);
  const [draft, setDraft] = useState<Record<string, ModulePermissionLevel>>({});
  const [capDraft, setCapDraft] = useState<Record<string, CapChoice>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredAccounts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.full_name.toLowerCase().includes(q) || a.username.toLowerCase().includes(q) || (a.team_name ?? "").toLowerCase().includes(q),
    );
  }, [accounts, keyword]);

  const capsByModule = useMemo(() => {
    const map = new Map<string, CapabilitySummary[]>();
    for (const cap of capabilities) map.set(cap.module, [...(map.get(cap.module) ?? []), cap]);
    return map;
  }, [capabilities]);
  const sections = [...modules, ...(capsByModule.has(OTHER_MODULE.code) ? [OTHER_MODULE] : [])];

  useEffect(() => {
    // selectedId chỉ CHUYỂN từ null sang có giá trị trong UI này (không có
    // nút "bỏ chọn") — không cần dọn `detail` về null, tránh gọi setState
    // ngay đầu effect (react-hooks/set-state-in-effect).
    if (!selectedId) return;
    let cancelled = false;
    // setTimeout(0) — khớp quy ước đã dùng ở birthday-theme-context.tsx cho
    // setState đầu effect (rule react-hooks/set-state-in-effect chỉ cảnh
    // báo lệnh gọi TRỰC TIẾP, không phải trong callback).
    const loadingTimer = setTimeout(() => setLoading(true), 0);
    clientApi<AccountModulePermissions>(`/module-permission/${selectedId}`)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setDraft(result.permissions);
        setCapDraft(result.capability_overrides ?? {});
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof ApiError ? error.message : "Không tải được phân quyền tài khoản");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(loadingTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lại khi đổi tài khoản chọn, không phụ thuộc toast
  }, [selectedId]);

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? null;
  const changedCaps =
    detail === null ? [] : capabilities.filter((c) => capOf(capDraft, c.code) !== capOf(detail.capability_overrides, c.code));
  const isDirty =
    detail !== null && (Object.keys(draft).some((code) => draft[code] !== detail.permissions[code]) || changedCaps.length > 0);

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const result = await clientApi<{
        account_id: string;
        permissions: Record<string, ModulePermissionLevel>;
        capability_overrides: Record<string, boolean>;
      }>(`/module-permission/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({
          permissions: draft,
          capabilities: Object.fromEntries(changedCaps.map((c) => [c.code, capOf(capDraft, c.code)])),
        }),
      });
      setDetail((prev) =>
        prev ? { ...prev, permissions: result.permissions, capability_overrides: result.capability_overrides } : prev,
      );
      setDraft(result.permissions);
      setCapDraft(result.capability_overrides);
      toast.success(`Đã cập nhật phân quyền cho "${selectedAccount?.full_name}"`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Lưu phân quyền thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Bên trái — Mục 1: danh sách tài khoản + tìm kiếm. */}
      <Card className="flex h-fit flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)]">
        <div className="border-b border-slate-100 p-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <Input
              uiSize="sm"
              className="pl-8"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên, tài khoản, nhóm..."
            />
          </div>
        </div>
        <div className="max-h-72 min-h-0 flex-1 overflow-y-auto lg:max-h-none">
          {filteredAccounts.length === 0 ? (
            <EmptyState title="Không tìm thấy tài khoản nào" />
          ) : (
            filteredAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelectedId(account.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-slate-50",
                  selectedId === account.id && "bg-brand-50 hover:bg-brand-50",
                )}
              >
                <Avatar fullName={account.full_name} avatarUrl={account.avatar_url} className="h-8 w-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{account.full_name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {account.username} · {ACCOUNT_ROLE_LABEL[account.role]}
                    {account.team_name ? ` · ${account.team_name}` : ""}
                  </p>
                </div>
                {account.role === "admin" && (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={2} />
                )}
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Bên phải — từng trang: mức truy cập + các quyền nhỏ. */}
      <div>
        {!selectedAccount && (
          <Card className="p-8">
            <EmptyState title="Chọn 1 tài khoản bên trái để xem/sửa phân quyền" icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.75} />} />
          </Card>
        )}

        {selectedAccount && selectedAccount.id === currentAdminId && selectedAccount.role === "admin" && (
          <Card className="flex items-center gap-3 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-500" strokeWidth={2} />
            <p className="text-sm text-slate-600">
              Đây là tài khoản Admin đang đăng nhập. Admin luôn có toàn quyền hệ thống và không thể tự thu hồi quyền của
              chính mình.
            </p>
          </Card>
        )}

        {selectedAccount && selectedAccount.role === "admin" && selectedAccount.id !== currentAdminId && (
          <Card className="flex items-center gap-3 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-500" strokeWidth={2} />
            <p className="text-sm text-slate-600">
              &ldquo;{selectedAccount.full_name}&rdquo; là tài khoản Admin — luôn có toàn quyền hệ thống, không thể
              chỉnh sửa phân quyền riêng.
            </p>
          </Card>
        )}

        {selectedAccount && selectedAccount.role !== "admin" && (
          <Card className="overflow-hidden">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{selectedAccount.full_name}</p>
                <p className="truncate text-xs text-slate-400">
                  {selectedAccount.username} · {ACCOUNT_ROLE_LABEL[selectedAccount.role]}
                </p>
              </div>
              <Button type="button" size="sm" disabled={!isDirty || saving} onClick={() => void handleSave()}>
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
                {saving ? "Đang lưu..." : "Lưu phân quyền"}
              </Button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Đang tải...</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sections.map((module) => {
                  const isOther = module.code === OTHER_MODULE.code;
                  const level = draft[module.code] ?? "none";
                  const caps = capsByModule.get(module.code) ?? [];
                  return (
                    <div key={module.code} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-800">{module.label}</span>
                        {!isOther && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {LEVEL_OPTIONS.map((option) => (
                              <label key={option.value} className="flex items-center gap-1.5 text-sm text-slate-600">
                                <input
                                  type="radio"
                                  name={`module-${module.code}`}
                                  checked={level === option.value}
                                  onChange={() => setDraft((prev) => ({ ...prev, [module.code]: option.value }))}
                                  className="h-4 w-4 border-slate-300 text-accent-500 focus:ring-2 focus:ring-accent-500/30"
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {caps.length > 0 && (isOther || level !== "none") && (
                        <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/60">
                          {level === "view" && !isOther && (
                            <p className="px-3 py-2 text-xs text-amber-600">
                              Trang đang để &ldquo;Chỉ xem&rdquo;: mọi thao tác thêm/sửa/xoá ở trang này bị chặn dù quyền nhỏ cho phép.
                            </p>
                          )}
                          {caps.map((cap) => {
                            const choice = capOf(capDraft, cap.code);
                            const roleDefault = cap.default_roles.includes(selectedAccount.role);
                            const effective = choice ?? roleDefault;
                            return (
                              <div key={cap.code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                <div className="min-w-0 flex-1 basis-60">
                                  <p className="text-sm text-slate-700">
                                    <span
                                      className={cn(
                                        "mr-1.5 inline-block h-2 w-2 rounded-full align-middle",
                                        effective ? "bg-emerald-500" : "bg-slate-300",
                                      )}
                                      title={effective ? "Đang có quyền" : "Đang không có quyền"}
                                    />
                                    {cap.label}
                                  </p>
                                  {cap.hint && <p className="mt-0.5 pl-3.5 text-xs text-slate-400">{cap.hint}</p>}
                                </div>
                                <div className="flex shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white text-xs">
                                  {CAP_OPTIONS.map((option) => {
                                    const active = choice === option.value;
                                    return (
                                      <button
                                        key={String(option.value)}
                                        type="button"
                                        onClick={() => setCapDraft((prev) => ({ ...prev, [cap.code]: option.value }))}
                                        className={cn(
                                          "border-l border-slate-200 px-2.5 py-1 transition-colors first:border-l-0",
                                          !active && "text-slate-600 hover:bg-slate-50",
                                          active && option.value === null && "bg-slate-700 text-white",
                                          active && option.value === true && "bg-emerald-500 text-white",
                                          active && option.value === false && "bg-rose-500 text-white",
                                        )}
                                      >
                                        {option.value === null ? `${option.label} (${roleDefault ? "Có" : "Không"})` : option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
