# Logic Forgot Password

## Mục tiêu

Chức năng `forgot password` cho phép người dùng:

1. nhập email ở trang quên mật khẩu
2. nhận một reset link
3. mở link đó để vào trang đặt mật khẩu mới
4. đổi mật khẩu
5. đăng nhập lại bằng mật khẩu mới

Luồng này đã được triển khai đầy đủ ở cả Prisma, Backend và Frontend.

---

## 1. Prisma Schema

Phần dữ liệu chính nằm trong:

- [prisma/schema.prisma](../prisma/schema.prisma)

Đã thêm model:

```prisma
model PasswordResetToken {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  tokenHash String   @unique @map("token_hash") @db.VarChar(255)
  expiresAt DateTime @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

Và relation trong `User`:

```prisma
passwordResetTokens PasswordResetToken[]
```

### Ý nghĩa các field

- `tokenHash`: không lưu token gốc, chỉ lưu bản hash để an toàn hơn
- `expiresAt`: thời điểm token hết hạn
- `usedAt`: đánh dấu token đã dùng chưa
- `userId`: token này thuộc về user nào

---

## 2. Vì sao dùng bảng riêng thay vì thêm cột vào User

Không nên thêm trực tiếp các cột kiểu `resetToken`, `resetTokenExpiresAt` vào bảng `users` vì:

- khó quản lý lịch sử request reset
- khó đánh dấu token đã dùng
- khó mở rộng nếu sau này muốn lưu nhiều lần yêu cầu
- kém rõ ràng về mặt nghiệp vụ

Dùng bảng riêng `password_reset_tokens` giúp logic sạch hơn và đúng hướng thiết kế backend hơn.

---

## 3. Backend API

File chính:

- [src/Backend/controllers/authController.js](../src/Backend/controllers/authController.js)
- [src/Backend/routes/auth.js](../src/Backend/routes/auth.js)

Đã thêm 3 API:

### 3.1. `POST /api/auth/forgot-password`

Mục đích:

- nhận email từ người dùng
- tìm user theo email
- tạo reset token
- lưu bản hash của token vào database
- trả về thông báo chung

Logic:

1. lấy `email` từ request body
2. chuẩn hóa email bằng `trim().toLowerCase()`
3. tìm user theo email
4. nếu không có user hoặc user bị khóa:
   trả về message chung, không báo rõ email có tồn tại hay không
5. nếu có user:
   - xóa các reset token cũ chưa dùng
   - sinh token ngẫu nhiên bằng `crypto.randomBytes(32)`
   - hash token bằng `sha256`
   - lưu `tokenHash`, `expiresAt`
   - tạo `resetUrl`
6. trong môi trường không phải production:
   trả thêm `resetUrl` để test local nhanh

### 3.2. `GET /api/auth/reset-password/:token/validate`

Mục đích:

- kiểm tra token trong link reset có còn hợp lệ không

Logic:

1. lấy token từ URL params
2. hash token
3. tìm record trong `password_reset_tokens`
4. kiểm tra:
   - có tồn tại không
   - đã dùng chưa
   - đã hết hạn chưa
5. nếu hợp lệ:
   trả `{ valid: true, expiresAt }`

### 3.3. `POST /api/auth/reset-password`

Mục đích:

- nhận token + mật khẩu mới
- cập nhật mật khẩu cho user

Logic:

1. lấy `token` và `password` từ body
2. validate dữ liệu đầu vào
3. hash token và tìm token trong DB
4. kiểm tra token còn hợp lệ
5. hash mật khẩu mới bằng `bcrypt`
6. transaction:
   - update `user.passwordHash`
   - update `usedAt` cho token vừa dùng
   - xóa các token reset còn lại của user đó
   - xóa tất cả `refresh_tokens` để buộc đăng nhập lại
7. trả message thành công

---

## 4. Bảo mật trong luồng này

### 4.1. Không lưu token gốc trong DB

Hệ thống chỉ lưu:

```js
tokenHash = sha256(rawToken)
```

Nếu database bị lộ, attacker không thể dùng thẳng token để reset mật khẩu.

### 4.2. Không lộ email có tồn tại hay không

API `forgot-password` luôn trả:

```text
Nếu email tồn tại trong hệ thống, chúng tôi đã tạo yêu cầu đặt lại mật khẩu.
```

Điều này tránh lộ thông tin tài khoản hợp lệ cho người ngoài.

### 4.3. Token có hạn sử dụng

Token reset hiện có hiệu lực:

- `30 phút`

Sau thời gian này, token sẽ bị từ chối.

### 4.4. Token chỉ dùng một lần

Sau khi reset thành công:

- token hiện tại được set `usedAt`
- các token reset khác của user cũng bị xóa

### 4.5. Buộc đăng nhập lại

Sau khi đổi mật khẩu:

- hệ thống xóa toàn bộ `refresh_tokens`

Điều này giúp các session cũ không tiếp tục tồn tại sau khi đổi mật khẩu.

---

## 5. Frontend Flow

Các file liên quan:

- [src/components/Auth/Login.js](../src/components/Auth/Login.js)
- [src/components/Auth/ForgotPassword.js](../src/components/Auth/ForgotPassword.js)
- [src/components/Auth/ResetPassword.js](../src/components/Auth/ResetPassword.js)
- [src/services/Api.js](../src/services/Api.js)
- [src/App.js](../src/App.js)

### 5.1. Login page

Ở trang đăng nhập đã thêm link:

- `Quên mật khẩu?`

Người dùng bấm vào sẽ đi đến:

- `/forgot-password`

### 5.2. ForgotPassword page

Trang này:

1. cho người dùng nhập email
2. gọi `api.forgotPassword(email)`
3. hiển thị message thành công
4. nếu đang ở local/dev thì hiện thêm `resetUrl`

API frontend:

```js
api.forgotPassword(email)
```

### 5.3. ResetPassword page

Route:

```text
/reset-password/:token
```

Trang này hoạt động như sau:

1. lấy `token` từ URL
2. gọi `api.validateResetPasswordToken(token)`
3. nếu token hợp lệ:
   hiển thị form nhập mật khẩu mới
4. khi submit:
   gọi `api.resetPassword(token, password)`
5. thành công thì chuyển về trang login

---

## 6. Route đã thêm

### Backend

Trong [src/Backend/routes/auth.js](../src/Backend/routes/auth.js):

- `POST /forgot-password`
- `GET /reset-password/:token/validate`
- `POST /reset-password`

### Frontend

Trong [src/App.js](../src/App.js):

- `/forgot-password`
- `/reset-password/:token`

---

## 7. API client đã thêm

Trong [src/services/Api.js](../src/services/Api.js):

- `forgotPassword(email)`
- `validateResetPasswordToken(token)`
- `resetPassword(token, password)`

Đây là lớp trung gian giữa component React và backend API.

---

## 8. Cách test local

### Bước 1

Mở trang:

```text
/login
```

### Bước 2

Bấm:

```text
Quên mật khẩu?
```

### Bước 3

Nhập email của user có trong hệ thống.

### Bước 4

Vì hiện tại chưa tích hợp mail thật, backend sẽ trả thêm `resetUrl` trong môi trường local/dev.

Frontend sẽ hiển thị link:

```text
Mở link đặt lại mật khẩu
```

### Bước 5

Bấm link đó để vào trang reset password.

### Bước 6

Nhập mật khẩu mới và submit.

### Bước 7

Đăng nhập lại bằng mật khẩu mới.

---

## 9. Tại sao hiện tại chưa gửi email thật

Project hiện chưa có:

- SMTP config
- mail service
- nodemailer hoặc provider email khác

Nên tạm thời logic đang theo kiểu:

- production: trả message chung
- local/dev: trả thêm `resetUrl` để test nhanh

Nếu muốn triển khai thật, bước tiếp theo là thêm:

1. `nodemailer`
2. SMTP account hoặc provider mail
3. template email reset password

---

## 10. Tóm tắt ngắn

Luồng `forgot password` hiện tại hoạt động như sau:

1. user nhập email
2. backend tạo reset token
3. DB lưu `tokenHash`
4. user mở reset link
5. frontend validate token
6. user nhập mật khẩu mới
7. backend cập nhật `passwordHash`
8. token reset bị vô hiệu hóa
9. refresh token cũ bị xóa

Đây là luồng đầy đủ và đủ tốt để dùng cho local/dev và có thể mở rộng sang gửi email thật sau đó.
