import { redirect } from "next/navigation";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): "Đơn xin nghỉ phép" không còn
 * là mục riêng trên menu — đã chuyển thành 1 tab trong trang Chấm công (xem
 * ../attendance/attendance-client.tsx). Giữ lại route này CHỈ để chuyển
 * hướng — tránh vỡ link cũ đã lưu/đã gửi trước đây (vd link trong thông báo
 * cũ), luôn kèm theo `open=<id>` nếu có để vẫn tự mở đúng đơn.
 */
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const open = params.open;
  const openId = Array.isArray(open) ? open[0] : open;
  redirect(openId ? `/attendance?tab=requests&open=${openId}` : "/attendance?tab=requests");
}
