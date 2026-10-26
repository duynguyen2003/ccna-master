# ADR-007 - Câu hỏi đã kết thúc vẫn có thể còn chi phí cần kiểm tra

**Ngày:** 19/10/2026. **Trạng thái:** chấp nhận R1; ledger/receipt runtime ở BE-01/03/04 và recovery OPS-06.

[Contract v1](../../../src/agent/contracts/ai-lab/v1/README.md) · [Threat review](../../../src/agent/contracts/ai-lab/v1/threat-scenarios.md)

**Ở mốc BE-01 ngày 23/10/2026:** đã có bảng lưu lần gọi, tiền giữ chỗ và điều chỉnh chi phí; usage chưa biết được để trống. Database giữ được dữ liệu chi phí sau khi xóa nội dung/tách người dùng. Lúc đó API receipt, xác thực dịch vụ và luồng đối soát chưa có; BE-04 bổ sung sau đó. [Báo cáo BE-01](../baseline/BE-01-storage.md).

Ví dụ, bạn bấm hủy sau khi AI đã nhận việc. Câu hỏi có thể dừng ở trạng thái đã hủy, nhưng nhà cung cấp vẫn có thể tính tiền. Vì vậy **trạng thái câu hỏi và sổ chi phí phải được theo dõi riêng**. Receipt là biên nhận kết quả một lần gọi; accounting là phần ghi và đối chiếu chi phí.

## Quyết định

**Sau BE-04 ngày 23/10/2026:** đã có API biên nhận xác thực bằng token dịch vụ, nhận lại cùng nội dung không ghi trùng, và ghi sự kiện khi nội dung xung đột. Kết quả muộn không được hiện sau khi mất quyền/kết thúc/xóa nội dung. Đã tách hoàn lượt khỏi tiền, có ước tính và điều chỉnh usage. Hai process cùng database đã kiểm chốt trùng và hủy lần ghi bị lỗi. Nối hóa đơn provider, đổi khóa dịch vụ và phục hồi vận hành đầy đủ vẫn thuộc PY/OPS. [Báo cáo receipt local/fake](../baseline/BE-04-worker.md).

### Trước khi gọi AI

Một lần gọi R1 có `stepIndex=0`, callId và liên kết với requestId/contextHash/leaseVersion/version. Python phải xin permit bằng token dịch vụ được giới hạn cho đúng việc. JWT người dùng, danh tính dịch vụ và khóa provider là ba loại quyền riêng.

Token dịch vụ ràng buộc `aud/operation/iss/sub/keyId/iat/exp` và thông tin lần gọi. Server kiểm chữ ký, hạn dùng, bên cấp/bên nhận, quyền hiện tại và fence trước cấp phép. JSON đúng khuôn chưa chứng minh token hợp lệ.

### Sau khi có kết quả

Python PUT receipt gồm đầu ra có giới hạn kích thước, usage/status, provider request ID, finishReason và versions. Node kiểm khuôn, liên kết lần gọi, quyền giữ nội dung và dấu nhận diện nội dung (`hash canonical`) trước khi ghi.

- Cùng call/hash: nhận lại bản cũ, không xử lý trùng.
- Khác payload/hash: báo `AI_RECEIPT_CONFLICT`, ghi sự kiện kiểm tra và không ghi đè.
- Response HTTP của Python chỉ xác nhận đã ghi bằng `{contractVersion,callId,contextHash,receiptHash}`. Worker/finalizer đọc receipt trong Node để hoàn tất.

Mất xác nhận này không có nghĩa là AI chưa chạy. Có thể gửi lại receipt theo cách chống trùng; không gọi model lại để lấy câu trả lời khác.

### Trạng thái lần gọi và trạng thái câu hỏi

Lần gọi đi từ `PLANNED` (đã lên kế hoạch) → `DISPATCHED` (đã cấp phép) → `RECEIVED`/`KNOWN_FAILURE`/`OUTCOME_UNKNOWN` (đã nhận/thất bại đã biết/chưa rõ kết quả). Trạng thái unknown có thể được cập nhật khi đối soát ra kết quả.

Câu hỏi đã kết thúc thì giữ nguyên trạng thái. Kết quả đến muộn không thêm tin nhắn assistant thứ hai, không hiện lại chat đã xóa hoặc đảo việc hủy/thu hồi quyền.

Hủy, xóa hoặc mất quyền trước khi cấp phép thì trả phần giữ chỗ chưa dùng. Sau khi cấp phép vẫn có thể phát sinh tiền. Nội dung đến muộn bị bỏ nếu không còn quyền giữ; chỉ giữ metadata tối thiểu để đối chiếu chi phí, không chép text sang nơi khác để giữ lại.

Token cấp phép hết hạn không được dùng lại. Receipt muộn cần danh tính dịch vụ được cấp mới trong thời gian đối soát, vẫn ràng buộc đúng lần gọi ban đầu. Quyền ghi chi phí không cho phép hiện câu trả lời hoặc gọi thêm model.

### Khi chưa biết tiền hoặc câu trả lời bị loại

Usage thiếu thì để `UNRESOLVED`. Sau tối đa 24 giờ, đối soát hoặc ghi phần đã giữ thành chi phí ước tính theo hướng bảo thủ. Usage thật đến sau thì tạo adjustment có khóa chống trùng; không sửa receipt hash hay sổ cũ. Node dùng `priceVersion` đã lưu khi giữ ngân sách để tính tiền.

Nếu output model không hợp lệ, Python gửi receipt `KNOWN_FAILURE`, `output=null` nhưng vẫn giữ usage đã đo. Nếu Node từ chối receipt vì sai khuôn/liên kết, phần tiền vẫn chưa rõ; không tự hoàn về 0. Loại câu trả lời không chứng minh provider chưa tính phí.

## Hệ quả và xem lại

Đánh dấu xóa/xóa nội dung hội thoại tách khỏi bản ghi lần gọi, tiền giữ chỗ và sổ chi phí. Người học xóa chat không làm mất toàn bộ dữ liệu đối soát. Quyền hỗ trợ và thời hạn lưu vẫn phải chốt/triển khai trước pilot. Hủy câu hỏi không bảo đảm thu hồi được dữ liệu provider đã nhận hoặc được hoàn phí.

Ở mốc thiết kế, test mới chứng minh khuôn dữ liệu, liên kết, usage chưa biết và sơ đồ trạng thái. BE-04 sau đó đã kiểm chốt trùng, receipt muộn và rollback local. Kiểm lỗi/khôi phục đầy đủ vẫn cần các ca tích hợp của QA-04/OPS-06.
