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
  2. Deployment (`deploy-vercel`): Dùng Vercel CLI theo thứ tự `vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod` với các secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). Cần kiểm tra đủ cả ba secret để workflow không chạy deploy khi project chưa được liên kết.
- Lỗi `Could not retrieve Project Settings` thường xuất hiện khi CLI chưa có liên kết project trong runner hoặc ID/token không có quyền truy cập. `vercel pull --yes` với `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID` tạo liên kết `.vercel` tạm thời trong CI; thư mục này không được commit.
- GitHub secret tồn tại chỉ chứng minh tên secret đã được tạo, không chứng minh giá trị còn đúng hoặc token có quyền trên project. Cần đối chiếu lại `orgId`/`projectId` trong `.vercel/project.json` sau khi chạy `vercel link` và cấp token đúng team.
- Lỗi `exit code 152` trong `npm ci`: Đây là lỗi crash nội bộ của tiến trình npm CLI (thường do "Exit handler never called" hoặc ngắt kết nối mạng khi tải cây dependency khổng lồ). Để giải quyết:
  + Nâng cấp lên Node 22 (LTS) có phiên bản npm mới nhất ổn định hơn.
  + Cấu hình `npm config set fetch-retries 5` và nới rộng timeout.
  + Tránh dùng `cache: 'npm'` của `setup-node` khi repo có nhiều packages dễ gây xung đột checksum cache trên runner.

## Rà soát tiến độ và kế hoạch hoàn thiện — 2026-09-08

- Checklist được tích phản ánh ghi chép tại một thời điểm. Khi tổng kết, phải đối chiếu lại code, Git và bằng chứng chạy; tính năng tồn tại trong working tree chưa có nghĩa đã commit, deploy hoặc nghiệm thu.
- Ghi riêng số test pass/fail/skip. Kết quả 33 pass, 0 fail và một bài integration bị skip không chứng minh quyền truy cập, transaction hay concurrency trên PostgreSQL thật.
- Benchmark engine trong RAM không đại diện cho HTTP/DB hoặc nhiều backend. Ghi ngày, workload, môi trường và giới hạn phép đo để so sánh đúng.
- Một tính năng có thể đã triển khai nhưng còn lỗi nghiệp vụ ngoài các ca test hiện có. PAT cần kiểm tra aging xen kẽ và tính duy nhất của mapping; trace cần kiểm tra thiết bị gây drop, không chỉ thông báo lỗi.
- Thay đổi hook cài dependency phải xét thứ tự build: thêm `postinstall: prisma generate` khi Docker chưa COPY schema/config trước `npm ci` có thể làm hỏng cài đặt sạch.
- Tài liệu nối tiếp có thể thay thế yêu cầu cũ: dùng yêu cầu mới nhất về banner/GSAP và không build Docker FE; không cộng mọi mục lịch sử thành nghĩa vụ triển khai đồng thời.
- Với PAT, cổng NAT phải được cấp từ tập cổng đang dùng thay vì độ dài mảng; khi mapping được dùng lại cần cập nhật thời điểm aging. Trace lỗi nên lấy thiết bị phát hiện lỗi từ engine để UI chỉ đúng nơi rơi gói.
- Sanitizer cho rich text cần chạy ở cả biên ghi dữ liệu và lúc render dữ liệu cũ. Allowlist thẻ/thuộc tính an toàn giúp không phụ thuộc vào dữ liệu đã tồn tại trong DB.
- Attempt bị giới hạn event cần có đường kết thúc và bắt đầu lại rõ ràng; nếu `start` chỉ resume `IN_PROGRESS`, người học có thể bị kẹt dù phiên chưa đạt.
- Integration test phải chạy trên DB thử nghiệm tách biệt. Datasource hiện trỏ tới Supabase và thiếu schema CLI; không được tự `db push --accept-data-loss` hoặc coi lỗi schema là lỗi chức năng của API.
- CI cần tạo PostgreSQL service riêng cho integration, chạy `prisma db push` trên schema test và đặt deploy phụ thuộc job đó; lint/build thành công riêng lẻ chưa đủ chứng minh quyền truy cập hoặc concurrency.

