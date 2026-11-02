# Saram RMS — quy tắc làm việc cho Claude

CRM tuyển dụng / cung ứng lao động (1 văn phòng). Backend NestJS 11 + Prisma + PostgreSQL (`backend/`), frontend Next.js 16 / React 19 (`frontend/`). Ngôn ngữ giao diện, comment, commit: **tiếng Việt**.

> `frontend/` dùng Next.js bản mới có breaking changes: trước khi viết code Next, đọc hướng dẫn liên quan trong `frontend/node_modules/next/dist/docs/` (xem `frontend/AGENTS.md`).

## Tài liệu — chỉ đọc phần cần
| File | Dùng khi |
|---|---|
| `docs/PROJECT_STATUS.md` | Biết module nào xong/đang mở, việc tiếp theo |
| `docs/ARCHITECTURE.md` | Tìm file/API/schema liên quan một yêu cầu |
| `docs/BUSINESS_RULES.md` | Trước khi đụng vai trò, quyền, Data, Kho chăm sóc, báo cáo |
| `docs/TECHNICAL_NOTES.md` | Trước khi sửa phần dùng chung / chạy dev, test, DB |
| `docs/09…15-*.md` | Đặc tả gốc (Design Freeze). Chi tiết hơn nhưng có chỗ đã cũ — nếu mâu thuẫn với code hoặc `BUSINESS_RULES.md`, tin code rồi báo lại |

## Lệnh đã xác minh (từ package.json)
- Backend (`cd backend`): `npm run start:dev`, `npm run build`, `npm test` (jest), `npm run test:e2e`, `npm run lint` (có `--fix`, sẽ sửa file), `npm run prisma:generate`, `npm run prisma:migrate` (dev), `npm run prisma:deploy` (server), `npm run seed`.
- Frontend (`cd frontend`): `npm run dev`, `npm run build`, `npm run lint`; kiểm kiểu: `npx tsc --noEmit`.
- Kiểm kiểu backend: `npx tsc --noEmit` (đang có 3 lỗi `Buffer` cũ ở spec, không tính).
- Cổng mặc định: backend 3001, frontend 3000.

## Quy trình mỗi yêu cầu
1. Xác định module + hành vi cần đổi → đọc đúng mục trong docs ở trên.
2. `Grep` tên route/hàm/component/từ khoá trước, rồi `Read` đúng đoạn (offset/limit). Không đọc cả file lớn, không quét cả dự án cho lỗi nhỏ.
3. Mở rộng phạm vi chỉ khi có bằng chứng. Sửa nhỏ nhất đủ dùng; không refactor, không thêm abstraction, không "làm đẹp" ngoài yêu cầu.
4. Không triển khai lại thứ đã có; kiểm tra code hiện tại (và `git log`) trước. Kết quả cũ chỉ tái dùng nếu code chưa đổi.
5. Không gộp sửa lỗi + refactor + tối ưu vào một lần.
6. Không tạo thêm file tài liệu trùng nội dung; cập nhật file có sẵn.

## Kiểm thử vừa đủ
- Chạy test/lint/tsc **của phần bị ảnh hưởng**; chạy toàn bộ chỉ khi đổi phần dùng chung, schema, phân quyền, hoặc trước mốc phát hành.
- Thêm service dependency mới ở backend → phải **boot thử app thật** (jest mock DI nên không bắt được lỗi DI/vòng import). Xem `TECHNICAL_NOTES.md`.
- Không nói "đã test" nếu chưa chạy. Không bỏ kiểm tra quyền/transaction/dữ liệu để tiết kiệm token.

## Không tự ý làm
- Đổi nghiệp vụ, quyền, schema/migration, xoá dữ liệu khi chưa được user duyệt; nghiệp vụ chưa rõ thì hỏi.
- `git commit/push` khi chưa có OK (đợt rà soát) — mặc định: mỗi tính năng **một nhánh riêng** (kiểm `git branch --show-current` trước khi commit); user đã duyệt gộp thì tự `merge --ff-only` vào `main` + push, không PR, không bắt user chạy lệnh git.
- `nest build` khi user đang chạy dev (ghi đè `dist`); tạo DB tạm trong lúc user đang khởi động server.
- Ghi mật khẩu, token, `.env`, dữ liệu cá nhân vào code hay docs.

## Báo cáo ngắn
Chỉ nêu: đã làm gì · file chính đổi · kết quả kiểm thử (thật) · vấn đề còn lại · việc cần user xác nhận. Không dán lại code/diff dài. User không phải dân code: nói bằng ngôn ngữ thường.

## Cập nhật docs
Sau tính năng lớn / đổi kiến trúc / đổi nghiệp vụ: chỉ sửa mục bị ảnh hưởng, xoá ghi chú lỗi thời. Đổi giao diện nhỏ thì không cần.
