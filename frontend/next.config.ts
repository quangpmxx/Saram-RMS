import type { NextConfig } from "next";

const BACKEND_URL = process.env.API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  /**
   * Proxy /api/* trên chính origin của Next.js sang backend NestJS
   * (server-to-server, cùng máy). Nhờ vậy trình duyệt chỉ cần biết 1 origin
   * duy nhất — khắc phục 2 vấn đề khi share link qua tunnel (ngrok/VS Code
   * Port Forwarding...): (1) NEXT_PUBLIC_API_URL trỏ "localhost:3001" chỉ
   * đúng trên máy chạy dev, người xem link sẽ gọi nhầm cổng 3001 trên máy
   * họ; (2) cookie phiên đăng nhập (SameSite=Lax, host-only) không gửi kèm
   * được giữa 2 domain khác nhau — qua proxy này, browser luôn thấy 1 origin
   * duy nhất nên cookie hoạt động bình thường. Chỉ cần forward/share 1 cổng
   * (3000) khi dùng tunnel, không cần forward cổng 3001 nữa.
   *
   * Cùng đường proxy này còn được lib/realtime.ts dùng cho bắt tay
   * Socket.IO (path "/api/socket.io") — vì lý do y hệt: kết nối realtime
   * cũng phải qua 1 origin duy nhất để hoạt động đúng trên máy khác/tunnel,
   * không hard-code "localhost:3001" (bug thực tế 2026-07-16: máy thứ 2 mở
   * trang qua LAN không kết nối được vì "localhost:3001" trên máy đó không
   * trỏ tới backend thật).
   */
  async rewrites() {
    return [
      // Đặt TRƯỚC rule chung — Socket.IO server chỉ nhận đúng path CÓ dấu
      // "/" cuối ("/socket.io/"). Rule chung bên dưới tái tạo URL đích từ
      // các đoạn path bắt được (":path*"), làm mất dấu "/" cuối này (path
      // rỗng ở cuối không được path-to-regexp giữ lại) — phải khai báo rõ
      // ràng bằng 1 rule khớp CHÍNH XÁC path này, hardcode dấu "/" cuối ở
      // đích, thay vì để rule chung tự tái tạo.
      { source: "/api/socket.io/", destination: `${BACKEND_URL}/socket.io/` },
      { source: "/api/:path*", destination: `${BACKEND_URL}/:path*` },
    ];
  },
  /**
   * BẮT BUỘC cho proxy Socket.IO ở trên: engine.io/Socket.IO server mặc
   * định chỉ nhận đúng path CÓ dấu "/" cuối ("/api/socket.io/"), nhưng
   * Next.js mặc định tự 308-redirect bỏ dấu "/" cuối trên MỌI đường dẫn
   * (kể cả đường dẫn đã rewrite) — request polling bị redirect vòng vòng,
   * không bao giờ tới được backend (lỗi "xhr poll error" phía client). Tắt
   * hành vi tự động này để giữ nguyên dấu "/" cuối cho riêng path Socket.IO.
   */
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
