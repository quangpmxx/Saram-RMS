import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { ForcePasswordChangeForm } from "./force-password-change-form";

/**
 * Bắt đổi mật khẩu (rà soát 2026-10-30): tài khoản đang dùng mật khẩu mặc
 * định (mới tạo / vừa được đặt lại) phải đổi mật khẩu ở đây trước khi vào hệ
 * thống — backend chặn mọi API khác (PasswordChangeGuard). Nằm ngoài khung
 * dashboard để không gọi các API bị chặn.
 */
export default async function ForcePasswordChangePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.must_change_password) redirect("/");

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 h-screen w-screen bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/login-bg.png)" }}
      />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white/90 p-8 shadow-2xl shadow-brand-900/20 backdrop-blur-sm sm:p-10">
          <div className="flex flex-col items-center text-center">
            <Logo size="lg" showWordmark={false} className="z-0" />
          </div>
          <h2 className="mt-6 text-lg font-semibold text-slate-900">
            Đổi mật khẩu
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Xin chào <b>{user.full_name}</b>. Tài khoản của bạn đang dùng mật
            khẩu mặc định — vui lòng đặt mật khẩu mới trước khi tiếp tục.
          </p>
          <ForcePasswordChangeForm />
        </div>
      </div>
    </div>
  );
}
