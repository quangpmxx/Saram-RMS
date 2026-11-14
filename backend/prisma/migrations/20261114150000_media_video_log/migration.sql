-- Sổ video (2026-11-14): chỉ THÊM cột/bảng mới cho Media, không sửa dữ liệu đang có.
-- AlterTable
ALTER TABLE "media_tasks" ADD COLUMN     "content_group_id" UUID,
ADD COLUMN     "done_link" VARCHAR(1000),
ADD COLUMN     "editor_id" UUID,
ADD COLUMN     "raw_link" VARCHAR(1000),
ADD COLUMN     "work_date" DATE;

-- AlterTable
ALTER TABLE "media_publications" ADD COLUMN     "channel_id" UUID;

-- CreateTable
CREATE TABLE "media_content_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color_key" VARCHAR(20),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_content_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_channels" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "platform" VARCHAR(30) NOT NULL DEFAULT 'tiktok',
    "url" VARCHAR(1000),
    "owner_id" UUID,
    "color_key" VARCHAR(20),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_content_groups_name_key" ON "media_content_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "media_channels_name_key" ON "media_channels"("name");

-- CreateIndex
CREATE INDEX "media_tasks_editor_id_idx" ON "media_tasks"("editor_id");

-- CreateIndex
CREATE INDEX "media_tasks_work_date_idx" ON "media_tasks"("work_date");

-- CreateIndex
CREATE INDEX "media_publications_task_id_idx" ON "media_publications"("task_id");

-- CreateIndex
CREATE INDEX "media_publications_channel_id_idx" ON "media_publications"("channel_id");

-- AddForeignKey
ALTER TABLE "media_tasks" ADD CONSTRAINT "media_tasks_content_group_id_fkey" FOREIGN KEY ("content_group_id") REFERENCES "media_content_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_publications" ADD CONSTRAINT "media_publications_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "media_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

