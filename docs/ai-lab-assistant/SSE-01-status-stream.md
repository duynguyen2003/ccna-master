# SSE-01 — trạng thái thật và kết quả đã xác thực

Đợt 1 triển khai ngày 02/11/2026. Không chuyển `generateContent` sang token streaming;
model output vẫn qua kiểm tra cuối và transaction lưu message/quota/request.

## Hợp đồng và tương thích

- Client tạo request bằng POST hiện có; `clientRequestId` và admission idempotency
  không đổi. Theo dõi bằng `fetch GET /api/lab-attempts/:attemptId/ai/requests/:id/events`.
  Bearer nằm trong header, không nằm trong URL. Đóng stream không hủy generation.
- API JSON chỉ công bố `progress` và capability `streaming` khi header
  `X-AI-Progress: 1`. Client mới tự gửi header; bundle cũ nhận đúng hình dạng v1 cũ.
  Client mới làm việc được với backend cũ bằng polling.
- `RequestStreamEvent` là schema nguồn trong `contracts/aiLabContract.js`; JSON
  Schema được sinh lại bằng `node src/agent/scripts/generate-ai-lab-contracts.cjs`.
  Envelope gồm `contractVersion`, `kind`, `data` (RequestResource hiện có).
- `progress` gồm `streamVersion`, `phase`, `deviceId?`, `unitStatus`, `reasonCode`, `recoveryAction`
  và `deadlineAt`. Version tăng khi claim/phase/requeue/terminal; heartbeat không
  tăng version. Không dùng topology revision hoặc lease version làm event cursor.

| Event             | Khi phát                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `state`           | Snapshot QUEUED/RUNNING, không chứa câu trả lời model.                                                |
| `result`          | Snapshot có kết quả đã commit; có thể là fallback deterministic hiện có.                              |
| `terminal`        | Kết thúc không có result, giữ nguyên status FAILED/CANCELLED/EXPIRED/OUTCOME_UNKNOWN/REVOKED/DELETED. |
| `error`           | ErrorResponse chuẩn khi quyền bị thu hồi hoặc reader thất bại; kết thúc stream.                       |
| Comment heartbeat | Mỗi 10 giây nếu không có cập nhật; không phải event ping, không có version.                           |

Event ID là `requestId:streamVersion`. Reconnect gửi cursor nhưng server luôn gửi
snapshot hiện tại, kể cả result đã kết thúc với cùng cursor. Đây là phục hồi bằng
snapshot, không phải nhật ký phát lại mọi phase. Client bỏ snapshot cũ hơn version
đang giữ, kiểm request/kind/ID, bindings và quan hệ evidence/command.

Phase chỉ từ server: QUEUED, RUNNING (bản ghi cũ chưa có phase), PREPARING_CONTEXT (claim), ANALYZING (trước gọi
dịch vụ Python), FINALIZING (sau ACK/receipt), FINISHED (terminal). Phase không
suy ra từ log, token hay suy luận model. `ANALYZING` bao gồm preflight của Python,
không khẳng định model đã bắt đầu sinh token. Device lấy từ task focus trước lựa
chọn terminal. Không phát những thông báo chi tiết mà engine chưa thực hiện.

## Giới hạn và lifecycle

- Hub dùng một vòng đọc mỗi request/session trong một process; các tab cùng nhóm
  chia sẻ vòng này. Mỗi subscriber vẫn qua quyền ban đầu. Mỗi lượt đọc tái kiểm
  tài khoản/session, attempt, conversation và policy; không giữ transaction hoặc
  connection DB trong thời gian stream mở. Read không giữ admission advisory lock.
- Chu kỳ đọc 1 giây sau khi lượt đọc trước xong; không có query chồng nhau trong
  cùng nhóm. Đây vẫn là polling phía server; nhiều instance có vòng riêng.
- Mỗi process tối đa 256 stream, mỗi user tối đa 2 stream; tối đa 75 giây/kết nối
  và không vượt hạn token. Frame/buffer có giới hạn 128 KiB. Slow reader bị đóng
  và phục hồi bằng snapshot; không giữ hàng đợi vô hạn.
- Client chờ dữ liệu đầu tối đa 5 giây; idle 20 giây, hard limit 85 giây. Nếu không
  có event dùng được, quay về polling. Nếu stream đã hoạt động rồi đứt, nối lại tối
  đa hai lần với backoff 1/2 giây và jitter, sau đó polling. Không tự POST lại.
- 401/403/404 hoặc conversation thay đổi dừng giữ dữ liệu riêng; không fallback
  vô hạn. Unmount/offline/hidden/reset hủy IO và vô hiệu phản hồi cũ.
- `aiSweeper.js` chạy độc lập, không gọi provider. Lease worker 15 giây, heartbeat
  5 giây và deadline/grace hiện có được giữ nguyên. Mất lease trước dispatch có
  thể requeue; sau dispatch không tự gọi model lại khi outcome chưa biết.
- Hủy tác vụ giữ cơ chế hiện có: dừng công bố và giải phóng lượt theo transaction;
  không cam kết provider ngừng tính tiền ngay. Generation vẫn bị giới hạn bởi
  timeout/deadline hiện có. Mất kết nối không tạo hoặc hoàn một lượt mới.

