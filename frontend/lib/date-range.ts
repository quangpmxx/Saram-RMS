/**
 * Dự án phụ — nâng cấp toàn diện: bộ lọc ngày dùng chung cho TẤT CẢ các
 * trang có lọc theo ngày (Dashboard/Báo cáo/Data lao động/Lịch/Nhật ký/Đưa
 * đón) — yêu cầu trực tiếp người dùng: "thiết kế bộ lọc ngày giống như thế
 * này [ảnh kiểu Google Analytics], áp dụng cho tất cả những trang hiện tại
 * và sau này cần lọc ngày". Trước đây mỗi trang tự viết riêng 1 bản
 * computeDateRange/DATE_PRESET_OPTIONS (trùng gần như y hệt ở dashboard-
 * client.tsx và reports-client.tsx, lệch nhau ở candidates-client.tsx) —
 * gộp về đúng 1 nơi.
 *
 * Chỉ tính toán NGÀY THUẦN (chuỗi "YYYY-MM-DD", khớp value gốc của
 * <input type="date">) — KHÔNG tự quy đổi sang ISO datetime đầu/cuối ngày,
 * vì mỗi API mỗi trang cần định dạng khác nhau (có nơi cần ISO datetime cho
 * "date_from"/"date_to", có nơi chỉ cần "YYYY-MM-DD" thuần như Shuttle) —
 * việc quy đổi cuối cùng vẫn do từng trang tự làm như cũ, y hệt hành vi gốc,
 * component này chỉ thay phần UI chọn ngày.
 *
 * "Tuần/Tháng" tính theo quy ước ĐÃ CHỐT trước đó (Mục 1, docs/12 — tuần bắt
 * đầu Thứ 2) — giữ nguyên đúng công thức cũ của dashboard-client.tsx/
 * reports-client.tsx, không đổi nghiệp vụ, chỉ đổi giao diện chọn.
 */

export type DatePreset =
  | "today"
  | "yesterday"
  | "today_yesterday"
  | "7d"
  | "14d"
  | "28d"
  | "30d"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export interface DateRangeValue {
  preset: DatePreset;
  /** "YYYY-MM-DD" — chuỗi rỗng nếu chưa chọn. */
  from: string;
  /** "YYYY-MM-DD" — chuỗi rỗng nếu chưa chọn. */
  to: string;
}

export const DATE_PRESET_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "today_yesterday", label: "Hôm nay và hôm qua" },
  { value: "7d", label: "7 ngày qua" },
  { value: "14d", label: "14 ngày qua" },
  { value: "28d", label: "28 ngày qua" },
  { value: "30d", label: "30 ngày qua" },
  { value: "this_week", label: "Tuần này" },
  { value: "last_week", label: "Tuần trước" },
  { value: "this_month", label: "Tháng này" },
  { value: "last_month", label: "Tháng trước" },
];

export const EMPTY_DATE_RANGE: DateRangeValue = { preset: "custom", from: "", to: "" };

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Đổi 1 mốc thời gian ISO (UTC) sang chuỗi ngày dương lịch "YYYY-MM-DD" theo
 * giờ ĐỊA PHƯƠNG — không dùng iso.slice(0, 10) vì đó là ngày theo giờ UTC,
 * lệch mất 1 ngày ở múi giờ Việt Nam (UTC+7) khi ISO rơi vào khoảng
 * 00:00–07:00 giờ VN. Dùng khi trang nhận filter ban đầu từ server dạng ISO
 * datetime (vd Reports — link "Xem chi tiết" từ Dashboard mang theo
 * date_from/date_to dạng ISO đầy đủ) để đổ lại vào DateRangePicker (chỉ nhận
 * "YYYY-MM-DD" thuần).
 */
export function isoToLocalDateOnly(iso: string): string {
  if (!iso) return "";
  return toDateOnly(new Date(iso));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Thứ 2 = 0 ... Chủ nhật = 6 — khớp đúng quy ước "tuần bắt đầu Thứ 2" đã chốt (Mục 1, docs/12). */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Tính khoảng ngày [from, to] (bao gồm cả 2 đầu) cho 1 preset — khớp đúng
 * công thức nghiệp vụ đã có ở dashboard-client.tsx/candidates-client.tsx
 * (chỉ đổi từ mốc ISO datetime sang "YYYY-MM-DD" thuần, phần "quy đổi sang
 * đầu/cuối ngày" do từng trang tự làm tiếp như cũ).
 */
export function computeDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { from: toDateOnly(today), to: toDateOnly(today) };
    case "yesterday": {
      const d = addDays(today, -1);
      return { from: toDateOnly(d), to: toDateOnly(d) };
    }
    case "today_yesterday":
      return { from: toDateOnly(addDays(today, -1)), to: toDateOnly(today) };
    case "7d":
      return { from: toDateOnly(addDays(today, -6)), to: toDateOnly(today) };
    case "14d":
      return { from: toDateOnly(addDays(today, -13)), to: toDateOnly(today) };
    case "28d":
      return { from: toDateOnly(addDays(today, -27)), to: toDateOnly(today) };
    case "30d":
      return { from: toDateOnly(addDays(today, -29)), to: toDateOnly(today) };
    case "this_week": {
      const start = addDays(today, -mondayIndex(today));
      return { from: toDateOnly(start), to: toDateOnly(today) };
    }
    case "last_week": {
      const startThisWeek = addDays(today, -mondayIndex(today));
      const start = addDays(startThisWeek, -7);
      const end = addDays(startThisWeek, -1);
      return { from: toDateOnly(start), to: toDateOnly(end) };
    }
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toDateOnly(start), to: toDateOnly(today) };
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toDateOnly(start), to: toDateOnly(end) };
    }
    case "custom":
      return { from: "", to: "" };
  }
}

/** Nhãn hiển thị gọn trên nút mở bộ lọc — vd "Hôm nay", hoặc "13/07 – 20/07" nếu tùy chỉnh. */
export function formatDateRangeLabel(value: DateRangeValue): string {
  const preset = DATE_PRESET_OPTIONS.find((option) => option.value === value.preset);
  if (preset) return preset.label;
  if (!value.from && !value.to) return "Chọn ngày";
  const short = (iso: string) => {
    const [year, month, day] = iso.split("-");
    return year ? `${day}/${month}` : "";
  };
  if (value.from && value.to && value.from !== value.to) return `${short(value.from)} – ${short(value.to)}`;
  return short(value.from || value.to);
}
