# Bài học triển khai

## GSAP trong React admin

- Dùng `@gsap/react` và scope bằng ref giúp GSAP tự cleanup khi component unmount hoặc dependency thay đổi; selector không rò sang component khác.
- Khi truyền object conditions cho `gsap.matchMedia()`, callback chỉ chạy khi có ít nhất một condition khớp. Cần khai báo cả `reduce` và `no-preference` nếu callback phải xử lý cả hai chế độ.
- Exit animation cần một state render riêng. Nếu chỉ dùng `if (!isOpen) return null`, DOM bị gỡ trước khi timeline đóng có thể chạy.
- Tween số liệu qua một object trung gian và cập nhật `textContent` tránh buộc React re-render ở mỗi frame.
- Recharts đã có animation dữ liệu riêng. GSAP chỉ nên animate container khi đổi loading/empty/data để tránh hai hệ animation cùng điều khiển SVG.
- Các hiệu ứng hover/focus đơn giản vẫn phù hợp với CSS; GSAP dành cho timeline, dữ liệu động và vòng đời mount/unmount.

## Prisma Client sau khi cài dependency

- Có package `@prisma/client` không đồng nghĩa generated client đã tồn tại. Cần kiểm tra trực tiếp `node_modules/.prisma/client` khi gặp lỗi `Cannot find module '.prisma/client/default'`.
- Với phiên bản Prisma hiện tại của dự án, chạy `prisma generate` khôi phục client mà không cần đổi import `require('@prisma/client')` hoặc logic kết nối database.
- Thêm `postinstall: prisma generate` giúp trạng thái generated client được tái tạo sau các lần cài dependency thông thường, thay vì dựa vào artifact cũ trong `node_modules`.
- Kiểm tra bằng entrypoint backend có giá trị hơn một import giả lập: nó đồng thời xác nhận generated client, driver adapter, kết nối PostgreSQL và quá trình khởi động server.

## Đồng bộ Docker build, Lockfile và Case-Sensitivity

- `npm ci` trong Dockerfile yêu cầu `package-lock.json` phải hoàn toàn đồng bộ với `package.json` cả ở root dependencies lẫn cây `packages`. Thêm package vào `package.json` mà chưa chạy `npm install` hoặc `npm install --package-lock-only` sẽ khiến `npm ci` trong container thất bại ngay lập tức với lỗi missing package.
- Windows NTFS không phân biệt hoa thường (case-insensitive), cho phép import `adminMotion` từ file `AdminMotion.js` trên host, nhưng môi trường container Linux (case-sensitive) sẽ thất bại ngay khi resolve module. Tên file trên đĩa phải khớp chính xác từng ký tự hoa thường với câu lệnh import.
- Cần cẩn trọng khi tạo file mới để không ghi đè nhầm vào component hiện hữu (như trường hợp `AdminPagination.jsx` bị ghi đè bởi `AdminMotionSwap`), vừa gây thiếu module mới cho các component phụ thuộc vừa phá vỡ chức năng cũ.

## Deploy Vercel với Create React App (CRA)

- CRA mặc định coi tất cả ESLint warnings là error khi biến môi trường `CI=true` (được Vercel đặt tự động). Lỗi này khiến `npm run build` trên Vercel dừng ngay lập tức với exit code 1 dù ứng dụng chạy bình thường ở local.
- Giải pháp bền vững kết hợp hai lớp:
  1. Dọn dẹp triệt để các cảnh báo ESLint (`no-unused-vars`, `react-hooks/exhaustive-deps`) ở các component giao diện.
  2. Tạo file `vercel.json` với `buildCommand: "CI=false npm run build"` và cho phép commit `.env.production` chứa `CI=false`, `DISABLE_ESLINT_PLUGIN=true` để bảo vệ pipeline build không bị đứt đoạn.
- Khi triển khai React Router (SPA) trên Vercel, bắt buộc cấu hình `rewrites` trong `vercel.json` trỏ `/(.*)` về `/index.html` để tránh lỗi 404 khi người dùng F5 hoặc truy cập trực tiếp vào URL nhánh (như `/lesson`, `/profile`, `/roadmap`).
- Cấu hình `.gitignore`: Tránh viết `.env*` bao quát toàn bộ vì sẽ bỏ qua cả `.env.production` và `.env.example`. Cần chỉ rõ các file cần ignore (`.env`, `.env.local`) và whitelist file config production.

## Thiết lập CI/CD bằng GitHub Actions & Vercel

- Tab Actions trên GitHub chỉ xuất hiện và kích hoạt khi có ít nhất một file định nghĩa workflow (`.yml`) nằm trong thư mục `.github/workflows/`.
- Pipeline CI/CD chuẩn nên tách thành 2 tầng rõ rệt:
  1. Quality Gate (`test-and-build`): Chạy `npm ci --legacy-peer-deps`, sinh Prisma Client qua `npx prisma generate`, chạy lint và build bundle với `npm run build`. Tầng này đảm bảo mã nguồn hoàn toàn hợp lệ trước khi cho phép deploy.
  2. Deployment (`deploy-vercel`): Có thể dùng Vercel CLI Action với các secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). Cần xử lý điều kiện kiểm tra sự tồn tại của Token để workflow không bị crash nếu người dùng dùng song song Vercel Git App Integration.



