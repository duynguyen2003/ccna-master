# ADR-010 — Gọi Gemini qua worker và Python ở local

**Ngày:** 26/10/2026. **Trạng thái:** chấp nhận cho kiểm tra local theo yêu cầu
“ok làm đi” sau khi người dùng yêu cầu dùng model thật. Áp dụng cho PY-02;
chưa mở pilot hoặc production.

[PY-02](../baseline/PY-02-provider.md) · [ADR-003](ADR-003-provider-policy.md) ·
[ADR-009](ADR-009-local-live-gemini.md) · [Chính sách tiền](../ops/OPS-00-live.json)

## Quyết định

Node worker được gọi Python qua HTTP nội bộ. Python dùng adapter fake hoặc Gemini
do server chọn. Model local tiếp tục là `gemini-3.5-flash-lite`; URL Google cố định,
key chỉ có trong môi trường server. Browser và nội dung câu hỏi không được chọn
model, endpoint hoặc quyền gọi.

Python đếm token trên **toàn bộ request sẽ gửi**, gồm chỉ dẫn, JSON Schema, context,
facts và history. Việc này chạy trước khi xin permit từ Node và ngoài transaction
database. Count thiếu/sai hoặc vượt 6.000 token trừ margin 64 thì dừng trước generation.
Node chỉ giao bước đếm này cho profile Gemini đã cấu hình; các kiểm bytes, schema,
facts và catalog lệnh ở Node vẫn chạy.

Sau preflight, Python claim permit một lần. Node kiểm lại trạng thái/quyền/ngân sách,
giữ slot và ghi lần gọi. Chỉ claim thành công mới được gọi Gemini. Analyze, claim
và generation không tự retry. Riêng gửi **cùng một receipt** được thử tối đa ba lần
khi mất ACK/lỗi tạm thời; không gọi lại model để sửa câu trả lời.

Pydantic bọc JSON Schema sinh từ nguồn Zod chung, kiểm dữ liệu gốc trước khi ép
kiểu hoặc bỏ trường. Output sai vẫn có biên nhận usage; Node kiểm tiếp nội dung,
evidence, commandId và quyền trước khi lưu câu trả lời. Usage thiếu để `null` và
`UNRESOLVED`; chỉ suy ra thinking bằng 0 khi tổng token xác nhận được điều đó.

## Một ngân sách chung

Luồng Python và nút giải thích cũ dùng **cùng ledger** `.tmp/ai-lab-live/budget.json`,
cùng khóa ghi độc quyền. Không tạo/reset ledger khi đổi adapter hoặc khởi động lại.
Giữ 20 reservation cả đợt, 0,05 USD/ngày UTC, 0,10 USD/tháng và toàn đợt; giữ cả
reservation lỗi/unknown, không hoàn tiền dựa trên việc câu trả lời bị loại.

API đặt `maxOutputTokens=800` gồm output và thinking; `thinkingLevel=minimal` không
có nghĩa thinking bằng 0. Mỗi lần giữ tối đa 3.800 micro-USD ở ledger chung. Theo
cách contract tách hai loại token, PostgreSQL giữ mức thận trọng hơn là 5.800
micro-USD; usage thực được Node tính lại theo bảng giá có phiên bản. Nếu usage vượt
trần, ngừng các lượt tiếp theo. Ghi receipt hoặc retry không tạo reservation mới.

Ghi ledger trước khi transaction claim hoàn tất có thể giữ dư một reservation nếu
DB lỗi sau đó. Khoản giữ dư tiếp tục được tính vào hạn mức; không tự khôi phục lượt
vì chưa chứng minh được bên ngoài chưa tính tiền.

## Phạm vi kiểm tra và vận hành

Mặc định Python/worker tắt. `python-gemini` chỉ chạy với DB AI thử riêng trên loopback,
ngoài production; Python Gemini cần thêm `AI_PYTHON_LIVE_ENABLED=true` và key.
Readiness chỉ xác nhận cấu hình, không gọi Google và không xác nhận quota tài khoản.

Kiểm tự động/CI dùng fake Google cùng Node, Python và PostgreSQL thật. Lượt live
local của task này giới hạn tối đa **một generation**, dữ liệu tổng hợp và ledger
có sẵn. Có khóa không đồng nghĩa được mở ứng dụng thật hoặc tăng ngân sách.

BE-06 còn việc đóng đường provider cũ. Đánh giá CCNA/model, UI hội thoại, browser
E2E, tải lớp học, staging/backup và các gate pilot vẫn theo backlog hiện có.

Đối chiếu chính thức:
[model Gemini](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite),
[đếm token](https://ai.google.dev/gemini-api/docs/tokens),
[thinking và trần token](https://ai.google.dev/gemini-api/docs/generate-content/thinking),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output).
