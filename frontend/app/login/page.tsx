import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[22%] -left-[20%] h-[62vw] w-[62vw] max-h-[820px] max-w-[820px] rounded-full bg-accent-400" />
        <div className="absolute -top-[28%] -left-[26%] h-[62vw] w-[62vw] max-h-[820px] max-w-[820px] rounded-full bg-gradient-to-br from-brand-800 to-brand-600" />
        <div className="absolute -right-[20%] -bottom-[22%] h-[62vw] w-[62vw] max-h-[820px] max-w-[820px] rounded-full bg-accent-400" />
        <div className="absolute -right-[26%] -bottom-[28%] h-[62vw] w-[62vw] max-h-[820px] max-w-[820px] rounded-full bg-gradient-to-tl from-brand-800 to-brand-600" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-brand-900/20 sm:p-10">
            <div className="flex flex-col items-center text-center">
              <Logo size="lg" showWordmark={false} />
              <p className="mt-3 text-base font-semibold text-brand-900 sm:text-lg">
                Công ty TNHH Thương mại Dịch vụ Saram Vina
              </p>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Đăng nhập</h2>
              <p className="mt-1 text-sm text-slate-500">Hệ thống quản lý tuyển dụng nội bộ</p>
              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Saram Vina. Nội bộ — không chia sẻ ra ngoài.
          </p>
        </div>
      </div>
    </div>
  );
}
