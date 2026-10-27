# ADR-005 - Luồng xử lý AI và nơi định nghĩa dữ liệu chung

**Ngày quyết định:** 19/10/2026. **Trạng thái tại thời điểm chốt:** đã thống nhất thiết kế và bộ quy ước dữ liệu v1; chưa dựng dịch vụ Python. Worker local/fake được bổ sung sau đó ở BE-04; Python tiếp tục ở PY-01/PY-02.

**Cập nhật 26/10/2026:** [BE-05](../baseline/BE-05-context-output.md) đã nối bộ lọc snapshot/lịch sử và kiểm đầu ra vào worker/receipt. Contract v1.0.0 và 17 schema giữ nguyên; dịch vụ Python/model thật chưa triển khai qua luồng mới.

[Contract v1 và kiểm tra](../../../src/agent/contracts/ai-lab/v1/README.md) · [Nguồn shared](../../../src/agent/contracts/aiLabContract.js)

Tài liệu này chốt hai việc: **một câu hỏi đi qua những phần nào** và **các phần lấy mẫu dữ liệu ở đâu**. “Orchestration” là cách phối hợp các bước; “schema” là khuôn quy định dữ liệu có trường gì, kiểu gì và được nhận giá trị nào.

Ví dụ, Node gửi `callId` dưới dạng chuỗi nhưng Python lại đòi số thì hai bên không ghép được. Vì vậy frontend, Node và Python phải dùng chung một khuôn, có kiểm thử để phát hiện khi một bên hiểu khác.

## Quyết định

### 1. Bản đầu tiên chạy theo các bước cố định

Luồng R1 là: **Node nhận câu hỏi → worker chẩn đoán → Python gọi model một lần → gửi biên nhận → Node kiểm tra và lưu kết quả**.

API, worker và Python chạy thành ba chương trình riêng. Hàng chờ được lưu bền vững; một tác vụ chạy nền trong web server hoặc một mảng trong RAM không đủ, vì khởi động lại có thể làm mất việc.

R1 chưa thêm framework agent. Sang R2 mới so sánh một bộ điều khiển trạng thái nhỏ với LangGraph, dựa trên khả năng lưu mốc chạy, kiểm quyền công cụ, hủy việc, chi phí và tìm lỗi. Python không tự cấp quyền dùng công cụ hoặc truy vấn Prisma.

### 2. Chỉ sửa khuôn dữ liệu ở một nơi

Nguồn gốc là Zod trong `@ccna/shared/aiLabContract`, dùng được cả trong trình duyệt. Frontend và Node đọc trực tiếp module này. Công cụ sinh file xuất **17 JSON Schema Draft 7** vào `src/agent/contracts/ai-lab/v1/` để Python đọc.

Khi đổi một trường dữ liệu, sửa nguồn chung rồi sinh lại các file liên quan. Những mẫu dữ liệu đúng và sai được thử trên cả frontend, Node và Python để bảo đảm ba bên nhận/từ chối như nhau.

Các hàm kiểm liên kết dữ liệu, dấu nhận diện yêu cầu và chuyển trạng thái chỉ kiểm đầu vào, không truy cập database. Python hiện có bộ kiểm JSON Schema tham chiếu. Khi bọc bằng FastAPI/Pydantic ở task sau, vẫn phải từ chối trường lạ và giữ các test đối chiếu. Không được tự bỏ trường lạ trước khi kiểm rồi coi dữ liệu đó hợp lệ.

### 3. Phiên bản dữ liệu phải khớp rõ ràng

Hiện yêu cầu đúng `contractVersion=1.0.0`. Header `X-AI-Contract-Version` phải khớp phiên bản trong body/envelope. GET và cancel không có body vẫn gửi header.

Ví dụ, nếu phiên bản sau thêm một trường tùy chọn, phía gửi phải biết bên nhận có hỗ trợ hay chưa. Schema hiện từ chối trường không biết; thêm trường tùy chọn không tự động làm dữ liệu mới tương thích với client cũ.

Lần đầu chỉ hỗ trợ v1. Khi có bản tiếp theo, trong giai đoạn chuyển đổi phải giữ adapter, schema và mẫu thử của cả bản hiện tại lẫn bản trước. Thay ý nghĩa hoặc trường bắt buộc cần phiên bản major mới; thêm trường tùy chọn có thể dùng minor khi đã xử lý thương lượng phiên bản. Phiên bản model/prompt được quản lý riêng với phiên bản dữ liệu truyền giữa các phần.

## Hệ quả và xem lại

**Cập nhật PY-02 ngày 26/10/2026:** worker đã có transport Python; adapter
fake/Gemini, preflight toàn request và retry receipt riêng đã được kiểm trên
PostgreSQL thử. Pydantic bọc JSON Schema chung, kiểm raw JSON trước ép kiểu/bỏ
trường; 76 fixture chung đạt parity. Một lượt Gemini thật qua luồng mới thành
công theo [ADR-010](ADR-010-python-local-gemini.md). Contract vẫn v1.0.0;
pilot/production chưa bật. [Báo cáo PY-02](../baseline/PY-02-provider.md).

**Cập nhật PY-01 ngày 26/10/2026:** [dịch vụ Python local/fake](../baseline/PY-01-service.md)
đã dùng trực tiếp JSON Schema sinh từ nguồn chung để kiểm raw JSON, có JWT tương
thích Node, health và claim/receipt fake trước ACK. Worker chính chưa chuyển
transport; bọc Pydantic có parity, provider/prompt/tokenizer và receipt retry đầy
đủ tiếp tục ở PY-02. Không đổi contract v1.0.0 hoặc bật model thật.

CI kiểm các file JSON và mẫu thử đã sinh có khớp nguồn chung hay không. Muốn sửa chúng thì sửa shared source/builder rồi sinh lại, tránh mỗi bên có một bản khác nhau.

Ở mốc ADR-01, phần đã có là quy ước dữ liệu và kiểm thử tương thích. Các task BE triển khai database, quyền và worker sau đó; dịch vụ Python, giao diện và phối hợp agent R2 vẫn cần công việc riêng. Có bản thiết kế/schema chưa chứng minh các dịch vụ đó đã chạy.
