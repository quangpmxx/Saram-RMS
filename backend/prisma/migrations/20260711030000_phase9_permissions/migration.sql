-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_permissions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "is_granted" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "account_permissions_account_id_permission_id_key" ON "account_permissions"("account_id", "permission_id");

-- AddForeignKey
ALTER TABLE "account_permissions" ADD CONSTRAINT "account_permissions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_permissions" ADD CONSTRAINT "account_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_permissions" ADD CONSTRAINT "account_permissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
