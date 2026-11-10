import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** PUT /shuttle/sheet-sync/config — chỉ Admin. Không gửi chìa khoá = giữ chìa khoá cũ. */
export class SaveShuttleSheetConfigDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  spreadsheet_url: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  service_account_json?: string;
}

/** POST /shuttle/sheet-sync/preview — không gửi tab = tự chọn tab của tháng này. */
export class ShuttleSheetPreviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tab?: string;
}

/** POST /shuttle/sheet-sync/commit — `drivers`: tên NV đưa đón trong sheet → id tài khoản (null = để trống). */
export class ShuttleSheetCommitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  tab: string;

  @IsOptional()
  @IsObject()
  drivers?: Record<string, string | null>;
}
