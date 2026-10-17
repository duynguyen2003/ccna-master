# 🚀 CCNA Master - Nền tảng học và luyện thi CCNA chuyên nghiệp

**CCNA Master** là một ứng dụng web toàn diện được thiết kế để hỗ trợ sinh viên và kỹ sư mạng trong quá trình chinh phục chứng chỉ CCNA (Cisco Certified Network Associate). Hệ thống tích hợp lộ trình học tập bài bản, ngân hàng câu hỏi trắc nghiệm thông minh, và các công cụ thực hành Lab hiện đại.

---

## ✨ Tính năng nổi bật

### 👨‍🎓 Dành cho Học viên
- **Lộ trình học tập (Curriculum)**: Chia thành các Module và bài học chi tiết theo chuẩn Cisco.
- **Theo dõi tiến độ**: Ghi lại lịch sử xem video và tiến độ học tập hàng ngày bằng biểu đồ trực quan.
- **Hệ thống thi trắc nghiệm**: Ngân hàng câu hỏi phong phú, chấm điểm tức thì và xem lại giải thích đáp án.
- **Thực hành Lab**: Cung cấp tài liệu và file cấu hình (.pka) để thực hành trực tiếp trên Cisco Packet Tracer.
- **Bộ công cụ (Network Tools)**: Subnet Calculator, VLSM, Tra cứu Cisco CLI, Tra cứu Port & Protocol.

### 🛡️ Bảo mật & Hệ thống
- **Xác thực đa dạng**: Đăng nhập bằng tài khoản hoặc Google OAuth 2.0.
- **Bảo mật nâng cao**: Sử dụng JWT (JSON Web Token), mã hóa mật khẩu Bcrypt, bảo vệ Header với Helmet và giới hạn tần suất yêu cầu (Rate Limiting).
- **Quản lý phiên làm việc**: Tính năng Quên mật khẩu & Khôi phục mật khẩu qua Email tự động.

### ⚙️ Dành cho Quản trị viên (Admin Panel)
- **Quản lý nội dung**: CRUD (Thêm, Sửa, Xóa mềm) Khóa học, Bài học, Bài thi và Bài Lab.
- **Thống kê người dùng**: Biểu đồ hoạt động và báo cáo kết quả học tập của toàn bộ hệ thống.
- **Log hệ thống**: Theo dõi các hoạt động quan trọng của Admin.

---

## 🛠️ Công nghệ sử dụng

### Frontend
- **React.js 18**
- **Tailwind CSS** (Styling)
- **Lucide React** (Icons)
- **Recharts** (Biểu đồ thống kê)
- **TanStack Query** (Quản lý trạng thái API)

### Backend
- **Node.js & Express.js**
- **Prisma ORM** (Quản lý Database)
- **PostgreSQL** (Hệ quản trị CSDL)
- **Nodemailer** (Gửi email tự động)
- **Cloudinary** (Lưu trữ hình ảnh/tài liệu)

---

## 🚀 Hướng dẫn cài đặt

### 1. Yêu cầu hệ thống
- **Node.js** 22.12+ (nhánh 22) hoặc 24+.
- **pnpm** 10.33.4 (được khóa trong `package.json`).
- **PostgreSQL** (Đang chạy trên máy hoặc qua Docker)

### 2. Cài đặt Dependencies
Mở terminal tại thư mục gốc của dự án và chạy:
```bash
corepack enable pnpm
pnpm install --frozen-lockfile
```

Nếu chưa bật được lệnh `pnpm`, dùng `corepack pnpm install --frozen-lockfile`.
Trên Windows, có thể dùng `pnpm.cmd` nếu PowerShell chặn script `.ps1`.
Commit `pnpm-lock.yaml` khi thay đổi dependency; CI, Docker và Vercel đều dùng `--frozen-lockfile`.
Vercel gọi `corepack pnpm` để dùng đúng phiên bản đã khóa trong `package.json`.
Cấu hình trong `pnpm-workspace.yaml` giữ layout phẳng tương thích Create React App 5,
không tự thêm peer dependency và giữ override `qs` hiện có.

Thêm thư viện bằng `pnpm add <package>`, thêm công cụ phát triển bằng `pnpm add -D <package>`.
Chạy kiểm tra bằng `pnpm run test:cli`, `pnpm run test:learning`, `pnpm run test:core`,
`pnpm test --watchAll=false --runInBand --testPathIgnorePatterns=src/Backend/` và `pnpm run build`.

### 3. Cấu hình biến môi trường
Tạo file `.env` tại thư mục gốc (dựa trên mẫu `.env.example`) và điền các thông tin sau:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/db_name"
JWT_SECRET="<secret ngẫu nhiên riêng, ít nhất 32 ký tự>"
GOOGLE_CLIENT_ID="your_google_id"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```

### 4. Khởi tạo Database
Với database mới, chạy các migration đã lưu trong Git:
```bash
pnpm exec prisma generate
pnpm run db:deploy
```

Database đang có dữ liệu từ `db push` cần đối chiếu schema và baseline trước khi deploy.
Xem [hướng dẫn vận hành, backup/restore và rollout](docs/operations.md).
Docker Compose chạy migration trong service `migrate` riêng; backend khởi động bằng Node.
`developer` triển khai Vercel preview, `main` triển khai production với secrets riêng theo GitHub Environment.

### 5. Chạy ứng dụng
Mở hai terminal song song:
- **Terminal 1 (Backend)**: `pnpm run server`
- **Terminal 2 (Frontend)**: `pnpm start`

---

## 📂 Cấu trúc thư mục chính
```text
ccna-master/
├── prisma/             # Định nghĩa Schema Database
├── public/             # Tài sản tĩnh (Images, HTML)
├── src/
│   ├── Backend/        # Toàn bộ mã nguồn Backend (MVC)
│   │   ├── config/     # Cấu hình DB, JWT, Email...
│   │   ├── controllers/# Xử lý logic nghiệp vụ
│   │   ├── middleware/ # Lớp bảo vệ (Auth, Rate Limit...)
│   │   ├── routes/     # Định nghĩa các API endpoints
│   │   └── validation/ # Schema xác thực dữ liệu (Zod)
│   ├── components/     # Giao diện người dùng (React Components)
│   ├── context/        # Quản lý trạng thái Auth, Toast...
│   ├── services/       # Lớp gọi API từ Frontend
│   └── css/            # Các file định dạng giao diện
└── .env                # Biến môi trường (Không commit)
```

---

## 👨‍💻 Tác giả
- **Tên**: [Tên của bạn]
- **Đồ án**: Tốt nghiệp khóa [Năm] - Ngành Công nghệ thông tin.
