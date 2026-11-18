-- Trang web công ty: tin việc làm, tin tức/album, lịch sử sửa nội dung (2026-11-18)
-- CreateTable
CREATE TABLE "website_jobs" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "company" VARCHAR(200),
    "area" VARCHAR(200),
    "salary" VARCHAR(100),
    "shift" VARCHAR(200),
    "description" VARCHAR(10000),
    "image" VARCHAR(200),
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_posts" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500),
    "body" VARCHAR(50000),
    "cover" VARCHAR(200),
    "images" JSONB NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_text_history" (
    "id" UUID NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "account_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_text_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_jobs_slug_key" ON "website_jobs"("slug");

-- CreateIndex
CREATE INDEX "website_jobs_published_sort_order_idx" ON "website_jobs"("published", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "website_posts_slug_key" ON "website_posts"("slug");

-- CreateIndex
CREATE INDEX "website_posts_kind_published_published_at_idx" ON "website_posts"("kind", "published", "published_at");

-- CreateIndex
CREATE INDEX "website_text_history_created_at_idx" ON "website_text_history"("created_at");

-- CreateIndex
CREATE INDEX "website_text_history_key_idx" ON "website_text_history"("key");
