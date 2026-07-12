/**
 * Dự án phụ — nâng cấp toàn diện: 3 màu đánh dấu cố định cho ô "Lịch sử
 * ghi chú/cuộc gọi" (trang Chi tiết) và ô "Tình trạng cuộc gọi" (bảng danh
 * sách) — swatch (màu đậm, để bấm chọn) và bgHex (màu nền phủ khi đã chọn).
 * Dùng style inline (không phải class Tailwind) cho nền vì các ô này đã có
 * sẵn nền riêng (bg-white/bg-slate-50...) — cn() chỉ nối chuỗi, không tự
 * loại bỏ class trùng, nên thắng/thua phụ thuộc thứ tự CSS được build ra
 * (không ổn định giữa các màu) — style inline luôn thắng chắc chắn.
 */
export const NOTE_COLORS: { value: "yellow" | "green" | "red"; label: string; swatch: string; bgHex: string }[] = [
  { value: "yellow", label: "Vàng", swatch: "bg-yellow-400", bgHex: "#fef08a" },
  { value: "green", label: "Xanh lá cây", swatch: "bg-green-500", bgHex: "#bbf7d0" },
  { value: "red", label: "Đỏ nhạt", swatch: "bg-red-300", bgHex: "#fecaca" },
];

export function noteColorBgHex(color: "yellow" | "green" | "red" | null): string | undefined {
  return NOTE_COLORS.find((c) => c.value === color)?.bgHex;
}
