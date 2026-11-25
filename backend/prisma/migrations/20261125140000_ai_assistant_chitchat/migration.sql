-- Trợ lý AI: công tắc cho trò chuyện ngoài lề (mặc định tắt)
ALTER TABLE "ai_assistant_config" ADD COLUMN "allow_chitchat" BOOLEAN NOT NULL DEFAULT false;
