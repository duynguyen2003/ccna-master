# AI Coding Rules

## Vị trí triển khai agent

Mọi code triển khai task AI/agent đặt trong `src/agent`, cùng cấp `src/backend`.
Xem [cấu trúc agent](src/agent/README.md) và [quy tắc triển khai](src/agent/AGENTS.md).
Báo cáo task vẫn sửa trực tiếp trong `docs/ai-lab-assistant`; Prisma migration và
các điểm nối domain/API của ứng dụng vẫn ở backend.

Trước khi thực hiện bất kỳ thay đổi nào, phải tuân thủ quy trình sau:

1. Viết kế hoạch cụ thể vào `todo.md`.
   - Mục tiêu phải đo được.
   - Liệt kê file dự kiến thay đổi.
2. Kiểm tra lại kế hoạch trước khi code.
3. Thực hiện từng mục.
   - Hoàn thành mục nào → đánh dấu [x] mục đó.
4. Mỗi thay đổi phải giải thích:
   - Thay đổi gì?
   - Tại sao thay đổi?
5. Sau khi hoàn thành:
   - Kiểm tra lỗi.
   - Ghi kết quả vào `todo.md`.
6. Ghi bài học/rút kinh nghiệm vào `lessons.md`.

7. Xóa bỏ những khẩu hiệu thừa thãi, văn bản giải thích và nhãn phụ.Nếu xóa xong mà giao diện trở lên khó hiểu, chứng tỏ layout bản thân đã có vấn đề , hãy thiết kế lại nay lập tức

8. Mỗi lần chỉnh sửa đều phải cân nhắc đến trải nghiệm người dùng , trải nghiệm lập trình viên và trải nghiệm của AI agent. Cả 3 đều phải được cải thiện, mà không được phép phá hỏng chức năng hiện có

## Nguyên lý

### 1. Tối giản
Chỉ thay đổi những gì cần thiết.
Không refactor hoặc sửa code không liên quan.

### 2. Triệt để
Tìm nguyên nhân gốc của vấn đề.
Không vá tạm để làm cho lỗi biến mất.

### 3. Vô hình
Thay đổi phải ít ảnh hưởng nhất có thể.
Không làm hỏng chức năng đang hoạt động.

## Quy tắc quan trọng

Không được bỏ qua bất kỳ bước nào.


Nếu chưa hiểu nguyên nhân của lỗi, không được sửa code một cách phỏng đoán.

