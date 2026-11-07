# NetMaster

Nền tảng học, thực hành mạng và luyện thi CCNA trên trình duyệt.

NetMaster kết hợp bài học, lộ trình có điều kiện tiên quyết, bài thi trắc nghiệm và phòng lab mô phỏng CLI Cisco. Người học có thể cấu hình thiết bị, kiểm tra kết nối, theo dõi mục tiêu và nhận gợi ý từ trợ lý AI trong cùng một workspace.

Dự án đang được phát triển với mã nguồn chia theo pnpm workspace. Tên repository và các package vẫn dùng `ccna-master` / `@ccna/*`; tên hiển thị của sản phẩm là **NetMaster**.

## Tính năng

### Học và luyện thi

- Khóa học theo chương và bài học, hỗ trợ video, nội dung đọc và ghi chú.
- Lộ trình mở bài theo điều kiện tiên quyết, lưu tiến độ và vị trí xem video.
- Bài thi trắc nghiệm có thời hạn, lưu lượt làm bài, chấm điểm và xem lại lời giải.
- Hồ sơ học tập với lịch hoạt động và lịch sử hoàn thành bài học, lab.

### Thực hành mạng

- Lab CLI ngay trên web, bên cạnh tài liệu và tệp thực hành Packet Tracer.
- Sơ đồ router, switch, PC và liên kết; chọn thiết bị để chuyển terminal, kiểm tra kết nối bằng công cụ mô phỏng.
- Checklist mục tiêu, gợi ý theo nhiệm vụ, chấm cấu hình và xem lại trạng thái lab theo lịch sử thao tác.
- Định nghĩa lab có phiên bản; lượt thực hành giữ bản chụp để thay đổi nội dung không làm đổi đề và kết quả cũ.
- Bộ công cụ subnet, VLSM, tra cứu Cisco CLI, port và protocol.

### Trợ lý AI

- Gợi ý bước tiếp theo, phân tích kết nối và giải thích khái niệm theo ngữ cảnh thực hành.
- Chọn thiết bị và mức gợi ý, sao chép lệnh, phản hồi hữu ích/chưa hữu ích và quản lý hội thoại.
- Xử lý bất đồng bộ qua worker, có hạn mức, hủy yêu cầu và trạng thái xử lý. SSE truyền cập nhật trạng thái khi được bật; polling là phương án dự phòng.
- Runtime Gemini được cấu hình phía server; AI mặc định tắt và chỉ khả dụng khi quyền, chính sách cùng ngân sách cho phép.

### Quản trị

- Quản lý khóa học, bài học, câu hỏi, bài thi, lab và tài khoản.
- Biên soạn topology, trạng thái ban đầu, mục tiêu chấm điểm và điều kiện mở lab.
- Theo dõi kết quả học tập, hoạt động quản trị và cấu hình trợ lý AI.
- Đăng nhập bằng tài khoản hoặc Google, khôi phục mật khẩu qua email và quản lý phiên đăng nhập.

Giao diện hỗ trợ sáng/tối, mặc định sáng cho người truy cập mới. Phòng lab CLI được thiết kế cho máy tính có bàn phím. Simulator hỗ trợ tập lệnh và hành vi đã triển khai trong dự án, không thay thế đầy đủ thiết bị Cisco hoặc Packet Tracer.

## Công nghệ và kiến trúc

| Thành phần   | Công nghệ                                                  | Vai trò                                            |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| Web          | React 18, React Router, TanStack Query, CSS theo component | Giao diện học viên và quản trị                     |
| Lab UI       | xterm, SVG, Lucide, GSAP, Motion                           | Terminal, topology và tương tác                    |
| API          | Node.js, Express, Prisma                                   | Tài khoản, nội dung, tiến độ, bài thi và lab       |
| Database     | PostgreSQL                                                 | Dữ liệu ứng dụng, hàng đợi và hạn mức AI           |
| AI Node      | Worker và HTTP API nội bộ                                  | Quyền truy cập, context, kiểm kết quả và lifecycle |
| AI Python    | Dịch vụ Python, Gemini                                     | Thực hiện yêu cầu model đã được Node cấp phép      |
| Tệp và email | Uploads trên disk, Cloudinary, Nodemailer                  | Tài nguyên học tập và email tài khoản              |

