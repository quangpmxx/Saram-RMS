"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import type { Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useBirthdayTheme } from "@/lib/birthday-theme-context";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16), Mục 11: "Chế độ dev/Admin cho
 * phép truyền ngày giả lập HOẶC chọn 1 tài khoản làm 'sinh nhật hôm nay'
 * trong preview... nút 'Xem thử giao diện sinh nhật'... KHÔNG đổi ngày sinh
 * thật... KHÔNG ảnh hưởng người dùng khác trong production." Đặt trong
 * trang Cấu hình vận hành (chỉ Admin vào được) — backend (birthday.service.ts)
 * đã tự kiểm tra lại role=admin + NODE_ENV !== production, âm thầm bỏ qua
 * nếu không đủ điều kiện nên không cần lo lộ ra ngoài production.
 */
export function BirthdayPreviewPanel({ accounts }: { accounts: Account[] }) {
  const { isPreview, startPreview, stopPreview } = useBirthdayTheme();
  const [simulatedDate, setSimulatedDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeAccounts = accounts.filter((account) => account.status === "active");

  async function handlePreview() {
    if (!simulatedDate && !accountId) {
      setError("Chọn ngày giả lập hoặc tài khoản để xem thử");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await startPreview({
        simulated_date: simulatedDate || undefined,
        force_account_id: accountId || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, không thể xem thử");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mt-6 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <PartyPopper className="h-4 w-4 text-brand-500" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-slate-800">Xem thử giao diện sinh nhật</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Chỉ dùng để xem thử — không thay đổi ngày sinh thật, không ảnh hưởng người dùng khác. Chỉ hoạt động ở môi
        trường phát triển.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Ngày giả lập (MM-DD)" uiSize="sm" className="sm:w-40">
          <Input
            placeholder="12-25"
            value={simulatedDate}
            onChange={(event) => setSimulatedDate(event.target.value)}
            uiSize="sm"
          />
        </Field>
        <Field label="Hoặc chọn tài khoản" uiSize="sm" className="sm:flex-1">
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)} uiSize="sm">
            <option value="">— Không chọn —</option>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={isSubmitting} onClick={() => void handlePreview()}>
            {isSubmitting ? "Đang tải..." : "Xem thử"}
          </Button>
          {isPreview && (
            <Button type="button" variant="outline" size="sm" onClick={stopPreview}>
              Dừng xem thử
            </Button>
          )}
        </div>
      </div>

      {isPreview && <p className="mt-2 text-xs font-medium text-accent-600">Đang ở chế độ xem thử — giao diện sinh nhật đã áp dụng bên dưới.</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </Card>
  );
}