## Nghiệm thu PostgreSQL, benchmark và scale local — 2026-09-08

- Clean install trên Windows nên dùng thư mục và npm cache riêng. Cache dùng chung có thể bị antivirus/process khác khóa với `EPERM`; lỗi này không chứng minh lockfile hoặc `postinstall` sai.
- Khi test snapshot rubric, attempt mới sau lúc admin sửa đề phải snapshot rubric mới. Dùng đáp án của attempt cũ tạo false negative: submit trả 200 và giữ `IN_PROGRESS` là đúng vì bài chưa đạt, không phải khóa transaction thất bại.
- Docker target backend phải copy mọi module nằm ngoài `src/Backend` mà server require. Sau khi sanitizer được đặt ở `src/shared`, chỉ copy `src/Backend` khiến container crash dù test host vẫn đạt.
- Khi scale một Compose service, phải bỏ publish port host cố định của service đó; nhiều replica không thể cùng bind `5500`. Dùng `!reset []` trong override và đưa lưu lượng qua Nginx.
- Chứng minh scale cần ba lớp bằng chứng: suite nghiệp vụ chạy qua từng replica dùng chung DB, log riêng cho thấy Nginx phân phối request, và burst test xác nhận 429 ở lớp proxy. Healthcheck đơn lẻ không đủ chứng minh các tính chất này.
- Benchmark HTTP nên ghi p50/p95/max, lỗi và RSS cùng workload. HTTP 409 do revision/submit race và HTTP 429 do proxy giới hạn là kết quả hợp lệ khi test chủ động tạo xung đột; phải tách chúng khỏi lỗi ngoài dự kiến.
- Tài nguyên integration nên có tên/label riêng, dùng DB rỗng và kiểm tra số hàng sau cleanup. Container `--rm`, network, volume, image và thư mục cài sạch cần được dọn mà không chạm stack hoặc dữ liệu đang sử dụng.

## Khắc phục npm audit có kiểm soát — 2026-09-08

- Không dùng số tổng của `npm audit` làm tiêu chí duy nhất. Sau khi chuyển `react-scripts` sang `devDependencies`, audit production-only giảm từ 50 xuống 0; 32 cảnh báo còn lại thuộc CRA 5/Prisma CLI. Một số mục có thể xử lý riêng bằng override hoặc cập nhật transitive, còn nhóm toolchain cần đánh giá migration/major; không nên gom tất cả thành một lệnh `--force`.
- Cập nhật trực tiếp theo từng nhóm và chạy kiểm thử sau mỗi nhóm giúp phân biệt bản vá semver an toàn với migration. Axios, Multer, React Router và express-rate-limit được nâng trong major hiện tại; Nodemailer phải nâng lên major 10 và cần smoke test `createTransport`/`sendMail`.
- Khi dependency transitive còn nằm trong dải dễ khai thác, `overrides.qs = ^6.16.0` là cách pin có phạm vi rõ ràng hơn chạy `npm audit fix --force`; cần xác minh lại `npm ls` sau clean install để không để package invalid.
- Phân loại dependency trong `package.json` chỉ phản ánh đúng khi image production cũng không cài dev dependency. Docker backend hiện dùng chung stage cài đầy đủ vì entrypoint còn gọi `npx prisma db push`; muốn image runtime tối giản phải tách bước schema/entrypoint, không tự xoá Prisma CLI trong đợt sửa audit này.
- Mọi module được `require` bởi backend phải nằm trong `dependencies`: `Server.js` nạp `dotenv`, nên để nó trong `devDependencies` sẽ làm `npm ci --omit=dev` cài xong nhưng runtime thiếu module.
- Hook `postinstall` không được giả định Prisma CLI luôn có mặt. Gọi entrypoint JavaScript cục bộ khi CLI tồn tại và bỏ qua có thông báo khi không có CLI giúp runtime install không tải package ngoài ý muốn; cài dev đầy đủ vẫn chạy generate.
- Runtime install `--omit=dev` không thể tự tạo `node_modules/.prisma/client` sau khi bỏ Prisma CLI; image production phải nhận generated client từ builder hoặc có bước generate riêng trước khi khởi động backend.
- Khi Docker Desktop chạy nhưng named pipe bị chặn trong môi trường kiểm tra, cần xác minh lại context/daemon bằng quyền Docker phù hợp trước khi kết luận Dockerfile hỏng; sau đó vẫn phải chạy image thật, chờ healthcheck `healthy` và gọi endpoint, không chỉ dựa vào log build.
- Sau khi đổi lockfile, phải chạy lại integration trên DB rỗng; cluster PostgreSQL tạm ở đường dẫn ASCII vượt hạn chế `initdb` với workspace Unicode, và `prisma db push` không cần `--accept-data-loss` trên DB mới. Bằng chứng cuối đạt 46/46 trước khi dọn cluster.
- Windows có thể khóa file `node_modules/.cache` làm `npm ci` thất bại với `EPERM`, còn registry có thể trả `ECONNRESET`. Dùng cache riêng và thư mục clean đã xác minh giúp tách lỗi môi trường khỏi lỗi lockfile; không ghi nhận các lần này là lỗi ứng dụng.

