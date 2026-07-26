import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { SHUTTLE_OPTION_COLORS } from "@/lib/shuttle-colors";

/**
 * Dự án phụ — nâng cấp toàn diện: bảng chọn màu 80 ô (10 xám + 10 tông màu x
 * 7 sắc độ) dùng chung cho mọi nơi cần chọn màu nền/màu chữ theo bảng màu cố
 * định SHUTTLE_OPTION_COLORS — tách ra từ shuttle-client.tsx (nơi khởi tạo
 * đầu tiên) để Quản lý đơn hàng tái dùng nguyên vẹn (yêu cầu trực tiếp người
 * dùng: "giống như trang đưa đón lao động"), không viết trùng lặp.
 */
export function ColorPalette({ selected, onPick }: { selected: string | null; onPick: (key: string | null) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {SHUTTLE_OPTION_COLORS.map((c) => (
        <button
          key={c.key}
          type="button"
          title={c.label}
          onClick={() => onPick(c.key)}
          style={{ backgroundColor: c.backgroundColor }}
          className={cn(
            "h-5 w-5 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110",
            selected === c.key && "ring-2 ring-brand-500 ring-offset-1",
          )}
        />
      ))}
      <button
        type="button"
        title="Không màu"
        onClick={() => onPick(null)}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-inset ring-slate-300 hover:scale-110",
          selected === null && "ring-2 ring-brand-500 ring-offset-1",
        )}
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}
