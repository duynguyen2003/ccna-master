# Quyền test AI cho ADMIN trên app

Ngày cập nhật: 28/10/2026.

ADMIN hiện tại trong database được dùng bốn ý định trợ lý trên CLI lab đã xuất bản
của mình hoặc lab mình là thành viên. Không cần thêm từng admin/lab vào cohort.
Trong môi trường dev `admin-test`, admin có thể mở và nộp lab còn bị khóa bởi
lộ trình để kiểm thử. Quyền khóa học/bài học và dữ liệu của người khác giữ theo
quy tắc ứng dụng.

## Test ngay

Backend cổng5500, Python cổng8001 và worker Gemini đã được chạy; frontend hiện tại ở
<http://localhost:3001>. Đăng nhập tài khoản ADMIN đang có, mở **Labs → Làm lab
CLI → Trợ lý lab**. Có thể thử hỏi, gợi ý bước tiếp theo, chẩn đoán, lịch sử,
feedback và tải lại để phục hồi câu hỏi. Nếu dùng giao diện quản trị, chuyển
sang trang Labs của ứng dụng để có attempt thật; bản xem trước nháp không có
hội thoại AI.

Theo yêu cầu gọi thật ngày 28/10/2026, worker hiện là **app-gemini**, qua Node
queue → Python → Gemini → receipt/settlement. Model `gemini-3.5-flash-lite`,
prompt `gemini-r1-v2`; API trả `responseMode=LLM` khi nhận câu trả lời hợp lệ.
Hạn mức ADMIN: 2 câu/phút, 20 câu/ngày, 1 yêu cầu đang xử lý/admin và 1 slot
toàn môi trường. Ledger dùng chung với các lượt live trước: tối đa20 reservation
toàn đợt, $0,05/ngày, $0,10/tháng và toàn đợt. Không reset ledger khi đổi mode;
request lỗi/không rõ usage vẫn giữ mức dự phòng, không tự gửi lại generation.

Sau khi dừng app, chạy lại ở các terminal riêng tại gốc repo:

```sh
pnpm server
pnpm ai:python
pnpm ai:worker
pnpm start
```

## Cấu hình có thể chạy lại

```sh
pnpm ai:admin:enable --gemini
pnpm ai:admin:enable --gemini --apply
```

Lệnh đầu chỉ kiểm tra. Lệnh `--apply` cấu hình `.env` đang có hiệu lực và duy
nhất policy `admin-test`; không đổi role, mật khẩu hoặc database URL. Schema AI
phải được migrate trước. Công cụ từ chối production, thiếu ADMIN hoặc file env
không được gitignore. Secrets mới sinh ngẫu nhiên, không in ra output; giữ nguyên
secrets/recovery epoch khi chạy lại. Bản cấu hình cũ nằm riêng trong `.tmp/admin-ai-setup/`.
Cấu hình hệ thống đặt trực tiếp bằng biến môi trường vẫn ưu tiên hơn file env.

Policy bật `eligibilityRules.adminAccess=true`, danh sách user/lab thông thường
rỗng và provider `local-gemini-v1`. Server dùng `AI_ENVIRONMENT=admin-test`,
`AI_WORKER_MODE=app-gemini`. Mode này chỉ bật ngoài production và cần key server
cùng model đã pin. `pnpm ai:python` nạp cấu hình server rồi chỉ chuyển service
secret/key cần thiết cho Python, không chuyển DATABASE_URL/JWT/owner secret.
Backend, Python và worker chạy riêng; restart khi thay cấu hình. Student vẫn cần
cohort thông thường. Đường `/explain` cũ vẫn dùng `LAB_AI_MODE=deterministic`;
mode Gemini này áp dụng panel **Trợ lý lab**, không bật thêm đường legacy có phí.

Setup cập nhật provider/version/budget và các trần quota bucket của riêng
`admin-test`, giữ counters/spend/reservations, role, session và recovery epoch.
Trần DB dự phòng5800 micro-USD/lượt; ledger bảo thủ3800 micro-USD/lượt với
800 output cộng thinking. Worker cấp cửa sổ55giây cho Gemini, vẫn bị chặn bởi
deadline60giây của request và JWT; fake giữ20giây. Python launcher dùng55giây
cho Gemini/25giây cho fake. Không tăng token cap hoặc retry model khi timeout.

Nếu chủ động quay về fake, lệnh không có `--gemini` vẫn kiểm tra/chọn
`app-fake` như trước. Không tự fallback từ mode Gemini sang fake; UI sẽ nhận
trạng thái thất bại/không rõ kết quả khi provider không hoàn tất.

Auth/session, account active, attempt owner/member, hội thoại riêng và kill
switch vẫn được kiểm tra. Role lấy từ DB ở admission và delivery, bỏ qua role
trong JWT. Admin bị demote hoặc mất quyền không nhận nội dung tiếp theo.

Tắt môi trường test bằng policy riêng:

```sql
UPDATE ai_runtime_policies
SET admission_enabled = false, dispatch_enabled = false,
    version = version + 1, updated_at = now()
WHERE environment = 'admin-test';
```

