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
    <div className="relative min-h-screen w-screen overflow-hidden bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 h-screen w-screen bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/login-bg.png)" }}
      />
      {/* Lớp phủ rất nhẹ chỉ để tăng độ tương phản, không làm tối ảnh nền. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-white/5" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white/90 p-8 shadow-2xl shadow-brand-900/20 backdrop-blur-sm sm:p-10">
            <div className="flex flex-col items-center text-center">
              <Logo size="lg" showWordmark={false} />
              <p className="mt-1 text-base font-semibold text-brand-900 sm:text-lg">
                Công Ty TNHH Thương Mại Dịch Vụ Saram Vina
              </p>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Đăng nhập</h2>
              <p className="mt-1 text-sm text-slate-500">Hệ thống quản lý tuyển dụng lao động nội bộ</p>
              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Saram Vina . Nội bộ
          </p>
        </div>
      </div>
    </div>
  );
}
