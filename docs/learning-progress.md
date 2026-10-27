# Lưu tiến độ học tập

Cập nhật 26/10/2026. Phạm vi lần này là giảm việc đọc/ghi khi lưu video, giữ API và điều kiện hoàn thành hiện có. Không thay đổi schema hoặc yêu cầu migrate database.

## Các luồng riêng

- `GET /api/users/progress/video/:lessonId`: tải bookmark của người dùng hiện tại trước khi mở player.
- `POST /api/users/progress/video`: lưu vị trí và thời gian phiên xem. Snapshot dùng `sessionId`, `sequence`, tổng giây của phiên và thời điểm chụp. Đây là telemetry để xem tiếp và thống kê, không phải thao tác hoàn thành bài.
- `POST /api/users/progress`: luồng tiến độ/hoàn thành bài hiện có. Frontend video vẫn xét vị trí đạt 90% để gửi hoàn thành. Backend kiểm tra quyền khóa/chương; CLI Lab vẫn chỉ hoàn thành qua chấm server.

Ngưỡng theo vị trí ở frontend không chứng minh người xem đã theo dõi đủ nội dung. Lần tối ưu này không bổ sung unique coverage, chống giả mạo thời gian hay thay chính sách hoàn thành bằng cách đánh dấu ngay khi video bắt đầu. Dữ liệu đã quan sát ở F8 không được coi là bằng chứng cho thiết kế database hoặc ngưỡng hoàn thành của NetMastery.

## Nhịp lưu ở frontend

Player vẫn lấy mẫu mỗi giây để cập nhật giao diện. Snapshot định kỳ chỉ gửi khi có thay đổi, sau khoảng **30–35 giây**, có jitter mỗi đợt và khi tiếp tục phát/quay lại tab. Snapshot rỗng tại vị trí 0 và chưa có thời gian xem không tạo request.

Pause, kết thúc, chuyển bài hoặc unmount vẫn flush ngay. Khi tab chuyển hidden/pagehide, gửi một request keepalive thay cho cặp request thường + keepalive ở cùng một lần xử lý. Các sự kiện vòng đời khác nhau vẫn có thể gửi lại cùng sequence; backend bỏ qua bản trùng. Thời gian ở tab hidden không được cộng vào thời gian học.

Request thông thường chạy lần lượt, giữ snapshot đang chờ. Retry dùng lại định danh của batch hoặc snapshot mới hơn có tổng giây tích lũy; backoff tăng dần từ khoảng 2,5 giây tới khoảng 30 giây, có jitter. Không ACK trước khi server phản hồi thành công.

Bookmark được tải trước khi gắn player. Trong lúc seek đến vị trí resume chưa xong, không ghi đè vị trí đã lưu bằng vị trí 0. Video native lấy playback rate thực tế để xử lý giới hạn tua phù hợp.

Keepalive là best effort: trình duyệt/process bị tắt đột ngột hoặc mất mạng vẫn có thể làm mất phần vị trí chưa được server xác nhận, thông thường tối đa một chu kỳ lưu khi đang online. Khoảng 30–35 giây là lựa chọn đánh đổi giữa số request và độ mới của bookmark, không phải cam kết không mất dữ liệu.

## Đường xử lý heartbeat ở backend

Transaction tiếp tục dùng advisory lock theo user, cùng cơ chế khóa với việc cập nhật tiến độ và chấm lab. Kiểm tra tài khoản hoạt động và quyền học từ dữ liệu hiện tại trước khi ghi.

`readVideoAccess` chỉ đọc cấu trúc cần cho quyền truy cập: course/module, ID các bài/lab và tiến độ task trong phần chương trình cần xét tới khóa đích. Không tải nội dung bài, exams, số câu hỏi, topics, badges hay metadata lộ trình đầy đủ. Các khóa có order lớn hơn khóa đích bị loại; các khóa đồng hạng vẫn được xét theo quy tắc thứ tự của domain.

Quyền vẫn sử dụng cùng `buildLearningPath` với lộ trình chính. Không tin row tổng kết course/module, vì nội dung có thể thay đổi sau khi row đó được ghi. Việc đọc cấu trúc trước khóa đích vẫn tăng theo kích thước chương trình; đây chưa phải cơ chế quyền O(1) hay cache quyền.

Trong transaction:

1. Bỏ qua sequence cũ hoặc đã ghi nhận trong cùng phiên.
2. Tính phần giây tăng từ tổng giây phiên; giữ giới hạn thời gian được ghi nhận hiện có.
3. Cập nhật phiên và bookmark, chỉ dùng vị trí có timestamp mới hơn. Timestamp client chạy trước được chặn ở thời gian server.
4. Upsert study log theo ngày Việt Nam với phần giây tăng, nếu dương.

Không aggregate toàn bộ lịch sử hoặc cập nhật `User.totalStudyTime` trong heartbeat. Lỗi ghi study log rollback cùng phiên và bookmark, nên retry không tạo trạng thái dở dang.

## Tổng thời gian học

`StudyLog.duration` theo giây là nguồn thống kê. Profile và chi tiết người dùng cho admin tính:

```text
totalStudyTime = floor(sum(duration của tất cả ngày) / 60)
```

Giữ đơn vị phút và tên field của response, gồm cả `data.totalStudyTime` và `data.stats.totalStudyTime` trong profile. Tổng này không bị giới hạn bởi cửa sổ bảy ngày của biểu đồ. Hai ngày có 35 giây mỗi ngày cho tổng một phút; chỉ làm tròn sau khi cộng.

Column `User.totalStudyTime` cũ được giữ để tương thích schema, nhưng không còn được duy trì bởi heartbeat hoặc dùng làm nguồn cho các báo cáo trên. SQL/report bên ngoài đang đọc trực tiếp column này cần chuyển sang tổng `StudyLog`; không dùng giá trị cache cũ để đối chiếu số mới.

## Kiểm chứng

- Component tests: tải bookmark, lỗi/retry, resume đang chờ, thời gian thật ở tốc độ 2x, đáp ứng về trễ khi chuyển bài, cadence/jitter, flush ngắn, hidden, unmount và retry đúng định danh.
- PostgreSQL/HTTP: quyền telemetry khớp roadmap, summary giả không mở khóa, quyền xuất bản được kiểm tra lại, retry đồng thời không cộng lặp, lỗi study log rollback, tổng giây xuyên ngày và cache cũ không làm sai profile/admin. Các test completion/reward/unlock hiện có tiếp tục chạy.
- Chỉ chạy integration với database test riêng, không có fallback vào database ứng dụng.

Với 1.000 người xem liên tục, riêng heartbeat định kỳ 30–35 giây tương ứng khoảng **29–33 request/giây**, so với khoảng 100 ở chu kỳ 10 giây. Số này chưa bao gồm request tiến độ bài, tải ban đầu, flush và retry; không phải kết quả load test. Cần đo p95, pool, CPU và burst trên môi trường triển khai trước khi cam kết năng lực phục vụ.
