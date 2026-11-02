import { IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export class OverviewQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
  @IsOptional() @IsIn(['facebook', 'tiktok']) platform?: 'facebook' | 'tiktok';
  @IsOptional() @IsUUID('4') ad_account_id?: string;
  @IsOptional() @IsUUID('4') owner_id?: string;
}