```text
ccna-master/
├── src/
│   ├── frontend/            # Ứng dụng React, public assets và build
│   ├── backend/
│   │   ├── src/             # API và domain ứng dụng
│   │   └── prisma/          # Schema và migration
│   ├── shared/              # Định nghĩa lab, simulator và hợp đồng dùng chung
│   ├── agent/
│   │   ├── browser/         # UI và client AI chạy trong trình duyệt
│   │   ├── contracts/       # Schema và fixtures dùng chung
│   │   ├── node/            # Context, quyền, quota và kiểm câu trả lời
│   │   ├── routes/          # API của trợ lý
│   │   ├── workers/         # Worker và sweeper
│   │   └── python/          # Dịch vụ gọi Gemini
│   ├── scripts/             # Công cụ phát triển, import, backup và restore
│   └── storage/uploads/     # Tệp tải lên tại máy chủ
├── docs/                    # Kiến trúc, vận hành và hướng dẫn tính năng
├── compose.yaml             # Stack Docker cho ứng dụng
└── pnpm-workspace.yaml
```

Frontend chỉ dùng phần browser và contract của agent. Prisma và migration thuộc backend; simulator dùng chung nằm trong `shared`. Xem [cấu trúc mã nguồn](docs/project-structure.md) và [kiến trúc agent](src/agent/README.md).

## Chạy tại máy cá nhân

### Yêu cầu

- Node.js 22.12+ thuộc nhánh 22, hoặc Node.js 24+.
- pnpm **10.33.4**, theo `packageManager` trong `package.json`.
- PostgreSQL đang chạy và một database dành riêng cho môi trường phát triển.
- Nếu dùng AI: Python **3.11**, uv **0.11.22** và cấu hình Gemini phía server.

### 1. Cài dependencies

```sh
corepack enable pnpm
pnpm install --frozen-lockfile
```

Nếu chưa bật được lệnh `pnpm`, dùng `corepack pnpm`. Trên Windows, có thể dùng `pnpm.cmd` khi PowerShell chặn script `.ps1`.

### 2. Cấu hình môi trường

Với checkout mới, sao chép mẫu tại root:

```sh
cp .env.example .env
```

Điền các giá trị tương ứng với môi trường của bạn:

| Biến                | Cấu hình                                                    |
| ------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`      | URL PostgreSQL của database phát triển                      |
| `JWT_SECRET`        | Secret riêng, ngẫu nhiên, ít nhất 32 ký tự                  |
| `PORT`              | Cổng frontend, mặc định trong mẫu là `3000`                 |
| `BACKEND_PORT`      | Cổng API, mặc định `5500`                                   |
| `REACT_APP_API_URL` | URL API phía trình duyệt, ví dụ `http://localhost:5500/api` |
| `FRONTEND_URL`      | Địa chỉ frontend, ví dụ `http://localhost:3000`             |
| `CORS_ORIGIN`       | Danh sách origin frontend được phép gọi API                 |

Google OAuth, email và Cloudinary cần cấu hình thêm khi dùng các chức năng tương ứng. Giữ khóa và secret ở phía server; chỉ các biến công khai mới dùng tiền tố `REACT_APP_`. Không commit `.env`.

### 3. Khởi tạo schema

Tạo database PostgreSQL rồi chạy từ root:

```sh
pnpm prisma:generate
pnpm db:deploy
```

