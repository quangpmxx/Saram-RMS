import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingContact } from "@/components/floating-contact";
import { EditBar } from "@/components/edit-bar";

// Roboto (user chọn 2026-11-16) — dùng chung chữ thường + tiêu đề.
const roboto = Roboto({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL("https://saramvina.com"),
  title: {
    default: "SARAM VINA - ĐẠI VIỆT",
    template: "%s · SARAM VINA - ĐẠI VIỆT",
  },
  description:
    "Đại Việt cung ứng nhân lực cho nhà máy tại các KCN Bắc Ninh, Bắc Giang từ năm 2016. Người lao động có ký túc xá sát nhà máy, mượn xe điện miễn phí, chỉ cần CCCD.",
};

// Chữ sửa tại chỗ lấy từ CRM: tự làm mới tối đa 5 phút/lần (lưu ở chế độ sửa thì làm mới ngay).
export const revalidate = 300;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={roboto.variable}>
      <body className="font-sans">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <FloatingContact />
        <EditBar />
      </body>
    </html>
  );
}