## CLI Lab Phase 1

- Khi React Strict Mode co the khoi tao effect hai lan, endpoint `start attempt` phai idempotent o backend. PostgreSQL advisory lock theo cap `(userId, labId)` trong transaction ngan hai request dong thoi tao hai attempt ma khong can unique index tam thoi hay `--accept-data-loss`.
- `pg_advisory_xact_lock` tra ve PostgreSQL `void`, Prisma `$queryRaw` khong deserialize truc tiep duoc; can cast ket qua sang `text` (hoac mot kieu duoc ho tro) trong cau `SELECT` va xac minh tren chinh driver/container dang deploy.
- Khong nen dung `prisma db push --accept-data-loss` chi de vuot qua canh bao index trong entrypoint Docker. Neu thay doi lam container restart, uu tien thiet ke lai rang buoc hoac dung migration duoc kiem soat.
- CLI simulator an toan nen parse command tree khai bao va goi cac handler da dang ky; khong map input nguoi dung vao shell, `eval` hay process he dieu hanh.
- Cham diem theo state cuoi cho phep hoc vien dung nhieu chuoi lenh hop le khac nhau. So khop transcript/chuoi lenh se de loai nham dap an dung va khong phu hop muc tiêu thuc hanh Cisco.
- Client terminal chi nen quan ly hien thi va thao tac ban phim. Device state, history chinh thuc, score va viec danh dau tien do phai nam o backend de reload duoc va khong the gia mao tu trinh duyet.
- Voi Windows, artifact CRA trong `build/` co the bi process khac khoa va gay `EPERM`; dat `BUILD_PATH` sang thu muc tam rieng giup phan biet loi filesystem voi loi compile, sau do xoa thu muc tam bang duong dan tuyet doi da xac minh.

## Google OAuth và Xử lý Lỗi Thiếu Client ID trên Production

- Thư viện `@react-oauth/google` và script Google Identity Services (`accounts.google.com/gsi/client`) sẽ ném ngoại lệ đồng bộ `Error: Missing required parameter client_id` ngay khi hook `useGoogleLogin` được gọi nếu `clientId` bị `undefined` hoặc rỗng (do quên cấu hình biến môi trường trên Vercel/Netlify).
- Khi lỗi này xảy ra trong chu kỳ render của React component, React sẽ unmount toàn bộ DOM tree dẫn đến màn hình trắng xóa (blank screen) khi người dùng truy cập trang `/login` hoặc `/register`.
- Giải pháp phòng thủ (defensive rendering):
  1. Cung cấp fallback an toàn cho `GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || '...'}` để không làm sập provider gốc.
  2. Không gọi `useGoogleLogin` trực tiếp ở component cha; bọc hook này trong một component con riêng biệt và chỉ mount khi `process.env.REACT_APP_GOOGLE_CLIENT_ID` tồn tại.
  3. Khi thiếu Client ID, hiển thị nút thông báo fallback. Nhờ đó, người dùng vẫn có thể đăng nhập / đăng ký bằng Email và Mật khẩu truyền thống bình thường mà ứng dụng không bao giờ bị crash.

