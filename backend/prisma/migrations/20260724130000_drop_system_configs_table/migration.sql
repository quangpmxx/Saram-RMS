-- Yêu cầu trực tiếp người dùng (2026-07-24): "xoá hẳn module cấu hình vận
-- hành đi nhé" — gỡ bỏ hoàn toàn màn hình "Cấu hình vận hành" (SystemConfig)
-- cùng 2 worker tự động đứng sau nó (CarePoolScannerService, phần nhắc lịch
-- qua Zalo của NotificationScannerService), đã bị tắt ở migration trước
-- (20260724120000). Không còn code nào đọc/ghi bảng này nữa.
DROP TABLE IF EXISTS "system_configs";
