-- Lịch sử chat Trợ lý AI (Admin xem ai hỏi gì, mỗi ngày bao nhiêu lượt)
CREATE TABLE "ai_chat_logs" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "via_voice" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_chat_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_chat_logs_account_id_created_at_idx" ON "ai_chat_logs"("account_id", "created_at");
CREATE INDEX "ai_chat_logs_created_at_idx" ON "ai_chat_logs"("created_at");