## Thiết kế UI Lab, GSAP và Responsive Mobile

- **Kiểm tra phòng thủ `window.matchMedia` khi dùng GSAP trong React:**
  Khi viết helper kiểm tra `prefers-reduced-motion` để cấu hình timeline GSAP, bắt buộc kiểm tra `typeof window.matchMedia === 'function'` thay vì chỉ kiểm tra `typeof window !== 'undefined'`. Môi trường Jest / JSDOM có đối tượng `window` nhưng không triển khai sẵn `window.matchMedia`, dẫn đến lỗi đồng bộ `TypeError: window.matchMedia is not a function` làm hỏng toàn bộ suite test component.
- **Chiến lược Responsive hai tầng cho công cụ mô phỏng mạng:**
  Các công cụ kỹ thuật cao như sơ đồ mạng Topology và Terminal Cisco CLI đòi hỏi không gian hiển thị rộng và bàn phím vật lý, không thể sử dụng hiệu quả trên màn hình điện thoại 360px-400px. Chiến lược xử lý hiệu quả gồm:
  1. *Tầng cảnh báo trước*: Đặt banner gợi ý `.lab-mobile-notice` ngay đầu trang danh sách Lab.
  2. *Tầng bảo vệ giao diện*: Hiển thị màn hình fallback `.cli-mobile-fallback` ("Chức năng này cần dùng trên Laptop") với biểu tượng Laptop và nút quay lại nếu người dùng mở workspace trên mobile, bảo vệ layout không bị vỡ và tránh gây khó chịu cho người dùng.
- **Bo góc tinh tế (6px - 8px) cho phần mềm công nghệ:**
  Các nút bo tròn viên thuốc (`9999px`) thường không phù hợp với ngữ cảnh kỹ thuật/networking. Quy chuẩn về `6px - 8px` tạo cảm giác chuyên nghiệp, hiện đại, tăng độ tin cậy và giúp tận dụng không gian padding của các nhãn nút tốt hơn.
- **GSAP `.from()` vs `.fromTo()` và React Re-render (Lỗi phần tử bị kẹt `opacity: 0`):**
  Trong React 18, khi sử dụng `gsap.from(".selector", { opacity: 0, stagger: ... })`, GSAP lập tức gán inline style `opacity: 0` lên toàn bộ các phần tử khớp selector. Nếu có bất kỳ effect hoặc state nào khác re-render component trong khi stagger đang chạy, timeline bị unmount/ngắt quãng giữa chừng, khiến các phần tử phía sau chưa kịp chạy đến 1 bị đóng băng vĩnh viễn với inline style `opacity: 0` (dẫn tới hiện tượng các nút category bị biến mất và chỉ còn nút đầu tiên hiển thị).
  *Khắc phục*: Luôn sử dụng `gsap.fromTo()` kèm cờ `clearProps: "all"` để tự động gỡ sạch inline style sau khi hoàn tất hoặc cleanup, đồng thời tách biệt dependency array (không để state tương tác lọc như `filter` kích hoạt lại entrance timeline của toàn trang).

- **Xung đột giữa GSAP `.from()` và CSS Animation Keyframes trên Modal Dialog:**
  Khi một component modal đã có CSS animation (ví dụ `@keyframes slideUpModal` và `fadeInOverlay`), không nên bọc thêm `gsap.from(".lab-modal", { opacity: 0 })`. Nếu khi mở modal, component cha thực hiện đồng bộ query URL (như `setSearchParams({ labId })`), React 18 sẽ re-render ngay lập tức. Lần re-render này làm ngắt quãng tween GSAP trong frame đầu, khiến thuộc tính inline `opacity: 0` bị đóng băng, làm toàn bộ form modal trở nên vô hình.
  *Giải pháp*: Với modal và dialog có vòng đời ngắn, ưu tiên dùng thuần CSS keyframes (`animation: slideUpModal 0.28s cubic-bezier(...)`). CSS animations độc lập hoàn toàn với thread JavaScript và React reconciliation cycle, không sinh ra inline style trong DOM và không bao giờ bị đè bởi re-render.

