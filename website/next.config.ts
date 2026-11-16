import type { NextConfig } from "next";

/** Backend CRM (NestJS) — trên máy chủ cùng máy, cổng 3001. */
const API_URL = process.env.API_URL ?? "http://localhost:3001";

/** Trang web công ty saramvina.com — dự án riêng, tách khỏi CRM (frontend/). */
const nextConfig: NextConfig = {
  /**
   * Chuyển /api/* sang backend CRM để trình duyệt chỉ thấy 1 tên miền: cookie đăng nhập
   * (host-only) đặt trên saramvina.com và gửi kèm khi lưu chữ ở chế độ sửa.
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
