import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Form "Đăng ký tìm việc" trên trang web. `website` = ô ẩn chống máy tự điền (người thật để trống). */
export class RegisterWorkerDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(150)
  full_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

/** Form "Gửi nhu cầu tuyển dụng" của doanh nghiệp. */
export class BusinessContactDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên công ty' })
  @MaxLength(200)
  company_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  need?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class ListWebsiteContactsQueryDto {
  @IsOptional()
  @IsIn(['all', 'pending', 'handled'])
  status: 'all' | 'pending' | 'handled' = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  page_size = 100;
}

export class UpdateWebsiteContactDto {
  @IsOptional()
  @IsBoolean()
  handled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
