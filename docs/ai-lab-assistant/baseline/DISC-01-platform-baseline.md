# DISC-01 — Kiểm kê hệ thống hiện có trước khi thêm AI

[Kế hoạch](../README.md) · [Backlog](../03-delivery-backlog.md) · [Issue cần xử lý](DISC-01-blockers.md) · [ADR nền tảng](../adr/ADR-000-platform-baseline.md)

**Ngày kiểm kê:** 19/10/2026, múi giờ `Asia/Saigon`. **Trạng thái:** đã kiểm kê xong; chưa xác nhận toàn hệ thống đủ điều kiện cho học viên thử AI. Người thực hiện giữ vai trò SO/SE. Phiên này chỉ đọc cấu hình, thông tin phiên bản trên GitHub, HTTP công khai và cấu trúc DB; không triển khai, migrate, đăng nhập hoặc tạo dữ liệu thử trên production.

Task này trả lời: **code ở đâu, phần nào đang chạy, database nào đang được dùng và còn thiếu gì trước khi thêm AI?** “Baseline” là bản ghi làm mốc để đối chiếu về sau. Mọi trạng thái dưới đây là ảnh chụp ngày kiểm kê, không phải kiểm tra lại ngày bạn đang đọc.

Ví dụ, trang web mở được nhưng backend cổng 5500 không chạy thì luồng lab local vẫn chưa dùng được. Hoặc file `.env` trên máy trỏ database từ xa thì chạy test theo cấu hình đó có thể ghi vào dữ liệu thật.

Quy ước đọc: **đã kiểm tra** là thấy trực tiếp trong phiên này; **cấu hình** là cách code được viết; **lịch sử** là kết quả báo cáo cũ; **chưa xác minh** là chưa đủ bằng chứng để đánh dấu qua mốc nghiệm thu.

## 1. Matrix local/main/staging/production

Đây là bảng đối chiếu bốn nơi: máy phát triển (local), nhánh GitHub (main), môi trường thử trước phát hành (staging) và môi trường đang phục vụ người dùng (production). Commit/SHA nhận diện phiên bản code; thông tin triển khai chưa tự chứng minh chương trình đang chạy đúng phiên bản đó.

| Môi trường         | Commit / bản đang chạy                                                                                                                                                          | Frontend / API                                                                                                                         | DB, migration và storage                                                                                                                                       | Kết luận                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Local working tree | Nhánh `developer`, HEAD `20ba2527e120b3e0c1e52a8b05e1f9562042a2be`; thay đổi chưa commit liệt kê bên dưới. Không có endpoint chứng minh commit của dev server                   | `http://localhost:3000/` trả 200, tải `/static/js/bundle.js`; `http://localhost:5500/api/health/ready` bị `ECONNREFUSED`               | `.env` trỏ **remote Supabase**, không phải DB test local. Ba migration đã kiểm tra trực tiếp trên đích này                                                     | Frontend đang phục vụ; luồng lab local chưa chạy trọn vẹn. Phải tách DB trước test có ghi dữ liệu |
| GitHub `main` / CI | `19394880a555c037640462be982e714910df71f5`; PR #9 đã merge. Tree trùng HEAD local, nhưng commit khác nhau                                                                       | Run `39147574217` thành công cả Test & Build, PostgreSQL Integration và Deploy to Vercel                                               | DB PostgreSQL 16 tổng hợp của CI; không phải bằng chứng DB staging/production                                                                                  | Đã xác minh source/CI của đúng SHA, không suy ra toàn stack đang chạy SHA này                     |
| Staging / preview  | GitHub deployment `7156183870` ghi Vercel **Preview**, SHA `20ba2527e120b3e0c1e52a8b05e1f9562042a2be`                                                                           | URL deployment preview chuyển tới trang đăng nhập Vercel; HTTP cuối 200 là trang login. Chưa xác minh app/API qua preview              | Chưa xác minh backend, DB, uploads, keys riêng hoặc migration của staging                                                                                      | Có frontend preview deployment; chưa có bằng chứng một staging stack cách ly                      |
| Production         | GitHub deployment `7157774888` ghi Vercel **Production**, SHA `19394880a555c037640462be982e714910df71f5`. Chưa xác minh SHA backend Render và liên kết alias với deployment này | Alias `https://ccna-master.vercel.app/` trả app 200; bundle công khai trỏ `https://ccna-master.onrender.com/api`; Render readiness 200 | Chưa đọc cấu hình host để chứng minh Render dùng đúng DB Supabase đang kiểm tra. Backup local có bằng chứng riêng ở mục 5; lịch backup trên host chưa xác minh | Đã kiểm tra HTTP cơ bản, chưa xác nhận release manifest và toàn stack                             |

