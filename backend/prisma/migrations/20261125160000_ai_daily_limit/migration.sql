-- Trợ lý AI: giới hạn số câu hỏi mỗi ngày theo tài khoản + bảng đếm
ALTER TABLE "accounts" ADD COLUMN "ai_daily_limit" INTEGER;

CREATE TABLE "ai_usage_daily" (
    "account_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("account_id","day")
);
