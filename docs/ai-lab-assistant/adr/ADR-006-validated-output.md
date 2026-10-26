# ADR-006 - Kiểm tra câu trả lời trước khi hiện cho học viên

**Ngày:** 19/10/2026. **Trạng thái:** chấp nhận R1; renderer/binding runtime ở BE-05/FE-01…03.

**Cập nhật 26/10/2026:** [BE-05 đã triển khai kiểm đầu ra phía Node local/fake](../baseline/BE-05-context-output.md), trước lưu receipt text và trước tạo tin nhắn. Kết luận nguyên nhân đầy đủ còn cần SIM-01; renderer/giao diện và browser E2E còn ở FE/QA.

**Bổ sung SIM-01 cùng ngày:** [kết luận chẩn đoán mạnh](../baseline/SIM-01-diagnostics.md) đã được kiểm theo mẫu, loại kết luận và đầy đủ evidence IDs Node tạo cho đúng nguồn–đích. `NO_ISSUE_OBSERVED` chỉ nói probe đi/về thành công, không nói cả lab đúng. Chưa chứng minh mọi câu văn tự do do model sinh đúng ngữ nghĩa; renderer/browser/eval vẫn còn.

[Contract v1](../../../src/agent/contracts/ai-lab/v1/README.md) · [UI](../ui-ai-lab-assistant.md)

AI trả lời được chưa có nghĩa là câu trả lời đúng hoặc được phép hiển thị. Node phải kiểm câu trả lời thuộc đúng câu hỏi, dùng đúng bằng chứng và không vượt mức gợi ý cho phép.

Ví dụ, model nêu một lệnh có vẻ hợp lý nhưng ID lệnh đó không nằm trong danh sách Node đã cấp thì không được đưa thẳng lên giao diện. Tương tự, thiếu dữ liệu để chẩn đoán không thể biến thành kết luận “lab đúng hoàn toàn”.

## Quyết định

1. **Nhận xong, kiểm xong mới hiện.** Không truyền từng token của model thẳng tới học viên. Worker chỉ lưu tin nhắn cuối sau khi Node kiểm khuôn dữ liệu, call/context/fence/version, ID bằng chứng, lệnh được phép và mức gợi ý. Response HTTP của Python không được bỏ qua bước ghi receipt.
2. **Nói rõ mức chắc chắn.** Các loại kết luận gồm `SUPPORTED_FINDING` (có căn cứ), `HYPOTHESIS` (giả thuyết), `NO_ISSUE_OBSERVED` (chưa thấy lỗi), `INSUFFICIENT_CONTEXT` (thiếu dữ liệu), `UNSUPPORTED` (chưa hỗ trợ). Kết luận có căn cứ cần cả bằng chứng lẫn quy tắc chẩn đoán phù hợp.
3. **Giữ câu trả lời có giới hạn.** Có summary, evidence IDs, tối đa hai bước nhỏ, cách kiểm tra lại và hint level. Model chỉ trả command IDs đã cấp; Node tra text/device/mode. Mức trả lời không được vượt `effectiveHintLevel`; browser không tự nâng mức chính sách.
4. **Hiển thị nội dung như dữ liệu.** UI dùng text/Markdown giới hạn, escape text, không nhận HTML thô, ảnh từ xa hoặc kiểu link nguy hiểm. AI không được chấm điểm hoặc tự chạy lệnh. Một chuỗi đúng kiểu dữ liệu vẫn cần kiểm cách hiển thị, dữ liệu nhạy cảm và ý nghĩa.
5. **Cho người học biết nguồn và độ cũ.** Phân biệt câu LLM và câu dự phòng xác định. So source/current revision để gắn nhãn `stale`; lab đổi không tự tạo lần gọi mới. Câu dự phòng, lỗi 429/503 (hết lượt/dịch vụ chưa sẵn sàng) và lỗi mạng có trạng thái riêng; terminal vẫn hoạt động.
6. **Đổi quyền thì bỏ nội dung cũ.** Đổi tài khoản, đăng xuất, bị thu hồi quyền hoặc hội thoại được đánh dấu xóa thì loại cache, vòng hỏi trạng thái và phản hồi đến muộn theo auth/conversation epoch. Biết UUID không cấp quyền đọc tin nhắn. Mặc định không lưu chat vào localStorage.

## Hệ quả và xem lại

R1 chấp nhận chờ câu trả lời hoàn chỉnh để có thời gian kiểm. Nếu cần, sau này có thể truyền trạng thái đã định nghĩa. Muốn truyền từng khối câu trả lời đã kiểm thì cần thiết kế thêm việc thu hồi quyền, cache và an toàn đầu ra.

Test quy ước dữ liệu không thay cho kiểm toàn luồng trên trình duyệt, kiểm XSS hoặc đánh giá độ đúng của câu trả lời tiếng Việt. Phần triển khai vẫn thuộc BE-05/FE-01…03 theo trạng thái đầu tài liệu.