URL bản triển khai production: `https://ccna-master-n13q2eydj-duynguyen-s-projects.vercel.app`; preview: `https://ccna-master-b43z7nwzm-duynguyen-s-projects.vercel.app`. Cả hai đều chuyển tới trang đăng nhập Vercel khi mở công khai. Nhận HTTP 200 của trang đăng nhập chưa chứng minh ứng dụng đã chạy thử thành công.

Việc tách DB local/staging và khôi phục luồng local được theo dõi tại [DISC-B01](DISC-01-blockers.md#disc-b01--db-local-và-staging-cách-ly); chưa dùng DB từ `.env` hiện tại cho test có ghi dữ liệu.

### Trạng thái Git và thay đổi chưa triển khai

- Nguồn trực tiếp: [PR #9](https://github.com/duynguyen2003/ccna-master/pull/9), [commit main](https://github.com/duynguyen2003/ccna-master/commit/19394880a555c037640462be982e714910df71f5), [CI main](https://github.com/duynguyen2003/ccna-master/actions/runs/39147574217). PR merge lúc **00:00:23 ngày 19/10/2026**; CI hoàn tất **00:04:05** cùng ngày, giờ Việt Nam.
- GitHub compare `developer...main`: main đi trước 2 commit, **0 file khác biệt**. Tree SHA của main và HEAD local đều là `9377654c38667425150d126e273ca59b027668d6`. Không được gọi các thay đổi workspace/UI của PR #9 là “chỉ có local” nữa.
- Ref local chưa cập nhật: `origin/main` còn `a3abe7a2fbffe12839a251d05acbd5e8b73a6651`, nhánh local `main` còn `fb86d4f`; chúng không phản ánh main GitHub hiện tại. Task kiểm kê không fetch/checkout/merge.
- Trước khi ghi báo cáo, working tree có xóa `coure.md`, xóa `docs/ui-browser-default-audit.md`, và file chưa track `docs/ai-lab-assistant/ai-lab-tasks.md`. Giữ nguyên các thay đổi này. Báo cáo DISC-01, ADR và cập nhật README/backlog trong task này cũng chưa commit/deploy.

## 2. Runtime và kiểm tra HTTP

| Kiểm tra trong phiên            | Kết quả                                                                                                     | Giới hạn                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Node / pnpm local               | Node `v24.12.0`; `pnpm.cmd` `10.33.4`, phù hợp manifest                                                     | PowerShell chặn `pnpm.ps1`; gọi `pnpm.cmd` được, không cần đổi execution policy                  |
| Docker runtime                  | Không kết nối được Docker engine; CLI còn báo không đọc được config                                         | Chưa chứng minh daemon đang chạy hoặc container nào được triển khai; không build/start container |
| Production frontend             | GET alias: 200; entry bundle `/static/js/main.4830953b.js`                                                  | Không có bằng chứng ánh xạ bundle tới SHA từ host                                                |
| Production readiness / liveness | GET `/api/health/ready`: 200 `{"status":"ok"}`; `/api/debug-ping`: 200 `{"message":"pong"}`                 | Readiness chỉ kiểm `SELECT 1`, không chứng minh schema/auth đầy đủ                               |
| Production CORS                 | GET readiness với Origin `https://ccna-master.vercel.app`: 200, allow-origin khớp, allow-credentials `true` | Chưa kiểm toàn bộ origin của preview hoặc proxy/IP                                               |
| Production lab không token      | GET `/api/lab-attempts/00000000-0000-4000-8000-000000000000`: 401                                           | Chỉ kiểm từ chối request vô danh; không chứng minh revoke/member/account-switch                  |
| Auth/session unit local         | `node --test src/backend/src/security/session.test.js`: **2/2 qua**                                         | Mock DB; không thay thế staging E2E                                                              |
| Ranh giới source                | `pnpm.cmd check:boundaries`: **1.080 import/asset, 258 source file**, đạt                                   | Kiểm source local, không phải runtime production                                                 |

Ở mốc kiểm kê, code đăng nhập kiểm chữ ký HS256, tài khoản còn hoạt động/chưa xóa, `sessionVersion` và vai trò mới nhất trong DB ở mỗi request. Quyền bài làm đọc owner/members sau khi lấy khóa dùng chung theo attempt. Lúc này chưa có hội thoại/hạn mức AI mới. Xem [auth.js](../../../src/backend/src/middleware/auth.js), [session.test.js](../../../src/backend/src/security/session.test.js), [attemptAccess.js](../../../src/backend/src/simulation/attemptAccess.js). Kiểm thu hồi phiên/quyền trên staging còn ở [DISC-B02](DISC-01-blockers.md#disc-b02--revision-backend-và-xác-minh-auth-runtime).

## 3. Migration và schema

Đã kiểm **DB Supabase trong `.env` local**. Báo cáo cập nhật database cũ gọi đây là production, nhưng chưa đọc kết nối trên Render để chứng minh backend dùng cùng DB. Báo cáo không ghi hostname nội bộ, user DB, URL kết nối hoặc dữ liệu học viên.

Chỉ đọc lịch sử và cấu trúc bằng `pg`: `BEGIN READ ONLY`, giới hạn mỗi câu lệnh 5 giây, SELECT `_prisma_migrations` và `information_schema.columns`, rồi `ROLLBACK`. Cả ba migration có `finished_at`, không có `rolled_back_at`; dấu kiểm SHA-256 **khớp file local**, nghĩa là các file migration được đối chiếu có cùng nội dung:

| Migration                                    | Trạng thái trực tiếp       | Applied steps |
| -------------------------------------------- | -------------------------- | ------------: |
| `20260901000000_baseline`                    | Đã ghi nhận; checksum khớp |             0 |
| `20260922190000_add_video_progress_sessions` | Đã ghi nhận; checksum khớp |             0 |
| `20261015000000_sessions_exam_attempts`      | Đã áp dụng; checksum khớp  |             1 |

Hai migration đầu có steps 0, phù hợp lịch sử dùng `resolve --applied` để ghi nhận đã áp dụng. Đã thấy `users.is_active`, `users.deleted_at`, `users.session_version` và bảng `exam_attempts` có cột bản chụp/thời hạn/nộp bài. Các bản ghi đã đọc không có migration dở dang.

**Chưa kiểm được toàn bộ cấu trúc DB có lệch schema hay không** (gọi là schema drift). Đã thử lệnh chỉ đọc:

```text
pnpm.cmd exec prisma migrate diff --from-config-datasource --to-schema src/backend/prisma/schema.prisma --script
```

Lệnh lỗi `P1011` do TLS trên Windows (`No credentials are available in the security package`). Không tắt kiểm chứng TLS hoặc chạy resolve/deploy để chữa lỗi kết nối. Lần nâng cấp trước có báo cáo không lệch, nhưng cần chạy lại phép so cho mốc hiện tại. Theo dõi ở [DISC-B03](DISC-01-blockers.md#disc-b03--đối-chiếu-db-runtime-và-schema-drift).

## 4. Topology và proxy

**Đường truy cập đã thấy:** trình duyệt tải frontend Vercel → JavaScript gọi API HTTPS trên Render → lớp nhận truy cập của Render → Express → DB mà API readiness kiểm. Chưa xác minh số lớp trung gian, firewall, `TRUST_PROXY`, DB URL và nơi gắn lưu trữ từ cấu hình Render. Vercel phục vụ frontend tĩnh; [vercel.json](../../../vercel.json) chỉ chuyển route cho SPA, không có backend `/api`.

**Cấu hình Compose thường** ([compose.yaml](../../../compose.yaml), [nginx.conf](../../../docker/nginx.conf)):

```text
Browser → frontend:Nginx:80 → backend:5000 → db:5432 (PostgreSQL 16)
                               └→ uploads_data
                              migrate → hoàn tất trước backend
```

Theo Compose, frontend mở `${FRONTEND_PORT:-3000}:80`; backend mở `127.0.0.1:5500:5000`; DB không mở cổng ra host. `TRUST_PROXY=1` dựa trên giả định chỉ có một lớp Nginx nhận truy cập. Đây là cách cấu hình trong repo, chưa chứng minh Render đang chạy theo sơ đồ đó.

**Compose chạy nhiều backend** ([compose.scale.yaml](../../../compose.scale.yaml), [nginx.scale.conf](../../../docker/nginx.scale.conf)): hai replica, không mở cổng backend ra host, Nginx chuyển tới `backend:5000`. `/api/lab-attempts/` có trần **4 request/giây/IP, burst 24**, vượt trả 429. Việc hỏi trạng thái AI cũng đi qua prefix này.

Bộ đếm Express ở RAM từng process, chưa dùng chung. Chưa đo khi cả lớp dùng chung IP Internet (NAT) hoặc kiểm IP được proxy chuyển tiếp trên host thật. Giữ chính sách hiện có; cần xử lý theo [DISC-B05](DISC-01-blockers.md#disc-b05--proxy-trust-và-tải-chung-ip).

## 5. Backup/restore

- Công cụ hiện có: [backup.cjs](../../../src/scripts/backup.cjs), [restore.cjs](../../../src/scripts/restore.cjs), [operations.md](../../operations.md). Gói chuẩn gồm `database.dump`, `uploads.tar.gz` và manifest SHA-256 để kiểm nội dung. Restore yêu cầu DB/uploads trống và xác nhận tên DB đích.
- Báo cáo lần trước ở `backups/production-before-migration-2026-10-18-1792258179658/migration-report.md`, bị Git ignore. Nó ghi đã khôi phục vào PostgreSQL riêng, so 24 dấu nhận diện dữ liệu và thử đăng nhập/thi trên bản sao. DISC-01 không chạy lại lần restore này.
- Kiểm trực tiếp trong phiên ngày 19/10: file `public.dump` có thật, kích thước và SHA-256 khớp manifest, có dấu nhận diện của 24 bảng. Manifest ghi `createdAt=2026-10-17T17:29:49.994Z` (00:29:49 ngày 18/10, giờ Việt Nam).
- Gói cũ **không có `uploads.tar.gz`**, cũng khác định dạng manifest/archive của `pnpm restore`; không đưa trực tiếp vào script restore hiện tại. Đã có bằng chứng backup DB, còn backup đầy đủ DB + uploads/Cloudinary chưa được chứng minh.
- Chưa kiểm lịch tự động, bản sao khác máy, mã hóa hoặc cảnh báo backup quá cũ. RPO là mức dữ liệu có thể mất, RTO là thời gian cần để khôi phục; cả hai chưa được đo trên host thật. Xem [DISC-B04](DISC-01-blockers.md#disc-b04--backup-đầy-đủ-và-restore-trên-môi-trường-cách-ly).

## 6. Inventory biến môi trường — chỉ tên key

Đây là danh sách tên biến lấy từ `.env.example`/`.env`, code cấu hình, Compose và workflow. Không ghi giá trị, hash/độ dài khóa bí mật hoặc URL kết nối. “Có local” chỉ nghĩa là thấy cấu hình trong phiên kiểm kê, chưa chứng minh khóa dùng được hoặc server đang chạy dùng đúng giá trị đó.

| Nhóm             | Tên key                                                                                                                | Bằng chứng / trạng thái                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB               | `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`                                                    | Local có `DATABASE_URL`; ba key `POSTGRES_*` chỉ thấy ở template/Compose                                                                                                  |
| Auth             | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`                                                                   | Hai key đầu có local; refresh key là tùy chọn trong source, không có trong `.env` đã đọc                                                                                  |
| Google           | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `REACT_APP_GOOGLE_CLIENT_ID`                                               | Có local; chỉ key `REACT_APP_*` là cấu hình công khai cho frontend                                                                                                        |
| Media            | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`                                                 | Có local; chưa xác minh riêng từng môi trường                                                                                                                             |
| Email            | `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS`                                                                            | Có local; không gửi email kiểm thử trong task                                                                                                                             |
| AI cũ            | `LAB_AI_URL`, `LAB_AI_KEY`, `LAB_AI_MODEL`                                                                             | Có trong template/Compose; chưa đặt trong môi trường kiểm kê local. Trạng thái trên Render chưa xác minh                                                                  |
| Runtime / proxy  | `NODE_ENV`, `PORT`, `BACKEND_PORT`, `FRONTEND_PORT`, `FRONTEND_URL`, `CORS_ORIGIN`, `TRUST_PROXY`, `REACT_APP_API_URL` | Local có `PORT`, `BACKEND_PORT`, `REACT_APP_API_URL`; các key còn lại theo source/template/Compose, chưa xác minh host                                                    |
| Storage / backup | `UPLOADS_DIR`, `BACKUP_DIR`, `PG_DUMP_BIN`, `PG_RESTORE_BIN`                                                           | Source hỗ trợ, chưa đặt local; lib backup sinh `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE` trong môi trường tiến trình con                      |
| Deploy frontend  | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`                                                                   | Workflow yêu cầu cho GitHub Environments `preview`/`production`. API liệt kê tên secret cấp repo và hai environment đều trả **401**; chưa xác minh inventory trên dịch vụ |

Ở mốc kiểm kê, `AI_INTERNAL_*`, `AI_PROVIDER_*`, `AI_CONTEXT_*`, `AI_BUDGET_*` mới là nhóm biến đề xuất, chưa có bằng chứng đang cài trên host. Không thêm khóa provider vào frontend. Kiểm danh sách biến trên host thuộc [DISC-B06](DISC-01-blockers.md#disc-b06--inventory-secrets-theo-môi-trường).

Code [labFeedback.js](../../../src/backend/src/simulation/labFeedback.js) ở mốc này còn gọi provider trực tiếp bằng ba key `LAB_AI_*`, chưa đi qua hạn mức/sổ chi phí lưu database của luồng mới. BE-06 cần xử lý đường cũ trước khi bật model thật của hệ thống mới; xem [DISC-B07](DISC-01-blockers.md#disc-b07--đường-gọi-ai-có-phí-cũ). Phiên kiểm kê không gọi provider.

## 7. Nghiệm thu và bước tiếp theo

- [x] Matrix local/main/staging/production có commit, nguồn bằng chứng và phần chưa xác minh.
- [x] Phân biệt working tree, refs local cũ, source đã merge, deployment frontend và runtime backend.
- [x] Kiểm kê auth, migration, proxy, backup và tên key; không đưa credential/dữ liệu học viên vào artifact.
- [x] Mỗi vấn đề còn mở có issue, owner và điều kiện đóng trong [sổ issue DISC-01](DISC-01-blockers.md).
- [x] Không dùng CI main xanh làm bằng chứng stack đủ điều kiện pilot; không thay đổi production.

**DISC-01 đã xong việc kiểm kê.** Những phần thiếu bằng chứng đã có issue và mốc cần xử lý. Trước test có ghi dữ liệu cần môi trường cách ly; trước các mốc vận hành cần đóng issue tương ứng. Chưa nghiệm thu G0/G1/G2 hoặc tính năng trợ lý AI.

Theo kế hoạch lúc kiểm kê, bước sau là DISC-02 quan sát/phỏng vấn học viên. Sau đó người dùng đã yêu cầu bỏ qua DISC-02 và tiếp tục DISC-03; việc bỏ qua không được tính là đã nghiên cứu người học.
