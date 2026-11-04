import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện: POST /shuttle/options — thêm 1 giá trị mới
 * vào danh sách gợi ý của 1 trong các trường "chọn", kèm màu nền tự chọn
 * (yêu cầu trực tiếp người dùng: "dữ liệu mới khi thêm thì được chọn màu
 * nền"). "company" KHÔNG còn nằm trong danh sách này (2026-07-26, yêu cầu
 * trực tiếp người dùng: "công ty chính là đơn hàng") — quản lý riêng qua
 * module Quản lý đơn hàng (OrderRecord), xem shuttle.service.ts#listCompanies().
 * "interview_result" tách riêng khỏi "status" (yêu cầu trực tiếp người dùng:
 * tách cột "Trạng thái" cũ thành "Tình trạng đón" + "Kết quả PV").
 * "interview_time" (Giờ phỏng vấn) đổi từ ô nhập tay tự do sang chọn từ
 * trình đơn thả xuống giống các trường còn lại (yêu cầu trực tiếp người dùng).
 * "sale" giờ CHỈ dùng field này để lưu MÀU NỀN riêng cho từng tài khoản Sale
 * thật (value = họ tên tài khoản, khớp ShuttleService.listSaleAccounts()) —
 * KHÔNG dùng để thêm/sửa/xóa TÊN Sale tự do nữa (yêu cầu trực tiếp người
 * dùng: "cho thêm 1 bảng màu cho phép sửa được màu nền"), vì cần khớp đúng
 * tài khoản thật để sau này làm báo cáo. Frontend chỉ gọi upsert màu qua
 * value = tên tài khoản có sẵn, không cho gõ tay tên mới.
 */
export const SHUTTLE_OPTION_FIELDS = [
  'area',
  'type',
  'sale',
  'driver',
  'contractor',
  'status',
  'interview_result',
  'interview_time',
  'lead_source',
] as const;

/**
 * Giá trị cố định (2026-11-04): Dashboard đếm Hẹn/Đến/Bùng/Đỗ/Trượt PV và tách
 * CT/TV theo ĐÚNG các chuỗi này, nên không cho xoá/đổi tên (chỉ đổi màu) —
 * shuttle.service.ts chặn, dashboard.service.ts dùng chung hằng số.
 */
export const SHUTTLE_TYPE_CT = 'CT';
export const SHUTTLE_TYPE_TV = 'TV';
export const SHUTTLE_STATUS_ATTENDED = 'Đã đón';
export const SHUTTLE_STATUS_NO_SHOW = 'Chưa đón được';
export const SHUTTLE_RESULT_PASSED = 'Đỗ PV';
export const SHUTTLE_RESULT_FAILED = 'Trượt PV';
export const LOCKED_SHUTTLE_OPTIONS: ReadonlyArray<{
  field: string;
  value: string;
}> = [
  { field: 'type', value: SHUTTLE_TYPE_CT },
  { field: 'type', value: SHUTTLE_TYPE_TV },
  { field: 'status', value: SHUTTLE_STATUS_ATTENDED },
  { field: 'status', value: SHUTTLE_STATUS_NO_SHOW },
  { field: 'interview_result', value: SHUTTLE_RESULT_PASSED },
  { field: 'interview_result', value: SHUTTLE_RESULT_FAILED },
];

export function isLockedShuttleOption(field: string, value: string): boolean {
  return LOCKED_SHUTTLE_OPTIONS.some(
    (o) => o.field === field && o.value === value,
  );
}

/**
 * Khớp đúng bảng màu SHUTTLE_OPTION_COLORS ở frontend (lib/shuttle-colors.ts)
 * — 80 màu (10 xám + 10 tông màu x 7 sắc độ), đúng cấu trúc lưới 10x8 người
 * dùng gửi ảnh yêu cầu ("đổi thành bộ màu y hệt như thế này").
 */
export const SHUTTLE_OPTION_COLORS = [
  'gray-1',
  'gray-2',
  'gray-3',
  'gray-4',
  'gray-5',
  'gray-6',
  'gray-7',
  'gray-8',
  'gray-9',
  'gray-10',
  'maroon-base',
  'maroon-1',
  'maroon-2',
  'maroon-3',
  'maroon-4',
  'maroon-5',
  'maroon-6',
  'red-base',
  'red-1',
  'red-2',
  'red-3',
  'red-4',
  'red-5',
  'red-6',
  'orange-base',
  'orange-1',
  'orange-2',
  'orange-3',
  'orange-4',
  'orange-5',
  'orange-6',
  'yellow-base',
  'yellow-1',
  'yellow-2',
  'yellow-3',
  'yellow-4',
  'yellow-5',
  'yellow-6',
  'green-base',
  'green-1',
  'green-2',
  'green-3',
  'green-4',
  'green-5',
  'green-6',
  'cyan-base',
  'cyan-1',
  'cyan-2',
  'cyan-3',
  'cyan-4',
  'cyan-5',
  'cyan-6',
  'cornflower-base',
  'cornflower-1',
  'cornflower-2',
  'cornflower-3',
  'cornflower-4',
  'cornflower-5',
  'cornflower-6',
  'blue-base',
  'blue-1',
  'blue-2',
  'blue-3',
  'blue-4',
  'blue-5',
  'blue-6',
  'purple-base',
  'purple-1',
  'purple-2',
  'purple-3',
  'purple-4',
  'purple-5',
  'purple-6',
  'magenta-base',
  'magenta-1',
  'magenta-2',
  'magenta-3',
  'magenta-4',
  'magenta-5',
  'magenta-6',
] as const;

export class CreateShuttleOptionDto {
  @IsIn(SHUTTLE_OPTION_FIELDS)
  field: (typeof SHUTTLE_OPTION_FIELDS)[number];

  @IsString()
  @IsNotEmpty({ message: 'Giá trị không được để trống' })
  @MaxLength(150)
  value: string;

  @IsOptional()
  @IsIn(SHUTTLE_OPTION_COLORS)
  color_key?: string;

  /** Dự án phụ — nâng cấp toàn diện: màu CHỮ riêng, độc lập với color_key (màu nền) — yêu cầu trực tiếp người dùng. */
  @IsOptional()
  @IsIn(SHUTTLE_OPTION_COLORS)
  text_color_key?: string;
}
