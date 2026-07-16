import type { CSSProperties } from "react";
import type { AccountRole } from "./types";

/**
 * Dự án phụ — nâng cấp toàn diện: tên + nhãn vai trò hiển thị màu riêng theo
 * vai trò ở MỌI nơi có hiển thị tên tài khoản (yêu cầu trực tiếp người dùng)
 * — Admin: vàng gold (gradient), Quản lý: đỏ thẫm, Leader: tím. Dùng inline
 * style (không phải class Tailwind nối thêm qua cn()) vì cn() trong dự án
 * chỉ join chuỗi, không dedup theo thuộc tính CSS — nối thêm text-color/bg-color
 * qua className không đảm bảo thắng class màu gốc (bài học lặp lại nhiều lần
 * trong dự án).
 */
export const ADMIN_GOLD_GRADIENT = "linear-gradient(90deg, #8a6a15 0%, #c9a227 50%, #8a6a15 100%)";
export const ADMIN_GOLD_RING = "rgba(138, 106, 21, 0.35)";

export const MANAGER_DARK_RED = "#7f1d1d";
export const MANAGER_DARK_RED_RING = "rgba(127, 29, 29, 0.35)";

export const LEADER_PURPLE = "#6d28d9";
export const LEADER_PURPLE_RING = "rgba(109, 40, 217, 0.35)";

/**
 * style={} cho chữ tên/nhãn thường (không phải badge). Admin được "cắt" chữ
 * theo gradient (background-clip: text) để có hiệu ứng vàng gold ánh kim;
 * Quản lý/Leader dùng màu đặc (đỏ thẫm/tím). Trả về undefined cho các vai
 * trò còn lại, để không đụng màu mặc định.
 */
export function roleAccentTextStyle(role: AccountRole | undefined | null): CSSProperties | undefined {
  if (role === "admin") {
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
  if (role === "manager") {
    return { color: MANAGER_DARK_RED, fontWeight: 600 };
  }
  if (role === "leader") {
    return { color: LEADER_PURPLE, fontWeight: 600 };
  }
  return undefined;
}

/**
 * style={} cho dạng badge/pill (nền màu đặc + chữ đậm, đủ tương phản để luôn
 * đọc rõ). Trả về undefined cho các vai trò còn lại.
 */
export function roleAccentBadgeStyle(role: AccountRole | undefined | null): CSSProperties | undefined {
  if (role === "admin") {
    return {
      backgroundImage: ADMIN_GOLD_GRADIENT,
      color: "#3f2d05",
      fontWeight: 700,
      boxShadow: `inset 0 0 0 1px ${ADMIN_GOLD_RING}`,
    };
  }
  if (role === "manager") {
    return {
      backgroundColor: MANAGER_DARK_RED,
      color: "#ffffff",
      fontWeight: 700,
      boxShadow: `inset 0 0 0 1px ${MANAGER_DARK_RED_RING}`,
    };
  }
  if (role === "leader") {
    return {
      backgroundColor: LEADER_PURPLE,
      color: "#ffffff",
      fontWeight: 700,
      boxShadow: `inset 0 0 0 1px ${LEADER_PURPLE_RING}`,
    };
  }
  return undefined;
}
