"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { company } from "@/lib/content";
import { errorMessage } from "@/lib/editor";

/**
 * Form đăng ký tìm việc / nhu cầu doanh nghiệp — gửi thẳng về CRM:
 * - Người lao động → 1 data nguồn "Website", chia lần lượt cho các nhóm.
 * - Doanh nghiệp → trang "Liên hệ từ website" + báo chuông Admin/Quản lý.
 */
export function RegisterFormClient({
  kind = "worker",
  areaOptions,
  jobTitle,
}: {
  kind?: "worker" | "business";
  /** Tên KCN theo danh sách đã sửa (components/register.tsx). */
  areaOptions: string[];
  /** Đăng ký từ trang chi tiết tin việc làm → ghi kèm tên việc vào data CRM. */
  jobTitle?: string;
}) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-xl">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden="true" />
        <p className="font-display text-xl font-bold text-ink">Đã nhận thông tin!</p>
        <p className="text-sm text-slate-600">Đại Việt sẽ gọi lại cho bạn trong thời gian sớm nhất.</p>
      </div>
    );
  }

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const body =
      kind === "worker"
        ? {
            full_name: text("name"),
            phone: text("phone"),
            area: [jobTitle ? `Việc: ${jobTitle}` : "", text("area")].filter(Boolean).join(" · ").slice(0, 100) || undefined,
            website: text("website"),
          }
        : { company_name: text("name"), phone: text("phone"), need: text("need") || undefined, website: text("website") };
    setBusy(true);
    setError("");
    try {
      const res = await fetch(kind === "worker" ? "/api/website/register-worker" : "/api/website/business-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "Gửi không thành công, vui lòng thử lại."));
        return;
      }
      setSent(true);
    } catch {
      setError(`Không gửi được. Bạn gọi ngay ${document.body.dataset.hotline || company.hotlineDisplay} để được tư vấn nhé.`);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:bg-white";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
      className="space-y-3 rounded-2xl bg-white p-6 shadow-xl sm:p-8"
    >
      <p className="font-display text-xl font-bold text-ink">
        {kind === "worker" ? (jobTitle ? "Ứng tuyển việc này" : "Đăng ký tìm việc") : "Gửi nhu cầu tuyển dụng"}
      </p>
      <p className="text-sm text-slate-500">
        {kind === "worker" ? "Miễn phí 100%. Đại Việt gọi lại tư vấn ngay." : "Đại Việt liên hệ lại trong ngày làm việc."}
      </p>
      <input
        required
        name="name"
        maxLength={kind === "worker" ? 150 : 200}
        autoComplete={kind === "worker" ? "name" : "organization"}
        placeholder={kind === "worker" ? "Họ và tên" : "Tên công ty / nhà máy"}
        className={input}
      />
      <input
        required
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={20}
        pattern="[0-9 +.\-]{9,20}"
        title="Nhập số điện thoại, ví dụ 0971 242 250"
        placeholder="Số điện thoại"
        className={input}
      />
      {kind === "worker" ? (
        <select name="area" className={input} defaultValue="">
          <option value="">Khu vực muốn làm</option>
          {areaOptions.map((a) => (
            <option key={a}>{a}</option>
          ))}
          <option>Chỗ nào cũng được</option>
        </select>
      ) : (
        <textarea name="need" rows={3} maxLength={2000} placeholder="Số lượng, vị trí, thời gian cần người" className={input} />
      )}
      {/* Ô ẩn chống máy tự điền: người thật không thấy, để trống. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Đang gửi…" : kind === "worker" ? "Đăng ký ngay" : "Gửi nhu cầu"}
      </button>
    </form>
  );
}