Migration khởi tạo schema, không tự tạo đầy đủ thư viện nội dung học tập. Dùng trang quản trị để thêm nội dung hoặc công cụ import phù hợp. Với database đã có dữ liệu, đọc [hướng dẫn baseline và migration](docs/operations.md#baseline-cho-db-đã-tồn-tại) trước khi triển khai.

### 4. Chạy web và API

Mở hai terminal tại root:

```sh
# Terminal 1: API
pnpm server
```

```sh
# Terminal 2: React
pnpm start
```

Truy cập `http://localhost:3000`. Backend readiness nằm tại `http://localhost:5500/api/health/ready`.

### 5. Chạy trợ lý AI nếu cần

Đọc [hướng dẫn cấu hình AI trong app dev](docs/ai-lab-assistant/baseline/admin-test-access.md) để chuẩn bị quyền, policy, key và ngân sách. Cài môi trường Python:

```sh
uv sync --project src/agent/python --frozen
```

Sau khi cấu hình hợp lệ, thay terminal API bằng:

```sh
pnpm dev:ai
```

Launcher chạy backend, Python, worker và sweeper; frontend vẫn chạy riêng bằng `pnpm start`. Nếu backend đang chạy, dùng `pnpm dev:ai --existing-backend`. Launcher không tự bật AI hoặc thay đổi hạn mức. Chỉ chạy `pnpm server` sẽ không có worker xử lý câu hỏi.

Chi tiết: [runtime AI](src/agent/README.md#chạy-app-với-trợ-lý-ai), [dịch vụ Python](src/agent/python/README.md), [theo dõi trạng thái SSE](docs/ai-lab-assistant/SSE-01-status-stream.md).

## Kiểm tra và build

Chạy các lệnh từ root:

| Lệnh                                     | Mục đích                                      |
| ---------------------------------------- | --------------------------------------------- |
| `pnpm test --watchAll=false --runInBand` | Test component và hành vi frontend            |
| `pnpm test:cli`                          | Test simulator, grader và lab                 |
| `pnpm test:core`                         | Test tài khoản, bài thi và runtime            |
| `pnpm test:learning`                     | Test lộ trình và điều kiện mở bài             |
| `pnpm test:ai`                           | Test AI Node và browser, không gọi model thật |
| `pnpm test:ai:python`                    | Test dịch vụ Python                           |
| `pnpm check:ai:python`                   | Lint Python                                   |
| `pnpm check:ai:contracts`                | Kiểm artifacts khớp schema nguồn              |
| `pnpm check:ai:fixtures`                 | Kiểm fixtures lab của agent                   |
| `pnpm check:ai:budget`                   | Kiểm ngân sách context offline                |
| `pnpm check:icons`                       | Kiểm export icon dùng trong browser           |
| `pnpm check:boundaries`                  | Kiểm ranh giới import giữa các workspace      |
| `pnpm build`                             | Build frontend ra `src/frontend/build`        |

Các test integration PostgreSQL cần database thử nghiệm riêng và flag tương ứng; mặc định được bỏ qua khi chưa bật. Xem cấu hình trong [CI/CD](.github/workflows/ci-cd.yml) và [hướng dẫn vận hành](docs/operations.md). Kiểm thử provider thật dùng các lệnh riêng, cần cấu hình và có thể phát sinh chi phí.

## Triển khai và đóng góp

- Cài bằng `pnpm install --frozen-lockfile`; cập nhật `pnpm-lock.yaml` cùng thay đổi dependency.
- Host frontend cần SPA fallback cho BrowserRouter. Backend, database và uploads được cấu hình riêng theo môi trường.
- Workflow hiện chạy kiểm tra cho `developer` và `main`; frontend preview/production dùng GitHub Environments riêng. Xem [CI/CD](.github/workflows/ci-cd.yml).
- Docker dùng [compose.yaml](compose.yaml); backup, restore, health check và rollout được mô tả trong [hướng dẫn vận hành](docs/operations.md).
- Chia thay đổi thành commit theo chức năng, kèm kiểm chứng và mô tả PR đủ để người review hiểu hành vi mới. Không đưa secrets, build artifacts hoặc database dump vào Git.

## Tài liệu

- [Cấu trúc mã nguồn và quy tắc import](docs/project-structure.md)
- [Vận hành, migration, backup và restore](docs/operations.md)
- [Phòng lab và trợ lý AI](docs/ui-ux/lab-workspace.md)
- [Định nghĩa và chấm điểm EIGRP01](docs/eigrp01-grading.md)
- [Tài liệu AI Lab Assistant](docs/ai-lab-assistant/README.md)
- [Quy tắc giao diện học viên](docs/ui-ux/student-ui-guidelines.md)

## Tác giả

- **Tên**: DUY.hy
