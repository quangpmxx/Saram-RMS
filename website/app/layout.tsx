import type { Metadata } from "next";
import { Be_Vietnam_Pro, Inter, Lexend, Montserrat, Nunito, Open_Sans, Roboto } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingContact } from "@/components/floating-contact";
import { EditBar } from "@/components/edit-bar";
import { T } from "@/components/editable";
import { nav } from "@/lib/content";
import { getCompany, getCustomPages, getTheme, getTracking, themeCss } from "@/lib/site";

// Roboto (user chọn 2026-11-16) — dùng chung chữ thường + tiêu đề.
const roboto = Roboto({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });
// Font chọn được ở "Cài đặt chung" (lib/style.ts FONTS). preload: false → chỉ tải khi đang dùng.
const bevn = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800"], variable: "--font-bevn", preload: false });
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter", preload: false });
const montserrat = Montserrat({ subsets: ["latin", "vietnamese"], variable: "--font-montserrat", preload: false });
const lexend = Lexend({ subsets: ["latin", "vietnamese"], variable: "--font-lexend", preload: false });
const nunito = Nunito({ subsets: ["latin", "vietnamese"], variable: "--font-nunito", preload: false });
const openSans = Open_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-opensans", preload: false });
const fontVars = [roboto, bevn, inter, montserrat, lexend, nunito, openSans].map((f) => f.variable).join(" ");

const DEFAULT_DESC =
  "Đại Việt cung ứng nhân lực cho nhà máy tại các KCN Bắc Ninh, Bắc Giang từ năm 2016. Người lao động có ký túc xá sát nhà máy, mượn xe điện miễn phí, chỉ cần CCCD.";

export async function generateMetadata(): Promise<Metadata> {
  const { ogImage } = await getTracking();
  return {
    metadataBase: new URL("https://saramvina.com"),
    title: {
      default: "SARAM VINA - ĐẠI VIỆT",
      template: "%s · SARAM VINA - ĐẠI VIỆT",
    },
    description: DEFAULT_DESC,
    // Ảnh hiện khi gửi link lên Facebook/Zalo (Cài đặt chung → Ảnh chia sẻ).
    openGraph: ogImage ? { images: [`/api${ogImage}`], siteName: "SARAM VINA - ĐẠI VIỆT", locale: "vi_VN" } : undefined,
  };
}

// Chữ sửa tại chỗ lấy từ CRM: tự làm mới tối đa 5 phút/lần (lưu ở chế độ sửa thì làm mới ngay).
export const revalidate = 300;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [company, theme, tracking, customPages] = await Promise.all([getCompany(), getTheme(), getTracking(), getCustomPages()]);
  const css = themeCss(theme);
  // Tên mục menu sửa được (dùng chung cho menu trên và chân trang); trang tự thêm có bật "hiện trên menu" nằm cuối.
  const navItems = [...nav, ...customPages.filter((p) => p.menu).map((p) => ({ href: `/${p.slug}`, label: p.title }))].map((item) => ({
    href: item.href,
    label: <T k={`nav.${item.href === "/" ? "home" : item.href.slice(1)}`}>{item.label}</T>,
  }));
  return (
    <html lang="vi" className={fontVars}>
      <body className="pb-16 font-sans sm:pb-0" data-hotline={company.hotlineDisplay}>
        {/* Màu chủ đạo + cỡ chữ + font đã chỉnh ở "Cài đặt chung" (chỉ gồm giá trị đã kiểm).
            Đặt trong body: tự viết thẻ <head> làm Next chèn CSS sai, trang vỡ bố cục. */}
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <SiteHeader nav={navItems} hotline={company.hotline} hotlineDisplay={company.hotlineDisplay} />
        <main>{children}</main>
        <SiteFooter nav={navItems} />
        <FloatingContact />
        <EditBar
          pages={customPages}
          site={{
            hotline: company.hotline,
            zalo: company.zalo,
            email: company.email,
            address: company.address,
            fb_pixel: tracking.fbPixel,
            ga4: tracking.ga4,
            zalo_oa: tracking.zaloOa,
            og_image: tracking.ogImage,
          }}
          theme={theme}
        />
        {/* Mã theo dõi: chỉ chèn khi đã điền đúng dạng mã số (lib/style.ts) — không nhận đoạn code tuỳ ý. */}
        {tracking.ga4 && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${tracking.ga4}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${tracking.ga4}');`}
            </Script>
          </>
        )}
        {tracking.fbPixel && (
          <Script id="fb-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tracking.fbPixel}');fbq('track','PageView');`}
          </Script>
        )}
        {tracking.zaloOa && (
          <>
            <div
              className="zalo-chat-widget"
              data-oaid={tracking.zaloOa}
              data-welcome-message="Xin chào! Đại Việt có thể giúp gì cho bạn?"
              data-autopopup="0"
              data-width="350"
              data-height="420"
            />
            <Script src="https://sp.zalo.me/plugins/sdk.js" strategy="lazyOnload" />
          </>
        )}
      </body>
    </html>
  );
}
