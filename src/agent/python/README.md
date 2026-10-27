# Python AI service — PY-01/PY-02

Python đã có adapter fake và Gemini local. Node giữ quyền học viên, simulator,
hàng chờ, database và quyết toán. Python nhận bản chụp đã lọc, gọi model khi Node
cấp phép rồi gửi biên nhận về Node.

## Cài và kiểm từ gốc repo

Cần Python **3.11**, uv **0.11.22** và Node/pnpm của repo. Dependency đã pin trong
`pyproject.toml` và `uv.lock`.

```sh
uv sync --project src/agent/python --frozen
pnpm check:ai:python
pnpm test:ai:python
uv run --directory src/agent/python --frozen python -m app
```

Lệnh cuối mặc định nghe **127.0.0.1:8001**, AI tắt. Python không tự đọc `.env`.
[.env.example](.env.example) liệt kê biến cần truyền qua shell/process manager.

## Cấu hình

| Biến                            | Ý nghĩa                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `AI_PYTHON_MODE`                | `off` mặc định; thêm `fake` hoặc `gemini` khi chủ động bật.                          |
| `AI_PYTHON_ENVIRONMENT`         | `local` hoặc `test` với fake; Gemini chỉ nhận `local`.                               |
| `AI_SERVICE_SECRET`             | Cùng secret Node, ít nhất 32 ký tự; chỉ ở server.                                    |
| `AI_PYTHON_NODE_URL`            | Callback loopback, mặc định `http://127.0.0.1:5500/internal/v1/ai`.                  |
| `AI_PYTHON_LIVE_ENABLED`        | Mặc định `false`; Gemini cần `true` và `GEMINI_API_KEY`.                             |
| `AI_PYTHON_MAX_BODY_BYTES`      | Mặc định và tối đa 65.536 byte UTF-8.                                                |
| `AI_PYTHON_BODY_TIMEOUT_MS`     | Mặc định 2.000 ms để đọc body.                                                       |
| `AI_PYTHON_MAX_REQUEST_MS`      | Mặc định 25.000 ms cho preflight/claim/generation; còn bị giới hạn bởi JWT/deadline. |
| `AI_PYTHON_CALLBACK_TIMEOUT_MS` | Mặc định 3.000 ms mỗi callback.                                                      |
| `AI_PYTHON_RECEIPT_ATTEMPTS`    | Tối đa ba lần gửi cùng receipt; không retry model.                                   |
| `AI_PYTHON_MAX_CONCURRENT`      | Mặc định hai tác vụ mỗi process; đầy trả 503.                                        |

Sau hạn generation còn tối đa 4,5 giây gửi receipt, trong hạn token receipt. Biến
`AI_PYTHON_*` không biết hoặc giá trị sai làm service dừng bằng lỗi chung, không in
cấu hình. Key chỉ được đọc khi chọn Gemini. Không lấy URL/model/key từ người học,
không dùng proxy môi trường hoặc tự theo redirect.

`GET /health/live` trả 200 khi service còn chạy. `GET /health/ready` trả 503 khi tắt
hoặc thiếu cấu hình Gemini, 200 khi adapter đã cấu hình. Readiness **không gọi model**,
không xác nhận DB/Node/quota tài khoản và không cấp phép mở pilot.

## Một yêu cầu đi qua đâu?

1. Worker gửi `POST /internal/v1/lab-assistant/analyze` với JWT riêng cho
   ANALYZE/CLAIM/RECEIPT và `X-AI-Contract-Version: 1.0.0`.
2. Python kiểm auth trước body; kiểm bytes, JSON Schema và Pydantic strict.
   Không bỏ trường lạ/ép kiểu. Token phải cùng request/call/contextHash/leaseVersion.
3. Gemini đếm token toàn request, gồm system prompt và output schema. Count sai/quá
   trần dừng trước claim. Fake dùng câu trả lời cố định, không gọi Google.
4. Python claim permit một lần. Node kiểm quyền, giữ slot/ngân sách trong PostgreSQL
   và ledger chung. Bị từ chối thì không gọi model.
5. Gemini generation tối đa một lần. Timeout, 429 hoặc JSON sai không được gọi lại.
   Usage thiếu để `null`/`UNRESOLVED`, không đổi thành chi phí 0.
