"use client";

import { useCallback, useState } from "react";
import { Building2, Phone } from "lucide-react";
import { ApiError, clientApi } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useSetPageTitle } from "@/lib/page-title-context";
import { useToast } from "@/lib/toast-context";
import { formatDMYHM } from "@/lib/date-format";
import { cn } from "@/lib/cn";

export interface WebsiteContact {
  id: string;
  company_name: string;
  phone: string;
  need: string | null;
  note: string | null;
  created_at: string;
  handled_at: string | null;
  handled_by_name: string | null;
}

export interface WebsiteContactPage {
  total: number;
  pending: number;
  page: number;
  page_size: number;
  data: WebsiteContact[];
}

type StatusFilter = "all" | "pending" | "handled";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chưa gọi" },
  { value: "handled", label: "Đã gọi" },
];

/** Danh sách doanh nghiệp gửi nhu cầu từ trang web: gọi lại rồi đánh dấu "Đã gọi", ghi chú kết quả. */
export function WebsiteContactsClient({ canEdit, initial }: { canEdit: boolean; initial: WebsiteContactPage }) {
  useSetPageTitle("Liên hệ từ website");
  const toast = useToast();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [result, setResult] = useState<WebsiteContactPage>(initial);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(
    async (next: StatusFilter) => {
      setLoading(true);
      try {
        setResult(await clientApi<WebsiteContactPage>(`/website/contacts?status=${next}&page=1&page_size=100`));
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Không tải được danh sách");
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  async function update(row: WebsiteContact, body: { handled?: boolean; note?: string }) {
    setSavingId(row.id);
    try {
      await clientApi(`/website/contacts/${row.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load(status);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Lưu không thành công");
    } finally {
      setSavingId(null);
    }
  }

  const statusBadge = (row: WebsiteContact) =>
    row.handled_at ? <Badge variant="success">Đã gọi</Badge> : <Badge variant="warning">Chưa gọi</Badge>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setStatus(f.value);
              void load(f.value);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              status === f.value ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {f.label}
            {f.value === "pending" && result.pending > 0 && (
              <span className="ml-1.5 rounded-full bg-accent-500 px-1.5 text-xs text-white">{result.pending}</span>
            )}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-500">{loading ? "Đang tải…" : `${result.total} liên hệ`}</span>
      </div>

      {result.data.length === 0 ? (
        <EmptyState
          title="Chưa có liên hệ nào"
          description="Doanh nghiệp điền form “Gửi nhu cầu tuyển dụng” trên saramvina.com sẽ hiện ở đây."
          icon={<Building2 className="h-6 w-6" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Thời gian</th>
                <th className="px-3 py-2.5">Công ty</th>
                <th className="px-3 py-2.5">Số điện thoại</th>
                <th className="px-3 py-2.5">Nhu cầu</th>
                <th className="px-3 py-2.5">Trạng thái</th>
                <th className="px-3 py-2.5">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.data.map((row) => (
                <tr key={row.id} className={cn("align-top", !row.handled_at && "bg-accent-50/40")}>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{formatDMYHM(row.created_at)}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{row.company_name}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Phone className="h-3.5 w-3.5" />
                      {row.phone}
                    </a>
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5 whitespace-pre-line text-slate-700">{row.need || "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {canEdit ? (
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!row.handled_at}
                          disabled={savingId === row.id}
                          onChange={(e) => void update(row, { handled: e.target.checked })}
                          className="h-4 w-4 accent-emerald-600"
                        />
                        {statusBadge(row)}
                      </label>
                    ) : (
                      statusBadge(row)
                    )}
                    {row.handled_at && (
                      <p className="mt-1 text-xs text-slate-400">
                        {row.handled_by_name ? `${row.handled_by_name} · ` : ""}
                        {formatDMYHM(row.handled_at)}
                      </p>
                    )}
                  </td>
                  <td className="min-w-[200px] px-3 py-2.5">
                    {canEdit ? (
                      <textarea
                        defaultValue={row.note ?? ""}
                        rows={2}
                        maxLength={1000}
                        placeholder="Kết quả gọi…"
                        disabled={savingId === row.id}
                        onBlur={(e) => {
                          if (e.target.value.trim() !== (row.note ?? "")) void update(row, { note: e.target.value });
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                      />
                    ) : (
                      <span className="whitespace-pre-line text-slate-600">{row.note || "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
