# BE-01 — Tạo các bảng lưu câu hỏi, hội thoại và hạn mức AI

[Kế hoạch](../README.md) · [Backlog](../03-delivery-backlog.md) · [Kiến trúc](../02-architecture-and-contracts.md) · [ADR-002](../adr/ADR-002-postgres-queue-quota.md) · [ADR-007](../adr/ADR-007-receipts-accounting.md)

**Nghiệm thu local:** 23/10/2026, `Asia/Saigon`. **Kết quả:** hoàn thành BE-01; đã có cấu trúc bảng, bản cập nhật database và kiểm trên DB mới/DB nâng cấp, kể cả dùng client cũ. Chưa áp migration vào DB ứng dụng local/remote hoặc production. DB tạm đã được xóa sau kiểm; PostgreSQL thử của OPS-00 đã dừng, vẫn giữ data và DB nền `ai_lab_local` riêng.

BE-01 tạo **chỗ lưu bền vững cho tính năng AI**: người dùng hỏi gì, câu hỏi đang chờ hay đã xong, AI trả lời gì, đã giữ/dùng bao nhiêu hạn mức. Schema là mô tả cấu trúc này; migration là file cập nhật database theo mô tả đó.

Ví dụ, backend khởi động lại thì một mảng câu hỏi trong RAM sẽ mất. Các bảng BE-01 cho phép các task sau lưu và đọc lại câu hỏi từ database. BE-01 mới tạo nơi lưu và ràng buộc dữ liệu; BE-03/BE-04 mới thực hiện nhận và xử lý câu hỏi.

## 1. Đầu ra và phạm vi

- [Prisma schema](../../../src/backend/prisma/schema.prisma): 11 model R1, danh sách giá trị enum theo contract v1, quan hệ giữa bảng và chỉ mục tìm kiếm.
- [Migration mới](../../../src/backend/prisma/migrations/20261022000000_ai_lab_storage/migration.sql): tạo bảng, enum, chỉ mục, khóa ngoại và điều kiện kiểm dữ liệu; thêm bảy cột có thể để trống (`nullable`) vào `lab_attempts`. Không sửa ba migration cũ, xóa bảng/cột hoặc tự gán thông tin lịch sử không biết cho attempt cũ.
- Bộ kiểm riêng gồm [runner DB cách ly](../../../src/agent/scripts/test-ai-lab-storage.cjs), [Prisma config riêng](../../../src/agent/prisma/test.config.ts), [17 kiểm thử DB](../../../src/agent/node/storage.integration.test.js), [schema trước BE-01](../../../src/agent/node/fixtures/pre-be01.prisma) và [checksum migration cũ](../../../src/agent/node/fixtures/pre-be01-migrations.json).
- Đã thêm kiểm tra [CI PostgreSQL Integration](../../../.github/workflows/ci-cd.yml): cài DB mới, nâng cấp DB có dữ liệu, so cấu trúc, kiểm ràng buộc và client cũ. Test backup/restore đối chiếu **tên tất cả migration** trong repo, không cố định chỉ ba bản cũ.

Các task chia việc như sau: BE-01 tạo nơi lưu; BE-02/05 kiểm quyền và dữ liệu bản chụp; BE-03 nhận câu hỏi/giữ hạn mức; BE-04 nhận việc, cấp phép, chuyển trạng thái và chốt hạn mức; BE-08 làm API xóa/tự dọn theo thời hạn. Khóa ngoại chỉ kiểm quan hệ dữ liệu, không cấp quyền truy cập. Kiểm JSON là object cũng chưa thay cho kiểm khuôn nội dung hoặc lọc trường ẩn.

## 2. Mô hình và ràng buộc

