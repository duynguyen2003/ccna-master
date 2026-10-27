# BE-02 — Kiểm quyền và chụp trạng thái bài lab lúc hỏi

**Ngày:** 23/10/2026. **Trạng thái:** hoàn thành phần nền BE-02 trên môi trường thử local; API nhận và lưu câu hỏi thuộc BE-03.

BE-02 lo hai việc: **người này có được hỏi về bài lab này không** và **bài lab trông như thế nào tại lúc hỏi**. Attempt là một lần làm bài; snapshot là bản chụp dữ liệu của lần làm đó.

Ví dụ, bạn hỏi khi cổng R1 còn tắt rồi bật cổng trong lúc chờ. Bản chụp giúp câu trả lời vẫn gắn với trạng thái lúc hỏi. Một thành viên cùng nhóm cũng không mặc nhiên được đọc hội thoại riêng của bạn.

## Thay đổi

### Kiểm quyền ở cửa vào và lúc lưu dữ liệu

`src/agent/node/access.js` kiểm chữ ký HS256 và chỉ nhận token qua Bearer header. Hệ thống kiểm tài khoản/phiên đăng nhập hiện tại trước khi truy cập attempt, rồi kiểm lại trong transaction. Khóa dùng chung theo attempt và khóa đọc user giúp quyền ổn định trong lúc kiểm/ghi.

Các điều kiện gồm: còn là thành viên, lab đã công khai và chưa xóa, đúng chủ hội thoại, đúng epoch và chưa bị đánh dấu xóa. Server chọn chính sách qua `AI_ENVIRONMENT` (mặc định `local`). `eligibilityRules` phải có danh sách `userIds` và `labIds` được phép; thiếu chính sách hoặc nhóm được bật tính năng thì từ chối.

`ai/middleware.js` chạy trước auth chung tại `/:attemptId/ai`. Đưa token vào query không đăng nhập được namespace AI. Lỗi dùng khuôn contract và `Cache-Control: private, no-store`.

Middleware chỉ kiểm sớm. Lúc nhận câu hỏi, BE-03 vẫn phải gọi `withAiAccess` và chụp snapshot trong cùng callback transaction để tránh quyền đổi giữa kiểm và ghi. Không giữ transaction trong lúc gọi mạng/provider.

### Chỉ chụp phần dữ liệu được phép

`ai/snapshot.js` tạo bản sao chỉ dùng phía server, gồm các trường được cho phép về interface/VLAN/static route/link và tiến độ công khai. Không sao chép gradingSpec, expected/actual của bộ chấm, bản ghi user hoặc khóa/mật khẩu.

Đây là đầu vào nội bộ cho BE-05. Nó chưa thay cho toàn bộ việc lọc context/che dữ liệu nhạy cảm trước khi gửi provider, nhất là topology ngoài ba lab đã chứng nhận.

### Ghi rõ dữ liệu lấy lúc nào và từ đâu

Controller start lưu thông tin lab công khai, nguồn ghi nhận (`provenance`) và thời gian. Khi submit, lưu feedbackRevision/RecordedAt/safeFeedbackSnapshot/provenance cùng lần chấm trong một transaction. Lab sửa sau đó không làm thay thông tin đã lưu lúc bắt đầu.

Với attempt cũ, thông tin công khai lấy ở hiện tại phải ghi `CAPTURED_AT_AI_REQUEST`: được lấy lúc hỏi AI. Không có định nghĩa lab đã chốt cho attempt thì từ chối chụp trạng thái live. `LAB_REVIEW` chỉ dùng feedback đã lưu, không ghép revision/trạng thái live vào kết quả chấm cũ. Thiếu nguồn ghi nhận đầy đủ thì dùng `LEGACY_FEEDBACK`, revision để null.

## Bằng chứng thực chạy

Đã chạy `pnpm.cmd test:ai:storage`: tạo DB tạm trên PostgreSQL riêng cổng 55432, cập nhật cấu trúc rồi chạy Express ở cổng loopback do hệ điều hành cấp. Test gửi HTTP thật và dùng PostgreSQL thật với dữ liệu mẫu; `LAB_AI_MODE=deterministic` nên không gọi model thật. Số liệu dưới đây là kết quả nghiệm thu ngày 23/10.

- 34/34 kiểm storage trước đó tiếp tục đạt; dữ liệu 25 bảng cũ và client cũ vẫn tương thích.
- 7/7 test tích hợp (một test cha, sáu test con) trên AI-IPV4-01, AI-ROUTE-01, AI-VLAN-01: start 201, submit/explain 200; thông tin lab không bị đổi theo dữ liệu mới, feedback giữ revision lúc chấm. Đã kiểm chỉ nhận Bearer, người ngoài/tài khoản khóa/thành viên bị xóa, chủ hội thoại riêng và epoch.
- 6/6 test từng phần: token/chữ ký/phiên/nhóm được bật tính năng, sao chép dữ liệu lồng nhau, dấu thử phát hiện lộ trường ẩn, nguồn dữ liệu cũ và định nghĩa lab đã chốt.
- CLI 76 đạt/1 integration bỏ qua; lint, format, source boundaries và git diff whitespace đạt. CI đã thêm unit/lint và runner có integration BE-02; chưa chạy GitHub trong phiên này.

## Kết nối frontend/backend

Trong source, frontend `cliExplain` gọi POST `/lab-attempts/:id/explain` và backend có route tương ứng. `.env` cho frontend gọi cổng 5500, khớp `BACKEND_PORT=5500`. Kiểm HTTP đã chứng minh route hoạt động sau khi cập nhật cấu trúc DB thử, dùng câu trả lời xác định từ logic dự phòng.

Chưa kiểm toàn luồng trên trình duyệt với phiên đăng nhập thật. Task này không khởi động dev server thường trực 3000/5500; server test được đóng sau kiểm. Ở mốc BE-02, API nhận câu hỏi/tin nhắn và giao diện hội thoại chưa nối; chúng thuộc BE-03/FE-02. Có lớp kiểm quyền chưa có nghĩa là namespace AI đã có endpoint xử lý câu hỏi hoặc đã gọi model.

Không cập nhật cấu trúc hoặc đổi URL của DB ứng dụng/production trong task này. Client mới và controller start/submit cần DB đã có migration BE-01. Công cụ chạy test xóa đúng DB tạm nó tạo, giữ cluster/data riêng cho lần kiểm sau.

**Bước tiếp theo tại mốc nghiệm thu:** BE-03 nhận câu hỏi, chống gửi trùng và giữ hạn mức. Dùng `withAiAccess` + `captureSnapshot` trong transaction lưu câu hỏi, kiểm đầu vào theo contract trước khi gọi helper. Phần này sau đó đã có [báo cáo BE-03](BE-03-admission.md).
