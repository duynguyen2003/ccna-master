# PY-02 — Nối model thật vào worker và Python

**Ngày:** 26/10/2026. **Phạm vi:** kiểm kỹ thuật local trên DB thử riêng.

**Cập nhật 27/10/2026:** đã ghép thiết kế prompt và test người dùng gửi thành
`gemini-r1-v2`. Có module cho bốn intent, ví dụ có input cấu trúc, kiểm độ dài
ngay khi nhận output và loại lịch sử khác revision. Chi tiết ở mục 8; số liệu
lượt Gemini sinh câu trả lời ngày 26/10 bên dưới giữ nguyên bằng chứng của bản v1.

## 1. Task này giải quyết việc gì?

PY-01 dựng chương trình Python và dùng câu trả lời giả để kiểm đường truyền.
PY-02 nối thêm Gemini: câu hỏi đi qua hàng chờ của Node, worker gọi Python,
Python xin phép Node rồi mới gọi model. Kết quả quay về Node để kiểm và lưu.

Ví dụ, với câu hỏi “Vì sao gói trả lời cần đường về?”, Gemini có thể viết lời giải
thích tiếng Việt từ dữ liệu được phép gửi. Model không tự sửa cấu hình, chấm điểm
hoặc kết luận toàn bộ lab đã đúng.

## 2. Đã làm những phần nào?

| Phần               | Hiểu đơn giản                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Worker gọi Python  | Có transport HTTP thật, ba token riêng cho nhận việc/xin phép/gửi biên nhận.                         |
| Adapter Gemini     | Model và địa chỉ do server chọn; không nhận từ câu hỏi/browser. Vẫn có adapter fake cho test.        |
| Đếm token trước    | Đếm cả chỉ dẫn, schema, context và lịch sử sẽ gửi. Quá trần thì dừng trước khi xin phép generation.  |
| Kiểm khuôn dữ liệu | Pydantic dùng schema sinh từ Zod chung. Field lạ/sai kiểu bị từ chối, không âm thầm bỏ.              |
| Xử lý lỗi model    | Có nhánh cho 429, timeout, JSON sai, output bị cắt và usage thiếu. Không gọi lại để sửa câu trả lời. |
| Gửi biên nhận lại  | Mất ACK thì gửi lại đúng biên nhận, tối đa ba lần; không gọi model lần hai.                          |
| Ngân sách chung    | Dùng cùng sổ chi phí với nút giải thích cũ; không tạo sổ mới để có thêm lượt.                        |

Code Python nằm trong [`src/agent/python/app`](../../../src/agent/python/app/).
Phần nối worker ở [`pythonTransport.js`](../../../src/agent/node/pythonTransport.js),
quyền gọi và quyết toán tiếp tục do Node giữ.

## 3. Nếu model trả sai hoặc không rõ tiền thì sao?

Model trả HTML, lệnh CLI tùy ý, evidence không có thật hoặc kết luận không đủ căn
cứ thì Node chặn câu trả lời. **Chi phí vẫn được ghi** nếu model đã báo usage.

Nếu Google không báo đủ số token, hệ thống để `UNRESOLVED` và các số chưa biết là
`null`. Không coi lỗi mạng hoặc câu trả lời bị loại là miễn phí. Timeout sau khi
đã được cấp phép cũng không được chạy lại generation.

Hai Python process nhận cùng một permit không làm phát sinh hai generation:
Node chỉ chấp nhận một lần claim. Đếm token có thể lặp lại trước claim; bước đó
không thay cho quyền gọi model.

## 4. Trần tiền local

Giữ nguyên model `gemini-3.5-flash-lite` và chính sách
[OPS-00-live.json](../ops/OPS-00-live.json): tối đa 6.000 input token, 800 token
output **cộng thinking**, 20 reservation cả đợt, 0,05 USD/ngày UTC và
0,10 USD/tháng/toàn đợt.

Mỗi lần gọi giữ trước tối đa 3.800 micro-USD trong sổ local dùng chung. Database
giữ mức thận trọng hơn là 5.800 micro-USD vì contract tách output và reasoning;
tiền thực tính từ usage do Google trả. Giữ cả reservation lỗi/unknown, không reset
sổ khi chạy lại service. Xem [ADR-010](../adr/ADR-010-python-local-gemini.md).

## 5. Đã kiểm thế nào?

