-- CreateTable
CREATE TABLE "shuttle_options" (
    "id" UUID NOT NULL,
    "field" VARCHAR(20) NOT NULL,
    "value" VARCHAR(150) NOT NULL,
    "color_key" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shuttle_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shuttle_options_field_idx" ON "shuttle_options"("field");

-- CreateIndex
CREATE UNIQUE INDEX "shuttle_options_field_value_key" ON "shuttle_options"("field", "value");
