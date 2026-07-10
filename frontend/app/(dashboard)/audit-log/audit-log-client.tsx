"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, History, RefreshCw } from "lucide-react";
import { clientApi } from "@/lib/api-client";
import type { Account, AuditLogEntry, PaginatedResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useSetPageTitle } from "@/lib/page-title-context";

const PAGE_SIZE = 20;

/** Toàn bộ giá trị enum action_type — Mục 2.16, docs/11-database-design.md. */
const ACTION_TYPE_LABEL: Record<string, string> = {
  view: "Xem",
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xóa",
  assign: "Phân chia",
  transfer: "Chuyển",
  hold: "Giữ số",
  lock: "Khóa",
  unlock: "Mở khóa",
  login: "Đăng nhập",
  logout: "Đăng xuất",
  reset_password: "Reset mật khẩu",
};

/** Toàn bộ giá trị entity_type thực tế đang được ghi log trong hệ thống. */
const ENTITY_TYPE_LABEL: Record<string, string> = {
  account: "Tài khoản",
  account_permission: "Quyền tài khoản",
  callback_schedule: "Lịch gọi lại",
  distribution_rule: "Cấu hình tự động phân chia",
  import_job: "Import Excel",
  interview_appointment: "Lịch hẹn PV",
  lead: "Ứng viên",
  lead_note: "Ghi chú",
  system_config: "Cấu hình hệ thống",
  team: "Nhóm",
};

interface Filters {
  account_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  date_from: string;
  date_to: string;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

export function AuditLogClient({
  initialLogs,
  canPickAccount,
  accounts,
}: {
  initialLogs: PaginatedResult<AuditLogEntry>;
  canPickAccount: boolean;
  accounts: Account[];
}) {
  useSetPageTitle("Nhật ký", "Tra cứu toàn bộ lịch sử truy cập/thao tác trong hệ thống.");

  const [result, setResult] = useState(initialLogs);
  const [filters, setFilters] = useState<Filters>({
    account_id: "",
    action_type: "",
    entity_type: "",
    entity_id: "",
    date_from: "",
    date_to: "",
  });
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);

  async function refresh(page = 1) {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (filters.account_id) query.set("account_id", filters.account_id);
      if (filters.action_type) query.set("action_type", filters.action_type);
      if (filters.entity_type) query.set("entity_type", filters.entity_type);
      if (filters.entity_id) query.set("entity_id", filters.entity_id);
      if (filters.date_from) query.set("date_from", new Date(filters.date_from).toISOString());
      if (filters.date_to) query.set("date_to", new Date(`${filters.date_to}T23:59:59.999`).toISOString());
      const next = await clientApi<PaginatedResult<AuditLogEntry>>(`/audit-log?${query.toString()}`);
      setResult(next);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Nhật ký" description="Lịch sử truy cập/thao tác toàn hệ thống — chỉ Admin/Quản lý xem được." />

      <Card className="mb-4 p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void refresh(1);
          }}
        >
          {canPickAccount && (
            <Field label="Tài khoản" uiSize="sm" className="w-48">
              <Select
                uiSize="sm"
                value={filters.account_id}
                onChange={(event) => setFilters((prev) => ({ ...prev, account_id: event.target.value }))}
              >
                <option value="">Tất cả</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.full_name} ({account.username})
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Loại hành động" uiSize="sm" className="w-40">
            <Select
              uiSize="sm"
              value={filters.action_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, action_type: event.target.value }))}
            >
              <option value="">Tất cả</option>
              {Object.entries(ACTION_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Loại đối tượng" uiSize="sm" className="w-44">
            <Select
              uiSize="sm"
              value={filters.entity_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, entity_type: event.target.value }))}
            >
              <option value="">Tất cả</option>
              {Object.entries(ENTITY_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ID đối tượng" uiSize="sm" className="w-48">
            <Input
              uiSize="sm"
              placeholder="vd: id ứng viên/tài khoản"
              value={filters.entity_id}
              onChange={(event) => setFilters((prev) => ({ ...prev, entity_id: event.target.value }))}
            />
          </Field>
          <Field label="Từ ngày" uiSize="sm" className="w-36">
            <Input
              uiSize="sm"
              type="date"
              value={filters.date_from}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
            />
          </Field>
          <Field label="Đến ngày" uiSize="sm" className="w-36">
            <Input
              uiSize="sm"
              type="date"
              value={filters.date_to}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
            />
          </Field>
          <Button type="submit" variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2} />
            Lọc
          </Button>
        </form>
      </Card>

      <div className="mb-3 flex items-center gap-1.5 text-sm text-slate-500">
        <History className="h-4 w-4" strokeWidth={2} />
        Tổng số hành động trong bộ lọc hiện tại: <span className="font-semibold text-slate-800">{result.total}</span>
      </div>

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState title="Không có dữ liệu nhật ký" description="Chưa có hành động nào khớp bộ lọc hiện tại." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50/60 text-xs font-semibold tracking-wide text-brand-900 uppercase">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Tài khoản thực hiện</th>
                  <th className="px-4 py-3">Loại hành động</th>
                  <th className="px-4 py-3">Đối tượng tác động</th>
                  <th className="px-4 py-3">Giá trị cũ → mới</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((log) => (
                  <tr
                    key={log.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => setDetail(log)}
                  >
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{log.account.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="info">{ACTION_TYPE_LABEL[log.action_type] ?? log.action_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {ENTITY_TYPE_LABEL[log.entity_type] ?? log.entity_type}
                      {log.field_changed ? ` · ${log.field_changed}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {log.old_value || log.new_value ? `${log.old_value ?? "—"} → ${log.new_value ?? "—"}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {detail && (
        <Modal
          title="Chi tiết nhật ký"
          description={formatDateTime(detail.created_at)}
          footer={
            <Button type="button" variant="outline" size="sm" onClick={() => setDetail(null)}>
              Đóng
            </Button>
          }
        >
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Tài khoản thực hiện</dt>
              <dd className="font-semibold text-slate-900">{detail.account.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Loại hành động</dt>
              <dd className="font-semibold text-slate-900">{ACTION_TYPE_LABEL[detail.action_type] ?? detail.action_type}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Đối tượng</dt>
              <dd className="font-semibold text-slate-900">{ENTITY_TYPE_LABEL[detail.entity_type] ?? detail.entity_type}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">ID đối tượng</dt>
              <dd className="font-mono text-xs text-slate-700">{detail.entity_id ?? "—"}</dd>
            </div>
            {detail.field_changed && (
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Trường thay đổi</dt>
                <dd className="font-semibold text-slate-900">{detail.field_changed}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">Giá trị cũ</dt>
              <dd className="text-slate-700">{detail.old_value ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Giá trị mới</dt>
              <dd className="text-slate-700">{detail.new_value ?? "—"}</dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}
