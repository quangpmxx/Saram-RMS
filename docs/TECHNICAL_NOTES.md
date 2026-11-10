# Ghi chú kỹ thuật (chỉ những điều dễ vấp)

## Chạy dev & DB
- DB dev dùng `npx prisma dev` (cổng ngẫu nhiên, đặt vào `DATABASE_URL`; đặt `DATABASE_POOL_MAX` riêng cho nó) hoặc Docker (`docker-compose.yml`). Production: xoá `DATABASE_POOL_MAX`.
- DB dev `default` thỉnh thoảng treo (cổng LISTEN nhưng ECONNRESET → `/login` trả 500). Cách xử lý đã thấy hiệu quả: `npx prisma dev stop default`, rồi chạy `npx prisma dev start default` ở chế độ nền **không bọc `timeout`**; kiểm tra `POST /login` sai mật khẩu phải ra 401 chứ không 500.
- `prisma dev` tạm có thể chiếm cổng 3001 của backend; đừng tạo DB tạm khi user đang khởi động server; xong thì dọn và kiểm tra lại login.

## Prisma / dist cũ
- Sau `prisma generate` (thêm enum/field), `nest start --watch` của user có thể **không** phát lại `dist/generated/prisma/internal/class.js` → giá trị enum mới bị từ chối lúc chạy (lỗi hay bị nuốt bởi try/catch). Cách xử lý: biên dịch bản mới ra thư mục scratchpad (`tsc -p tsconfig.build.json --outDir …`), so với `backend/dist/generated`, chép file lệch sang, đổi nội dung thật một file `src` để watch restart rồi hoàn lại. Không chạy `nest build` khi dev đang chạy.
- Migration ở server: `prisma migrate deploy`, không dùng `migrate dev`.

## Test
- jest mock provider ⇒ **lỗi DI/vòng import chỉ lộ khi boot thật**. Ví dụ ShuttleService ← ModulePermissionService từng sập boot do vòng import qua module-registry; sửa bằng `@Inject(forwardRef(...))`. Quy trình: build vào scratchpad, `PORT=3105 node <out>/src/main.js`, đợi "successfully started".
- E2E: đặt `DEFAULT_PASSWORD` khác `123456` (vd `E2e-Not-Default-9`) và dùng **DB sạch mỗi lần chạy** (không chạy lại được trên DB đã dùng). Hàm dựng app e2e tự báo lỗi nếu mật khẩu mặc định là `123456`.
- Trạng thái cuối (01-11): 577 jest + 135 e2e đạt. `npx tsc --noEmit` backend có 3 lỗi `Buffer` cũ trong `attendance.service.spec.ts` / `test/phase6.e2e-spec.ts`.

## Ràng buộc đặc biệt
- Hai `module-registry.ts` (backend và frontend) phải đồng bộ thủ công.
- Giới hạn đăng nhập sai nằm trong bộ nhớ ⇒ chỉ chạy **1 bản backend**; `trust proxy = 1` ⇒ reverse proxy phải đứng ngay trước backend và gửi `X-Forwarded-For`.
- `NODE_ENV=production` bắt buộc ở server (chặn endpoint seed/demo).
- Hiệu năng Kho/Báo cáo tiến độ: tránh tạo `Intl.DateTimeFormat` trong vòng lặp (đã được tạo 1 lần ở `care-time.util.ts`; từng chiếm ~75% CPU).
- Dashboard hiệu suất/xếp hạng: gom query theo danh sách Sale, không quay lại N+1.
- Sao lưu cần cả `pg_dump` lẫn thư mục `uploads`, `private-uploads`.
- Thông báo đẩy ra điện thoại (Web Push, 2026-11-06): mọi thông báo trong chuông đi qua `RealtimeService.emitNotificationCreated` → `PushService.notify` (chạy nền, lỗi chỉ log; máy báo 404/410 tự xoá khỏi `push_subscriptions`). Khoá `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` trong `backend/.env` (thiếu = tắt tính năng); dev và server dùng **cặp khoá riêng**, đổi khoá thì mọi máy phải bật lại. Chữ + trang mở: `backend/src/push/push-message.ts` phải khớp `notification-bell.tsx`. Service worker: `frontend/public/sw.js`. iPhone chỉ nhận khi đã "Thêm vào MH chính" (iOS ≥ 16.4).
- DB dev (PGlite) chấp nhận dữ liệu sai kiểu mà Postgres thật từ chối (vd chuỗi '__none__' cho cột uuid → dùng `NO_MATCH_UUID`): lỗi chỉ ở server thì xem `pm2 logs saram-frontend|saram-backend --err --lines 40 --nostream`. Không truy vấn thẳng DB dev bằng client `pg` khi server đang chạy (làm kẹt DB).
- Ghi nhớ bộ lọc khi rời trang rồi quay lại (2026-11-10): trang mới có bộ lọc dùng `useRememberedFilters(key, filters, onRestore)` ở `frontend/lib/remembered-filters.ts` (sessionStorage, mốc ngày dạng preset tự tính lại, xoá khi đăng nhập). Data lao động và Kho chăm sóc dùng cơ chế riêng có sẵn (lưu lúc mở Chi tiết). Vị trí cuộn: `lib/navigation-history.ts`.

## Quy ước Git của user
Nhánh riêng mỗi tính năng; làm hết các việc đang giao rồi mới gộp `main` và push một lần; không PR; `gh` không cài trên máy. Đợt rà soát tổng thể: hỏi trước khi commit/push.

## Tài liệu mâu thuẫn code (cần dọn khi tiện)
- `README.md` còn mô tả Care-pool/Zalo (đã gỡ 2026-07-24) và chưa nhắc các module mới (Đưa đón, Chấm công…).
- `docs/09` mục 10.10 nói thông báo qua Zalo/không có chuông; thực tế đã gỡ Zalo và có chuông trong app.
- `docs/09` mục 10.1 (Care-pool 30 phút tự động) đã cũ so với code.
- `docs.zip` ở gốc repo: chưa rõ còn cần không.
