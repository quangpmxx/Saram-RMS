"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, clientApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function ForcePasswordChangeForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Mật khẩu mới và xác nhận mật khẩu không khớp");
      return;
    }
    setIsSubmitting(true);
    try {
      await clientApi("/me/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: current,
          new_password: next,
          confirm_password: confirm,
        }),
      });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Có lỗi xảy ra, vui lòng thử lại",
      );
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    await clientApi("/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-6 flex flex-col gap-4"
    >
      <Field label="Mật khẩu hiện tại">
        <Input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </Field>
      <Field
        label="Mật khẩu mới"
        hint="Ít nhất 6 ký tự, khác mật khẩu mặc định"
      >
        <Input
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </Field>
      <Field label="Nhập lại mật khẩu mới">
        <Input
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Đang lưu..." : "Đổi mật khẩu và tiếp tục"}
      </Button>
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        Đăng xuất
      </button>
    </form>
  );
}
