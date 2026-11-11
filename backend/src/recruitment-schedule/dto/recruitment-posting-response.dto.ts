import type { Prisma } from '../../../generated/prisma/client';

export const RECRUITMENT_POSTING_INCLUDE = {
  updatedBy: { select: { fullName: true } },
  team: { select: { name: true } },
} satisfies Prisma.RecruitmentPostingInclude;

type PostingWithRelations = Prisma.RecruitmentPostingGetPayload<{
  include: typeof RECRUITMENT_POSTING_INCLUDE;
}>;

export interface RecruitmentPostingResponseDto {
  id: string;
  company_name: string;
  team_id: string | null;
  team_name: string | null;
  order_record_id: string | null;
  kind: string;
  status: string;
  area: string | null;
  accept_male: boolean;
  accept_female: boolean;
  age_min: number | null;
  age_max: number | null;
  requirement: string | null;
  base_salary: number | null;
  allowance: number | null;
  salary_note: string | null;
  bonus_summary: string | null;
  bonus: string | null;
  tags: string[];
  interview_slot: string | null;
  work: string | null;
  documents: string | null;
  housing: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  zalo_message: string | null;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export function toRecruitmentPostingResponse(
  p: PostingWithRelations,
): RecruitmentPostingResponseDto {
  return {
    id: p.id,
    company_name: p.companyName,
    team_id: p.teamId,
    team_name: p.team?.name ?? null,
    order_record_id: p.orderRecordId,
    kind: p.kind,
    status: p.status,
    area: p.area,
    accept_male: p.acceptMale,
    accept_female: p.acceptFemale,
    age_min: p.ageMin,
    age_max: p.ageMax,
    requirement: p.requirement,
    base_salary: p.baseSalary,
    allowance: p.allowance,
    salary_note: p.salaryNote,
    bonus_summary: p.bonusSummary,
    bonus: p.bonus,
    tags: p.tags,
    interview_slot: p.interviewSlot,
    work: p.work,
    documents: p.documents,
    housing: p.housing,
    pros: p.pros,
    cons: p.cons,
    notes: p.notes,
    zalo_message: p.zaloMessage,
    updated_by_name: p.updatedBy.fullName,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}
