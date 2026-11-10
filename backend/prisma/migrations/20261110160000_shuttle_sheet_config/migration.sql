-- Đồng bộ Danh sách đưa đón từ Google Sheet (2026-11-10): cấu hình sheet + chìa khoá robot (mã hoá).
CREATE TABLE "shuttle_sheet_config" (
    "id" UUID NOT NULL,
    "spreadsheet_id" VARCHAR(128) NOT NULL,
    "client_email" VARCHAR(255) NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shuttle_sheet_config_pkey" PRIMARY KEY ("id")
);
