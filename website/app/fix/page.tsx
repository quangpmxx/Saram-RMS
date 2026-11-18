import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập sửa nội dung",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <section className="bg-mist py-20 sm:py-28">
      <div className="mx-auto max-w-md px-4">
        <LoginForm />
      </div>
    </section>
  );
}
