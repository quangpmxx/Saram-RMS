import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
// Giao diện Tối (html.dark) — tự sinh, xem scripts/generate-dark-theme.mjs. Nạp
// riêng ở đây vì @import trong globals.css không được Turbopack (next dev) nạp.
import "./dark-theme.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CRM Tuyển dụng — Saram RMS",
  description: "Hệ thống quản lý tuyển dụng nội bộ",
};

/**
 * Bật sẵn giao diện Tối (nếu tài khoản dùng lần trước chọn Tối) TRƯỚC khi
 * trang hiện ra để không nháy trắng; UiThemeProvider sẽ chỉnh lại đúng theo
 * tài khoản đang đăng nhập ngay sau đó. Trang đăng nhập luôn sáng.
 */
const THEME_BOOT_SCRIPT = `try{if(!location.pathname.startsWith("/login")&&localStorage.getItem("saram_rms_ui_theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">{children}</body>
    </html>
  );
}
