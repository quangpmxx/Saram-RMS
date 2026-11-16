-- Form trên trang web gửi về CRM (2026-11-16)
ALTER TYPE "notification_type" ADD VALUE 'website_contact';

-- CreateTable
CREATE TABLE "website_contacts" (
    "id" UUID NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "need" VARCHAR(2000),
    "handled_at" TIMESTAMP(3),
    "handled_by" UUID,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_contacts_created_at_idx" ON "website_contacts"("created_at");

-- Nguồn data "Website" cho người lao động đăng ký trên trang web
INSERT INTO "lead_sources" ("id", "name") VALUES (gen_random_uuid(), 'Website') ON CONFLICT ("name") DO NOTHING;
