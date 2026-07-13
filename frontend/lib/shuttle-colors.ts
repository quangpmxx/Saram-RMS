/**
 * Dự án phụ — nâng cấp toàn diện: bảng màu cố định cho các giá trị gợi ý của
 * Danh sách đưa đón (Công ty/Khu vực/Loại hình/Sale/Nhân viên đưa đón/Nhà
 * thầu/Trạng thái) — người dùng CHỌN 1 màu trong bảng này khi thêm/sửa giá
 * trị. Bộ màu này khớp đúng bảng màu chuẩn 10 cột x 8 hàng người dùng gửi
 * ảnh minh họa (1 hàng xám đen→trắng + 10 tông màu, mỗi tông 1 sắc "chuẩn"
 * và 6 sắc độ nhạt→đậm) — yêu cầu trực tiếp người dùng: "đổi thành bộ màu y
 * hệt như thế này". 6 sắc độ mỗi tông được TÍNH bằng nội suy HSL (không lấy
 * tay từng mã màu) nên có thể lệch vài đơn vị mã hex so với bảng màu gốc của
 * Google Sheets, nhưng đúng cấu trúc lưới 10x8 và đúng chiều nhạt→đậm như
 * ảnh gửi. Khớp đúng SHUTTLE_OPTION_COLORS ở backend
 * (dto/create-shuttle-option.dto.ts).
 */
