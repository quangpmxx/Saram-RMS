/**
 * UUID hợp lệ nhưng không trùng bản ghi nào — dùng làm điều kiện "không khớp
 * gì" cho cột kiểu uuid (vd tài khoản không thuộc nhóm nào). Trước đây dùng
 * chuỗi '__none__': PostgreSQL thật báo lỗi "invalid input syntax for type
 * uuid" (dev dùng PGlite không bắt lỗi này) — sập Dashboard của NV Đưa đón
 * (2026-11-06).
 */
export const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