| Nhóm kiểm       | Kết quả                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Python          | **250/250 đạt**, gồm đối chiếu fixture JSON Schema/Pydantic, auth, fault model và retry receipt.               |
| Hồi quy Node    | **274 đạt**, 4 kiểm integration opt-in bỏ qua trong bộ offline; bộ DB riêng chạy bên dưới.                     |
| PostgreSQL      | **34 kiểm storage/migration** và **42 kiểm HTTP/DB** đạt. Có worker, Python process, callback Node và DB thật. |
| Cài từ lockfile | Cài vào venv mới và chạy lại 250 test đạt; lock Linux dry-run đạt.                                             |
| Kiểm tĩnh       | Ruff, ESLint phần sửa, contracts/fixtures, boundaries và actionlint đạt.                                       |

Google được giả lập trong test tự động và CI. Các kiểm usage thiếu/429/output sai
không gọi mạng Google.

**Lượt Gemini thật:** một generation qua worker → Python → Google → Node →
PostgreSQL đã hoàn tất, trạng thái `COMPLETED`, `responseMode=LLM`, usage `FINAL`.
Google báo **2.819 input, 215 output, 0 thinking token**; Node tính **1.384 micro-USD
(0,001384 USD)** theo bảng giá hiện có. Node đã chấp nhận khuôn và nội dung; không
gọi lại generation. Bộ DB chạy cùng lượt live đạt 38/38 (nhánh offline có nhiều ca hơn).

Ledger tăng từ **3 lên 4 reservation**, giữ nguyên ba mục cũ; tổng cam kết từ
11.400 lên **15.200 micro-USD**, circuit vẫn đóng. Không hoàn phần reservation
chưa dùng và không tạo sổ mới. Evidence riêng: `.tmp/ai-lab-py02/live-result.json`.

## 6. Chạy lại bằng lệnh nào?

Từ gốc repo, sau khi cài Python 3.11/uv và dependency:

```sh
uv sync --project src/agent/python --frozen
pnpm test:ai:python
pnpm ai:db:start
pnpm test:ai:python:integration
pnpm ai:db:stop
```

`pnpm ai:python:live:check` là lệnh **chủ động gọi thật một lần** bằng câu hỏi tổng
hợp, chỉ dùng DB thử và ledger đang có. Cần cluster thử đang chạy và key server
hợp lệ. Lệnh không tự retry; mỗi lần chạy lại có thể tính thêm một lượt. Không dùng
lệnh này trong CI. Cấu hình chi tiết nằm trong [README Python](../../../src/agent/python/README.md).

## 7. Phần chưa được nghiệm thu

Mặc định worker/Python vẫn tắt; task chưa nối UI hội thoại FE-02. BE-06 còn việc
đóng đường provider cũ. Chưa có review CCNA độc lập, đánh giá model trên bộ lab,
browser E2E, đo tải cả lớp hoặc pilot/production.

Chưa build/chạy image vì Docker Engine local chưa hoạt động; CI mới chưa chạy trên
GitHub. Test có cảnh báo deprecation Starlette TestClient/HTTPX và một số kiểm
PostgreSQL cũ có cảnh báo pg; không có lỗi kiểm thử.

Bằng chứng nằm trong `.tmp/ai-lab-py02/`, không chứa key hoặc mật khẩu DB. Một câu
trả lời live hợp lệ chỉ chứng minh đường tích hợp chạy được; chất lượng giảng dạy
vẫn cần bộ đánh giá riêng.

## 8. Prompt được bổ sung ngày 27/10 như thế nào?

Đã dùng hai bản người dùng gửi để bổ sung [`prompts.py`](../../../src/agent/python/app/prompts.py)
và [`test_prompts.py`](../../../src/agent/python/tests/test_prompts.py). Quy tắc chung
và cách dạy luôn được gửi; mỗi câu hỏi chỉ kèm module của intent đang chọn và **một
ví dụ phù hợp**. Có tám ví dụ được lưu và kiểm: hai mẫu cho mỗi intent, gồm có
bằng chứng và thiếu bằng chứng. Cách chọn này giữ chỗ cho dữ liệu lab trong trần token.

| Intent            | Cách hướng dẫn                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `DIAGNOSE`        | Nêu quan sát có căn cứ, gợi vùng cần kiểm rồi hỏi cách xác minh; không đưa cấu hình sửa.     |
| `NEXT_STEP`       | Chọn một quan sát tiếp theo theo mục tiêu công khai; thiếu mục tiêu thì hỏi lại.             |
| `EXPLAIN_CONCEPT` | Giải thích ngắn; chỉ liên hệ lab khi có dữ liệu hiện tại, còn lại ghi rõ là kiến thức chung. |
| `LAB_REVIEW`      | Nhận xét trạng thái quan sát được, không chấm đạt/trượt hoặc đoán ai đã cấu hình.            |

