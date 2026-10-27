# ADR-003 - Chọn một cấu hình AI và có câu trả lời dự phòng

**Ngày:** 19/10/2026. **Trạng thái:** đã chốt quy tắc kết nối AI cho R1; chưa chọn nhà cung cấp/model R1 hoặc cấp quyền gọi có phí qua luồng mới. Lần thử Gemini local được quy định riêng ở [ADR-009](ADR-009-local-live-gemini.md).

[Contract v1](../../../src/agent/contracts/ai-lab/v1/README.md) · [Backlog](../03-delivery-backlog.md)

Tài liệu này trả lời: **gọi AI nào, được gọi mấy lần, và làm gì khi AI lỗi?** Provider là nhà cung cấp model. Fallback là câu trả lời dự phòng từ logic đã duyệt, không phải câu do model sinh ra.

Ví dụ, AI trả về JSON sai định dạng thì hệ thống dùng câu dự phòng hoặc báo thất bại. Hệ thống không tự gọi thêm lần nữa để nhờ AI sửa JSON, vì lần gọi thêm vừa tốn phí vừa làm luồng khó kiểm soát.

## Quyết định

1. **Server chọn cấu hình AI.** R1 dùng một cấu hình provider/model đã được đánh giá. Node gửi `providerConfigId`; Python tra cấu hình tương ứng trên server. Trình duyệt và model không được chọn API key, model, endpoint hoặc callback URL.
2. **Mỗi câu hỏi tối đa một lần gọi model.** Chỉ gọi sau khi database đã lưu phần hạn mức giữ chỗ và đã cấp permit. Tắt việc tự gửi lại POST ở SDK/proxy; không gọi lần hai để sửa JSON. Giấy phép nội bộ giúp chặn gọi lặp, nhưng không bảo đảm nhà cung cấp bên ngoài thực hiện chính xác một lần trong mọi sự cố mạng.
3. **Phân biệt câu dự phòng và câu AI.** Provider không chạy được, trả sai hoặc chưa hỗ trợ dữ liệu đó thì dùng fallback đã duyệt, gắn `responseMode=DETERMINISTIC`. Không có nội dung dùng được thì `FAILED`/`NONE`. Nếu chưa biết lần gọi đã chạy hay chưa, có thể hiện fallback nhưng yêu cầu vẫn là `OUTCOME_UNKNOWN`.
4. **Giới hạn đầu vào và đầu ra trước khi gọi.** Tổng input tối đa 6.000 token, output tối đa 800 token theo cấu hình R1; phần reasoning có tính phí phải có trần rõ ràng. Adapter không chặn được chi phí tối đa thì chưa được nhận yêu cầu để gọi thật. Dữ liệu truyền nội bộ còn có giới hạn 64 KiB theo UTF-8; số ký tự không thay cho việc đếm token.
5. **Chưa biết usage thì ghi là chưa biết.** `FINAL` cần đủ số token. Thiếu số liệu thì để `UNRESOLVED` và count `null`, không thay bằng 0. Node tự tính tiền từ bảng giá có phiên bản trên server; không tin số tiền browser/model tự khai.
6. **Lượt hỏi và tiền được tính riêng.** Chỉ có fallback, không có câu LLM dùng được thì hoàn lượt LLM. Phí provider đã phát sinh vẫn phải chốt hoặc tiếp tục theo dõi. Câu LLM dựa trên bản lab cũ (`stale`) vẫn tính một lượt, vì hệ thống đã xử lý bản chụp được yêu cầu.

## Điều kiện trước model thật

**Ngoại lệ local ngày 26/10/2026:** [ADR-010](ADR-010-python-local-gemini.md) cho
phép thử luồng worker/Python với Gemini thật bằng dữ liệu tổng hợp, DB thử riêng và
ngân sách local dùng chung. Một lượt đã hoàn tất theo [PY-02](../baseline/PY-02-provider.md).
Đây là kiểm tích hợp local; các điều kiện mở pilot/production bên dưới vẫn áp dụng.

Trước khi bật model thật qua R1, OPS-00 phải chốt ngân sách ngày/tháng, nơi chạy và giới hạn tài khoản. AI-02 so sánh model bằng cùng bộ tình huống thử và chi phí. BE-06 xử lý đường gọi `/explain` cũ; OPS-02 có trần ngân sách và công tắc tắt. Chưa đạt các điều kiện này thì luồng mới tiếp tục dùng AI giả lập.

## Hệ quả và xem lại

Quy ước dữ liệu không gắn cứng với một hãng/model. Muốn thêm cấu hình khác thì phải đánh giá chất lượng, dữ liệu và ngân sách tương ứng. Đổi model không được làm đổi chủ sở hữu, bản chụp lab hay quyền của câu hỏi đã nhận.
