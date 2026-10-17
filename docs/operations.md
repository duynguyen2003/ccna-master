# Vận hành MVP CCNA

## Thay đổi khi nâng cấp

Backend kiểm tra trạng thái, quyền và `sessionVersion` ở mỗi request có token. Khóa/xóa/khôi phục tài khoản, đổi quyền, reset mật khẩu và logout tăng phiên bản phiên; token cũ bị từ chối. Logout thu hồi toàn bộ phiên của tài khoản. Token trước nâng cấp không có `sessionVersion` cũng bị thu hồi: người dùng cần đăng nhập lại. Nếu thay đổi mật khẩu/quyền trực tiếp qua SQL, đồng thời tăng `session_version`; ưu tiên API quản trị.

Thi dùng `POST /api/exams/:id/attempts` để bắt đầu hoặc tiếp tục lượt đang mở; `GET /api/exams/:id/attempts/:attemptId` để khôi phục. `POST /api/exams/:id/submit` bắt buộc `{ attemptId, answers }`. Client cũ thiếu attemptId nhận 400, vì vậy triển khai frontend/backend cùng cửa sổ bảo trì. Một lượt có một kết quả, retry trả cùng resultId, làm lại tạo lượt mới. Thời gian bắt đầu/hạn nộp/thời gian sử dụng do server quyết định. Quá hạn nhận 409; frontend khóa chọn đáp án và thử gửi khi còn một giây. Mất mạng qua hạn nộp không gia hạn lượt.

Đề, đáp án, giải thích và ngưỡng đạt được chụp lúc bắt đầu. API attempt loại đáp án đúng và giải thích; chỉ chủ kết quả đọc được bản chụp đầy đủ. Kết quả trước nâng cấp giữ điểm/đáp án đã lưu nhưng không thể phục dựng đề gốc bị sửa; API trả `legacyUnavailable: true` và không trả câu hỏi hiện tại thay cho đề cũ.

## Cấu hình và triển khai

