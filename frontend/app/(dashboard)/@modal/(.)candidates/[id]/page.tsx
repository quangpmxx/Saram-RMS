import { CandidateDetailContent } from "../../../candidates/[id]/detail-content";

/**
 * Bấm mở 1 data từ trong app → hiện Chi tiết lao động dạng POPUP lớn đè lên
 * trang đang xem, thay vì chuyển hẳn trang (yêu cầu người dùng 2026-11-10 —
 * danh sách phía sau giữ nguyên bộ lọc/vị trí, đóng popup là thấy ngay).
 * URL vẫn đổi thành /candidates/<id>: nút Quay lại đóng popup; tải lại trang
 * hoặc mở thẳng link thì ra trang riêng đầy đủ như cũ (candidates/[id]/page.tsx).
 */
export default async function CandidateDetailModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CandidateDetailContent id={id} inModal />;
}