## Kiểm chứng fake trước khi chuyển Gemini

- 229 test AI offline đạt; 16 test learning path đạt, 1 integration opt-in không chạy
  trong lệnh unit. Lint, format và source boundaries đạt.
- PostgreSQL riêng: 17 fresh + 17 upgrade + 39 HTTP/lifecycle test/subtest đạt. Có
  kiểm ADMIN hiện tại, JWT role giả, demotion, khóa tài khoản, policy tắt,
  student bị khóa lộ trình, môi trường khác và lab nháp.
- Ba migration AI đã áp dụng trên DB ứng dụng: storage, worker và comment 1000 ký
  tự. Không reset/backfill dữ liệu học tập. Policy `admin-test` version 1 là policy
  mới duy nhất; chạy lại setup giữ nguyên env/secrets/policy version.
- Smoke HTTP trên app thật: ADMIN id1 mở lab EIGRP id1, tạo attempt riêng và gửi
  một câu hỏi test. Request COMPLETED/DETERMINISTIC, 1 fake call, receipt RECEIVED,
  chi phí 0, quota không còn reservation. Gửi lại cùng clientRequestId trả request
  cũ, không gọi thêm. History chứa kết quả; anonymous nhận401 và admin khác nhận404.
- So sánh toàn bộ attempt và số lệnh trước/sau câu hỏi: không đổi. Không gọi
  Gemini/Python hoặc thay mật khẩu/role tài khoản. Chưa kiểm browser ↔ Gemini
  trong lần cấp quyền này.

Evidence local: `.tmp/admin-ai-20261028/` gồm smoke.json, setup-idempotence.json,
log migration và regression. Cluster kiểm thử cổng55432 đã dừng; backend ứng dụng
và worker được giữ chạy để người dùng test.

## Kiểm chứng Gemini thật ngày 28/10/2026

- Node:233 test AI; Python:306 test; lint/format/boundaries đạt. DB riêng:
  17fresh +17upgrade +46HTTP/lifecycle/Python integration đạt, bao gồm mock
  Gemini success, output sai, usage thiếu và429. Không gọi Google trong các test này.
- Setup app chuyển policy `admin-test` từ version1 sang2, provider Gemini;
  chạy lại giữ nguyên env và policy version. Role/session, các counter quota và
  ledger4 lượt trước đều không đổi sau setup. Không đổi DB URL, migrate hoặc
  sửa tiến độ học tập. Model/giá standard đã đối chiếu với
  [Google](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite):
  $0,30/input và $2,50/output gồm thinking trên mỗi triệu token.
- Lượt đầu `b98c8606-6f59-4180-a70c-6ad16622085d` dừng
  `OUTCOME_UNKNOWN/UNRESOLVED` ở cửa sổ20giây cũ; không xóa hoặc gửi lại request,
  không giả định chi phí0. Đã đồng bộ worker/Python thành55giây trước lần kiểm mới.
- Lượt mới `f76ae445-2901-4159-b316-74db737d7575`, ADMIN1 trên attempt
  `279551be-7f90-4f8f-9a7e-066fcf849111` (ITN02), đạt `COMPLETED/LLM`.
  Gemini receipt `RECEIVED/FINAL`, input2076/output166/thinking0,
  1038micro-USD ($0,001038). Hỏi về default gateway, câu trả lời tiếng Việt có
  dẫn evidence của PC1/R1 và commandId được server xác minh.
- Replay cùng clientRequestId trả request cũ, một provider call cho request đó;
  state và command log không đổi, history đọc được. Ledger tổng6 reservation
  (gồm4 lượt cũ và lượt không rõ kết quả), còn14 theo trần20 tại thời điểm kiểm.
  Không reset ledger, không tự retry generation. Chưa kiểm browser ↔ Gemini
  hoặc đánh giá chất lượng model trên toàn bộ lab; không mở pilot học viên.

Evidence local mới: `.tmp/admin-gemini-20261028/setup-checks.json`,
`first-timeout.json`, `smoke.json`. Backend/Python/worker và frontend dev được
giữ chạy; cluster55432 chỉ phục vụ test riêng được dừng sau khi kiểm xong.

Phân tích tiếp về độ trễ, mốc thời gian từng chặng và thử tối ưu schema tại
[latency-analysis.md](latency-analysis.md). Kết quả thử chưa chứng minh giảm trễ
ổn định; schema đã trả về bản cũ và bổ sung phase tracing có opt-in.
# Cập nhật 29/10/2026: chỉ dùng Gemini thật

`pnpm ai:admin:enable` hiện luôn chọn `app-gemini` và yêu cầu `GEMINI_API_KEY`
phía server; thêm `--apply` để ghi cấu hình. `--gemini` vẫn được chấp nhận để
tương thích lệnh cũ. Chạy backend, `pnpm ai:python`, rồi `pnpm ai:worker`.
Các hướng dẫn `app-fake` bên dưới chỉ là lịch sử kiểm thử, không còn chạy được.
Không còn fallback ghép câu trả lời khi Gemini lỗi; quota và ledger cũ được giữ.
