Nếu deploy thật lên Vercel, luồng forgot password sẽ chạy như này:

Luồng thực tế

User mở frontend trên domain Vercel, ví dụ https://app-ten-ban.vercel.app/login, bấm Quên mật khẩu?.
Frontend gọi API POST /auth/forgot-password.
Backend tạo raw token, lưu bản hash vào PostgreSQL trong password_reset_tokens, set expiresAt.
Backend tạo link reset kiểu https://app-ten-ban.vercel.app/#/reset-password/<token> vì app của bạn đang dùng HashRouter.
Backend gửi link đó qua email thật.
User bấm email, vào trang reset password trên frontend.
Frontend gọi API validate token.
User nhập mật khẩu mới, frontend gọi POST /auth/reset-password.
Backend hash mật khẩu mới, cập nhật users.password_hash, đánh dấu token đã dùng, xóa refresh token cũ.
User đăng nhập lại.
Điểm quan trọng với project của bạn

Hiện tại Api.js đang hardcode http://localhost:5000/api, nên khi deploy phải đổi sang env var, ví dụ REACT_APP_API_URL.
Vì bạn đang dùng Express server riêng trong src/Backend/Server.js, cách đơn giản nhất là:
Frontend deploy lên Vercel
Backend deploy riêng trên Render/Railway/Fly.io
Nếu muốn cả backend lên Vercel, bạn sẽ phải refactor backend sang Vercel Functions trong thư mục /api. Vercel Node runtime phục vụ server code qua /api, không tự chạy nguyên server Express kiểu truyền thống.
Với Prisma trên môi trường serverless, connection pooling là rất quan trọng.
Với preview deploy của Vercel, nên dùng DB riêng cho Preview, không dùng chung DB production.
Email thật sẽ chạy thế nào

forgot-password không nên trả resetUrl cho frontend nữa ở production.
Thay vào đó backend sẽ dùng mail provider như Resend, SendGrid, Brevo, hoặc SMTP Gmail/Zoho để gửi mail.
Các biến môi trường tối thiểu:
DATABASE_URL
JWT_SECRET
FRONTEND_URL
SMTP_* hoặc RESEND_API_KEY
Cho production nên làm thêm

Dùng prisma migrate deploy, không dùng db push.
Thêm rate limit cho forgot-password.
Thêm log/audit cho reset password.
Thêm mail template HTML tử tế.
Thêm job dọn token hết hạn nếu muốn.
Khuyến nghị thực tế cho repo này

Ngắn hạn, ổn nhất:
Vercel: frontend React
Railway/Render: backend Express
Neon/Supabase/Railway Postgres: database
Resend hoặc SMTP: gửi mail
Dài hạn, nếu muốn all-in Vercel:
refactor auth/backend sang Vercel Functions hoặc Next.js API routes
Nguồn:

Vercel Environment Variables: https://vercel.com/docs/environment-variables
Vercel Node.js Functions: https://vercel.com/docs/functions/runtimes/node-js
Prisma deploy on Vercel: https://www.prisma.io/docs/orm/prisma-client/deployment/serverless
Prisma + preview DB on Vercel: https://www.prisma.io/docs/orm/prisma-client/deployment/serverless#add-a-separate-database-for-preview-deployments
Nếu muốn, tôi có thể làm tiếp bước “chuẩn bị repo để deploy thật”:

đổi Api.js sang env var
tắt resetUrl trên production
tích hợp gửi email thật bằng Resend hoặc SMTP
viết checklist deploy Vercel + backend + Postgres.