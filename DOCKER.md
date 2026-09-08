# Chạy CCNA Master bằng Docker

## CLI Lab nhiều thiết bị

Sau khi cập nhật source, chạy `docker compose up --build -d` rồi mở http://localhost:3000.
Trong Admin → Labs, chọn CLI Simulation → Simulation → Dùng mẫu mạng 2 Router + 2 PC.
Chọn khóa học, đặt mục tiêu cấu hình gateway/static route, publish. Trang Labs sẽ có nút Mở CLI Lab.
Trên workspace: chọn thiết bị để gõ lệnh; dùng Tick khi luyện OSPF; gửi gói và mở packet trace để xem lỗi. Replay chỉ xem lại. Chủ phiên thêm ID bạn học rồi gửi mã phiên để cùng làm.

LLM là tùy chọn: cấu hình `LAB_AI_URL`, `LAB_AI_KEY`, `LAB_AI_MODEL` trong `.env` rồi recreate backend. Không cấu hình thì vẫn có giải thích từ grader.

Chạy test tích hợp với các hàng dữ liệu tạm được tạo và dọn riêng:

```bash
docker compose exec -T -e LAB_INTEGRATION=1 backend node --test src/Backend/simulation/networkApi.integration.test.js
```

## Hai backend replica trên một máy

Đầu tiên chạy stack thường để `prisma db push` đồng bộ schema một lần. Sau đó:

```bash
docker compose -f compose.yaml -f compose.scale.yaml up -d --scale backend=2 --force-recreate
docker compose -f compose.yaml -f compose.scale.yaml exec -T -e LAB_INTEGRATION=1 -e LAB_REPLICAS=1 backend node --test src/Backend/simulation/networkApi.integration.test.js
```

Test replica gửi luân phiên đến các backend khác nhau, cùng dùng PostgreSQL. Nginx có giới hạn request chung cho lab. Sau khi tăng/giảm số replica, recreate frontend để refresh DNS upstream. Về một backend:

File `compose.scale.yaml` reset publish port `5500` của backend vì nhiều replica không thể cùng bind một cổng host; API scale được truy cập qua Nginx/frontend.

```bash
docker compose up -d --scale backend=1 --force-recreate
```

Không chạy nhiều lệnh đồng bộ schema song song và không dùng `--accept-data-loss` để bỏ qua cảnh báo database. Scale nhiều host cần storage chia sẻ và cấu hình vận hành riêng; xem giới hạn trong `lab.md`.

### Kết quả kiểm chứng local ngày 2026-09-08

- Target Docker `backend` build và healthcheck thành công; target này phải copy cả `src/Backend` và `src/shared` vì controller dùng sanitizer chung.
- Compose merge được kiểm tra với 2 replica, lệnh khởi động server trực tiếp và không còn publish port cố định trên backend.
- Hai backend cùng PostgreSQL/uploads vượt qua integration: 46 pass, 0 fail, 0 skip. Start/command/submit đồng thời vẫn được khóa qua DB và chỉ ghi tiến độ một lần.
- 20 request `/api/debug-ping` qua Nginx được chia đều 10/10 giữa hai backend.
- Burst 40 request vào `/api/lab-attempts/` trả 25 phản hồi từ backend và 15 phản hồi HTTP 429, xác nhận `limit_req` hoạt động.
- Volume uploads được ghi từ replica 1 và đọc từ replica 2. DB còn 0 hàng test sau suite; container, network, volume và image kiểm thử đã được xóa.

Đợt kiểm chứng chỉ build target backend, không chạy target `frontend-build` và không thay đổi stack `ccna-master-*` đang có.

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

Nếu chỉ cần khởi động lại backend sau khi đổi biến môi trường:

```bash
docker compose up -d backend
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
