-- Trợ lý AI: khoá Gemini do Admin liên kết (1 dòng)
CREATE TABLE "ai_assistant_config" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'gemini',
    "model" VARCHAR(100) NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "key_hint" VARCHAR(8) NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_assistant_config_pkey" PRIMARY KEY ("id")
);
