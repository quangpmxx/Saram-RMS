"use client";

import { useState } from "react";
import { checkCanEdit, errorMessage, writeEditorFlag } from "@/lib/editor";

/** Đăng nhập bằng tài khoản CRM để sửa chữ trên trang. */
export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    const data = new FormData(form);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "Đăng nhập không thành công"));
        return;
      }
      const can = await checkCanEdit();
      if (!can) {
        await fetch("/api/logout", { method: "POST" });
        setError("Tài khoản này chưa được cấp quyền “Sửa nội dung website” (trang Phân quyền trong CRM).");
        return;
      }
      writeEditorFlag(true);
      window.location.href = "/";
    } catch {
      setError("Không kết nối được máy chủ, thử lại sau.");
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
      <p className="font-display text-xl font-bold text-ink">Đăng nhập sửa nội dung</p>
      <p className="text-sm text-slate-500">Dùng tài khoản CRM. Sau khi đăng nhập, bấm vào chữ trên trang để sửa.</p>
      <input required name="username" autoComplete="username" placeholder="Tên đăng nhập" className={input} />
      <input
        required
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Mật khẩu"
        className={input}
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
