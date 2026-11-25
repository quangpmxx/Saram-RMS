-- Trợ lý AI: trần chi phí mỗi tháng + chi phí ước tính đã dùng
ALTER TABLE "ai_assistant_config" ADD COLUMN "monthly_budget_usd" DOUBLE PRECISION;
ALTER TABLE "ai_assistant_config" ADD COLUMN "cost_month" VARCHAR(7);
ALTER TABLE "ai_assistant_config" ADD COLUMN "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0;
