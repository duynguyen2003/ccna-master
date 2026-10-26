# ADR-008 — Chạy thử trên máy bằng AI giả, ngân sách 0 USD

**Ngày:** 22/10/2026. **Trạng thái:** chấp nhận cho phát triển local theo lựa chọn người dùng. **Task:** OPS-00. Chưa phê duyệt model thật hoặc phát hành pilot.

**Cập nhật sau đó:** [ADR-009](ADR-009-local-live-gemini.md) cho phép thử Gemini thật riêng ở nút giải thích kết quả local. Các yêu cầu tách database và nghiệm thu trước pilot/production trong tài liệu này vẫn giữ.

[Hồ sơ OPS-00](../ops/OPS-00-local-fake.md) · [Worksheet](../ops/OPS-00-budget.json) · [Provider policy](ADR-003-provider-policy.md)

## Bối cảnh

Mục đích là có nơi xây và thử phần nền AI mà không phát sinh phí gọi model. AI giả trả kết quả từ dữ liệu mẫu, giúp thử hàng chờ và lỗi giữa chừng trước khi nối model thật.

Ở thời điểm quyết định ngày 22/10, người dùng chọn “Chỉ chạy local/fake, 0 USD trước mắt” và cho biết có tài khoản Gemini. Chưa có thông tin project, model, loại tài khoản tính phí hoặc giới hạn request/token theo phút (RPM/TPM). Worker và dịch vụ Python mới chưa được xây. Có Docker CLI nhưng chưa kết nối được engine; máy có sẵn PostgreSQL 17.9 cài trực tiếp.

## Quyết định

1. **Dùng máy phát triển hiện tại.** Chỉ truy cập qua loopback, chưa chọn vùng cloud hoặc thuê host. Giữ React/Express/Prisma/PostgreSQL và thiết kế Node worker + Python theo ADR-001…007; không đổi production hoặc tạo staging cloud trong task này.
2. **Nhánh fake không gọi provider thật.** Ngân sách pilot/ngày/tháng/đánh giá và chi phí hạ tầng tăng thêm đều **0 USD**; cho phép **0** lần gọi thật, kể cả free tier. Dùng dữ liệu mẫu tổng hợp; chưa cài adapter hay nạp Gemini key vào nhánh này.
3. **Có PostgreSQL thử riêng.** Tạo cluster chứa `ai_lab_local`, user riêng, cổng `127.0.0.1:55432`, xác thực SCRAM và mật khẩu ngẫu nhiên. Công cụ hỗ trợ không đọc dotenv/nhận URL bên ngoài. Data ở thư mục tạm có tên theo hash repo để tránh lỗi đường dẫn tiếng Việt trên PostgreSQL Windows; thông tin kết nối ở `.tmp/ai-lab-local/`, bị Git bỏ qua.
4. **Xác nhận đúng database trước khi thao tác.** Kiểm host/port/database/user, thư mục data và mã nhận diện cluster. Giữ service PostgreSQL cổng 5432 hiện có. OPS-00 chưa cập nhật cấu trúc DB ứng dụng; BE-01 nhận URL thử được truyền rõ ràng. Nếu thư mục data mất thì xem là mất môi trường thử, không tự tạo lại cluster đã có mã nhận diện.
5. **Ghi ứng viên model để đánh giá sau.** Theo tài khoản người dùng, khảo sát Gemini với `gemini-3.5-flash-lite` và `gemini-3.8-flash`. Chưa chọn model R1. Giá/phép tính trong worksheet chỉ để tham khảo, không cấp quyền gọi. Chưa xác minh trần reasoning và hạn mức tài khoản thì chưa được cấp phép gọi.
6. **Chủ repo theo dõi local.** Một người giữ vai trò SO/SE, xem cảnh báo qua console/log. Dự kiến 20:00–21:00 thứ Ba/thứ Năm, `Asia/Ho_Chi_Minh`, hai giờ/tuần. Pilot cần chốt lại giờ/kênh hỗ trợ; chưa cam kết trực học viên 24/7.

## Phạm vi nghiệm thu

OPS-00 xong nhánh local/fake khi bảng ngân sách, kiểm tra offline và kiểm cơ bản database riêng đạt. Khi đó có thể tiếp tục BE-01/P1 bằng AI giả theo yêu cầu 0 USD.

Ví dụ, tạo/ghi dữ liệu tổng hợp rồi rollback trên DB riêng chứng minh môi trường DB dùng để thử được. Điều đó chưa chứng minh toàn bộ frontend, API, worker và Python đã chạy cùng nhau.

**G0 đầy đủ chưa nghiệm thu:** DISC-02 bị bỏ qua, staging ứng dụng riêng chưa chạy, hạn mức/khóa/provider thật chưa xác minh ở mốc này. Hoàn thành local chưa cho phép mở REL-01.

Bảng ngân sách ghi quyết định thiết kế, chưa tự chặn chi phí trong chương trình đang chạy. Đường `/explain` cũ chưa đổi trong task này; BE-06 vẫn phải xử lý đường gọi trực tiếp trước khi bật model thật qua luồng mới. Bộ khởi chạy ứng dụng với khóa, database và uploads riêng thuộc các task BE/PY/OPS sau.

## Điều kiện xem lại

Trước khi dùng Gemini thật qua R1, cần ngân sách dương cụ thể và hạn mức project/model; kiểm lại giá, vòng đời model, cách xử lý dữ liệu và trần reasoning/output. Cần hoàn thành adapter/đánh giá AI-02, BE-06 và trần ngân sách/công tắc tắt OPS-02. Trước pilot còn cần staging và kiểm backup/restore. Nơi chạy trả phí sẽ được chọn theo ngân sách mới; quyết định chạy local chưa chọn Render/Vercel cho phần AI.
