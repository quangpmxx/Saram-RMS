# Bản đồ kiến trúc

Chi tiết sâu: `10-system-design.md`, `11-database-design.md`, `13-api-design.md`, `12-ui-design.md`.

## Tổng quan
```
Trình duyệt ─► frontend (Next.js, :3000) ─► /api proxy ─► backend (NestJS, :3001) ─► Prisma ─► PostgreSQL
                    └──── socket.io-client ◄──── RealtimeGateway (backend/src/realtime) ────┘
```
- Frontend: `app/` (route; nhóm `(dashboard)/<module>/` cho từng màn), `components/`, `lib/` (api-client, api-server, session, quyền, hằng số, `types.ts`). `proxy.ts` = middleware Next.
- Backend: `src/<module>/` mỗi module gồm `*.controller.ts` → `*.service.ts` → `PrismaService`; DTO trong `dto/`; spec cạnh file. Controller prefix route khớp tên (vd `@Controller('shuttle')`; candidates dùng `candidate`, sales-entry dùng `sales-entry/ds-sale`).
- Database: `backend/prisma/schema.prisma` (+ `prisma/migrations`); client sinh ra ở `backend/generated/prisma` (import từ `../../generated/prisma/client`).

## Tìm code theo yêu cầu
1. Màn hình → `frontend/app/(dashboard)/<module>/`. 2. Gọi API nào → grep đường dẫn trong `frontend/` hoặc `lib/*-api.ts`. 3. Route → `backend/src/<module>/*.controller.ts` → service cùng thư mục. 4. Bảng/enum → grep `model X` trong `schema.prisma`. 5. Quyền → xem mục dưới.

## Backend theo domain
- **Data/Lead:** `candidates` (CRUD, ghi chú, lịch PV/gọi lại), `imports` (Excel, `ImportJob`), `distribution` (round-robin), `catalog` (nguồn, trạng thái), `calendar`, `sale-reminder`.
- **Kho chăm sóc:** `care-warehouse` (service, `care-metrics.ts`, `care-time.util.ts` — mốc ngày/tháng giờ VN), báo cáo tiến độ `care-progress`.
- **Lịch tuyển dụng:** `recruitment-schedule` (bảng `recruitment_postings`; màn `frontend/app/(dashboard)/recruitment-schedule/` — logic lọc/tin Zalo ở `recruitment-shared.ts`).
- **Số liệu:** `dashboard`, `daily-reports`, `report-penalty`, `sales-entry`, `order-management`, `payroll` (Tiền lương — trang `/accounting` + `/payslip`).
- **Nhân sự:** `accounts`, `teams`, `attendance`, `checkin`, `leave-requests`, `leave-accrual`, `birthday`, `anonymous-feedback`.
- **Media:** `media` (1 controller/service; bảng `media_*`, enum `media_task_status`, `media_priority`; quyền nhỏ `media.*`; trang `frontend/app/(dashboard)/media/` — mỗi tab 1 file `media-*.tsx`, kiểu + nhãn ở `media-shared.tsx`).
- **Marketing:** `marketing-hub` (client Graph API `facebook-ads.client.ts`, mã hoá token `token-crypto.ts`, bảng `ad_accounts`, `ad_spend_daily`); `pancake` (client `pancake.client.ts`, đọc 10 giây/lần `PancakeService.pollAll`, up qua `CandidatesService.create`; bảng `pancake_pages`, `pancake_conversations`, `pancake_auto_up_config`, `pancake_auto_up_teams`; `PancakeController` thuộc module quyền marketing-hub, `PancakeAutoUpController` thuộc candidates).
- **Khác:** `shuttle` (Đưa đón), `notification`, `audit-log`, `module-permission`, `realtime`, `auth`, `common`, `prisma`.

## Cơ chế dùng chung
- **Xác thực:** JWT trong cookie (`auth/`, `auth-cookie.util.ts`); guard toàn cục `jwt-auth.guard`, `roles.guard`, `password-change.guard` (tài khoản dùng mật khẩu mặc định bị chặn tới khi đổi ở `/doi-mat-khau`); `@Public()`, `@Roles()`, `@CurrentUser()` ở `common/decorators`. Giới hạn đăng nhập sai: `auth/login-attempt-limiter.ts` (trong bộ nhớ).
- **Vai trò** (enum `AccountRole`): admin, manager, leader, mkt, sale, sup_leader, accounting, order_staff, shuttle_staff, media_staff (NV Media), recruitment_staff (NV Tuyển dụng). Nhãn: `common/constants/role-label.ts`. Lấy nhóm: `common/utils/account-team.util.ts` (`findOwnTeamId`).
- **Phân quyền module:** `backend/src/module-permission/module-registry.ts` **và** `frontend/lib/module-registry.ts` phải khớp nhau (không import chung được) — sửa một bên nhớ sửa bên kia. Frontend gate trang bằng `lib/module-permission.ts#requirePageAccess`. Quyền theo Data ở frontend: `lib/lead-permissions.ts` (một nơi duy nhất).
- **Phân quyền chi tiết (quyền nhỏ):** danh mục duy nhất `backend/src/common/permissions/capability-catalog.ts` (`can(user, code)`, thuần, không DI). Quyền chỉnh riêng lưu bảng `user_capabilities`, nạp vào `request.user.capabilityOverrides` ở `jwt.strategy.ts` (hiệu lực ngay request sau). Route: `@RequireCap(code)` + `CapabilityGuard`; route dùng chung trang khác: `@AllowWithoutModule()`. API: `GET /module-permission/capabilities`, `PUT /module-permission/:id` nhận thêm `capabilities`. `GET /me` trả `capabilities` (mã hiệu lực) → frontend `lib/capabilities.ts#hasCap` (server) / `lib/capability-context.tsx#useCan` (client). Thêm quyền mới: thêm vào catalog rồi dùng `can()` ở service — frontend tự lấy danh mục.
- **Realtime:** `RealtimeService` phát sự kiện, `RealtimeGateway` giữ socket; tự ngắt khi tài khoản bị khoá/đổi nhóm. Frontend: `lib/realtime.ts`.
- **Lỗi:** `common/filters/http-exception.filter.ts`; mã lỗi `common/utils/error-code.util.ts`; frontend `lib/api-error.ts`.
- **Giờ VN:** dùng `care-warehouse/care-time.util.ts` (`vnDateOnly`, `vnDayRange`…) thay vì tự tính.
- **Upload:** `backend/uploads` (công khai), `backend/private-uploads` (riêng tư) — nằm ngoài DB.

## Test
Backend: jest (`*.spec.ts` cạnh code) + e2e ở `backend/test/*.e2e-spec.ts`. Frontend: chưa thấy test; kiểm bằng `tsc` + `lint`.