- **Kỹ thuật xây dựng GSAP Entrance Timeline theo dữ liệu (Data-Driven Timeline) cho trang Home:**
  1. *Đồng bộ với API loading*: Khởi tạo state `loading = true` và chỉ chuyển sang `false` trong khối `finally` của `fetchData`. Đặt dependency của `useGSAP` theo `[loading]` giúp timeline chỉ kích hoạt đúng một lần khi toàn bộ DOM (danh sách khóa học, dữ liệu tiến độ) đã sẵn sàng.
  2. *Kiểm tra phần tử có điều kiện*: Các khối hiển thị linh hoạt như thẻ "Tiếp tục học" (`.continue-learning`) chỉ xuất hiện khi người dùng đăng nhập và có bài học dở dang. Cần kiểm tra `containerRef.current?.querySelector(...)` trước khi gọi `tl.fromTo()` để tránh lỗi và không làm đứt nhịp timeline.

- **Hiểm họa khi dùng `clearProps: "all"` trên phần tử có React Inline Styles (Lỗi mất ảnh nền):**
  Khi sử dụng GSAP `fromTo()`, thiết lập `clearProps: "all"` sẽ xóa sạch TOÀN BỘ thuộc tính trong thuộc tính `style` của phần tử trong DOM (`element.removeAttribute('style')`). Nếu phần tử đó đang chứa các style do React gán (như biến CSS `--course-bg-image`, `cursor`, `backgroundImage`), toàn bộ các thuộc tính này sẽ bị GSAP xóa sạch sau khi animation kết thúc. Điều này khiến CSS mất biến và rơi về màu nền mặc định trắng, làm biến mất ảnh nền và làm chữ trắng bị chìm không đọc được.
  *Khắc phục*: Tuyệt đối không dùng `clearProps: "all"` bừa bãi. Luôn chỉ định rõ các thuộc tính mà GSAP can thiệp: `clearProps: "opacity,transform"`. Đồng thời luôn có thuộc tính fallback an toàn (màu nền tối `#0f172a` thay vì trắng) trong CSS.

- **Hiệu ứng cuộn hai chiều (Bidirectional Scroll) với GSAP `ScrollTrigger`:**
  Để giao diện vừa có hiệu ứng xuất hiện (fade in) khi cuộn xuống, vừa có hiệu ứng mờ dần (fade out) khi cuộn ngược lên ("cuộn ngược lên"):
  1. Sử dụng `ScrollTrigger` với cấu hình `toggleActions: "play reverse play reverse"` cho các khối section và grid card (`start: "top 85%"`, `end: "bottom 15%"`).
     - Khi cuộn xuống vào tầm nhìn: `onEnter` kích hoạt `play` (fade in & trượt lên).
     - Khi cuộn ngược lên rời tầm mắt: `onLeaveBack` kích hoạt `reverse` (fade out mượt mà).
  2. Không đặt `clearProps` trên các tween ScrollTrigger hai chiều để tránh làm mất trạng thái tween khi đảo chiều.

- **Tránh gắn đồng thời ScrollTrigger Scrub và Entrance Timeline trên cùng phần tử (Lỗi Banner bị ẩn khi cuộn ngược lên):**
  Khi một phần tử vừa được animate bằng `timeline.fromTo({ opacity: 0 }, ...)` vừa được gắn thêm `gsap.to(..., { scrub: 1, scrollTrigger: ... })`, ScrollTrigger khởi tạo ngay lập tức và đọc giá trị hiện tại của phần tử (đang là `opacity: 0` do timeline vừa thiết lập) làm giá trị gốc tại `scrollY = 0`. Hậu quả là khi người dùng cuộn ngược về đỉnh trang, ScrollTrigger đưa opacity trở về đúng giá trị gốc là 0, làm phần tử biến mất hoàn toàn.
  *Giải pháp*: Không gắn tween scrub lên các phần tử hero ở đỉnh trang vốn đã có entrance timeline. Để banner tự do hiển thị 100% với CSS gốc sau khi timeline entrance chạy xong, chỉ áp dụng ScrollTrigger đảo chiều cho các section nội dung bên dưới.
