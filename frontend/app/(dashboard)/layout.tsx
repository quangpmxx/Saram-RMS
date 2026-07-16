import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { serverApi } from "@/lib/api-server";
import { type AccountRole, type BirthdayToday } from "@/lib/types";
import { Logo } from "@/components/logo";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { SendNotificationButton } from "@/components/send-notification-button";
import { ClockInButton } from "@/components/clock-in-button";
import { PageTitleProvider, PageTitleSlot } from "@/lib/page-title-context";
import { ToastProvider, ToastSlot } from "@/lib/toast-context";
import { BirthdayThemeProvider } from "@/lib/birthday-theme-context";
import { BirthdayLayoutBackground } from "@/components/birthday/birthday-layout-background";
import { BirthdayHeaderStrip } from "@/components/birthday/birthday-header-strip";
import { BirthdayHeaderBackground } from "@/components/birthday/birthday-header-background";
import { BirthdayBanner } from "@/components/birthday/birthday-banner";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16), Mục 0: "Giao diện chúc mừng
 * sinh nhật nhân viên... không làm ảnh hưởng khả năng đọc dữ liệu và thao
 * tác nghiệp vụ." Tải TRƯỚC ở server (cùng lúc với getCurrentUser(), khớp
 * đúng khuôn mẫu session.ts) — lỗi gì cũng ÂM THẦM bỏ qua (trả về null),
 * KHÔNG được làm vỡ cả trang chỉ vì tính năng trang trí này lỗi.
 */
async function getBirthdayToday(): Promise<BirthdayToday | null> {
  try {
    return await serverApi<BirthdayToday>("/birthday/today");
  } catch {
    return null;
  }
}

