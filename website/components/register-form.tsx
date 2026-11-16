"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { areas } from "@/lib/content";

/**
 * Form đăng ký tìm việc / nhu cầu doanh nghiệp.
 * BẢN MẪU: chưa gửi đi đâu. Bước 2 sẽ gửi về CRM (người lao động → thành data).
 */
export function RegisterForm({ kind = "worker" }: { kind?: "worker" | "business" }) {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-xl">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden="true" />
        <p className="font-display text-xl font-bold text-ink">Đã nhận thông tin!</p>
        <p className="text-sm text-slate-600">Đại Việt sẽ gọi lại cho bạn trong thời gian sớm nhất.</p>
      </div>
    );
  }

  const input =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:bg-white";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="space-y-3 rounded-2xl bg-white p-6 shadow-xl sm:p-8"
    >
      <p className="font-display text-xl font-bold text-ink">
        {kind === "worker" ? "Đăng ký tìm việc" : "Gửi nhu cầu tuyển dụng"}
      </p>
      <p className="text-sm text-slate-500">
        {kind === "worker" ? "Miễn phí 100%. Đại Việt gọi lại tư vấn ngay." : "Đại Việt liên hệ lại trong ngày làm việc."}
      </p>
      <input required name="name" placeholder={kind === "worker" ? "Họ và tên" : "Tên công ty / nhà máy"} className={input} />
      <input required name="phone" type="tel" inputMode="tel" placeholder="Số điện thoại" className={input} />
      {kind === "worker" ? (
        <select name="area" className={input} defaultValue="">
          <option value="">Khu vực muốn làm</option>
          {areas.map((a) => (
            <option key={a.name}>KCN {a.name}</option>
          ))}
          <option>Chỗ nào cũng được</option>
        </select>
      ) : (
        <textarea name="need" rows={3} placeholder="Số lượng, vị trí, thời gian cần người" className={input} />
      )}
      <button
        type="submit"
        className="w-full rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        {kind === "worker" ? "Đăng ký ngay" : "Gửi nhu cầu"}
      </button>
    </form>
  );
}
