import { CandidateDetailContent } from "./detail-content";

/**
 * S5 (phần cuộc gọi/ghi chú), Mục 2.2, docs/12-ui-design.md — Phase 3.
 * Dự án phụ — nâng cấp toàn diện: bỏ hẳn phần "Phỏng vấn & đi làm" khỏi
 * trang này (sẽ làm lại thành 1 trang riêng, nhập thủ công — tính sau) —
 * không còn tải GET /candidate/:id/interview hay danh mục trạng thái PV/đi làm.
 */
export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CandidateDetailContent id={id} />;
}
