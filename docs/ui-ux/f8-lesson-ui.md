# Giao diện xem bài học tham khảo F8

Cập nhật ngày **27/10/2026**. Nguồn tham khảo: [màn học HTML/CSS của F8](https://f8.edu.vn/learning/html-css) và [trang giới thiệu khóa học](https://f8.edu.vn/courses/html-css).

## Đã phân tích những gì?

Có hai nguồn đối chiếu riêng:

- **REA:** capture trang bằng Chrome độc lập, không dùng tài khoản. Lần này F8 hiện hộp đăng nhập, nên capture đó không chứng minh bố cục màn học bên trong. REA cũng đọc lại bộ bằng chứng phân tích mã client công khai đã lưu ngày 26/10; đây là nguồn tĩnh của phiên bản đó.
- **Trình duyệt đang có phiên đăng nhập:** quan sát trực tiếp video đang dừng, mở/đóng danh sách bài và đo DOM/computed style. Không phát video, ghi chú hoặc đánh dấu hoàn thành bài trên F8 để kiểm thử.

Không suy ra thiết kế database, API nội bộ hay chính sách hoàn thành hiện tại từ hình thức giao diện.

## Những điểm hữu ích từ F8

| Thành phần    | Quan sát                                                                                        | Áp dụng cho NetMaster                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Video         | Vùng nền đen rộng, player giữ tỉ lệ 16:9, có khoảng đen hai bên nếu chiều cao màn hình giới hạn | Bỏ thẻ trắng và padding lớn bao quanh video; giới hạn kích thước theo màn hình để còn nhìn thấy điều hướng |
| Danh sách bài | Nằm bên phải, có tên chương, bài đang học, thời lượng và trạng thái; có thể thu gọn             | Panel nội dung chương rộng 320px trên desktop; bài hiện tại có nền/viền nhận diện và aria-current          |
| Chuyển bài    | Thanh dưới giữ hai nút ở vị trí ổn định trong khi phần nội dung cuộn                            | Đưa Trước/Tiếp theo xuống dưới; hiển thị Bài n/tổng và lý do chưa mở bài tiếp                              |
| Ghi chú       | Có nút mở riêng trên thanh đầu và mốc thời gian của video                                       | Ghi chú mặc định đóng; mở ngăn kéo khi cần, giữ tự lưu và nút chèn/nhảy mốc thời gian đã có                |
| Nội dung      | Tiêu đề và mô tả nằm dưới player, tách khỏi vùng video tối                                      | Giữ tiêu đề, tiến độ, ghi chú giảng viên trong phần nội dung nền sáng/tối của NetMaster                    |

Số đo tại phiên tham khảo, viewport 1536px: panel bài khoảng 352px; player khoảng 969×545px; thanh điều hướng cao 50px. Đây là số đo ở một trạng thái/viewport, không phải kích thước cố định cần chép nguyên sang web mình.

Giữ thương hiệu NetMaster, màu **#386298**, font đang dùng và sidebar của nền tảng. Dùng lại player và API hiện có; không thêm thư viện video, không chép tài nguyên/logo F8.

## Sửa hai lỗi màu

- Icon Tra cứu Port bị gắn nền primary. Trả về nền navy-50 **#e7e9ef**, nét navy-700 **#152845**, cùng cách đã sửa icon Cisco CLI.
- Nút Tiếp theo bị khóa từng dùng chữ trắng trên nền muted rất nhạt; nút Trước còn giảm opacity toàn bộ. Nút mới dùng cặp màu chữ/nền rõ ràng, opacity 1, viền và con trỏ thể hiện trạng thái khóa. Nút được mở vẫn có màu chủ đạo/hover/focus riêng.

**Giữ nguyên điều kiện chuyển bài:** bài đầu không có bài trước; bài cuối không có bài tiếp. Bài video vẫn cần tiến độ ít nhất 70% hoặc trạng thái hoàn thành hợp lệ. Bài đọc vẫn chờ xác nhận lưu hoàn thành từ server. Màu rõ hơn không làm bài đang khóa trở thành truy cập được.

## Chức năng được giữ

- Video/bookmark/khôi phục vị trí xem và ghi tiến độ theo cơ chế hiện có.
- Ghi chú cá nhân, tự lưu, thử lại khi lỗi, giới hạn ký tự và mốc thời gian.
- Ghi chú giảng viên và bài chỉ có nội dung đọc.
- Native Dialog dùng chung để ngăn kéo hỗ trợ Escape, giữ focus và trả focus về nút mở. Trên màn hình nhỏ, danh sách bài cũng dùng Dialog; video không bị ép vào cột hẹp.
- Chuyển động nhẹ cho ngăn kéo/nút, có prefers-reduced-motion; các animation Home/sidebar/xóa không bị sửa.

Theo điều chỉnh tiếp theo của người dùng: tên bài trong panel dùng **13px**, tiêu đề chương/panel **14px**, metadata **12px**. Nút nội dung chương nằm ngay bên phải Ghi chú, thứ tự Tab khớp vị trí hiển thị. Panel desktop giữ DOM và co chiều ngang 400ms khi mở/350ms khi đóng, kèm trượt nhẹ/fade; khi đóng có inert/aria-hidden để không nhận focus. Drawer có exit 150ms trước khi unmount, timer dự phòng và bỏ thời gian chờ khi giảm chuyển động. Hành vi exit là tùy chọn trong Dialog dùng chung; các hộp thoại khác không bị buộc chờ animation.

## Bằng chứng và kiểm chứng

Mã thay đổi nằm ở Lesson.js/Lesson.css/Lesson.test.jsx và PortLookup.css. Dữ liệu bằng chứng lưu tại `.tmp/ui-lesson-f8-20261027/`: REA Evidence, ảnh/số đo F8, baseline, log kiểm và bản dựng với API tổng hợp. Các file `.tmp` không phải dependency của ứng dụng.

Kiểm kỹ thuật/UI sử dụng dữ liệu tổng hợp, không thay cho nghiệm thu lưu tiến độ với database thật hoặc thử nhiều nhà cung cấp video. Kết quả cuối được ghi trong student-ui-audit.md và todo.md.
