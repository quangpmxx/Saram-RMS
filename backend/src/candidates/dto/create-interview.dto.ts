import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Mục 6, docs/13-api-design.md — POST /candidate/:id/interview (body). */
export class CreateInterviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  partner_company_name: string;

  @IsDateString()
  scheduled_at: string;
}
