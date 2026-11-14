-- Media (2026-11-14): chỉ THÊM bảng/enum mới + 1 giá trị loại thông báo, không sửa dữ liệu đang có.

-- CreateEnum
CREATE TYPE "media_task_status" AS ENUM ('todo', 'in_progress', 'in_review', 'revision', 'done');

-- CreateEnum
CREATE TYPE "media_priority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'media_task';

-- CreateTable
CREATE TABLE "media_campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "company_id" UUID,
    "factory" VARCHAR(200),
    "start_date" DATE,
    "end_date" DATE,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_plans" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "period_type" VARCHAR(10) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "company_id" UUID,
    "factory" VARCHAR(200),
    "campaign_id" UUID,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_videos" INTEGER NOT NULL DEFAULT 0,
    "target_posts" INTEGER NOT NULL DEFAULT 0,
    "target_livestreams" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_tasks" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL DEFAULT 'video',
    "status" "media_task_status" NOT NULL DEFAULT 'todo',
    "priority" "media_priority" NOT NULL DEFAULT 'normal',
    "deadline" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "platform" VARCHAR(30),
    "plan_id" UUID,
    "campaign_id" UUID,
    "idea_id" UUID,
    "company_id" UUID,
    "factory" VARCHAR(200),
    "assignee_id" UUID,
    "created_by" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_task_members" (
    "task_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,

    CONSTRAINT "media_task_members_pkey" PRIMARY KEY ("task_id","account_id")
);

-- CreateTable
CREATE TABLE "media_task_activities" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_submissions" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "link" VARCHAR(1000),
    "file_path" VARCHAR(255),
    "file_name" VARCHAR(255),
    "note" TEXT,
    "submitted_by" UUID NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "media_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_ideas" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "title_key" VARCHAR(255) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'video',
    "topic" VARCHAR(200),
    "company_id" UUID,
    "factory" VARCHAR(200),
    "campaign_id" UUID,
    "hook" TEXT,
    "script" TEXT,
    "dialogue" TEXT,
    "content" TEXT,
    "cta" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_publications" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "task_id" UUID,
    "campaign_id" UUID,
    "company_id" UUID,
    "factory" VARCHAR(200),
    "scheduled_date" DATE NOT NULL,
    "platform" VARCHAR(30) NOT NULL,
    "channel" VARCHAR(200),
    "publisher_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "link" VARCHAR(1000),
    "published_at" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "inbox" INTEGER NOT NULL DEFAULT 0,
    "candidates" INTEGER NOT NULL DEFAULT 0,
    "interviews" INTEGER NOT NULL DEFAULT 0,
    "hired" INTEGER NOT NULL DEFAULT 0,
    "metrics_source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "metrics_updated_at" TIMESTAMP(3),
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_plans_start_date_idx" ON "media_plans"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX "media_tasks_code_key" ON "media_tasks"("code");

-- CreateIndex
CREATE INDEX "media_tasks_status_idx" ON "media_tasks"("status");

-- CreateIndex
CREATE INDEX "media_tasks_assignee_id_idx" ON "media_tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "media_tasks_deadline_idx" ON "media_tasks"("deadline");

-- CreateIndex
CREATE INDEX "media_task_members_account_id_idx" ON "media_task_members"("account_id");

-- CreateIndex
CREATE INDEX "media_task_activities_task_id_created_at_idx" ON "media_task_activities"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "media_submissions_review_status_idx" ON "media_submissions"("review_status");

-- CreateIndex
CREATE UNIQUE INDEX "media_submissions_task_id_version_key" ON "media_submissions"("task_id", "version");

-- CreateIndex
CREATE INDEX "media_ideas_title_key_idx" ON "media_ideas"("title_key");

-- CreateIndex
CREATE INDEX "media_publications_scheduled_date_idx" ON "media_publications"("scheduled_date");

-- AddForeignKey
ALTER TABLE "media_plans" ADD CONSTRAINT "media_plans_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "media_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tasks" ADD CONSTRAINT "media_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "media_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tasks" ADD CONSTRAINT "media_tasks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "media_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tasks" ADD CONSTRAINT "media_tasks_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "media_ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_task_members" ADD CONSTRAINT "media_task_members_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "media_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_task_activities" ADD CONSTRAINT "media_task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "media_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_submissions" ADD CONSTRAINT "media_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "media_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_ideas" ADD CONSTRAINT "media_ideas_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "media_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_publications" ADD CONSTRAINT "media_publications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "media_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_publications" ADD CONSTRAINT "media_publications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "media_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

