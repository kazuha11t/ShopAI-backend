# ShopAI Backend

[![Backend CI](https://github.com/kazuha11t/ShopAI-backend/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/kazuha11t/ShopAI-backend/actions/workflows/ci.yml)

API NestJS cho ứng dụng [ShopAI Mobile](https://github.com/kazuha11t/ShopAI).
Dữ liệu lưu bằng Prisma và SQLite; AI được gọi từ server để giữ key khỏi ứng dụng mobile.

## Chức năng

- Đăng ký/đăng nhập, băm mật khẩu bằng scrypt, cấp và kiểm tra JWT.
- Danh mục sản phẩm, phân trang và kiểm tra quyền quản trị khi ghi sản phẩm.
- Báo giá và tạo đơn theo giá/tồn kho phía server; gửi lại cùng request ID không tạo đơn trùng.
- Đơn hàng theo tài khoản, thanh toán giả lập PENDING → PAID và lưu bền trong SQLite.
- AI chat qua Gemini, giới hạn tần suất request và kiểm tra dữ liệu đầu vào.
- Swagger, migration, seed mẫu, unit test và HTTP integration test.

## Khởi động trên máy mới

Cần Node.js 22 (từ 22.13) hoặc 24 (từ 24.3), npm. Các lệnh dưới đây dùng PowerShell.

```powershell
git clone https://github.com/kazuha11t/ShopAI-backend.git shopai-backend
cd shopai-backend
Copy-Item .env.example .env
```

Sửa `.env` trên máy của bạn:

| Biến | Ý nghĩa |
| --- | --- |
| `DATABASE_URL` | Mặc định `file:./prisma/dev.db` |
| `JWT_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 ký tự, bắt buộc khi chạy server |
| `GEMINI_API_KEY` | Key Gemini riêng; để trống thì AI trả lỗi chưa cấu hình |
| `GEMINI_MODEL` | Model dùng cho AI; giá trị mẫu có trong `.env.example` |
| `ADMIN_API_KEY` | Key cho các thao tác quản trị sản phẩm |
| `SEED_DEMO` | `true` khi muốn tạo tài khoản demo trên môi trường học tập |
| `PORT` | Mặc định `3000` |

Có thể tạo chuỗi ngẫu nhiên cho `JWT_SECRET` và `ADMIN_API_KEY` bằng:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Sau khi cấu hình:

```powershell
npm ci
npm run db:deploy
$env:SEED_DEMO = 'true'
npm run db:seed
npm run start:dev
```

Seed tạo 20 sản phẩm và tài khoản `demo@shopai.com` / `123456`.
Không ghi đè tài khoản/tồn kho đã có. Dữ liệu demo và thanh toán giả lập phục vụ đồ án.

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- Trên Android USB: chạy `adb reverse tcp:3000 tcp:3000` ở máy tính.

Các API đơn hàng và AI yêu cầu header `Authorization: Bearer <accessToken>`
nhận từ `POST /api/auth/login`. Thao tác quản trị sản phẩm dùng `X-Admin-Key`.

## Build và kiểm thử

```powershell
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
npm run start:prod
```

Đã kiểm chứng local: 7 suites / 15 tests đạt. HTTP integration test dùng database
SQLite tạm độc lập, không sửa database phát triển; AI được mock để không gọi dịch vụ trả phí.

[GitHub Actions](.github/workflows/ci.yml) chạy cài dependencies, migration,
typecheck, lint, test và build trên mỗi push/pull request. Workflow dùng cấu hình
CI riêng, không cần Gemini key hay database cá nhân.

## Cấu trúc

- `src/auth`: tài khoản, JWT và guard.
- `src/products`: danh mục và phân trang.
- `src/orders`: báo giá, tạo đơn, quyền sở hữu và trạng thái thanh toán.
- `src/ai`: proxy Gemini và lịch sử chat.
- `src/prisma`: kết nối database.
- `prisma/migrations`: SQL migration để tái tạo cấu trúc database.
- `prisma/seed.ts`, `prisma/products.seed.json`: dữ liệu mẫu.
- `test/commerce.spec.ts`: luồng nghiệp vụ qua HTTP và SQLite thật.

## Dữ liệu và cấu hình riêng

Git lưu mã nguồn, migration và `.env.example`. `.env`, Gemini key, JWT secret,
database đang dùng, thư mục generated/build và `node_modules` được Git ignore.
Mỗi máy clone phải cấu hình `.env` rồi chạy migration/seed.

Push lên GitHub chỉ chia sẻ mã nguồn. Để điện thoại dùng API không cần laptop/USB,
cần triển khai backend lên server HTTPS và đổi API URL trong mobile.