6. Gửi receipt về Node; mất ACK có thể gửi lại đúng receipt. Chỉ ACK analyze sau
   Node đã lưu. ACK không mang output model.

Node kiểm tiếp evidence, commandId, nội dung và quyền trước khi lưu câu trả lời.
Câu bị loại vẫn ghi chi phí. Prompt hiện viết giải thích/giả thuyết; SIM-01 của Node
kiểm soát kết luận chẩn đoán mạnh.

Prompt `gemini-r1-v2` có bốn module intent và tám ví dụ có input cấu trúc. Mỗi
request gửi một ví dụ phù hợp, giữ chỗ cho context. Summary/bước/verification
giới hạn 320/130/110 ký tự Unicode; Python kiểm lại output bằng cùng giới hạn và
ID của input trước khi gửi receipt. Không cần commandId thì bỏ field, không gửi null.
History khác hoặc chưa biết revision bị bỏ; history còn lại không phải bằng chứng
trạng thái mạng. Context bị lược hoặc chẩn đoán ngoài phạm vi chỉ cho kết luận
thiếu dữ liệu. Chi tiết và số đo token ở [PY-02, mục 8](../../../docs/ai-lab-assistant/baseline/PY-02-provider.md#8-prompt-được-bổ-sung-ngày-2710-như-thế-nào).

Module LAB_REVIEW mới là phần prompt/adapter: admission hiện thu feedback, chưa có
đường topology đầy đủ tới worker cho intent này. Chưa mở learnerLevel hoặc nâng
hint level tự động. Node/Python phải cùng prompt version với runtime policy.

Worker chọn `AI_WORKER_MODE=python-fake` hoặc `python-gemini`, URL Python qua
`AI_ANALYZE_URL`. Cần DB AI thử riêng trên loopback và runtime policy có cohort,
budget, recovery epoch hợp lệ. Thêm env không tự tạo policy trong DB.

## Kiểm tích hợp và Gemini thật

```sh
pnpm ai:db:start
pnpm test:ai:python:integration
pnpm ai:db:stop
```

Integration tạo DB fresh/upgrade tạm, chạy Node worker → Python → Node receipt →
PostgreSQL và dọn DB sau kiểm. Google được giả lập; không dùng key thật. CI dùng
nhánh này. Có kiểm duplicate permit, 429, output bị chặn, usage thiếu và accounting.

Khi cluster thử đang chạy, `pnpm ai:python:live:check` chủ động đọc key server từ
root `.env`, gửi **một câu hỏi tổng hợp**, ghi evidence tại
`.tmp/ai-lab-py02/live-result.json`. Lệnh không dùng DB ứng dụng, không retry
generation hoặc tạo/reset ledger. Mỗi lần chủ động chạy lại có thể tính thêm một
lượt; không đưa lệnh live vào CI.

Model/giá/cap lấy từ [OPS-00-live.json](../../../docs/ai-lab-assistant/ops/OPS-00-live.json):
6.000 input token, 800 output **cộng thinking**, cùng 20 reservation và cap
ngày/tháng/toàn đợt với luồng giải thích cũ. Xem
[ADR-010](../../../docs/ai-lab-assistant/adr/ADR-010-python-local-gemini.md).

## Docker và giới hạn

```sh
docker build -f src/agent/python/Dockerfile -t ccna-ai-python:py02 .
```

Build context là gốc repo để lấy contracts/policy. Image dùng user 10001, không
copy `.env`/key/venv. Trong container nghe `0.0.0.0:8001`, mode vẫn off; `EXPOSE`
không publish cổng host. Chưa thêm ports/Compose.

Docker Engine local chưa chạy nên chưa build/chạy image. Test có một cảnh báo
deprecation Starlette TestClient/HTTPX. Kiểm kỹ thuật và một lượt live nhỏ chưa thay
cho review CCNA, đánh giá model trên bộ lab, browser E2E, đo tải hoặc nghiệm thu pilot.

Xem [báo cáo PY-01](../../../docs/ai-lab-assistant/baseline/PY-01-service.md) và
[báo cáo PY-02](../../../docs/ai-lab-assistant/baseline/PY-02-provider.md).
