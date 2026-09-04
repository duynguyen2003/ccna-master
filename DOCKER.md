# Chạy CCNA Master bằng Docker

## Yêu cầu

- Docker Desktop đang chạy.
- Các giá trị bí mật đã được cấu hình trong file `.env` ở thư mục project.

Compose sẽ chạy ba container: React/Nginx, Express/Prisma và PostgreSQL. Chỉ
frontend được mở ra máy host ở cổng `3000`; Nginx tự chuyển tiếp `/api` và
`/uploads` tới backend.

## Khởi động

```bash
docker compose up --build -d
```

Mở <http://localhost:3000>. Xem trạng thái và log bằng:

```bash
docker compose ps
docker compose logs -f
```

Khi backend khởi động, `prisma db push` sẽ tạo hoặc đồng bộ các bảng trong
PostgreSQL. Lần chạy đầu có thể lâu hơn do Docker phải tải image và cài package.

## Biến môi trường

Compose đọc file `.env` hiện có. Các biến tích hợp Google, Cloudinary và email
được chuyển vào container nếu đã khai báo. Có thể bổ sung các biến sau:

```env
POSTGRES_DB=netmastery_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=mot-mat-khau-manh
FRONTEND_PORT=3000
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
JWT_REFRESH_SECRET=mot-chuoi-bi-mat-khac
```

`POSTGRES_PASSWORD` không nên chứa ký tự phải URL-encode như `@`, `/`, `:` vì
Compose dùng giá trị này để tạo `DATABASE_URL` nội bộ. Khi đưa lên máy chủ thật,
hãy đổi `JWT_SECRET`, `JWT_REFRESH_SECRET`, mật khẩu PostgreSQL và đặt
`FRONTEND_URL`/`CORS_ORIGIN` theo domain HTTPS thực tế.

`REACT_APP_*` được đóng vào JavaScript lúc build. Sau khi đổi
`REACT_APP_GOOGLE_CLIENT_ID`, cần build lại frontend:

```bash
docker compose build frontend
docker compose up -d frontend
```

## Dừng hoặc xóa dữ liệu

Dừng container nhưng giữ database và file upload:

```bash
docker compose down
```

Xóa cả container lẫn dữ liệu PostgreSQL/file upload (không thể hoàn tác):

```bash
docker compose down -v
```

Database Docker là database mới, không tự sao chép dữ liệu từ PostgreSQL đang
chạy trên máy. Nếu cần giữ dữ liệu cũ, hãy export/import bằng `pg_dump` và
`pg_restore`.
