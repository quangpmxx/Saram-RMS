import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  Max,
  Min,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MktSourceItemDto {
  @IsOptional() @IsUUID('4') id?: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên nguồn MKT không được để trống' })
  @MaxLength(100)
  name: string;
}

/** Lưu cả danh sách: mục có id → đổi tên, không id → thêm, thiếu → xoá. */
export class SaveMktSourcesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MktSourceItemDto)
  items: MktSourceItemDto[];
}

export class ConnectAdAccountDto {
  @IsIn(['facebook'])
  platform: 'facebook';

  @IsString()
  @MinLength(20)
  access_token: string;
}

export class ChangeOwnerDto {
  @IsUUID('4')
  owner_id: string;
}

export class SetMktSourceDto {
  /** null = bỏ gắn. */
  @IsOptional() @IsUUID('4') mkt_source_id: string | null;
}

export class SaveCostThresholdsDto {
  @IsInt() @Min(0) @Max(100_000_000) green_max: number;
  @IsInt() @Min(0) @Max(100_000_000) red_min: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export class OverviewQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
  @IsOptional() @IsIn(['facebook', 'tiktok']) platform?: 'facebook' | 'tiktok';
  @IsOptional() @IsUUID('4') ad_account_id?: string;
  @IsOptional() @IsUUID('4') owner_id?: string;
}

/** Khối Chi phí Marketing trên Dashboard — theo khoảng thời gian chung (2026-11-06). Bỏ trống cả 2 = hôm nay. */
export class MarketingPeriodQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
}
