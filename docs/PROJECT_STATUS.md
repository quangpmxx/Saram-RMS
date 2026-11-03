# Trạng thái dự án (cập nhật 2026-11-02)

Nguồn: README, `docs/14-roadmap.md`, `docs/15-tong-ra-soat-2026-10.md`, `git log`, `MODULE_REGISTRY`. Cập nhật khi xong tính năng lớn.

## Module trên sidebar (`frontend/lib/module-registry.ts`)
dashboard · candidates (Data lao động) · marketing-hub · shuttle (Đưa đón) · reports · attendance (Chấm công) · accounting (Kế toán) · sales-entry (Nhập doanh số) · calendar · audit-log · accounts · order-management (+ trang permissions, teams, requests, duplicates, account-settings).

## Tình trạng
- **Hoàn thành & đang dùng:** 10 Phase gốc (tài khoản/nhóm, nhập Data + Excel, chia thủ công/tự động round-robin, ghi chú & trạng thái cuộc gọi, lịch PV/gọi lại, Kho chăm sóc, Dashboard/Báo cáo, Nhật ký, Trùng lặp, phân quyền module), cùng các module mở rộng: Đưa đón, Chấm công/Check-in, Báo cáo ngày + phạt, Nghỉ phép, Nhập doanh số, Quản lý đơn, Sinh nhật, Phản ánh ẩn danh, Thông báo (chuông tách Data / Khác).
- **Marketing Hub (giai đoạn 1, 2026-11-02):** liên kết Facebook Ads bằng access token dán tay (không OAuth), đồng bộ chi tiêu theo ngày (tự động 30 phút/lần + nút Đồng bộ), bảng tài khoản quảng cáo + bộ lọc, gán nhân viên phụ trách. **2026-11-03:** Nguồn MKT (Admin) + bảng Hiệu quả Marketing (số data theo Nguồn MKT gắn TKQC, giá số tô màu theo ngưỡng, trạng thái camp/TK từ Facebook). **Chưa làm:** chi phí/người đi làm toàn công ty trên Dashboard, biểu đồ xu hướng/so sánh kỳ, cảnh báo bất thường, Fanpage, TikTok, OAuth. Chưa kiểm với token Facebook thật.
- **Đã gỡ:** worker Care-pool tự động + màn "Cấu hình vận hành", thông báo Zalo (2026-07-24), một số endpoint chết (xem doc 15).
- **Tổng rà soát 30-10-2026** (nhánh `refactor/tong-ra-soat`, chi tiết trong `docs/15-…`): B1–B3, B5–B8 xong; 577 test backend + 135 e2e đạt (01-11).

## Việc mở / cố ý hoãn
- B4 tách file lớn: làm dần khi lần tới phải sửa đúng module đó.
- M4 thống nhất định dạng ngày: cần user quyết.
- H3 danh sách Kho nạp hết vào bộ nhớ rồi lọc (~230 ms): chỉ tối ưu khi Kho lên hàng chục nghìn lead.
- Chưa đo lại thời gian thực sau B7 (mốc cũ: Dashboard 0,9–1,3 s).
- Marketing Hub chưa có yêu cầu nghiệp vụ.
- Chưa có VPS/triển khai thật; hướng dẫn triển khai ở `docs/15-…` mục 4.
- Chưa xác minh: tình trạng các nhánh `refactor/tong-ra-soat` / worktree `fix-phase3-loi` đã gộp vào `main` hết chưa (kiểm bằng `git branch --no-merged main`).

## Việc gần nhất (git log)
Thẻ "Chờ phân chia (N)" · thông báo Đưa đón tự hết hạn khi sang ngày · chuông thông báo tách Data/Khác · sidebar tô màu mục ở trang con · Marketing Hub khung sườn.
