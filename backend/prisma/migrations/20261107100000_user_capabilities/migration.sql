-- Phân quyền chi tiết (yêu cầu người dùng 2026-11-07): quyền nhỏ chỉnh riêng từng tài khoản.
-- CreateTable
CREATE TABLE "user_capabilities" (
    "account_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_capabilities_pkey" PRIMARY KEY ("account_id","code")
);

-- AddForeignKey
ALTER TABLE "user_capabilities" ADD CONSTRAINT "user_capabilities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_capabilities" ADD CONSTRAINT "user_capabilities_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
