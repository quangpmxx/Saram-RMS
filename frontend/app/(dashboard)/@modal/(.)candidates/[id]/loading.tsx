import { CandidateDetailModalFrame } from "@/components/candidate-detail-modal-frame";

/** Hiện ngay khung popup trong lúc tải dữ liệu data — bấm là thấy phản hồi. */
export default function CandidateDetailModalLoading() {
  return (
    <CandidateDetailModalFrame>
      <p className="py-16 text-center text-sm text-slate-400">Đang mở data...</p>
    </CandidateDetailModalFrame>
  );
}
