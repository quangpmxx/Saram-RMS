import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Dự án phụ — nâng cấp toàn diện: POST /shuttle/options — thêm 1 giá trị mới
 * vào danh sách gợi ý của 1 trong 9 trường "chọn", kèm màu nền tự chọn (yêu
 * cầu trực tiếp người dùng: "dữ liệu mới khi thêm thì được chọn màu nền").
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
  'company',
  'area',
  'type',
  'sale',
  'driver',
  'contractor',
  'status',
  'interview_result',
  'interview_time',
] as const;

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
