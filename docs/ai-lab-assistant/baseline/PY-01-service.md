# PY-01 — Dựng chương trình Python riêng cho AI

**Ngày:** 26/10/2026. **Trạng thái:** hoàn thành kiểm kỹ thuật local/fake.
**Tiếp theo:** PY-02. Code ở [src/agent/python](../../../src/agent/python/README.md).

## 1. Task này làm gì?

Trước đây đã có Node nhận câu hỏi, giữ hàng chờ và kiểm trạng thái mạng. PY-01
dựng thêm chương trình Python riêng, có địa chỉ nội bộ để sau này worker gọi sang.

Ví dụ, Node gửi một yêu cầu đã lọc cùng ba token có hạn. Python kiểm yêu cầu, xin
phép Node, tạo câu trả lời giả rồi gửi biên nhận về. Chỉ khi Node xác nhận đã lưu
biên nhận, Python mới trả “đã xử lý”. Nhờ đó, một phản hồi HTTP thành công không
bỏ qua việc kiểm kết quả và ghi nhận ở Node.

Hiện **chỉ dùng AI giả**. Chưa gọi Gemini, chưa bật model thật và chưa đổi đường
worker đang chạy. Ghép worker/provider đầy đủ là phần tiếp theo của PY-02.

## 2. Những phần đã có

| File/thư mục                                                                                                 | Công việc                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [pyproject.toml](../../../src/agent/python/pyproject.toml), [uv.lock](../../../src/agent/python/uv.lock)     | Chọn Python 3.11 và khóa dependency để máy khác cài lại cùng bộ thư viện.                        |
| [config.py](../../../src/agent/python/app/config.py)                                                         | Đọc biến môi trường đã định nghĩa; mặc định tắt, nghe ở loopback; không đọc `.env` của ứng dụng. |
| [security.py](../../../src/agent/python/app/security.py)                                                     | Kiểm token do Node ký, đúng mục đích và đúng request/call/hash/lease.                            |
| [boundary.py](../../../src/agent/python/app/boundary.py)                                                     | Kiểm quyền trước đọc body, giới hạn bytes, thời gian và số việc đồng thời.                       |
| [contracts.py](../../../src/agent/python/app/contracts.py)                                                   | Dùng JSON Schema hiện có, từ chối field lạ và kiểu dữ liệu sai.                                  |
| [main.py](../../../src/agent/python/app/main.py)                                                             | Endpoint health và analyze nội bộ; tắt trang Swagger/OpenAPI.                                    |
| [fake.py](../../../src/agent/python/app/fake.py), [callbacks.py](../../../src/agent/python/app/callbacks.py) | Chế độ giả có giá 0; xin phép và ghi biên nhận qua Node trước khi trả ACK.                       |
| [tests](../../../src/agent/python/tests)                                                                     | Kiểm contract, auth, giới hạn, lỗi và chạy hai tiến trình HTTP thật bằng dữ liệu giả.            |
| [Dockerfile](../../../src/agent/python/Dockerfile)                                                           | Cài từ lock, chạy bằng user không đặc quyền; không tự mở cổng host.                              |

FastAPI 0.162.0, Uvicorn 0.54.0, HTTPX 0.28.1, PyJWT 2.15.1 và jsonschema 4.26.0
được pin trực tiếp. Lockfile giữ cả dependency gián tiếp. Lượt local dùng CPython
3.11.15 và uv 0.11.22; không đổi thư viện Node/React hoặc schema database.

## 3. Còn sống khác sẵn sàng thế nào?

- `/health/live` trả 200: chương trình vẫn chạy.
- `/health/ready` trả 503/`disabled`: AI đang tắt theo cấu hình mặc định.
- Khi cấu hình fake hợp lệ, readiness trả 200 và ghi adapter là `fake`.

Readiness này kiểm cấu hình Python, chưa kiểm Node/database hoặc model thật. Mỗi
lần analyze vẫn phải được Node cấp phép. Có health xanh chưa có nghĩa được mở AI
cho học viên hoặc đưa vào production.

## 4. Các giới hạn đã kiểm

- Token phải là HS256 đúng secret, issuer, subject, audience và kid/keyId. Token
  cho analyze không dùng thay token claim/receipt; thời hạn tối đa 60 giây.