## Quota

Tạo request giữ chỗ (`RESERVED`). Kết quả LLM hợp lệ đã commit tiêu thụ lượt
(`CONSUMED`). Deterministic fallback/lỗi/hủy/hết hạn giải phóng lượt (`RELEASED`).
Tiền provider và usage chưa xác định tiếp tục đối soát độc lập. Stream chỉ đọc
snapshot quota đã commit; không thực hiện settlement.

## UI và đo lường

Giữ palette Stitch, cấu trúc trả lời và gợi ý ba mức. Response xuất hiện sau
validation, không giả lập đánh máy trên kết quả đã nhận đủ. Status enum có shimmer
nhẹ, reduced-motion. ResizeObserver giữ bám cuối khi đang đọc cuối hội thoại và
giữ vị trí khi đọc tin cũ. Composer tự tăng 44–144 px theo nội dung/chiều rộng;
Enter gửi, Shift+Enter xuống dòng và IME không gửi sớm. Khối lệnh giữ device/mode,
copy Motion và đưa vào terminal; evidence giữ nguồn simulator, thêm số nguồn.

Client phát `ccna:ai-timing` CustomEvent cho accepted/visible_feedback/
validated_result hoặc terminal/visible_result. Payload chỉ có phase, requestId,
ms; không lưu câu hỏi, token hoặc response. Đây là điểm nối đo lường, chưa phải
hệ thống analytics production. Worker log `ai.worker.timing` khi bật
`AI_TIMINGS_ENABLED=true`; Python đã có `AI_PYTHON_TRACE_TIMINGS=true` cho các phase
preflight/provider/receipt. Headers provider không được coi là token đầu tiên.

`pnpm bench:ai:stream` chạy HTTP local với 1/40/80 client, fake generation 120 ms,
4 worker giả và poll snapshot 1 giây. Báo thời gian event đầu/kết quả, lỗi, queries,
queue, peak stream và heap. Heap bao gồm cả client/server/fixture trong một Node
process và GC; không phải phép đo riêng bộ nhớ một socket. Benchmark không dùng
DB ứng dụng hoặc Google, không chứng minh throughput DB hay độ trễ Gemini thật.

Ngưỡng thử nghiệm: p95 kết quả ≤5 giây ưu tiên giữ kết quả trọn gói; >10 giây và
provider chiếm phần lớn mới cân nhắc đợt nội dung. Đo thêm browser paint thật và
tải DB/worker thực trước khi ra quyết định. Đợt nội dung cần contract công bố
phân đoạn riêng; hiện chưa đủ bằng chứng để bật.

## Bật và rollback

1. Áp dụng migration additive theo quy trình triển khai: `pnpm db:deploy`, sau đó
   `pnpm prisma:generate`. Migration mới `20261102000000_ai_request_progress` không
   chấm lại kết quả hoặc thay dữ liệu model đã lưu. Không sửa migration đã áp dụng.
2. Cập nhật và khởi động lại worker với code mới trước, rồi đặt
   `AI_STATUS_STREAM_ENABLED=true` trong backend environment và khởi động lại
   backend. Mặc định false. Giữ cấu hình provider/quota/cohort hiện có.
3. Chạy `pnpm ai:sweeper` như dịch vụ độc lập cạnh worker. `pnpm dev:ai` tự khởi
   động thêm sweeper; chế độ vận hành tách process giúp nó sống độc lập với worker.
4. Kiểm proxy không gom dữ liệu; response đặt `X-Accel-Buffering: no`, no-store,
   no-transform. Vẫn phải kiểm flush/nén/timeout trên proxy triển khai thực tế.

Rollback: tắt flag, khởi động lại backend; client dùng polling. Giữ các cột
additive, không rollback dữ liệu lịch sử hoặc chạy lại generation. Đợt viết mã
ban đầu chỉ kiểm bằng DB thử cô lập; trạng thái kích hoạt dev được ghi bên dưới.

Lần kích hoạt dev tiếp theo (02/11/2026) đã xác nhận migration có sẵn trên DB ứng
dụng, đặt cờ trong `src/backend/.env` và khởi động lại backend/Python/worker/sweeper.
Backend cổng5500 và Python cổng8001 trả readiness200; frontend cổng3000 giữ nguyên.
Launcher ưu tiên `BACKEND_PORT`, sau đó `PORT`, rồi5000 giống Server.js để tránh
nhầm cổng frontend. Log/PID/trạng thái vận hành cục bộ ở `.tmp/sse-enabled-*`;
không tạo câu hỏi thử hoặc thay provider/quota/cohort khi kích hoạt.

## Kiểm chứng

Các log kiểm chứng được ghi trong `.tmp/sse-*`; bản tổng kết kết quả cụ thể nằm
trong `todo.md`. Test bao gồm parser, controller, hub, HTTP/ownership/reconnect,
Prisma migration, quota/lease/sweeper và worker→Python→receipt với Google giả.
Browser dùng fixture HTTP/SSE local; chưa kiểm proxy production hoặc gọi Gemini
thật để đo latency. Không thêm dependency, không stream raw model output.
