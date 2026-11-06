import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  auth!: string;
}

/** POST /push/subscribe — đúng dạng PushSubscription.toJSON() của trình duyệt. */
export class PushSubscribeDto {
  @IsUrl({ require_tld: false, protocols: ['https'] })
  @MaxLength(2048)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  /** Trình duyệt luôn gửi kèm (thường null) — nhận cho hợp lệ, không dùng. */
  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;
}

/** POST /push/unsubscribe */
export class PushUnsubscribeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint!: string;
}
