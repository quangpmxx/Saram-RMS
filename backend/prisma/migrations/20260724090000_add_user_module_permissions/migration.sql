-- CreateEnum
CREATE TYPE "module_permission_level" AS ENUM ('none', 'view', 'edit');

-- CreateTable
CREATE TABLE "user_module_permissions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "permission" "module_permission_level" NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_module_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_module_permissions_account_id_module_key" ON "user_module_permissions"("account_id", "module");

-- AddForeignKey
ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
