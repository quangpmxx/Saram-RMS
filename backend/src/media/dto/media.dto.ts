import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MEDIA_TASK_TYPES = [
  'video',
  'post',
  'livestream',
  'design',
  'other',
] as const;
export const MEDIA_TASK_STATUSES = [
  'todo',
  'in_progress',
  'in_review',
  'revision',
  'done',
] as const;
export const MEDIA_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const MEDIA_PLATFORMS = [
  'tiktok',
  'facebook',
  'youtube',
  'zalo',
  'instagram',
  'other',
] as const;
export const MEDIA_PERIODS = ['day', 'week', 'month'] as const;
export const MEDIA_IDEA_KINDS = ['video', 'post', 'livestream'] as const;
export const MEDIA_IDEA_STATUSES = [
  'new',
  'approved',
  'used',
  'archived',
] as const;
export const MEDIA_PUBLICATION_STATUSES = ['pending', 'published'] as const;

const LONG = 8000;
const MAX_COUNT = 1_000_000_000;

/** Liên kết tuyển dụng dùng chung: công ty, nhà máy, chiến dịch. */
class MediaLinkDto {
  @IsOptional()
  @IsUUID()
  company_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  factory?: string | null;

  @IsOptional()
  @IsUUID()
  campaign_id?: string | null;
}

// ------------------------------------------------------------ Chiến dịch
export class MediaCampaignDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên chiến dịch không được để trống' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  company_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  factory?: string | null;

  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @IsOptional()
  @IsDateString()
  end_date?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ------------------------------------------------------------ Kế hoạch
export class MediaPlanDto extends MediaLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên kế hoạch không được để trống' })
  @MaxLength(200)
  title!: string;

  @IsIn(MEDIA_PERIODS)
  period_type!: (typeof MEDIA_PERIODS)[number];

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(MEDIA_PLATFORMS, { each: true })
  platforms?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  target_videos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  target_posts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  target_livestreams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  note?: string | null;
}

// ------------------------------------------------------------ Công việc
export class UpdateMediaTaskDto extends MediaLinkDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên nội dung không được để trống' })
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  description?: string | null;

  @IsOptional()
  @IsIn(MEDIA_TASK_TYPES)
  type?: (typeof MEDIA_TASK_TYPES)[number];

  @IsOptional()
  @IsIn(MEDIA_PRIORITIES)
  priority?: (typeof MEDIA_PRIORITIES)[number];

  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsIn(MEDIA_PLATFORMS)
  platform?: string | null;

  @IsOptional()
  @IsUUID()
  plan_id?: string | null;

  @IsOptional()
  @IsUUID()
  idea_id?: string | null;

  @IsOptional()
  @IsUUID()
  assignee_id?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  member_ids?: string[];
}

/** Thêm việc: cùng trường với sửa; service bắt buộc có `title`. */
export class CreateMediaTaskDto extends UpdateMediaTaskDto {}

export class MediaTaskStatusDto {
  @IsIn(MEDIA_TASK_STATUSES)
  status!: (typeof MEDIA_TASK_STATUSES)[number];
}

export class MediaTaskProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progress!: number;
}

export class MediaCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung trao đổi không được để trống' })
  @MaxLength(4000)
  content!: string;
}

export class MediaSubmitDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}

export class MediaReviewDto {
  @IsIn(['approved', 'revision'])
  decision!: 'approved' | 'revision';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}

// ------------------------------------------------------------ Ý tưởng
export class MediaIdeaDto extends MediaLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên ý tưởng không được để trống' })
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsIn(MEDIA_IDEA_KINDS)
  kind?: (typeof MEDIA_IDEA_KINDS)[number];

  @IsOptional()
  @IsIn(MEDIA_IDEA_STATUSES)
  status?: (typeof MEDIA_IDEA_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  hook?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  script?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  dialogue?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  content?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  cta?: string | null;
}

// ------------------------------------------------------------ Lịch xuất bản + số liệu
export class MediaPublicationDto extends MediaLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề bài đăng không được để trống' })
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsUUID()
  task_id?: string | null;

  @IsDateString()
  scheduled_date!: string;

  @IsIn(MEDIA_PLATFORMS)
  platform!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  channel?: string | null;

  @IsOptional()
  @IsUUID()
  publisher_id?: string | null;

  @IsOptional()
  @IsIn(MEDIA_PUBLICATION_STATUSES)
  status?: (typeof MEDIA_PUBLICATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  link?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  note?: string | null;
}

export class MediaMetricsDto {
  @IsOptional() @IsInt() @Min(0) @Max(MAX_COUNT) views?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_COUNT) interactions?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_COUNT) shares?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_COUNT) comments?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_COUNT) inbox?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_COUNT) candidates?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_COUNT) interviews?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_COUNT) hired?: number;
}