**Giới hạn được kiểm bằng code:** summary tối đa 320 ký tự Unicode, mỗi bước 130,
verification 110. Tối đa hai bước; giải thích khái niệm và review tối đa một bước.
Một nguồn `LIMITS` dùng cho hướng dẫn, schema gửi Google và kiểm output local.
Không quy đổi các số này thành “160 từ”. `ProviderReceipt` chung vẫn giữ nguyên.

ID bằng chứng phải thuộc facts của revision hiện tại; commandId phải thuộc catalog
Node. Không cần lệnh thì bỏ field, gửi `null` bị từ chối. Python kiểm lại giới hạn
và liên kết ID trước tạo receipt; Node tiếp tục kiểm nội dung trước khi lưu câu trả
lời. Bị chặn vẫn giữ usage đã biết, không gọi model lần hai.

Lịch sử khác hoặc chưa biết revision không được gửi sang model. Lịch sử còn lại
chỉ giúp hiểu hội thoại, không chứng minh trạng thái mạng. Context bị lược hoặc
Node báo chẩn đoán ngoài phạm vi/thiếu quan sát chỉ cho `INSUFFICIENT_CONTEXT` với
evidenceIds rỗng. Câu yêu cầu đổi luật vẫn ở phần dữ liệu, không đi vào system prompt.

Ví dụ trunk đã sửa ngoại lệ native VLAN; ví dụ quan sát chỉ dùng lệnh hiện có trong
catalog. Không suy “bạn đã tạo VLAN” chỉ vì snapshot có VLAN đó. Không thêm
`learnerLevel` vào contract; Node hiện vẫn cấp hint level 1, cấp 2–3 còn theo BE-09.

**Đo token bằng API Google `countTokens`, không gọi generation:** trong ba lab mẫu,
lab VLAN có payload lớn nhất theo số byte ở cả bốn intent. Với snapshot công khai
của lab đó và sáu lượt lịch sử ngắn cùng revision, đo toàn request được:

| Intent          | Input token |
| --------------- | ----------: |
| DIAGNOSE        |       5.797 |
| NEXT_STEP       |       5.686 |
| EXPLAIN_CONCEPT |       5.656 |
| LAB_REVIEW      |       5.664 |

Các mẫu này dưới ngưỡng preflight **5.936** (trần 6.000 trừ margin 64). Mẫu câu hỏi
2.000 ký tự và sáu lượt lịch sử, mỗi lượt 1.000 ký tự, lên 8.853 token và bị từ chối
trước permit/generation. Không có cam kết mọi payload hợp lệ về bytes đều vừa
token; preflight vẫn kiểm toàn request ở từng lượt. Không tăng cap hoặc sửa ledger.

**Phạm vi LAB_REVIEW:** bảng token kiểm builder/adapter với snapshot live tổng hợp.
Đường admission hiện lấy feedback cho LAB_REVIEW, chưa cấp topology cho worker như
các intent live. Có module prompt chưa làm đường đó chạy được; không mở rộng luồng
feedback hay đánh dấu BE-09 hoàn thành trong lần sửa này.

**Kiểm thử:** 305 Python đạt, gồm tám ví dụ/ID/catalog, đủ intent theo contract,
null commandId, độ dài, revision lịch sử, context thiếu, injection boundary và
bảo toàn usage khi loại output. Các kiểm này chứng minh cách dựng request và chặn
output sai; chưa chứng minh model luôn tuân thủ cách dạy hoặc chống mọi prompt injection.
Hồi quy Node: **274 đạt**, bốn integration opt-in bỏ qua ở bộ offline; kiểm DB riêng
đạt **34 storage và 43 HTTP/DB**. Có thêm ca output vượt giới hạn bị Python chặn
nhưng Node vẫn ghi usage/phí và không tạo assistant message. Ruff, ESLint, format,
contracts/fixtures, boundaries và actionlint đạt. Bằng chứng ở
`.tmp/prompt-review-20261027/`.

Đã sửa fixture BE-04 cấp lại peer khi cổng ngẫu nhiên bị Fetch chặn, trước khi có
request nghiệp vụ; thử tối đa tám lần và không retry claim/generation. Cơ chế chặn
cổng được mô tả trong [Fetch Standard](https://fetch.spec.whatwg.org/#port-blocking).
Đã thêm kiểm lỗi mã hóa tiếng Việt trong ví dụ sau khi sửa chuyển dữ liệu UTF-8.

Version `gemini-r1-v2` đã đồng bộ Node/Python; version cũ bị chặn trước preflight
và claim. Runtime policy khi chạy mới phải dùng version tương ứng; không tự chạy
lại yêu cầu cũ để đổi prompt. Không có generation mới trong lần cập nhật này;
ledger giữ nguyên bốn reservation và 15.200 micro-USD cam kết.