const ALL_NAV_ITEMS: Array<NavItem & { roles: AccountRole[] }> = [
  { href: "/", label: "Trang chủ Dashboard", icon: "home", roles: ["admin", "manager", "leader", "mkt", "sale"] },
  { href: "/candidates", label: "Data lao động", icon: "candidates", roles: ["admin", "manager", "mkt", "leader", "sale"] },
  {
    href: "/shuttle",
    label: "Danh sách đưa đón",
    icon: "shuttle",
    roles: ["admin", "manager", "leader", "mkt", "sale"],
  },
  { href: "/reports", label: "Báo cáo", icon: "reports", roles: ["admin", "manager", "leader", "sale"] },
  // Dự án phụ — nâng cấp toàn diện: module "Chấm công thủ công" (2026-07-14,
  // yêu cầu trực tiếp người dùng) — Admin/Quản lý/Leader xem+chỉnh theo
  // phạm vi, Nhân viên (MKT/Sale) chỉ xem chấm công của chính mình (RBAC
  // chi tiết nằm ở attendance.service.ts, khớp Mục 8 bản đặc tả).
  {
    href: "/attendance",
    label: "Chấm công",
    icon: "attendance",
    roles: ["admin", "manager", "leader", "mkt", "sale"],
  },
  // Dự án phụ — nâng cấp toàn diện: module Kế toán — CHỈ khung sườn (icon +
  // trang "sắp ra mắt"), chưa có nghiệp vụ gì. Yêu cầu trực tiếp người dùng
  // (2026-07-14): "hiện tại thì để nó ở tài khoản admin thôi đã" — chỉ Admin
  // thấy được, mở rộng thêm vai trò khác sau khi có nghiệp vụ thật.
  {
    href: "/accounting",
    label: "Kế toán",
    icon: "accounting",
    roles: ["admin"],
  },
  // Dự án phụ — nâng cấp toàn diện: module Nhập doanh số + Quản lý đơn hàng —
  // CHỈ khung sườn, chưa có nghiệp vụ gì (yêu cầu trực tiếp người dùng,
  // 2026-07-16, "để trống chờ phát triển thêm giống như kế toán ấy") — đặt
  // ngay dưới Kế toán, cùng khớp roles ["admin"] như Kế toán.
  {
    href: "/sales-entry",
    label: "Nhập doanh số",
    icon: "salesEntry",
    roles: ["admin"],
  },
  {
    href: "/order-management",
    label: "Quản lý đơn hàng",
    icon: "orderManagement",
    roles: ["admin"],
  },
  { href: "/calendar", label: "Lịch hẹn", icon: "calendar", roles: ["admin", "manager", "leader", "sale"] },
  { href: "/audit-log", label: "Nhật ký", icon: "auditLog", roles: ["admin", "manager"] },
  { href: "/accounts", label: "Quản lý tài khoản", icon: "accounts", roles: ["admin"] },
  { href: "/settings", label: "Cấu hình vận hành", icon: "settings", roles: ["admin"] },
  // "Đơn xin nghỉ phép" — yêu cầu trực tiếp người dùng (2026-07-16): không
  // còn là mục riêng trên menu, đã chuyển thành 1 tab trong "Chấm công"
  // (xem attendance/attendance-client.tsx, tab "requests").
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, birthdayToday] = await Promise.all([getCurrentUser(), getBirthdayToday()]);

  if (!user) {
    redirect("/login");
  }

  const navItems = ALL_NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <PageTitleProvider>
      <ToastProvider>
        <BirthdayThemeProvider initialData={birthdayToday}>
          <ToastSlot />
          {/*
            Sidebar cố định (yêu cầu tinh chỉnh trang đăng nhập/giao diện):
            từ breakpoint md trở lên, khóa toàn bộ khung ứng dụng đúng bằng chiều
            cao viewport ("md:h-screen md:overflow-hidden") rồi để CHỈ cột nội
            dung bên phải tự cuộn riêng ("md:overflow-y-auto") — <aside> là phần
            tử flex anh em cùng cấp, nằm ngoài vùng cuộn đó nên không bao giờ
            trôi theo khi cuộn trang. Chỉ áp dụng từ md trở lên (khớp đúng
            breakpoint CollapsibleSidebar đã ẩn trên mobile) để tránh lỗi 100vh
            khi thanh địa chỉ trình duyệt di động co giãn.

            Yêu cầu trực tiếp người dùng (2026-07-16, "Giao diện chúc mừng sinh
            nhật nhân viên", Mục 2/3): khối bọc ngoài cùng (nền trang) đổi
            thành BirthdayLayoutBackground (client component, tự đọc
            useBirthdayTheme()) — render ĐÚNG cùng 1 <div> với className y hệt
            trước đây khi không có sinh nhật nào (bg-slate-50), chỉ thêm
            gradient nhẹ + confetti/bóng bay khi có sinh nhật hôm nay.
          */}
          <BirthdayLayoutBackground>
            <CollapsibleSidebar navItems={navItems} />

            <div className="flex min-w-0 flex-1 flex-col md:h-screen md:overflow-y-auto">
              {/*
                Dự án phụ — nâng cấp toàn diện: z-50 — LUÔN LÀ LỚP NỔI CAO NHẤT
                toàn ứng dụng (yêu cầu trực tiếp người dùng: "thanh header này
                luôn để làm lớp đầu tiên của trang web"). Mọi phần tử
                sticky/fixed/portal thêm mới ở BẤT KỲ trang nào (bộ lọc dính,
                dropdown, modal...) PHẢI dùng z-index THẤP HƠN z-50 — hiện tại
                giá trị lớn nhất còn lại trong codebase là z-40
                (notification-bell.tsx, danh sách toast).
              */}
              <BirthdayHeaderBackground>
                <BirthdayHeaderStrip />
                {/* UI Polish — tinh chỉnh mật độ hiển thị: py-2.5 → py-1.5 (giảm ~28% chiều
                    cao header khi cộng với avatar/font thu nhỏ trong UserMenu). */}
                <div className="flex items-center justify-between gap-3 px-4 py-1.5 md:px-6">
                  <div className="md:hidden">
                    <Logo size="sm" showWordmark={false} href="/" />
                  </div>
                  <div className="hidden md:block">
                    <PageTitleSlot />
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    {user.role === "admin" && <SendNotificationButton />}
                    {/* Dự án phụ — nâng cấp toàn diện: nút "Chấm công" — mọi vai trò TRỪ Admin/Quản lý (yêu cầu trực tiếp người dùng), placeholder giao diện. */}
                    {user.role !== "admin" && user.role !== "manager" && <ClockInButton />}
                    <NotificationBell userId={user.id} />
                    <UserMenu user={user} />
                  </div>
                </div>
                <div className="border-t border-slate-100 px-2 py-2 md:hidden">
                  <SidebarNav items={navItems} variant="horizontal" />
                </div>
              </BirthdayHeaderBackground>
              <main className="relative flex-1 p-4 md:p-6">
                {/* Nền mờ logo công ty — yêu cầu trực tiếp người dùng (2026-07-14):
                    đã áp dụng riêng cho Dashboard trước, nay chuyển lên layout dùng
                    chung để áp dụng cho MỌI trang module ("áp dụng nền logo này cho
                    tất cả các trang module khác đi"). Đã tách nền trắng khỏi
                    public/saram-logo.jpg (xem public/saram-logo-transparent.png).
                    "sticky top-0 h-screen" + "-mb-[100vh]" để logo luôn dính giữa
                    khung nhìn hiện tại kể cả khi cuộn (absolute inset-0 sẽ canh
                    giữa theo toàn bộ chiều cao nội dung — với trang dài sẽ bị đẩy
                    xuống dưới màn hình đầu, lỗi thực tế đã gặp). z-0 để luôn nằm
                    dưới nội dung mọi trang (z-10) — mọi trang PHẢI đặt nội dung
                    trong khối z-10 để logo không đè lên (đã bọc sẵn bên dưới). */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none sticky top-0 z-0 -mb-[100vh] flex h-screen items-center justify-center overflow-hidden"
                >
                  <Image
                    src="/saram-logo-transparent.png"
                    alt=""
                    width={584}
                    height={733}
                    priority
                    className="w-[380px] opacity-[0.07] select-none sm:w-[460px]"
                  />
                </div>
                <div className="relative z-10">
                  <BirthdayBanner />
                  {children}
                </div>
              </main>
            </div>
          </BirthdayLayoutBackground>
        </BirthdayThemeProvider>
      </ToastProvider>
    </PageTitleProvider>
  );
}
