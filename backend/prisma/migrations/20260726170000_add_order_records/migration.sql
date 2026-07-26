-- CreateTable
CREATE TABLE "order_records" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "color_key" VARCHAR(20),
    "text_color_key" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_records_pkey" PRIMARY KEY ("id")
);
