import type { ReactNode } from "react";

/**
 * Yêu cầu trực tiếp người dùng (2026-07-16): "mẫu đơn sẽ trình bày y hệt
 * như thế" (kèm ảnh chụp mẫu giấy công ty) — khung hiển thị dùng CHUNG cho
 * cả lúc tạo đơn (ô nhập) lẫn lúc xem lại/duyệt đơn (chữ tĩnh), truyền vào
 * qua các slot ReactNode để giữ ĐÚNG bố cục từng dòng của mẫu giấy, chỉ
 * khác nội dung bên trong (input hay text). Tên công ty CỐ ĐỊNH theo đúng
 * yêu cầu — không truyền vào từ ngoài.
 */
export function LeaveRequestPaper({
  recipientSlot,
  fullName,
  position,
  department,
  daysCount,
  dateRangeSlot,
  reasonSlot,
  handoverSlot,
  signatureDate,
  leaderBlock,
  adminBlock,
}: {
  recipientSlot: ReactNode;
  fullName: string;
  position: string;
  department: string;
  daysCount: number | null;
  dateRangeSlot: ReactNode;
  reasonSlot: ReactNode;
  handoverSlot: ReactNode;
  /** "YYYY-MM-DD" — ngày ký đơn (hiện ở góc phải, kiểu "......, ngày ... tháng ... năm ..."). */
  signatureDate: string;
  leaderBlock: ReactNode;
  adminBlock: ReactNode;
}) {
  const [y, m, d] = signatureDate.split("-");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 font-serif sm:p-8">
      <div className="text-center">
        <p className="text-sm font-bold tracking-wide text-slate-900 uppercase sm:text-base">
          Công ty TNHH Thương mại Dịch vụ Saram Vina
        </p>
        <p className="mt-6 text-lg font-bold text-slate-900 uppercase sm:text-xl">Đơn xin nghỉ phép</p>
      </div>

      <div className="mt-7 flex flex-col gap-3 text-[13px] leading-relaxed text-slate-700 sm:text-sm">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="shrink-0 text-slate-500">Kính gửi:</span>
          {recipientSlot}
        </div>

        <p>
          <span className="text-slate-500">Tôi tên là: </span>
          <span className="font-medium text-slate-900">{fullName}</span>
        </p>
        <p>
          <span className="text-slate-500">Chức vụ: </span>
          <span className="font-medium text-slate-900">{position}</span>
        </p>
        <p>
          <span className="text-slate-500">Bộ phận: </span>
          <span className="font-medium text-slate-900">{department}</span>
        </p>

        <p className="mt-1">
          Nay tôi làm đơn này xin phép được nghỉ{" "}
          <span className="font-bold text-brand-700">{daysCount ?? "…"}</span> ngày
        </p>

        <div className="flex flex-col gap-2 pl-5">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="shrink-0">• Thời gian nghỉ:</span>
            {dateRangeSlot}
          </div>
          <div>
            <p>• Lý do nghỉ:</p>
            <div className="mt-1">{reasonSlot}</div>
          </div>
        </div>

        <p className="mt-1">Tôi cam kết:</p>
        <div className="flex flex-col gap-2 pl-5">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="shrink-0">• Đã bàn giao công việc cho:</span>
            {handoverSlot}
          </div>
          <p>• Không làm ảnh hưởng đến công việc chung của công ty.</p>
          <p>• Sẽ quay lại làm việc đúng thời gian quy định.</p>
        </div>

        <p className="mt-1">Kính mong Ban quản lý xem xét và phê duyệt.</p>
        <p>Xin chân thành cảm ơn!</p>

        <p className="mt-2 text-right text-xs text-slate-400 italic">
          Ngày {Number(d) || "…"} tháng {Number(m) || "…"} năm {y || "…"}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-dashed border-slate-300 pt-6 text-center sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">Xác nhận của Leader</p>
          <div className="mt-2 flex flex-col items-center gap-1">{leaderBlock}</div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700">Xác nhận của Quản lý</p>
          <div className="mt-2 flex flex-col items-center gap-1">{adminBlock}</div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700">Người làm đơn</p>
          <p className="text-[11px] text-slate-400">(Ký và ghi rõ họ tên)</p>
          <p className="mt-2 text-sm font-medium text-slate-800">{fullName}</p>
        </div>
      </div>
    </div>
  );
}
