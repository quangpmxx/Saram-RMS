"use client";

import { useEffect, useState } from "react";
import { Eye, Info } from "lucide-react";
import { Select } from "@/components/ui/form";
import { SlipDetail } from "@/components/payroll/slip-detail";
import { ApiError } from "@/lib/api-client";
import {
  payrollApi,
  type PayrollTemplateItem,
  type TemplatePreview as Preview,
} from "@/lib/payroll-api";

/**
 * Xem trước mẫu bảng lương thành phiếu lương hoàn chỉnh (2026-11-13). Truyền `items` để
 * xem mẫu đang sửa (tự tính lại sau mỗi lần sửa), hoặc `templateId` để xem mẫu đã lưu.
 * Chọn "Xem với" một nhân viên để thấy đúng số của người đó.
 */
export function TemplatePreview({
  items,
  templateId,
  name,
  accounts,
}: {
  items?: PayrollTemplateItem[];
  templateId?: string;
  name?: string;
  accounts: { account_id: string; full_name: string }[];
}) {
  const [accountId, setAccountId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const itemsKey = JSON.stringify(items ?? null);

  useEffect(() => {
    let stale = false;
    // Đợi người dùng gõ xong công thức rồi mới tính (đỡ gọi máy chủ liên tục).
    const timer = setTimeout(
      () => {
        setLoading(true);
        const req = templateId
          ? payrollApi.previewSavedTemplate(templateId, accountId)
          : payrollApi.previewTemplate(items ?? [], accountId, name);
        req
          .then((r) => {
            if (stale) return;
            setPreview(r);
            setError(null);
          })
          .catch(
            (e) =>
              !stale &&
              setError(
                e instanceof ApiError ? e.message : "Không xem trước được",
              ),
          )
          .finally(() => !stale && setLoading(false));
      },
      templateId ? 0 : 400,
    );
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, templateId, accountId, name]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Eye className="size-4 text-brand-600" /> Xem trước phiếu lương
        </span>
        {loading && <span className="text-xs text-slate-400">đang tính…</span>}
        <div className="grow" />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Xem với
          <Select
            uiSize="xs"
            className="w-44"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Nhân viên mẫu</option>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.full_name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {preview?.sample_data && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          <Info className="mt-px size-3.5 shrink-0" />
          {accountId
            ? "Chưa có phiếu lương: công, doanh số là số minh hoạ."
            : "Số minh hoạ: lương 8 triệu, đủ công tháng này."}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {preview ? (
        <div
          className={
            loading ? "opacity-60 transition-opacity" : "transition-opacity"
          }
        >
          <SlipDetail
            slip={preview.slip}
            year={preview.year}
            month={preview.month}
            compact
          />
        </div>
      ) : (
        !error && (
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        )
      )}
    </div>
  );
}
