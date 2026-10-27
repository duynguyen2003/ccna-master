# ADR-001 - Gửi câu hỏi trước, nhận kết quả sau và luôn kiểm lại quyền

**Ngày:** 19/10/2026. **Trạng thái:** chấp nhận thiết kế R1, task ADR-01; API runtime triển khai ở BE-02…06/FE-02.

[Contract v1](../../../src/agent/contracts/ai-lab/v1/README.md) · [Threat review](../../../src/agent/contracts/ai-lab/v1/threat-scenarios.md)

AI có thể cần vài giây để trả lời. Vì vậy, giao diện gửi câu hỏi, nhận mã theo dõi rồi hỏi lại trạng thái để lấy kết quả sau. Đó là API bất đồng bộ. Trong lúc chờ, học viên vẫn gõ lệnh lab được.

Ví dụ, mạng ngắt ngay sau khi bấm gửi thì giao diện dùng lại mã câu hỏi để tìm yêu cầu cũ. Backend phải nhận ra lần gửi lại, tránh tạo thêm câu hỏi và giữ hạn mức lần nữa.

## Quyết định

### Nhận câu hỏi và trả tiến độ

Đường dẫn chung là `/api/lab-attempts/:attemptId/ai`. POST lưu request, phần hạn mức giữ chỗ, tin nhắn và sự kiện outbox trước khi trả 202: đã nhận để xử lý. GET chỉ đọc trạng thái, không gọi AI. Gửi lại câu hỏi đã kết thúc thì trả 200 cùng yêu cầu cũ. Lịch sử nằm trên server; trạng thái chờ AI tách khỏi trạng thái bận của terminal CLI.

Giao diện kiểm tra tiến độ theo khoảng 2/3/5/8 giây, cộng độ lệch ngẫu nhiên nhỏ để tránh mọi máy gửi cùng lúc, và tuân theo `pollAfterMs` server trả. Dừng hỏi khi yêu cầu kết thúc, trang ẩn, mất mạng, component bị gỡ hoặc panel đóng. Đổi tài khoản/auth epoch thì hủy vòng hỏi, xóa dữ liệu cũ và bỏ phản hồi đến muộn.

### Kiểm lại quyền ở mỗi lần đọc hoặc ghi

Node kiểm JWT, tài khoản, `sessionVersion`, quyền trong bài làm, chủ hội thoại và nhóm được bật tính năng. Đọc trạng thái, lịch sử hay feedback đều kiểm lại. Chủ bài lab nhóm không mặc nhiên được đọc chat riêng của thành viên.

Chỉ nhận token qua Bearer header, không nhận trong query. Response dùng `Cache-Control: private, no-store` để tránh lưu nội dung AI vào cache dùng chung.

### Nhận biết một câu hỏi đã gửi rồi

Database có khóa chống trùng `(userId, clientRequestId)` và `(requestId, role)`. Sau kiểm quyền, tìm yêu cầu cũ trước khi kiểm bản lab cũ, phục hồi hoặc hạn mức cho yêu cầu mới. Cùng ID, cùng nội dung thì trả lại yêu cầu cũ, không giữ hạn mức hoặc gọi AI nữa. Cùng ID nhưng nội dung khác thì trả 409.

Dấu nhận diện nội dung (`fingerprint`) gồm attemptId trên path và body đã kiểm, bỏ clientRequestId vì trường đó đã là khóa riêng. Quy tắc kỹ thuật: chuẩn hóa Unicode NFC, CRLF/CR thành LF, bỏ optional null, sắp key object; giữ khoảng trắng, revision, mức gợi ý được xin và thứ tự array. Không đưa trạng thái lab hiện tại vào dấu nhận diện của lần gửi lại.

### Dữ liệu vào/ra dùng một khuôn

Response là `{contractVersion,data}` hoặc `{contractVersion,error:{code,message,…}}`. Schema và bảng mã HTTP được sinh từ nguồn shared. Trong thời gian tích hợp, client nhận diện lỗi 401 cũ `{message}` bằng HTTP status; không tạo thêm một schema lỗi AI khác.

Browser không gửi userId, bản chụp lab, provider/model hoặc callback URL. `DIAGNOSE` phải chỉ nguồn và đúng một đích device/IPv4; `EXPLAIN_CONCEPT` cần câu hỏi. Mức gợi ý do client xin chỉ là đề nghị; Node quyết định mức được phép từ lịch sử và chính sách.

## Revision và vòng đời

Revision là số phiên bản trạng thái bài làm. `sourceRevision` ghi phiên bản lúc hỏi và giữ nguyên. Công thức `stale = sourceRevision !== currentRevision` nghĩa là phiên bản lúc hỏi khác phiên bản hiện tại thì câu trả lời dựa trên bản lab cũ.

Feedback cũ không biết revision thì để `sourceRevision=null`, `stale=null`, nguồn `LEGACY_FEEDBACK`, chỉ dùng câu dự phòng xác định. `LAB_REVIEW` mới đọc bản feedback đã lưu cùng lần chấm; không lấy trạng thái lab đang chạy ghép với điểm cũ.

Yêu cầu đã kết thúc không được mở lại. Chỉ đưa `RUNNING` về hàng chờ khi hết quyền giữ việc, còn thời gian và chưa cấp phép gọi AI. Biên nhận đến muộn chỉ cập nhật chi phí. Chủ yêu cầu bấm hủy nhiều lần vẫn có cùng tác dụng, không đảo kết quả đã hoàn tất.

Khi đánh dấu xóa hội thoại (`tombstone`), tăng epoch để chặn nội dung thuộc phiên cũ ngay. Việc xóa nội dung khỏi lưu trữ (`purge`) không cần chờ provider hoàn thành.

## Hệ quả và xem lại

R1 dùng cách gửi trước, lấy kết quả sau; các ghi chú UI cũ đề xuất chờ trả lời ngay đã được thay bằng quyết định này. Chưa truyền từng token; chỉ xem xét SSE khi đo được nhu cầu.

Test contract ở mốc thiết kế chỉ kiểm khuôn dữ liệu, dấu nhận diện và chuyển trạng thái. Kiểm quyền/chống trùng qua nhiều backend cần DB/HTTP thật ở BE-02/03/QA-01; không thể kết luận chỉ từ test schema.
