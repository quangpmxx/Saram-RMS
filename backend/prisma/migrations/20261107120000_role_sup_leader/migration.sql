-- Vai trò mới "Sup Leader" (yêu cầu người dùng 2026-11-07): làm việc như Sale.
ALTER TYPE "account_role" ADD VALUE IF NOT EXISTS 'sup_leader';
