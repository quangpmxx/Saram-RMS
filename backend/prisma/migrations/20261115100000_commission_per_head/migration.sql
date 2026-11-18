-- Hoa hồng công ty (2026-11-15): Sale tính theo đầu lao động, Media / Tuyển dụng / Đưa đón
-- tính theo giờ — mỗi vị trí 1 mức. Mức theo giờ cũ được chép sang cả 3 vị trí.
ALTER TABLE "payroll_commission_rates"
  ADD COLUMN "rate_per_head" DECIMAL(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN "rate_per_hour_media" DECIMAL(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN "rate_per_hour_recruitment" DECIMAL(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN "rate_per_hour_shuttle" DECIMAL(14,0) NOT NULL DEFAULT 0;

UPDATE "payroll_commission_rates"
SET "rate_per_hour_media" = "rate_per_hour",
    "rate_per_hour_recruitment" = "rate_per_hour",
    "rate_per_hour_shuttle" = "rate_per_hour";

ALTER TABLE "payroll_commission_rates" DROP COLUMN "rate_per_hour";

-- Cột "Người tuyển" của DS Media / Tuyển dụng / Đưa đón = người nhập dòng (kể cả dòng cũ).
UPDATE "sales_entry_records"
SET "sale_user_id" = "created_by"
WHERE "kind" IN ('media', 'recruitment', 'shuttle');

-- Công thức Doanh số mẫu: cộng thêm hoa hồng theo đầu lao động của công ty.
UPDATE "payroll_components"
SET "formula" = 'IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_DAU + HOA_HONG_GIO)'
WHERE "formula" = 'IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_GIO)';

UPDATE "payroll_templates"
SET "items" = replace("items"::text,
  'IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_GIO)',
  'IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_DAU + HOA_HONG_GIO)')::jsonb
WHERE "items"::text LIKE '%IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_GIO)%';

UPDATE "payroll_account_settings"
SET "overrides" = replace("overrides"::text,
  'IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_GIO)',
  'IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_DAU + HOA_HONG_GIO)')::jsonb
WHERE "overrides"::text LIKE '%IF(MUC_HOA_HONG > 0, SO_LAO_DONG * MUC_HOA_HONG, HOA_HONG_GIO)%';