- Từ chối khi requestId, callId, contextHash hoặc leaseVersion không khớp token.
- Body tối đa 65.536 byte UTF-8. Kiểm cả dữ liệu gửi theo từng chunk, kể cả không
  có Content-Length; không dựa vào số ký tự để đo bytes.
- Mặc định chỉ chờ body 2 giây, toàn yêu cầu 25 giây và mỗi callback 3 giây. Nếu
  deadline hoặc token hết hạn sớm hơn thì dùng hạn sớm hơn.
- Mặc định nhận hai việc cùng lúc trên một tiến trình. Đầy thì từ chối; hàng chờ
  bền vững vẫn ở Node, không tạo thêm hàng chờ RAM trong Python.
- Callback chỉ đến URL loopback cấu hình phía server. Không theo redirect, proxy
  từ môi trường hoặc tự retry để tránh vô tình gọi lại cùng việc.
- Lỗi chỉ trả mã chung. Không ghi token, secret, câu hỏi hoặc body vào log. Input
  bị từ chối không bị Pydantic bỏ field lạ rồi coi như hợp lệ.

Kết quả giả chỉ nói chưa có phân tích bằng model thật. Python không tự thêm bằng
chứng, lệnh cấu hình, mục tiêu bài hoặc thuật toán mạng mới. Quyền, trạng thái bài,
điểm và chi phí tiếp tục do Node quản lý.

## 5. Chạy kiểm lại

Từ gốc repo:

```sh
uv sync --project src/agent/python --frozen
pnpm check:ai:python
pnpm test:ai:python
uv run --directory src/agent/python --frozen python -m app
```

Lệnh cuối chạy mặc định tại `127.0.0.1:8001`, AI tắt. Dừng bằng Ctrl+C. Hướng dẫn
cấu hình fake, headers nội bộ và Docker nằm trong [README Python](../../../src/agent/python/README.md).
Không copy secret của ứng dụng vào tài liệu hoặc frontend để thử.

Kết quả local:

| Nhóm kiểm             | Kết quả                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Python service        | **149/149 đạt**, gồm 76 fixture chung với Node.                                                                                                 |
| Cài lại bằng lockfile | Cài vào môi trường mới và chạy lại test; không sửa lock.                                                                                        |
| HTTP thật             | Python chạy ở cổng loopback tạm, nhận JWT do Node thật ký; Node peer test cấp permit/lưu receipt, rồi Python mới ACK. Yêu cầu trùng bị từ chối. |
| Hồi quy Node          | **270 qua, 4 integration opt-in bỏ qua**. Không cần DB cho thay đổi PY-01.                                                                      |
| Kiểm tĩnh             | Ruff/lint/format, ESLint phần sửa, boundaries, generated contracts/fixtures và actionlint đạt.                                                  |
| Linux/Docker          | Dry-run lock Linux đạt; chưa chạy image vì Docker Engine chưa hoạt động.                                                                        |

Node peer trong test chỉ giữ dữ liệu giả trong RAM để kiểm HTTP và JWT. Đây chưa
phải kiểm worker → Python → PostgreSQL đầy đủ; việc đó tiếp tục ở PY-02. Các test
DB BE-01…05 đã có không bị thay bằng peer này.

Có một cảnh báo deprecation từ Starlette TestClient/HTTPX trong test. Không có lỗi
lint/test. CI đã thêm cài uv, sync frozen, Ruff và pytest; chưa chạy CI GitHub của
thay đổi PY-01. Bằng chứng local ở `.tmp/ai-lab-py01/`.

## 6. Phần còn lại

**Cập nhật sau PY-01, ngày 26/10/2026:** các phần dưới đã được triển khai và kiểm
trong [PY-02](PY-02-provider.md), gồm một lượt Gemini thật qua worker/Python/DB thử.
Các số liệu phía trên giữ nguyên bằng chứng tại mốc PY-01.

PY-02 cần ghép transport worker, adapter/prompt/tokenizer, bọc kiểu Pydantic giữ
parity, receipt retry và mapping usage/lỗi model. Model thật vẫn cần chính sách,
ngân sách và đánh giá đã chốt. PY-01 local/fake chưa thay cho nghiệm thu nội dung,
browser E2E, đo tải hoặc pilot.
