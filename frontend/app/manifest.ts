import type { MetadataRoute } from "next";

/**
 * Thêm vào màn hình chính (Android/Chrome): tên + logo Đại Việt. Icon để trong
 * public/ (có đuôi .png) để proxy.ts không chặn khi điện thoại tải icon lúc chưa đăng nhập.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saram CRM",
    short_name: "Saram CRM",
    description: "Hệ thống quản lý tuyển dụng nội bộ",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
