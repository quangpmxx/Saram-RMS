# Trạng thái dự án (cập nhật 2026-11-02)

Nguồn: README, `docs/14-roadmap.md`, `docs/15-tong-ra-soat-2026-10.md`, `git log`, `MODULE_REGISTRY`. Cập nhật khi xong tính năng lớn.

## Module trên sidebar (`frontend/lib/module-registry.ts`)
dashboard · candidates (Data lao động) · recruitment-schedule (Lịch tuyển dụng) · marketing-hub · media · shuttle (Đưa đón) · reports · attendance (Chấm công) · accounting (Kế toán) · sales-entry (Nhập DS/Thưởng: tab Nhập doanh số → DS Sale, DS Media, DS Tuyển dụng, DS Đưa đón — 4 tab dùng chung bảng `sales_entry_records` phân biệt bằng cột `kind`, 3 tab sau có bộ cột theo file Excel mẫu: Tình trạng, Người tuyển, Check, Tổng công, Tổng giờ; tab Nhập thưởng = một danh sách thưởng dùng chung (`kind = bonus`: ID, Tên, Công ty, Ngày vào, Số tiền, STK, Tên TK, Ngân hàng, Người giới thiệu, Sale, Ghi chú, Ngày chi) để Kế toán chi, có dòng Tổng tiền và lọc Chưa chi/Đã chi) · calendar · audit-log · accounts · order-management (+ trang permissions, teams, requests, duplicates, account-settings).

## Tình trạng
- **Hoàn thành & đang dùng:** 10 Phase gốc (tài khoản/nhóm, nhập Data + Excel, chia thủ công/tự động round-robin, ghi chú & trạng thái cuộc gọi, lịch PV/gọi lại, Kho chăm sóc, Dashboard/Báo cáo, Nhật ký, Trùng lặp, phân quyền module + quyền chi tiết từng người), cùng các module mở rộng: Đưa đón, Chấm công/Check-in, Báo cáo ngày + phạt, Nghỉ phép, Nhập doanh số, Tiền lương (Kế toán), Quản lý đơn, Sinh nhật, Phản ánh ẩn danh, Thông báo (chuông tách Data / Khác).
- **Marketing Hub (giai đoạn 1, 2026-11-02):** liên kết Facebook Ads bằng access token dán tay (không OAuth), đồng bộ chi tiêu theo ngày (tự động 30 phút/lần + nút Đồng bộ), bảng tài khoản quảng cáo + bộ lọc, gán nhân viên phụ trách. **2026-11-03:** Nguồn MKT (Admin) + bảng Hiệu quả Marketing (số data theo Nguồn MKT gắn TKQC, giá số tô màu theo ngưỡng, trạng thái camp/TK từ Facebook). **Chưa làm:** chi phí/người đi làm toàn công ty trên Dashboard, biểu đồ xu hướng/so sánh kỳ, cảnh báo bất thường, Fanpage, TikTok, OAuth. Chưa kiểm với token Facebook thật.
- **Data lao động — dòng "Công ty" (2026-11-11):** trang Chi tiết có ô chọn Công ty (sau "Đánh dấu màu"), tên + màu lấy từ Quản lý đơn hàng (`leads.company_id` → `order_records`, migration `20261111180000`); danh sách hiện nhãn công ty ở cột Note và có ô lọc "Công ty" (tab Tất cả/Cá nhân). API: `GET /candidate/company-options`, `PUT /candidate/:id/company`. Kho chăm sóc chưa hiện nhãn này.
- **Lịch tuyển dụng (2026-11-11):** thay sheet "Lịch tuyển dụng" — thẻ tuyển dụng từng công ty (chính thức/thời vụ), lọc theo lao động đang tư vấn (giới tính, năm sinh, nhãn nhanh), "tờ tư vấn" + sao chép tin Zalo. Dữ liệu sheet (94 thẻ, dòng ẩn = Tạm dừng) nhập sẵn bằng migration `20261111120100`. Chưa làm: thông báo cho Sale khi lịch đổi, nút "Công ty phù hợp" từ hồ sơ lao động.
- **Media (2026-11-14, nhánh `module-media`):** kế hoạch/chiến dịch, giao việc + Kanban, nộp/duyệt nhiều phiên bản, kho ý tưởng chống trùng, lịch xuất bản theo tháng, báo cáo phễu xem → nhận việc (nhập tay). Migration `20261114100000_media`. Chưa làm: lấy số liệu tự động từ API TikTok/Facebook, nối nguồn ứng viên trong Data lao động với Media ID.
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
