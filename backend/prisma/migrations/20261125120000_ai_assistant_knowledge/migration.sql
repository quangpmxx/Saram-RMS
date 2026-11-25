-- Trợ lý AI: tên, "trợ lý là ai", sổ tay công ty; khoá được để trống (gỡ khoá vẫn giữ sổ tay)
ALTER TABLE "ai_assistant_config" ALTER COLUMN "encrypted_key" DROP NOT NULL;
ALTER TABLE "ai_assistant_config" ALTER COLUMN "key_hint" DROP NOT NULL;
ALTER TABLE "ai_assistant_config" ADD COLUMN "assistant_name" VARCHAR(60) NOT NULL DEFAULT 'Trợ lý Đại Việt';
ALTER TABLE "ai_assistant_config" ADD COLUMN "persona" TEXT;
ALTER TABLE "ai_assistant_config" ADD COLUMN "knowledge" TEXT;
