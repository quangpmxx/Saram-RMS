import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Ô "company" trên bảng gửi "" khi bỏ trống (khớp quy ước "" = chưa nhập của các ô khác) — coi như null, không phải lỗi định dạng UUID. */
const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

/**
 * Dự án phụ — nâng cấp toàn diện: POST /shuttle (Danh sách đưa đón) — nhập
 * tay độc lập, không liên kết Lead/module khác. Chỉ full_name/phone_number/
 * date bắt buộc, các trường còn lại tự do (khớp yêu cầu "cho phép thêm giá
 * trị mới nếu chưa có" — không ràng buộc danh mục cố định).
 */
export class CreateShuttleDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(150)
  full_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @MaxLength(20)
  phone_number: string;

  /** Yêu cầu trực tiếp người dùng (2026-07-26): "công ty chính là đơn hàng" — tham chiếu OrderRecord thật, không còn chuỗi tự do. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  company_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  /** Yêu cầu trực tiếp người dùng (2026-07-28): "chuyển cả 2 cột sang liên kết tài khoản thật" — tham chiếu Account thật (role='sale'), không còn chuỗi tự do. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  sale_user_id?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  driver_user_id?: string | null;

  // Chuỗi rỗng "" = chưa nhập (frontend gửi "" thay vì bỏ hẳn field khi để
  // trống ô trên bảng inline) — @IsOptional() chỉ bỏ qua null/undefined,
  // không bỏ qua "", nên regex phải tự chấp nhận thêm trường hợp rỗng.
  @IsOptional()
  @IsString()
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Giờ phỏng vấn không hợp lệ (định dạng HH:mm)',
  })
  interview_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contractor?: string;

  /** "Tình trạng đón" (Đã đón/Chưa đón được/Hẹn lại). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  /** "Kết quả PV" (Đỗ phỏng vấn/Trượt phỏng vấn) — tách riêng khỏi "Tình trạng đón". */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  interview_result?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
