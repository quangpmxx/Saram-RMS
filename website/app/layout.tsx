import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingContact } from "@/components/floating-contact";

const body = Plus_Jakarta_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-body" });
const head = Space_Grotesk({ subsets: ["latin", "vietnamese"], variable: "--font-head" });

export const metadata: Metadata = {
  metadataBase: new URL("https://saramvina.com"),
  title: {
    default: "SARAM VINA - ĐẠI VIỆT",
    template: "%s · SARAM VINA - ĐẠI VIỆT",
  },
  description:
    "SARAM VINA cung ứng nhân lực cho nhà máy tại các KCN Bắc Ninh, Bắc Giang từ năm 2016. Người lao động có ký túc xá sát nhà máy, mượn xe điện miễn phí, chỉ cần CCCD.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${body.variable} ${head.variable}`}>
      <body className="font-sans">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <FloatingContact />
      </body>
    </html>
  );
}