| Model               | Ràng buộc DB và mục đích                                                                                                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AiConversation`    | Lưu hội thoại riêng của user + attempt, không tạo trùng cặp này. Epoch không âm; chỉ tách thông tin định danh sau khi có dấu xóa (`tombstone`). Có chỉ mục phục vụ xóa nội dung.                                                                                      |
| `AiRequest`         | Lưu từng câu hỏi; chặn trùng user + clientRequestId. Có thêm ownerKey + clientRequestId để vẫn nhận biết gửi trùng sau khi tách định danh. Mỗi user tối đa một `QUEUED`/`RUNNING` trên mọi attempt. Khóa ngoại ghép buộc user/attempt/conversation đúng cùng phạm vi. |
| `AiMessage`         | Lưu tin nhắn; mỗi request + role chỉ có một bản. Khóa ngoại ghép buộc đúng conversation/epoch của request. Chỉ mục phân trang `(conversationId, epoch, createdAt, id)`.                                                                                               |
| `AiProviderCall`    | Lưu lần gọi AI; không trùng request + stepIndex, R1 chỉ nhận step=0. Khóa ngoại ghép buộc contextHash khớp request. Token/cost chưa biết là SQL NULL; `FINAL` cần đủ usage. Text biên nhận có thể xóa riêng.                                                          |
| `AiQuotaBucket`     | Lưu một ô hạn mức theo scope + key + windowStart, không trùng cặp này. Bộ đếm không âm, khoảng thời gian hợp lệ; used + reserved không vượt limit cả lượt và tiền. Khi tạo bucket, key phải có environment và định danh giả.                                          |
| `AiReservation`     | Lưu hạn mức giữ chỗ; chặn trùng request + bucket và settlementKey. Bản đã chốt/hoàn cần đủ key, thời gian, số liệu. Không tự xóa dây chuyền làm mất dữ liệu chi phí.                                                                                                  |
| `AiUsageAdjustment` | Lưu điều chỉnh chi phí; idempotencyKey chặn ghi trùng. Delta có thể âm để điều chỉnh sổ, vẫn gắn với provider call được giữ lại.                                                                                                                                      |
| `AiExecutionSlot`   | Lưu chỗ chạy AI theo khóa environment + slotNumber. Mỗi request/call chỉ chiếm một slot; khóa ngoại ghép buộc đúng cặp call/request. Phải đủ thông tin chiếm chỗ và hạn giữ việc.                                                                                     |
| `AiRuntimePolicy`   | Lưu một chính sách mỗi environment. Nhận câu hỏi/cấp phép mặc định false, không tạo sẵn chính sách bật. Cấp phép cần providerConfigId; chương trình phải kiểm config JSON mặc định rỗng trước khi bật.                                                                |
| `AiFeedback`        | Lưu đánh giá của user cho message, không trùng cặp này; comment tối đa 500 ký tự, xóa theo message/user. API BE-07 vẫn phải kiểm chủ sở hữu.                                                                                                                          |
| `AiEventOutbox`     | Lưu sự kiện để xử lý tiếp; eventId là khóa chính, payload phải là object, bộ đếm không âm. Chỉ mục riêng cho sự kiện chưa xuất. Nơi tạo sự kiện phải kiểm không đưa text/secret vào payload.                                                                          |

Các từ trong bảng: unique là không cho trùng; khóa ngoại (FK) buộc dữ liệu tham chiếu có thật và đúng phạm vi; partial unique là chỉ chặn trùng ở một số trạng thái. Epoch là số phiên của dữ liệu; fence là số phiên worker nhận việc, dùng để chặn phiên cũ ghi lại.

Tiền dùng PostgreSQL `BIGINT`, đơn vị micro-USD. Prisma trả kiểu `bigint`, nên lớp DTO chuyển dữ liệu ra API sau này phải đổi sang giá trị JSON trong giới hạn contract. Revision/epoch/fence/unit dùng số nguyên không âm. Thời gian AI lưu `timestamptz(3)`; khoảng ngày/tháng tính theo giờ UTC của DB.

`ownerKey` là mã tham chiếu thay cho danh tính, do server tạo ổn định; không nhận từ browser, không chứa email/token. BE-03 phải dùng cùng key từ bộ tạo mã để vẫn nhận biết gửi trùng sau khi xóa nội dung. Schema không tự tạo key hoặc quản lý khóa bí mật của phép băm.

`AiRequest` giữ riêng mức gợi ý được xin/được phép, nguồn ghi nhận (`provenance`), sourceRevision, snapshot, contextHash và versions. Feedback cũ chỉ dùng `LAB_REVIEW`, revision NULL và không có kết quả LLM. Yêu cầu đang hoạt động cần bản chụp và định danh đầy đủ; yêu cầu kết thúc cần finishedAt. Những ràng buộc này chỉ kiểm bản ghi hiện tại; việc chuyển trạng thái có kiểm điều kiện và không mở lại yêu cầu đã kết thúc vẫn cần BE-03/04.

### Metadata lab

Bảy trường mới là `publicMetadata`, `publicMetadataProvenance`, `publicMetadataCapturedAt`, `feedbackRevision`, `feedbackRecordedAt`, `safeFeedbackSnapshot`, `feedbackProvenance`. Chúng giữ thông tin lab công khai, bản feedback, phiên bản và thời điểm/nguồn lấy dữ liệu. Tất cả có thể để trống, không có giá trị mặc định hoặc tự điền cho lịch sử. Feedback có revision thì revision không âm và phải có recordedAt; provenance chỉ nhận đúng nhóm giá trị cho phép.

BE-02 và luồng chấm mới sẽ ghi các trường này trong transaction phù hợp. Không lấy revision hiện tại gán cho feedback cũ vì sẽ làm sai nguồn lịch sử. BE-01 không đổi thuật toán chấm điểm.

### Xóa nội dung và giữ accounting

- User/attempt → conversation/request: `Restrict`, chặn xóa khi dữ liệu AI chưa xử lý. Lab vẫn xóa dây chuyền attempt như schema cũ, nhưng FK AI ngăn mất dữ liệu gián tiếp.
- Conversation → message và message → feedback: `Cascade`, xóa kèm nội dung. Message → request dùng `Restrict` để giữ liên kết lịch sử.
- Request → provider call/reservation; call → adjustment; bucket → reservation; slot → request/call: `Restrict`, giữ dữ liệu cần đối soát.
- Policy → updatedBy: `SetNull`, xóa người sửa không làm mất chính sách. Feedback → user: `Cascade`.

Test đã thử thứ tự: đánh dấu xóa hội thoại/tăng epoch → request `DELETED`, xóa snapshot → xóa message/feedback → tách userId/attemptId/conversationId khỏi request → xóa conversation/account/lab. Call/reservation/adjustment vẫn còn; receipt muộn vẫn cập nhật usage được.

Đây là các phép ghi SQL có kiểm soát để chứng minh cấu trúc hỗ trợ cách xóa đó, **chưa phải API hay transaction xóa BE-08**. Khi triển khai thật phải làm cùng nhau, kiểm quyền/fence và chặn đầu ra muộn.

## 3. Bằng chứng kiểm thử

Kết quả dưới đây thuộc lần nghiệm thu BE-01. Local dùng Node `24.12.0`, Prisma CLI/generator `7.10.0` từ lockfile và PostgreSQL cài trực tiếp `17.9`, cluster riêng cổng `55432`. Manifest runtime ghi `@prisma/client` `7.6.0`; client sinh từ schema trước/sau BE-01 đều được kiểm đọc/ghi với bộ phiên bản này. CI cấu hình PostgreSQL 16/Node 22; task chưa push/chạy GitHub.

| Kiểm tra thực chạy                                                              | Kết quả                                                                                                                                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma validate/generate; migrate deploy DB rỗng                                | Đạt; đầy đủ 11 bảng AI và metadata nullable.                                                                                                                        |
| Deploy ba migration cũ → seed bằng client cũ → deploy migration mới             | Đạt; cả **25 bảng domain cũ** có dữ liệu tổng hợp, số row và SHA-256 từng bảng/cột cũ trước/sau không đổi.                                                          |
| Deploy lại trên DB đã nâng cấp                                                  | Đạt, không có migration pending.                                                                                                                                    |
| DB → schema `migrate diff --exit-code`                                          | Exit 0 trên cả DB mới và DB nâng cấp.                                                                                                                               |
| Ràng buộc, race hai connection PostgreSQL, accounting, xóa và Prisma read/write | **17/17 trên DB mới + 17/17 trên DB nâng cấp**, không skip.                                                                                                         |
| Client trước BE-01 sau nâng cấp                                                 | Đọc attempt kèm lab/commands, serialize JSON, ghi qua `withAttempt` hiện có và tạo attempt mới đều đạt. Đây là rollback **code/client**, không phải down migration. |
| Kiểm backup/restore hiện có trên DB tạm riêng                                   | **1/1 đạt**: giữ kết quả exam cũ, đủ migration, khôi phục uploads, từ chối restore đè đích không rỗng và archive sai checksum.                                      |
| CLI simulator offline                                                           | **76 đạt, 1 DB/HTTP test bỏ qua**.                                                                                                                                  |
| Account/exam unit offline                                                       | **5 đạt, 2 integration test bỏ qua**; test operations trong hai ca này đã chạy riêng như dòng trên.                                                                 |
| Contract Node                                                                   | **100/100 đạt**.                                                                                                                                                    |
| ESLint/Prettier, source boundaries và liên kết tài liệu                         | Đạt; 1.160 import/asset trong 274 source file, 167 liên kết local trong 23 tài liệu AI.                                                                             |

Runner là công cụ tự tạo môi trường và chạy test. Nó giữ báo cáo JSON chỉ có hash/count và kết quả ở `.tmp/ai-lab-be01/<run>/evidence.json`, bị Git ignore, cùng client cũ sinh riêng để kiểm. Không lưu khóa/mật khẩu vào báo cáo. Trong `finally`, chỉ xóa DB tạm khi tên đúng prefix và OID khớp DB nó đã tạo.

Chi tiết để chạy lại đúng cấu hình: partial index cần `previewFeatures = ["driverAdapters", "partialIndexes"]` với phiên bản Prisma đang khóa. PostgreSQL đổi cách viết điều kiện enum `IN` thành `= ANY (ARRAY[...::enum])`; schema dùng đúng biểu thức database trả để phép so không báo khác giả, vẫn chặn ở `QUEUED`/`RUNNING`. Các điều kiện `CHECK` viết trong SQL được thử bằng lỗi DB trực tiếp, vì schema diff không kiểm chúng. Tham khảo [Prisma partial indexes](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/indexes#configuring-partial-indexes-with-where) và [migration với tính năng ngoài schema](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features).

## 4. Chạy lại

Từ root repository, PowerShell:

```powershell
pnpm.cmd ai:db:start
pnpm.cmd test:ai:storage
pnpm.cmd ai:db:stop
```

Runner không nhận URL ứng dụng hoặc lệnh reset. Nó đọc file kết nối riêng của helper OPS-00, kiểm loopback/port/user/database, thư mục data và mã nhận diện cluster rồi mới tạo hai DB `ai_lab_be01_fresh_*` và `ai_lab_be01_upgrade_*`. Prisma dùng config riêng, không đọc dotenv hoặc tự dùng `DATABASE_URL`. Mất file kết nối/sai cluster thì dừng, không chuyển sang DB từ xa.

Trong GitHub CI, chỉ nhận `AI_TEST_ADMIN_URL` khi `CI=true` và URL là `127.0.0.1:5432/postgres`; đó là DB dữ liệu tổng hợp của job. Không dùng khóa provider, nạp chương trình gọi Gemini hoặc gọi mạng AI.

Khi đưa code vào môi trường ứng dụng, phải áp migration lên **đúng DB của môi trường đó** trước khi chạy client mới, vì client đọc các cột vừa thêm. Nếu quay lại code cũ thì giữ nguyên schema bổ sung; không drop bảng chi phí hoặc sửa migration đã áp. Task này chỉ kiểm DB tạm và chuẩn bị thay đổi để review, chưa đổi cấu hình DB ứng dụng.

**Bước tiếp theo tại mốc BE-01:** BE-02 kiểm quyền AI và chụp trạng thái bài làm bằng ba lab đã chứng nhận. Các mốc xác thực, dữ liệu riêng tư, hạn mức/worker và pilot vẫn cần kiểm theo từng task sau.

### Dọn artifact ngày 23/10/2026

Theo yêu cầu dọn file test thừa, đã xóa client/schema/migration tạm và helper dùng một lần trong `.tmp/ai-lab-be01` (106 file, khoảng 43,6 MiB). Giữ hai `evidence.json`, dữ liệu mẫu gốc và source test. Runner sẽ sinh lại những file tạm cần thiết vào lần chạy sau.
