/**
 * Dự án phụ — nâng cấp toàn diện: màu Badge "Tình trạng cuộc gọi" theo từng
 * lựa chọn (trước đó luôn cố định "info") — dùng ở danh sách Ứng viên và
 * "tag" trên mỗi note ở trang Chi tiết ứng viên.
 */
export function callStatusVariant(name: string): "info" | "neutral" | "warning" | "danger" {
  if (name === "Đã gọi") return "info";
  if (name === "Chưa gọi") return "neutral";
  if (name === "Sai số") return "danger";
  return "warning"; // Không nghe máy / Thuê bao / Máy bận
}

/** Màu nhãn "Kết quả cuộc gọi" (Tiềm năng / Không tiềm năng / còn lại). */
export function callResultVariant(name: string): "success" | "warning" | "neutral" {
  if (name.includes("Không tiềm năng")) return "neutral";
  if (name.includes("Tiềm năng")) return "success";
  return "warning";
}
