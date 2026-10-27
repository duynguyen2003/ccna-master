# ADR-002 - Dùng PostgreSQL giữ hàng chờ, hạn mức và quyền xử lý việc

**Ngày:** 19/10/2026. **Trạng thái:** chấp nhận thiết kế R1; transaction/constraint triển khai ở BE-01/03/04.

[Contract v1](../../../src/agent/contracts/ai-lab/v1/README.md) · [Threat review](../../../src/agent/contracts/ai-lab/v1/threat-scenarios.md)

**Ở mốc BE-01 ngày 23/10/2026:** đã có bảng dữ liệu, khóa ngoại và các ràng buộc chống trùng. Hai kết nối cùng tạo yêu cầu đang chạy cho một người thì chỉ một bên thành công. Lúc đó chưa kiểm luồng giữ/chốt hạn mức và worker; các phần này được bổ sung ở BE-03/BE-04 sau đó. [Báo cáo BE-01](../baseline/BE-01-storage.md).

Mục đích là **nhiều backend/worker cùng chạy vẫn nhìn thấy một hàng chờ và một hạn mức chung**. Reservation là phần lượt/tiền tạm giữ cho câu hỏi. Fence là số phiên nhận việc, giúp từ chối một worker cũ quay lại ghi dữ liệu sau khi việc đã được nhận lại.

## Quyết định

**Sau BE-04 ngày 23/10/2026:** đã kiểm việc nhận câu hỏi, gia hạn quyền xử lý, số phiên, dọn việc bỏ dở, permit một lần, chỗ chạy chung và chốt hạn mức bằng hai chương trình cùng database. BE-03 và worker lấy giờ từ database, dùng session UTC để tránh lệch múi giờ. Chưa đo tải hoặc bật provider thật. [Báo cáo worker local/fake](../baseline/BE-04-worker.md).

- **PostgreSQL giữ dữ liệu chung:** hàng chờ, hạn mức, sổ chi phí và chỗ chạy AI. `FOR UPDATE SKIP LOCKED` giúp worker bỏ qua việc/slot đang bị worker khác giữ; không thay cho kiểm tra hạn mức nhất quán khi nhận câu hỏi. Bộ đếm RAM riêng từng server không đủ để chặn ngân sách toàn hệ thống.
- **Nhận câu hỏi thì ghi cùng nhau:** request `QUEUED`, bản chụp đã lọc, một tin nhắn người dùng, phần hạn mức giữ chỗ và sự kiện outbox nằm trong một transaction. Database chặn một người có nhiều yêu cầu `QUEUED`/`RUNNING`, chặn trùng `(userId,clientRequestId)` và chặn bộ đếm âm.
- **Lấy khóa theo cùng thứ tự để tránh chờ chéo:** attempt → conversation → request/user slot → các bucket theo key ổn định → reservation/provider call. Lần nhận việc từ queue được commit ngay trước các bước kiểm quyền/bản chụp tiếp theo. Không giữ khóa request rồi quay lại chờ khóa attempt theo chiều ngược lại trong cùng transaction.
- **Giữ trước lượt và chi phí tối đa:** một lượt ở user/ngày; tiền ở user/ngày, global/ngày và global/tháng. Bucket là một ô hạn mức cho từng phạm vi/thời gian, tính theo giờ UTC của database. Tiền dùng số nguyên micro-USD. Khi chốt, cập nhật đúng bucket đã giữ ban đầu dù đã qua nửa đêm. OPS-00 phải cấp ngân sách và giá cụ thể, không mặc định vô hạn.
- **Luôn giữ `spent + reserved <= limit`:** tiền đã dùng cộng tiền đang giữ không vượt trần. Khoản chưa rõ vẫn tính vào phần giữ hoặc chi phí ước tính. Fallback không dùng lượt LLM nhưng phí đã phát sinh vẫn ghi. Mỗi lần chốt/điều chỉnh có khóa chống xử lý trùng, không sửa sổ cũ âm thầm.
- **Giới hạn cả người dùng lẫn tổng số việc:** mỗi người tối đa một yêu cầu đang chờ/chạy. Các worker dùng chung bảng slot. Hạ mức chạy đồng thời chỉ ngừng cấp chỗ mới; lần gọi chưa rõ kết quả vẫn giữ chỗ tới deadline cộng thời gian chờ thêm, dù worker đã mất quyền giữ việc.
- **Worker phải báo còn hoạt động:** lease ban đầu 15 giây, heartbeat mỗi 5 giây; nhận lại việc thì tăng fence. Mỗi lần ghi trạng thái phải khớp requestId, leaseVersion và trạng thái dự kiến. Không giữ transaction trong lúc gọi HTTP/provider, ngủ chờ hoặc chẩn đoán dài.

## Retry và phục hồi

Ví dụ, worker chết trước khi được cấp phép gọi AI thì có thể giao lại câu hỏi. Để chuyển `RUNNING` → `QUEUED`, phải đồng thời hết lease, còn deadline và chưa có provider call hoặc call vẫn `PLANNED`, chưa được cấp phép.

Sau `DISPATCHED`, kể cả mất xác nhận cấp phép, không tự gọi provider lại: lần trước có thể đã chạy và tính tiền. Có receipt đã lưu thì dùng nó để hoàn tất; nếu không xác định được kết quả trong thời hạn thì chuyển `OUTCOME_UNKNOWN` và kiểm tra chi phí tiếp.

Khi giao lại việc, cập nhật fence của call còn `PLANNED` theo lease mới trong transaction tương ứng. Token worker cũ không được xin permit nữa. Không tạo call `step=0` thứ hai hoặc đổi call `DISPATCHED` về `PLANNED` để gọi lại.

Sau khôi phục backup, tắt nhận yêu cầu/cấp phép và đổi `recoveryEpoch` bằng giá trị quản lý nằm ngoài bản backup. Mã câu hỏi còn trong sổ thì trả lại yêu cầu cũ sau khi kiểm quyền. Mã đã mất nhưng mang epoch cũ thì trả 409 `AI_RECOVERY_RECONFIRM`. Client không tự đổi epoch/ID để gửi lại; người học phải chủ động xác nhận yêu cầu mới.

## Hệ quả và xem lại

Chưa thêm Redis hoặc hệ thống queue khác. Chỉ xem lại khi đo thấy thời gian chờ khóa, CPU database hoặc hàng chờ không đáp ứng tải mục tiêu.

Test kiểu dữ liệu/trạng thái ở mốc ADR chưa đủ chứng minh tranh hạn mức hoặc chốt tiền không trùng. BE-04 đã bổ sung kiểm local bằng hai process. Các nhóm T-IDEM/T-COST/T-OPS ở QA-01/04 và OPS-06 vẫn cần kiểm hai replica cùng database thật theo phạm vi nghiệm thu vận hành.
