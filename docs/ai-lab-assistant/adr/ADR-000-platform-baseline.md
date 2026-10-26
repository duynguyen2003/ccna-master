# ADR-000 — Kiểm tra hệ thống đang có trước khi thêm AI

**Ngày:** 19/10/2026. **Trạng thái:** chấp nhận cho việc kiểm kê và phát triển local; không phải phê duyệt phát hành. **Task:** DISC-01. **Vai trò:** SO/SE.

[Baseline](../baseline/DISC-01-platform-baseline.md) · [Issue](../baseline/DISC-01-blockers.md) · [Thiết kế đích](../02-architecture-and-contracts.md)

## Bối cảnh

Trước khi thêm AI, cần biết code trên máy, code trên GitHub và code đang chạy thật có khớp nhau không. Ví dụ, frontend mở được chưa chứng minh backend đang chạy đúng bản hoặc database đã cập nhật đủ.

Tài liệu ngày 16/10 ghi trạng thái thư mục làm việc khi nhiều thay đổi chưa commit. Đến phiên kiểm kê ngày 19/10, PR #9 đã merge; main GitHub là `19394880a555c037640462be982e714910df71f5`, có cùng nội dung file với local HEAD `20ba2527e120b3e0c1e52a8b05e1f9562042a2be`. Frontend production và API kiểm sẵn sàng trên Render có phản hồi. Phiên bản backend, môi trường thử riêng và một phần vận hành vẫn chưa xác minh.

## Quyết định

1. **Ghi rõ đã kiểm gì và kiểm ngày nào.** Dùng bảng DISC-01 làm mốc đối chiếu. Phân biệt commit trong source, thông tin triển khai và phản hồi của ứng dụng đang chạy. CI đạt chưa thay cho việc kiểm trên môi trường đích.
2. **Tiếp tục dùng nền tảng hiện có.** Giữ React/Express/Prisma/PostgreSQL và `@ccna/shared`. Node giữ simulator, quyền và chấm điểm. Task kiểm kê không đổi framework/runtime hoặc xây thêm tính năng AI.
3. **Chỉ khẳng định đường chạy đã quan sát.** Frontend Vercel gọi API Render là đường đã thấy. Compose/Nginx có trong source nhưng chưa được xác nhận là cách production đang chạy. OPS-00 và các ADR sau sẽ quyết định nơi chạy worker/Python.
4. **Test ghi dữ liệu phải dùng database riêng.** Database trong `.env` local được xem là production cho tới khi chứng minh đã cách ly. Phiên kiểm kê chỉ đọc metadata. Ba migration có checksum khớp chưa chứng minh toàn bộ cấu trúc database khớp schema.
5. **Ghi phần còn thiếu thành việc cụ thể.** Mỗi issue có người chịu trách nhiệm và mốc phải xử lý. DISC-01 có thể xong phần kiểm kê, còn các mốc nghiệm thu vận hành phải chờ đủ bằng chứng.
6. **Báo cáo chỉ ghi tên biến cấu hình.** Không chép mật khẩu, khóa hay dữ liệu học viên vào tài liệu/mẫu thử. Phiên kiểm kê không triển khai, cập nhật database, restore hoặc đổi chính sách proxy.

## Hệ quả và điều kiện xem lại

DISC-01 hoàn thành khi có báo cáo và danh sách vấn đề. Các mốc G0/G1/G2 chưa hoàn thành nhờ task này. Vẫn cần xác nhận phiên bản backend đang triển khai, môi trường thử cách ly, cấu trúc database, backup đầy đủ và proxy theo từng mốc đã ghi. Quyết định này không thay ADR-001…007 và chưa chọn cách gọi đồng bộ/bất đồng bộ hoặc hãng/model AI.

Cập nhật báo cáo khi đổi code, bản triển khai, database/proxy hoặc có bằng chứng mới từ host. Ghi ngày và nguồn mới để vẫn đọc được lịch sử. Nếu đổi hạ tầng Vercel/Render hoặc cách chia trách nhiệm Node/Python thì cần quyết định kiến trúc riêng.
