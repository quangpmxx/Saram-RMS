import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ConnectPancakeDto {
  @IsString()
  @MinLength(20)
  access_token: string;

  @IsString()
  @IsNotEmpty({ message: 'Nhập tên page' })
  @MaxLength(255)
  name: string;
}

export class PancakeOwnerDto {
  @IsUUID('4') owner_id: string;
}

export class PancakeMktSourceDto {
  /** null = bỏ gắn. */
  @IsOptional() @IsUUID('4') mkt_source_id: string | null;
}

export class PancakeUpNoteDto {
  /** Rỗng = bỏ ghi chú. */
  @IsString()
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  up_note: string;
}

/** Mã bài Facebook dạng "<page>_<bài>". */
export const POST_ID_RE = /^\d{1,40}_\d{1,40}$/;

export class PancakeSelectedPostsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @Matches(POST_ID_RE, { each: true, message: 'Mã bài không hợp lệ' })
  post_ids: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export class PancakePagesQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
}

export class AutoUpTeamDto {
  @IsUUID('4') team_id: string;

  @IsInt()
  @Min(0)
  @Max(20)
  weight: number;
}

export class SaveAutoUpDto {
  @IsBoolean() is_active: boolean;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AutoUpTeamDto)
  teams: AutoUpTeamDto[];
}
