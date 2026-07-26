-- Yêu cầu trực tiếp người dùng (2026-07-24): "không sử dụng 2 tham số ngưỡng
-- vào cột chăm sóc và số phút nhắc trước giờ hẹn qua zalo nữa rồi nên bỏ đi"
-- + tắt hẳn cả 2 tính năng nghiệp vụ đứng sau (tự động vào Cột chăm sóc,
-- tự nhắc lịch hẹn qua Zalo). Xóa 2 dòng cấu hình còn lại trong DB — không
-- còn code nào đọc/ghi 2 key này nữa (xem system-config.service.ts).
DELETE FROM "system_configs" WHERE "config_key" IN ('CARE_POOL_THRESHOLD_MINUTES', 'NOTIFICATION_LEAD_MINUTES');
