# ADR-004 - Node giữ dữ liệu lab, bản chụp và bằng chứng chẩn đoán

**Ngày:** 19/10/2026. **Trạng thái tại thời điểm chốt:** đã thống nhất cho R1, phần xử lý lab cần BE-02/05/SIM-01 triển khai. BE-02 sau đó đã có kiểm quyền và bản chụp local; xử lý context/chẩn đoán đầy đủ vẫn thuộc BE-05/SIM-01.

**Cập nhật 26/10/2026:** [BE-05 đã có bộ lọc và verifier local/fake](../baseline/BE-05-context-output.md), bằng chứng quan sát từ snapshot và lệnh đọc qua parser. Chưa có bộ chẩn đoán nguyên nhân SIM-01. Các yêu cầu bên dưới là thiết kế R1 đầy đủ; hiện chưa gửi nhật ký CLI do thiếu ràng buộc actor/revision đầy đủ.

**Bổ sung SIM-01 cùng ngày:** [đã có quy tắc và probe clone local/fake](../baseline/SIM-01-diagnostics.md), facts DIAGNOSTIC có revision/phạm vi/version. Cổng không liên quan và default route hợp lệ được kiểm âm tính; cấu hình nâng cao hoặc dữ liệu thiếu được đánh dấu. Chưa có model thật/review CCNA độc lập; các giới hạn R1 đầy đủ vẫn áp dụng.

[Ba lab đã chứng nhận](../labs/DISC-03-certified-labs.md) · [Contract v1](../../../src/agent/contracts/ai-lab/v1/README.md)

**Node xác định điều gì đang xảy ra trong lab; Python dùng dữ liệu được cấp để viết lời giải thích.** Evidence là bằng chứng quan sát được, chẳng hạn “cổng R1 G0/0 đang shutdown”, kèm nguồn và phiên bản lab.

Ví dụ, cổng không dùng đang tắt không đủ để kết luận đó là nguyên nhân lỗi ping. Node phải kiểm cổng có nằm trên đường đi hay không; model không được tự biến một quan sát rời rạc thành nguyên nhân chắc chắn.

## Quyết định

- **Node giữ quyền và kết quả mô phỏng:** đăng nhập, thành viên/nhóm được dùng AI, simulator, chấm điểm, dữ kiện lab, hạn mức và chi phí. Python không có khóa đọc database nghiệp vụ; chỉ nhận dữ liệu đã lọc, dữ kiện, ID lệnh được phép và lịch sử đúng chủ sở hữu/epoch.
- **Chụp lab trong lần ghi ngắn:** kiểm quyền/revision và lấy bản chụp trong cùng transaction ngắn. Chẩn đoán hoặc thử kết nối lâu thì chạy trên bản sao đã lưu sau khi thả khóa. Không sửa `deviceState`, cache, số lệnh, điểm hay tiến độ thật.
- **Chỉ lấy trường được cho phép:** thông tin lab công khai và nguồn ghi nhận, interface/route/VLAN/link, tiến độ công khai, tối đa 12 command/output và 6 tin nhắn lịch sử đã lọc. Không chuyển nguyên Lab/Attempt/User hoặc feedback thô sang JSON. Trường text hợp khuôn vẫn phải che dữ liệu nhạy cảm và giới hạn kích thước.
- **Node cấp và kiểm bằng chứng:** gồm evidenceId, sourceRevision, phạm vi, quan sát và nguồn. Python chỉ tham chiếu evidenceId đã cấp. Node kiểm ID có thật, đúng revision/device/interface và có quy tắc đủ căn cứ cho kết luận. Cổng shutdown ngoài đường đi không tự là nguyên nhân; default route hợp lệ không bị coi là thiếu route.
- **Model chỉ chọn lệnh đã được cấp:** Node tạo `allowedCommands` gồm ID, thiết bị, mode và text từ danh sách khả năng hỗ trợ. Model trả commandId; Node tra lại lệnh rồi kiểm parser/profile trước khi hiển thị. UI cho sao chép, không tự thực thi.
- **Lịch sử không thay trạng thái hiện tại:** tin nhắn cũ chỉ giúp hiểu quá trình học. `LAB_REVIEW` dùng bản feedback và nguồn đã lưu; dữ liệu cũ thiếu revision chỉ có câu dự phòng kèm nhãn giới hạn. Thông tin công khai đọc muộn phải ghi `CAPTURED_AT_AI_REQUEST` để biết được lấy lúc hỏi AI.

## Phạm vi chứng minh

Schema từ chối trường ngoài danh sách như gradingSpec/userId/credentials. Các kiểm tra liên kết chặn ID bằng chứng/lệnh/thiết bị giả và revision lệch. Chúng chưa phát hiện được mọi câu kết luận sai hoặc bí mật lẫn trong trường text được phép.

BE-05 còn cần che dữ liệu nhạy cảm, dùng dấu thử (`canary`) để phát hiện lộ dữ liệu và kiểm chính sách bằng chứng. SIM-01, bộ đánh giá và người đọc chuyên môn mới giúp chứng minh chất lượng chẩn đoán.

Ba lab DISC-03 là dữ liệu mẫu do dự án dựng để phát triển, chưa phải bộ kiểm tra độc lập giữ riêng, và không chứng nhận toàn bộ Cisco IOS. Muốn chuyển phần xử lý lab khỏi Node hoặc cho Python đọc dữ liệu nghiệp vụ thì cần quyết định kiến trúc và thay đổi quyền riêng. Prompt hay công cụ tự khai không thể cấp các quyền đó.