1. Tạo GitHub Environments `preview` và `production`, mỗi môi trường có `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Thiếu secrets làm deploy thất bại. Có thể dùng hai project Vercel riêng; bật protection cho production theo quy trình nhóm.
2. Đặt `REACT_APP_API_URL` preview trỏ backend thử nghiệm và production trỏ backend production. Hai backend dùng database/uploads/secrets riêng. Workflow chỉ triển khai frontend; cấp phát backend/database và cấu hình secrets trên dịch vụ vẫn cần thực hiện ở hạ tầng.
3. Backend production bắt buộc `DATABASE_URL`, `JWT_SECRET` ngẫu nhiên riêng ít nhất 32 ký tự, `FRONTEND_URL`, `CORS_ORIGIN`. Compose còn bắt buộc `POSTGRES_PASSWORD`. URL encode password khi ghép DATABASE_URL. Cấu hình email/Cloudinary/OAuth trước khi bật chức năng tương ứng.
4. Thử staging, dừng ghi và backup trước migration. DB mới: `pnpm exec prisma generate`, `pnpm run db:deploy`, `pnpm run server`. Compose: `docker compose --env-file <environment-file> up --build -d`; service `migrate` hoàn tất trước backend. Không chạy `db push` trên DB có dữ liệu thật.
5. Kiểm readiness, đăng nhập/quyền, ghi chú/tiến độ và một lượt thi trước khi mở ghi. Lưu image/commit trước rollout. Rollback code bằng image tương thích schema; lỗi dữ liệu thì restore sang đích mới rồi chuyển kết nối, không tự đảo migration.

`migrate deploy` áp dụng migration đã commit, không tự kiểm tra drift; xem [Prisma v7](https://www.prisma.io/docs/cli/v7/migrate/deploy).

## Baseline cho DB đã tồn tại

Ba migration: `20260901000000_baseline`, `20260922190000_add_video_progress_sessions`, `20261015000000_sessions_exam_attempts`. Baseline mô tả schema trước video sessions và thay đổi tài khoản/thi.

- Backup và thử restore trên bản sao. Kiểm `_prisma_migrations`, schema thật, enum/index/FK. Không chạy baseline CREATE TABLE vào DB đã có bảng.
- Nếu DB cũ đúng baseline và chưa có lịch sử, đối chiếu trên bản sao rồi chạy `pnpm exec prisma migrate resolve --applied 20260901000000_baseline`, sau đó `pnpm run db:deploy`. Migration video idempotent có thể áp dụng khi bảng/column đã tồn tại nhưng vẫn cần kiểm định nghĩa.
- Nếu migration video đã được ghi nhận, giữ nguyên file/bản ghi; đối chiếu rồi resolve baseline. Drift khác cần migration hòa giải được xem xét, không đánh dấu schema chưa có.
- Đối chiếu bằng `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`. Trước nâng cấp chỉ có thay đổi dự kiến; sau nâng cấp diff phải rỗng. Kiểm riêng lịch sử migration và dữ liệu.
- Migration mới chỉ thêm column/table/index/FK; kết quả cũ không bị xóa/chấm lại. Test vận hành tạo baseline có kết quả cũ, resolve/deploy và xác minh dữ liệu còn nguyên.

## Backup và restore

Cần `pg_dump`, `pg_restore` cùng major hoặc mới hơn server và `tar` trong PATH. Có thể đặt `PG_DUMP_BIN`, `PG_RESTORE_BIN` thành đường dẫn executable. Credentials truyền qua môi trường; không đưa password vào command line. Không commit archive/secrets.

1. Bật bảo trì, chặn upload/tác vụ ghi và chờ request hoàn tất. `pg_dump` nhất quán trong DB; DB và filesystem cần cửa sổ ngừng ghi chung. Với Docker, đưa đúng dữ liệu từ volume uploads vào staging dưới quyền vận hành; DB phải truy cập được từ máy chạy script. Không dùng uploads rỗng trong checkout thay cho volume thật.
2. Đặt `DATABASE_URL`, `UPLOADS_DIR` nguồn và `BACKUP_DIR` được bảo vệ, chạy `pnpm backup`. Archive gồm `database.dump`, `uploads.tar.gz`, manifest SHA-256. Chỉ coi thành công khi exit 0 và manifest đầy đủ.
3. Lưu bản sao khác máy, mã hóa/giới hạn quyền. Đặt lịch mỗi ngày và trước migration, giữ 7 bản ngày/4 bản tuần tùy nhu cầu; giám sát tuổi backup/lỗi tác vụ. Media Cloudinary cần backup/export riêng; script chỉ sao lưu PostgreSQL và uploads trên disk.
4. Tạo DB và uploads đích trống, đổi DATABASE_URL/UPLOADS_DIR rồi chạy `pnpm restore <backup-directory> --confirm-database <database-name>`. Script kiểm checksum/đường dẫn archive và từ chối ghi đè dữ liệu có sẵn. Nếu thất bại, giữ bảo trì và thử lại với đích trống mới.
5. Kiểm số người dùng/kết quả/ghi chú/tiến độ, mở file mẫu, đăng nhập/xem kết quả và `pnpm exec prisma migrate status`. Chỉ chuyển kết nối sau xác minh. Ghi thời gian backup/restore và khoảng mất dữ liệu; diễn tập hằng tháng/trước thay đổi lớn.

CI chạy `OPERATIONS_INTEGRATION=1 pnpm run test:core` với DATABASE_URL kết thúc `_test`. Test tự tạo hai DB riêng, nâng cấp dữ liệu cũ, backup/restore DB/file, kiểm từ chối ghi đè và archive hỏng. CREATE DATABASE chỉ cần ở CI/test, không cần cho runtime production.

## Health, proxy và sự cố

- Liveness `/api/debug-ping`; readiness `/api/health/ready` chạy SELECT 1, trả 200/503 theo DB; Docker dùng readiness. Cấu hình monitor ngoài cho readiness, 5xx, latency và tuổi backup, chuyển cảnh báo đến kênh vận hành được chọn. Repo chưa kết nối nhà cung cấp cảnh báo.
- `TRUST_PROXY=0` khi truy cập trực tiếp, `1` khi Nginx là đường vào duy nhất. Nếu thêm CDN/load balancer, dùng số hop hoặc subnet tin cậy đúng topology, không dùng `true`. Backend Compose chỉ publish loopback; xác minh firewall/cổng thực tế. Xem [express-rate-limit proxy guide](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues).
- Backend giới hạn thi/CLI/tiến độ theo userId, login/reset theo IP. Nginx scale giữ giới hạn Lab 4 request/giây, burst 24 theo IP; lớp dùng chung NAT vẫn có thể gặp 429 ở tầng này. Cần đo tải/đánh giá chống DoS trước khi thay chính sách edge. Đề xuất xóa giới hạn này đã bị kiểm duyệt tự động từ chối do rủi ro DoS, nên chưa áp dụng.
- Bộ đếm backend đang ở RAM từng process; trước khi cần giới hạn toàn cụm, bổ sung store chung như Redis và test nhiều replica. Repo chưa có Redis store.
- DB lỗi: kiểm readiness/log/kết nối/tài nguyên, dừng rollout nếu migration lỗi, đọc `prisma migrate status`; chỉ resolve khi hiểu trạng thái thực tế, không reset DB.
- Lạm dụng tài khoản: khóa qua API admin, kiểm token cũ nhận 401, giữ audit log; đổi JWT secret nếu cần thu hồi toàn hệ thống. Không log token/password/connection URL.
- Lỗi chấm thi: giữ snapshot/kết quả để điều tra, đóng đề với lượt mới, tái hiện trên DB test; không tự chỉnh lịch sử điểm hàng loạt.

## Trước nhóm học thử

Test dùng dữ liệu tổng hợp, chưa xác minh nội dung production. Chủ nội dung cần duyệt một khóa: mục tiêu → bài/video → lab chạy được → đề thi và giải thích; kiểm từng link/file bằng tài khoản học viên, ghi người/ngày duyệt. Trên staging kiểm người mới, tiếp tục bài, reload/mất mạng và chuyển tài khoản cùng trình duyệt.

Chọn nhóm nhỏ và kênh báo lỗi/góp ý kèm mã bài/phiên bản. Đo bắt đầu học trên số đăng ký, hoàn thành bài đầu trên số bắt đầu, quay lại ngày 7 trên cohort đủ tuổi, chênh lệch điểm đầu/cuối trên đề tương đương. Dữ liệu tiến độ/điểm hỗ trợ phân tích nhưng chưa có event analytics/dashboard cohort/form góp ý riêng.

Nếu thu phí, bổ sung ownership/enrollment ở backend, webhook thanh toán idempotent, quyền xem/tải media và hỗ trợ/hoàn tiền. API nội dung công khai và uploads tĩnh hiện chưa kiểm soát nội dung trả phí. Các chức năng thương mại chưa triển khai/xác minh.
