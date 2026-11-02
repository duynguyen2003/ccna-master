# Điều kiện mở bài, chương và khóa học

Cập nhật 28/10/2026 theo lỗi chuyển bài trong danh sách Nội dung chương khi chưa
đủ điều kiện. Trước đây nút Tiếp theo kiểm70%, nhưng sidebar/URL không kiểm;
API module/lesson cũng trả toàn bộ nội dung, bỏ qua khóa chương/khóa học.

| Cấp                      | Điều kiện                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Bài kế tiếp trong chương | Chuỗi bài trước đều đạt điều kiện: video có tiến độ đã lưu ít nhất70%, bài đọc hoàn thành.           |
| Chương tiếp theo         | Chương trước hoàn thành toàn bộ bài học và lab bắt buộc theo lộ trình hiện có.                       |
| Khóa học tiếp theo       | Khóa học trước hoàn thành100% bằng chứng bài/lab;70% video chỉ mở bài kế, không hoàn thành khóa học. |

Bài đã hoàn thành có thể xem lại trong chương/khóa học đang có quyền. Một bài
đã hoàn thành về sau không tự lấp khoảng trống của những bài trước. Khi trùng
orderIndex, bài sắp theo ID số giống API PostgreSQL.

Lab có [điều kiện mở riêng](lab-access-policies.md) để thực hành xen kẽ. Lab tùy
chọn không nằm trong tiêu chí hoàn thành chương/khóa; lab tổng hợp chỉ chờ phần
lý thuyết, không chờ chính kết quả lab.

## Thực thi

- Domain `learningPath.js` tính `hasVideo`, `canAccess`, `lockedReason` từng bài.
  `learningPathService` dùng cùng kết quả khi đọc nội dung, ghi tiến độ và ghi
  telemetry video. Catalog chỉ trả metadata, không chứa URL/nội dung video.
- API nội dung trả metadata của bài bị khóa với `videoUrl/contentHtml=null`.
  Truy cập module hoặc khóa học chưa đủ điều kiện trả403. Các response cho người
  học có Cache-Control private/no-store.
- API frontend của người học dùng `view=learning`, kể cả ADMIN. API quản trị
  vẫn cho ADMIN đọc/sửa nội dung đầy đủ; user thường không thể đổi view để bỏ
  quyền. Ngoại lệ `admin-test` của AI chỉ nằm ở lab.
- Sidebar hiển thị khóa, giữ focus bàn phím và có mô tả điều kiện. Click/Enter,
  Trước/Tiếp theo, link danh sách khóa học và URL trực tiếp đều kiểm quyền.
  Link bị khóa trong CourseDetail không có href.
- Tiến độ cục bộ đang phát không mở bài. Sau ACK của server ở ngưỡng70% hoặc
  hoàn thành, tải lại quyền/nội dung. Trong lúc chờ hoặc khi lỗi, bài vẫn khóa;
  có Thử lại cho lỗi cập nhật quyền. Không làm tròn69,99% lên70%.
- Khi URL chuyển sang chương khác, đọc quyền mới từ API, tránh trạng thái khóa
  cũ sau khi vừa hoàn thành chương. Response cũ sau đổi tài khoản/khóa học không
  được ghi đè giao diện mới.

## Kiểm chứng

- Frontend:37suite/292test đạt; gồm sidebar, URL, pending save/permission,
  retry,69,99/70%, nội dung bài mới mở, link CourseDetail và chương vừa được mở.
- Learning:18unit đạt,1integration opt-in skip trong lệnh unit. Runner riêng
  chạy đủ25HTTP/PostgreSQL test/subtest đạt trên DB tạm của cluster55432, gồm
  editor ADMIN và learner view, nội dung bị ẩn, tiến độ/telemetry bị chặn và
  các bài đọc chưa hoàn thành. Database tạm đã xóa.
- 229 test AI offline đạt; lint, Prettier, production build và boundaries đạt.
- Browser production fixture1536px:đã xem hai theme, biểu tượng khóa và mô tả,
  Enter tại bài khóa không chuyển bài; pending save vẫn khóa, ACK mở đúng bài
  kế; URL bài/khóa học bị khóa bị từ chối; CourseDetail không có href cho bài khóa.
  Vùng bấm danh sách cao62,35px, document không tràn ngang. Các test component
  có kiểm drawer ở breakpoint nhỏ; lần này chưa kiểm browser mobile hoặc touch/
  screen reader thật. Các thử viewport CDP không được runtime hỗ trợ nên không
  tính là đã kiểm mobile.
- Smoke chỉ đọc trên app:ADMIN id1 và id10 đều bị403 khi đọc khóa học chưa đủ
  điều kiện, mỗi tài khoản có2bài bị khóa không chứa nội dung/video. ADMIN id1
  vẫn đọc capabilities của trợ lý lab với200. Không sửa tiến độ, role, mật khẩu,
  schema hoặc policy AI trên DB thật.

Evidence trong `.tmp/lesson-gates-20261028/`:integration/frontend/build logs,
live-readonly.json, browser-checks.json và ảnh. Backend5500 đã restart để nhận
logic mới; frontend3001 và worker AI giữ chạy. Server fixture4175 và cluster
test55432 đã dừng; tab fixture đã đăng xuất/đóng. Không commit/push/deploy.
