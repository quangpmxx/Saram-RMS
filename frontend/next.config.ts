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
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};

export default nextConfig;