export const SHUTTLE_OPTION_COLORS = [
  { key: "gray-1", label: "Đen", backgroundColor: "#000000", color: "#ffffff" },
  { key: "gray-2", label: "Xám rất đậm", backgroundColor: "#434343", color: "#ffffff" },
  { key: "gray-3", label: "Xám đậm", backgroundColor: "#666666", color: "#ffffff" },
  { key: "gray-4", label: "Xám", backgroundColor: "#999999", color: "#1f2937" },
  { key: "gray-5", label: "Xám vừa", backgroundColor: "#b7b7b7", color: "#1f2937" },
  { key: "gray-6", label: "Xám nhạt", backgroundColor: "#cccccc", color: "#1f2937" },
  { key: "gray-7", label: "Xám rất nhạt", backgroundColor: "#d9d9d9", color: "#1f2937" },
  { key: "gray-8", label: "Trắng xám", backgroundColor: "#efefef", color: "#1f2937" },
  { key: "gray-9", label: "Trắng ngà", backgroundColor: "#f3f3f3", color: "#1f2937" },
  { key: "gray-10", label: "Trắng", backgroundColor: "#ffffff", color: "#1f2937" },
  { key: "maroon-base", label: "Đỏ mận", backgroundColor: "#980000", color: "#ffffff" },
  { key: "maroon-1", label: "Đỏ mận rất nhạt", backgroundColor: "#f1d0d0", color: "#1f2937" },
  { key: "maroon-2", label: "Đỏ mận nhạt", backgroundColor: "#e69494", color: "#1f2937" },
  { key: "maroon-3", label: "Đỏ mận sáng", backgroundColor: "#d85a5a", color: "#1f2937" },
  { key: "maroon-4", label: "Đỏ mận vừa", backgroundColor: "#b62b2b", color: "#ffffff" },
  { key: "maroon-5", label: "Đỏ mận đậm", backgroundColor: "#7c1d1d", color: "#ffffff" },
  { key: "maroon-6", label: "Đỏ mận rất đậm", backgroundColor: "#3e1313", color: "#ffffff" },
  { key: "red-base", label: "Đỏ", backgroundColor: "#ff0000", color: "#1f2937" },
  { key: "red-1", label: "Đỏ rất nhạt", backgroundColor: "#fac6c6", color: "#1f2937" },
  { key: "red-2", label: "Đỏ nhạt", backgroundColor: "#ff7a7a", color: "#1f2937" },
  { key: "red-3", label: "Đỏ sáng", backgroundColor: "#ff3333", color: "#1f2937" },
  { key: "red-4", label: "Đỏ vừa", backgroundColor: "#e00000", color: "#ffffff" },
  { key: "red-5", label: "Đỏ đậm", backgroundColor: "#990000", color: "#ffffff" },
  { key: "red-6", label: "Đỏ rất đậm", backgroundColor: "#4b0606", color: "#ffffff" },
  { key: "orange-base", label: "Cam", backgroundColor: "#ff9900", color: "#1f2937" },
  { key: "orange-1", label: "Cam rất nhạt", backgroundColor: "#fae6c6", color: "#1f2937" },
  { key: "orange-2", label: "Cam nhạt", backgroundColor: "#ffca7a", color: "#1f2937" },
  { key: "orange-3", label: "Cam sáng", backgroundColor: "#ffad33", color: "#1f2937" },
  { key: "orange-4", label: "Cam vừa", backgroundColor: "#e08700", color: "#1f2937" },
  { key: "orange-5", label: "Cam đậm", backgroundColor: "#995c00", color: "#ffffff" },
  { key: "orange-6", label: "Cam rất đậm", backgroundColor: "#4b3006", color: "#ffffff" },
  { key: "yellow-base", label: "Vàng", backgroundColor: "#ffff00", color: "#1f2937" },
  { key: "yellow-1", label: "Vàng rất nhạt", backgroundColor: "#fafac6", color: "#1f2937" },
  { key: "yellow-2", label: "Vàng nhạt", backgroundColor: "#ffff7a", color: "#1f2937" },
  { key: "yellow-3", label: "Vàng sáng", backgroundColor: "#ffff33", color: "#1f2937" },
  { key: "yellow-4", label: "Vàng vừa", backgroundColor: "#e0e000", color: "#1f2937" },
  { key: "yellow-5", label: "Vàng đậm", backgroundColor: "#999900", color: "#1f2937" },
  { key: "yellow-6", label: "Vàng rất đậm", backgroundColor: "#4b4b06", color: "#ffffff" },
  { key: "green-base", label: "Xanh lá", backgroundColor: "#00ff00", color: "#1f2937" },
  { key: "green-1", label: "Xanh lá rất nhạt", backgroundColor: "#c6fac6", color: "#1f2937" },
  { key: "green-2", label: "Xanh lá nhạt", backgroundColor: "#7aff7a", color: "#1f2937" },
  { key: "green-3", label: "Xanh lá sáng", backgroundColor: "#33ff33", color: "#1f2937" },
  { key: "green-4", label: "Xanh lá vừa", backgroundColor: "#00e000", color: "#1f2937" },
  { key: "green-5", label: "Xanh lá đậm", backgroundColor: "#009900", color: "#1f2937" },
  { key: "green-6", label: "Xanh lá rất đậm", backgroundColor: "#064b06", color: "#ffffff" },
  { key: "cyan-base", label: "Xanh lơ", backgroundColor: "#00ffff", color: "#1f2937" },
  { key: "cyan-1", label: "Xanh lơ rất nhạt", backgroundColor: "#c6fafa", color: "#1f2937" },
  { key: "cyan-2", label: "Xanh lơ nhạt", backgroundColor: "#7affff", color: "#1f2937" },
  { key: "cyan-3", label: "Xanh lơ sáng", backgroundColor: "#33ffff", color: "#1f2937" },
  { key: "cyan-4", label: "Xanh lơ vừa", backgroundColor: "#00e0e0", color: "#1f2937" },
  { key: "cyan-5", label: "Xanh lơ đậm", backgroundColor: "#009999", color: "#1f2937" },
  { key: "cyan-6", label: "Xanh lơ rất đậm", backgroundColor: "#064b4b", color: "#ffffff" },
  { key: "cornflower-base", label: "Xanh coban", backgroundColor: "#4a86e8", color: "#1f2937" },
  { key: "cornflower-1", label: "Xanh coban rất nhạt", backgroundColor: "#ccdcf5", color: "#1f2937" },
  { key: "cornflower-2", label: "Xanh coban nhạt", backgroundColor: "#89b0f0", color: "#1f2937" },
  { key: "cornflower-3", label: "Xanh coban sáng", backgroundColor: "#4a86e8", color: "#1f2937" },
  { key: "cornflower-4", label: "Xanh coban vừa", backgroundColor: "#195bc7", color: "#ffffff" },
  { key: "cornflower-5", label: "Xanh coban đậm", backgroundColor: "#113e88", color: "#ffffff" },
  { key: "cornflower-6", label: "Xanh coban rất đậm", backgroundColor: "#0e2244", color: "#ffffff" },
  { key: "blue-base", label: "Xanh dương", backgroundColor: "#0000ff", color: "#ffffff" },
  { key: "blue-1", label: "Xanh dương rất nhạt", backgroundColor: "#c6c6fa", color: "#1f2937" },
  { key: "blue-2", label: "Xanh dương nhạt", backgroundColor: "#7a7aff", color: "#1f2937" },
  { key: "blue-3", label: "Xanh dương sáng", backgroundColor: "#3333ff", color: "#ffffff" },
  { key: "blue-4", label: "Xanh dương vừa", backgroundColor: "#0000e0", color: "#ffffff" },
  { key: "blue-5", label: "Xanh dương đậm", backgroundColor: "#000099", color: "#ffffff" },
  { key: "blue-6", label: "Xanh dương rất đậm", backgroundColor: "#06064b", color: "#ffffff" },
  { key: "purple-base", label: "Tím", backgroundColor: "#9900ff", color: "#ffffff" },
  { key: "purple-1", label: "Tím rất nhạt", backgroundColor: "#e6c6fa", color: "#1f2937" },
  { key: "purple-2", label: "Tím nhạt", backgroundColor: "#ca7aff", color: "#1f2937" },
  { key: "purple-3", label: "Tím sáng", backgroundColor: "#ad33ff", color: "#1f2937" },
  { key: "purple-4", label: "Tím vừa", backgroundColor: "#8700e0", color: "#ffffff" },
  { key: "purple-5", label: "Tím đậm", backgroundColor: "#5c0099", color: "#ffffff" },
  { key: "purple-6", label: "Tím rất đậm", backgroundColor: "#30064b", color: "#ffffff" },
  { key: "magenta-base", label: "Hồng cánh sen", backgroundColor: "#ff00ff", color: "#1f2937" },
  { key: "magenta-1", label: "Hồng cánh sen rất nhạt", backgroundColor: "#fac6fa", color: "#1f2937" },
  { key: "magenta-2", label: "Hồng cánh sen nhạt", backgroundColor: "#ff7aff", color: "#1f2937" },
  { key: "magenta-3", label: "Hồng cánh sen sáng", backgroundColor: "#ff33ff", color: "#1f2937" },
  { key: "magenta-4", label: "Hồng cánh sen vừa", backgroundColor: "#e000e0", color: "#1f2937" },
  { key: "magenta-5", label: "Hồng cánh sen đậm", backgroundColor: "#990099", color: "#ffffff" },
  { key: "magenta-6", label: "Hồng cánh sen rất đậm", backgroundColor: "#4b064b", color: "#ffffff" },
] as const;

export type ShuttleColorKey = (typeof SHUTTLE_OPTION_COLORS)[number]["key"];

/**
 * Dự án phụ — nâng cấp toàn diện: `textColorKey` (nếu có) GHI ĐÈ riêng màu
 * chữ, độc lập với `colorKey` (màu nền) — yêu cầu trực tiếp người dùng:
 * "ngoài cho phép đổi màu nền chữ thì cho phép đổi màu chữ nữa". Không có
 * textColorKey thì vẫn dùng màu chữ tương phản tự động đi kèm colorKey
 * (hành vi cũ, không đổi).
 */
export function shuttleColorStyle(
  colorKey: string | null | undefined,
  textColorKey?: string | null,
): { backgroundColor: string; color: string } | undefined {
  if (!colorKey) return undefined;
  const base = SHUTTLE_OPTION_COLORS.find((c) => c.key === colorKey);
  if (!base) return undefined;
  const textOverride = textColorKey ? SHUTTLE_OPTION_COLORS.find((c) => c.key === textColorKey) : undefined;
  return { backgroundColor: base.backgroundColor, color: textOverride?.backgroundColor ?? base.color };
}
