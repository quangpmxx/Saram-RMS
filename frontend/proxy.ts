import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 đổi tên "middleware" thành "proxy" (xem AGENTS.md).
 * Đây chỉ là redirect tiện UX dựa trên sự tồn tại của cookie phiên —
 * KHÔNG phải lớp xác thực thật. Việc kiểm tra quyền thật sự luôn nằm ở
 * backend (JWT) và ở từng Server Component qua GET /me (lib/session.ts).
 *
 * CHỈ redirect theo chiều "chưa có cookie → về /login" — chiều ngược lại
 * ("có cookie → đá khỏi /login") CỐ Ý KHÔNG làm ở đây, vì cookie tồn tại
 * không đồng nghĩa còn hợp lệ (hết hạn/bị thu hồi vẫn còn nằm trong trình
 * duyệt). Nếu middleware tự ý redirect /login → / chỉ dựa vào việc CÓ
 * cookie, trong khi app/(dashboard)/layout.tsx lại redirect / → /login vì
 * GET /me xác thực cookie đó không hợp lệ, hai lớp sẽ mâu thuẫn nhau vô
 * thời hạn → vòng lặp redirect (ERR_TOO_MANY_REDIRECTS). Việc "đã đăng
 * nhập rồi mà vào lại /login thì đá về /" đã được app/login/page.tsx tự
 * xử lý bằng đúng GET /me (kiểm tra thật), không cần lặp lại ở middleware.
 */
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("access_token");
  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!hasSession && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Loại trừ mọi đường dẫn có phần mở rộng file (vd. /saram-logo.jpg, các
  // *.svg trong public/) — nếu không, proxy sẽ redirect luôn cả request tải
  // ảnh tĩnh về /login khi chưa đăng nhập, khiến ảnh hiển thị "broken".
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
