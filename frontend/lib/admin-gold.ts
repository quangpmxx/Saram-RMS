import type { CSSProperties } from "react";
import type { AccountRole } from "./types";

/**
 * Dự án phụ — nâng cấp toàn diện: tài khoản Admin hiển thị tên + nhãn vai trò
 * bằng màu vàng gold (dạng gradient) ở MỌI nơi có hiển thị tên tài khoản
 * (yêu cầu trực tiếp người dùng). Dùng inline style (không phải class
 * Tailwind nối thêm qua cn()) vì cn() trong dự án chỉ join chuỗi, không
 * dedup theo thuộc tính CSS — nối thêm text-color/bg-color qua className
 * không đảm bảo thắng class màu gốc (bài học lặp lại nhiều lần trong dự án).
 */
export const ADMIN_GOLD_GRADIENT = "linear-gradient(90deg, #8a6a15 0%, #c9a227 50%, #8a6a15 100%)";
export const ADMIN_GOLD_TEXT = "#8a6a15";
export const ADMIN_GOLD_RING = "rgba(138, 106, 21, 0.35)";

/**
 * style={} cho chữ tên/nhãn thường (không phải badge) — chữ được "cắt" theo
 * gradient (background-clip: text) để có hiệu ứng vàng gold ánh kim thay vì
 * 1 màu phẳng. Trả về undefined nếu không phải Admin, để không đụng màu mặc
 * định.
 */
export function adminGoldTextStyle(role: AccountRole | undefined | null): CSSProperties | undefined {
  if (role !== "admin") return undefined;
  return {
    backgroundImage: ADMIN_GOLD_GRADIENT,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
    fontWeight: 600,
    display: "inline-block",
  };
}

/**
 * style={} cho dạng badge/pill (nền gradient + chữ đậm màu, KHÔNG cắt theo
 * gradient vì chữ trên nền gradient cần màu đặc để luôn đọc rõ bất kể điểm
 * sáng/tối của nền tại vị trí đó). Trả về undefined nếu không phải Admin.
 */
export function adminGoldBadgeStyle(role: AccountRole | undefined | null): CSSProperties | undefined {
  if (role !== "admin") return undefined;
  return {
    backgroundImage: ADMIN_GOLD_GRADIENT,
    color: "#3f2d05",
    fontWeight: 700,
    boxShadow: `inset 0 0 0 1px ${ADMIN_GOLD_RING}`,
  };
}
