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
              <Logo size="lg" showWordmark={false} className="z-0" />
              {/* Logo Đại Việt (2026-11-04) đã cắt sát viền nên không cần margin
                  âm như logo Saram cũ. Logo dùng position:relative (cho Image
                  fill) nên tự nằm trên các phần tử tĩnh cùng cấp — giữ z-10 cho chữ. */}
              {/* Luôn 1 dòng (yêu cầu 2026-11-05): cỡ chữ co theo bề rộng màn
                  hình (khung chữ ≈ 100vw − 96px trên điện thoại), tối đa 15px. */}
              <p className="relative z-10 mt-3 whitespace-nowrap text-[clamp(10px,calc((100vw-96px)/24),15px)] font-semibold text-brand-900">
                Công Ty TNHH Thương Mại Dịch Vụ Saram Vina
              </p>
              <p className="relative z-10 mt-1 whitespace-nowrap text-[clamp(10px,calc((100vw-96px)/28),13px)] text-slate-500">
                Hệ thống quản lý tuyển dụng lao động nội bộ
              </p>
            </div>

            <div className="mt-7">
              {/* Tiêu đề giữa 2 vạch mảnh màu thương hiệu (yêu cầu 2026-11-05). */}
              <div className="flex items-center gap-3">
                <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-brand-300" />
                <h2 className="text-[19px] font-semibold tracking-wide text-brand-900">Đăng nhập</h2>
                <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-brand-300" />
              </div>
              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Saram Vina . Nội bộ
            <br />
            -PMQ-
          </p>
        </div>
      </div>
    </div>
  );
}
