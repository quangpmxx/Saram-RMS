-- Trang web công ty: chữ sửa tại chỗ (2026-11-16)
-- CreateTable
CREATE TABLE "website_texts" (
    "key" VARCHAR(150) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_texts_pkey" PRIMARY KEY ("key")
);
