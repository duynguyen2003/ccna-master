# Font chữ và thanh học tiếp tham khảo F8

Cập nhật ngày **27/10/2026**. Tham khảo [lộ trình Front-end của F8](https://f8.edu.vn/roadmap/front-end-development) và ảnh thanh tiến độ người dùng gửi.

## 1. F8 dùng font gì?

**Be Vietnam Pro** là font của phần nội dung lộ trình đã quan sát: tiêu đề, tên khóa học, mô tả và nút. Chữ thường dùng weight 400, tên khóa học/nút dùng 700, tiêu đề nổi bật dùng 900. Cỡ chữ có thể thay đổi theo màn hình và mức zoom, nên không chép các số lẻ từ trình duyệt sang thiết kế của mình.

Đã kiểm bằng hai nguồn:

- Computed style của các phần tử đang hiển thị trên trang F8.
- REA mở trang trong Chrome độc lập và ghi nhận request stylesheet Google Fonts chứa `Be+Vietnam+Pro`, cùng các request font `fonts.gstatic.com/s/bevietnampro/`. Không dùng cookie/tài khoản để thực hiện lần capture này.

Trang còn tải Source Serif 4, nhưng các phần tử lộ trình đã kiểm dùng Be Vietnam Pro. Vì vậy web mình chỉ thêm Be Vietnam Pro. Logo là ảnh thương hiệu, không đổi hình dạng khi đổi font.

Đã áp dụng cho giao diện học viên, cả các hộp thoại; admin giữ font hiện có. Chữ lệnh, terminal và code tiếp tục dùng monospace. Tải các weight thường 400–900 qua một stylesheet có `display=swap` và preconnect; font hệ thống hiển thị khi chưa tải được font. Đây là tài nguyên mới có sử dụng thực tế, khác với các request font không được dùng đã bỏ trong đợt audit trước. Dung lượng font không nằm trong số đo JS/CSS bundle.

## 2. Thanh tiến độ trong ảnh có ý nghĩa gì?

Đây là một lối tắt để quay lại học, gồm:

- **96%:** tiến độ của khóa học đang được giới thiệu, không mặc nhiên là 96% cả lộ trình.
- **Tên khóa học và Bài tiếp:** cho biết sẽ học nội dung nào khi bấm nút.
- **0/5 khóa học:** số khóa đã hoàn thành trong lộ trình.
- **Chuỗi 1 ngày:** thông tin chuỗi ngày học.
- **Tiếp tục học:** mở bài phù hợp thay vì bắt người học tìm lại trong danh sách.

Lần mở trang F8 hiện tại chưa hiển thị thanh trong ảnh. Phân tích bố cục trên dựa vào ảnh người dùng gửi; không khẳng định đã kiểm lại hành vi của chính thanh đó bằng tài khoản F8.

## 3. Tiến độ F8 được lưu thế nào?

Bản phân tích các bundle công khai đã lưu ngày 26/10 cho thấy client gửi yêu cầu lưu bước học, cập nhật trạng thái hoàn thành sau phản hồi được chấp nhận, và tính phần trăm từ số bước hoàn thành/số bước do server cấp. Sự kiện phân tích lượt xem được tách với việc lưu tiến độ. Trong bản đó có thao tác lưu sau khi video bắt đầu có vị trí phát và khi video kết thúc.

Đây là **kết quả đọc mã client của phiên bản đã lưu**, chưa chạy thử ghi tiến độ F8. Nó không chứng minh quy tắc chấm hoàn thành, chống tua, cách tính streak, thiết kế database hoặc tần suất ghi database của F8 hiện tại. Chu kỳ player đọc thời gian video cũng không đồng nghĩa với chu kỳ gửi request lưu. Không sao chép quy tắc này sang hệ thống của mình chỉ vì thanh UI đẹp.

## 4. Web mình đã áp dụng thế nào?

Trên Home, thanh học tiếp nằm sau banner mở đầu đã được khôi phục. Chỉ /roadmap (mục Khóa học) còn đặt thanh dưới header; các trang Công cụ/Lab/Hồ sơ/Tài liệu/chi tiết khóa/bài/thi không hiển thị thanh. Dùng màu chủ đạo mới #386298 theo yêu cầu người dùng, nền/viền theo theme, tên khóa học rõ và một nút chính. Thanh rộng bằng banner (tối đa 1360px, cùng gutter/breakpoint), căn giữa và gọn chiều cao: khoảng 65px trên desktop, nút vẫn cao tối thiểu 44px. Điện thoại xếp nội dung thành các hàng để tên dài không làm tràn trang. Thẻ có hover/focus nâng 2px và bóng; chuyển động được tắt khi chọn giảm chuyển động. Ẩn thanh khi chưa đăng nhập, mở màn tài khoản, học bài, làm thi hoặc xem kết quả/chữa bài.

| Nội dung           | Dữ liệu sử dụng                                                           |
| ------------------ | ------------------------------------------------------------------------- |
| Khóa đang học      | `currentCourseId`, `canAccess`, `completed` từ learning path              |
| Phần trăm khóa học | `course.progressPercent` do backend tính                                  |
| Bài tiếp           | `course.nextLessonId` và tên bài tương ứng trong module có quyền truy cập |
| Số khóa hoàn thành | Đếm các khóa có `completed: true` trong catalog được trả về               |
| Chuỗi ngày         | `stats.streakDays` do backend trả về; không hiển thị badge nếu bằng 0     |
| Link học tiếp      | `/lesson?course=<id>&lesson=<id>`                                         |

Backend hiện có tính tiến độ từ bài học **và lab**, kể cả phần tiến độ đang dở; không lấy ảnh F8 làm dữ liệu mẫu. `nextLessonId` là bài tiếp theo trong lộ trình, không phải lịch sử “vừa mở bài nào gần nhất”. Vị trí xem trong video vẫn do cơ chế bookmark hiện có xử lý.

Tài khoản mới chưa có hoạt động học sẽ không thấy thanh này. Điều kiện dựa vào `isStarted`, `completed` hoặc `progressPercent > 0` trên các khóa do backend trả về; `currentCourseId` chỉ là khóa được đề xuất, không chứng minh đã học. Người đã bắt đầu nhưng phần trăm làm tròn về 0% vẫn thấy thanh. Lần tải đầu chưa có dữ liệu cũng không dựng thanh 0% tạm.

Nếu không có bài tiếp hợp lệ, bài đã hoàn tất nhưng còn lab, hoặc module chưa được mở, nút dẫn về chi tiết khóa học để chọn nội dung phù hợp. Không tự đoán ID bài. Hoàn thành tất cả thì hiển thị lời mời ôn tập; đã học khóa trước và chưa bắt đầu khóa kế tiếp thì dùng “Bắt đầu học”. Lỗi API có nút thử lại, không thay bằng tiến độ 0 giả.

Component dùng lại `useLearningPath` và query cache theo user của Roadmap. Khi thao tác lưu bài thành công cập nhật learning path, thanh sẽ nhận cùng dữ liệu đó. Không tạo bộ tính tiến độ hay bộ đếm streak thứ hai ở frontend. Card học tiếp lớn cũ trên Home đã được bỏ để tránh hai nơi hiển thị khác nhau.

Mã chính: [LearningResumeBanner.jsx](../../src/frontend/src/components/learning/LearningResumeBanner.jsx), [useLearningPath.js](../../src/frontend/src/features/courses/hooks/useLearningPath.js), [learningPath.js](../../src/backend/src/domain/learningPath.js).

## 5. Kiểm chứng và phạm vi

- Test tích hợp component với query cache thật: chọn đúng khóa/bài, cập nhật sau lưu, khóa quyền, còn lab, mới học, hoàn thành, tải/lỗi/thử lại, đổi tài khoản và ẩn ở màn tập trung.
- Test frontend và production build; browser với API tổng hợp để kiểm giao diện, điều hướng và theme. Không dùng database hoặc tài khoản học viên thật để kiểm thử.
- Giữ typewriter banner, sidebar gooey và nền tìm kiếm trung tính. Mũi tên “Khám phá” chỉ lùi 1px, không co ngang; vẫn tôn trọng giảm chuyển động.

Bằng chứng local: `.tmp/ui-f8-20261027/rea-evidence.json`, ảnh/biên bản kiểm UI và log build/test cùng thư mục. Bản phân tích tĩnh F8 trước đó: `.tmp/f8-progress-20261026/findings.json` và `provenance.json`. Các file `.tmp` là dữ liệu đối chiếu tại máy, không phải dependency của ứng dụng.
