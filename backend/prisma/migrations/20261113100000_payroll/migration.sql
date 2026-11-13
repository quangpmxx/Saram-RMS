-- Tiền lương (2026-11-13): chỉ THÊM 6 bảng mới, không sửa/xoá dữ liệu đang có.
CREATE TABLE "payroll_components" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "nature" VARCHAR(20) NOT NULL DEFAULT 'income',
    "formula" TEXT,
    "show_on_payslip" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_components_code_key" ON "payroll_components"("code");

CREATE TABLE "payroll_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "roles" TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "items" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_account_settings" (
    "account_id" UUID NOT NULL,
    "base_salary" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "commission_rate" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "template_id" UUID,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_account_settings_pkey" PRIMARY KEY ("account_id")
);

CREATE TABLE "payroll_commission_rates" (
    "company_id" UUID NOT NULL,
    "rate_per_hour" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_commission_rates_pkey" PRIMARY KEY ("company_id")
);

CREATE TABLE "payrolls" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" SMALLINT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "locked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payrolls_year_month_key" ON "payrolls"("year", "month");

CREATE TABLE "payroll_slips" (
    "id" UUID NOT NULL,
    "payroll_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "template_name" VARCHAR(150),
    "other_income" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "other_deduction" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "advance" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "note" VARCHAR(500),
    "inputs" JSONB NOT NULL DEFAULT '{}',
    "lines" JSONB NOT NULL DEFAULT '[]',
    "net_pay" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "confirm_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "question" VARCHAR(1000),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_slips_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payroll_slips_payroll_id_account_id_key" ON "payroll_slips"("payroll_id", "account_id");
CREATE INDEX "payroll_slips_account_id_idx" ON "payroll_slips"("account_id");

ALTER TABLE "payroll_account_settings" ADD CONSTRAINT "payroll_account_settings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_commission_rates" ADD CONSTRAINT "payroll_commission_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "order_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
