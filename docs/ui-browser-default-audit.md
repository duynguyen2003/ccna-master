# Rà giao diện còn dùng mặc định trình duyệt

## Đã xử lý sau rà soát

- Bổ sung `UiControls.css`: 5 nút lỗi trên route đang dùng và nút dự phòng TopologyEditor; checkbox Users 18px với accent xanh; nút chọn file, mũi tên select, chevron FAQ/details, scrollbar trang/auth và focus bàn phím.
- Thêm `Markdown.css`, nhập trực tiếp từ MarkdownRenderer để bài học và preview quản trị cùng nhận kiểu bảng, trích dẫn, đường kẻ, danh sách, ảnh và liên kết. Giữ nguyên sanitizer.
- Thay toàn bộ 26 lời gọi alert/confirm/prompt trong 7 file quản trị bằng appDialog. Dialog dùng phần tử dialog với CSS riêng, xếp hàng, mặc định focus Hủy, Tab vòng trong hộp thoại, Escape hủy và trả focus về nơi mở. Các nhánh confirmed=true vẫn bỏ qua xác nhận lần hai. Chèn link lưu/khôi phục vùng chọn trước/sau hộp nhập.
- Thay 7 điểm chọn tệp của trang quản trị bằng FileUploadField dùng chung: tải tài liệu, thumbnail khóa học, thumbnail/topology/file Packet Tracer của Lab, ảnh câu hỏi và import CSV. Có kéo-thả, kiểm tra định dạng, xem tên/dung lượng, xem trước ảnh, bỏ lựa chọn và trạng thái tải ảnh câu hỏi.
- Mẫu upload ban đầu dùng Tailwind và Motion nên được chuyển sang CSS/React sẵn có. Không tạo tiến độ giả; chỉ hiện tiến độ không xác định lúc callback upload ảnh câu hỏi thật đang chạy.
- Chủ động giữ menu chọn của hệ điều hành trên select, hình checkbox/radio đã có accent, spinner số và nắm kéo textarea. Đây là khả năng tương tác native hữu ích, không phải thiếu CSS. Không đổi font hoặc thay hộp chọn file của hệ điều hành.

Kiểm chứng giao diện mặc định: 10 test thuộc 3 suite dialog/TakeExam/Markdown đã vượt qua; lint có 9 cảnh báo cũ. Nút lỗi thật trên Playwright 1366px/390px căn đúng. Dialog qua kiểm tra focus desktop/320px. Skin Markdown/control đã kiểm tra bằng stylesheet thực tế.

Kiểm chứng upload: ESLint không lỗi, còn 6 cảnh báo có sẵn ở trang quản trị; build production thành công. `rg` chỉ còn input file nằm trong FileUploadField. Chưa thử gửi file lên API hoặc lưu dữ liệu bằng tài khoản admin.

## Rà soát admin và trạng thái tải — 2026-10-18

- Quét JSX các control native trong toàn bộ `src/frontend/src/features/admin`, rồi đối chiếu selector cha trước khi đánh dấu thiếu CSS. Nút toolbar của bài học, thao tác kỳ thi, ô tìm kiếm, radio và liên kết chi tiết Lab đã có skin qua vùng bao; chúng không phải control mặc định dù thiếu `className` trực tiếp.
- Bổ sung phản hồi chuyển màu/nhấn và focus ring bàn phím dùng chung trong `.admin-layout`. `details` trong phần phản hồi CLI thay marker mặc định bằng chevron; TopologyEditor tương thích có skin riêng cho nút, select và lỗi.
- Đồng bộ EKG HeartbeatLoader dạng gọn cho trạng thái tải danh sách Khóa học, Lab, Tài liệu, Công cụ, Người dùng và Đề thi. Auth guard quản trị dùng nền/trace chung với user. Spinner nhỏ cho thao tác lưu/tải vẫn giữ nguyên vai trò.
- Dashboard tải từng API độc lập nên giữ skeleton theo vùng để tránh làm mất bố cục; shimmer tắt khi bật `prefers-reduced-motion`. Lớp vỏ admin cũng rút ngắn/tắt chuyển động CSS theo tùy chọn này; GSAP hiện có nhánh giảm chuyển động riêng.
- Select vẫn giữ menu native để giữ hành vi bàn phím và thiết bị; chỉ tùy biến vỏ ngoài. Kiểm tra ESLint toàn Admin: 0 lỗi, 21 cảnh báo cũ. Production build thành công; CSS build xác nhận loader gọn, reduced-motion và chevron. Build vẫn báo kích thước bundle vượt ngưỡng khuyến nghị.

Phần dưới giữ nguyên bằng chứng **trước khi sửa**, không mô tả trạng thái hiện tại.

Ngày kiểm tra: 2026-10-18. Bỏ qua font chữ theo yêu cầu. Tác vụ chỉ rà soát, không sửa mã ứng dụng hoặc CSS.

## Kết quả chính: những chỗ chưa có skin riêng

| Ưu tiên | Vị trí | Bằng chứng | Hướng xử lý khi sửa UI |
| --- | --- | --- | --- |
| Cao | [TakeExam.js:238](../src/frontend/src/features/exams/pages/TakeExam.js#L238): nút “Thử lại / Bắt đầu lượt mới” khi lỗi hoặc hết phiên | Không có class/style; không có selector cha tạo skin cho nút. CSS thực tế còn appearance:auto, nền xám, border outset, padding 0, cursor default. Cả khối lỗi chỉ là thông báo và nút trong take-exam-page. | Dùng biến thể nút và khung trạng thái lỗi chung, giữ nguyên hành vi thử lại. |
| Cao | [CourseDetail.js:75](../src/frontend/src/features/courses/pages/CourseDetail.js#L75): “Xem lộ trình / Quay lại” khi không tìm thấy khóa | btn-xem-lo-trinh và btn-quay-lai không có định nghĩa CSS. Đã kiểm tra trực tiếp route khóa không tồn tại: hai nút vẫn xám/viền mặc định, chỉ nhận reset chung. CSS đang có tên khác là btn-map-2 và btn-back-2 tại [Lesson.css:1368](../src/frontend/src/features/lessons/styles/Lesson.css#L1368). | Đồng bộ class hoặc dùng component nút chung cho trạng thái lỗi. |
| Cao | [Roadmap.js:438](../src/frontend/src/features/courses/pages/Roadmap.js#L438): “Thử lại ngay / Về trang chủ” khi API lỗi | Cũng dùng hai class không có CSS nói trên. Đối chiếu nguồn và dựng mẫu với stylesheet hiện tại cho kết quả nút mặc định. | Sửa cùng nhóm nút lỗi khóa học để không còn lệch tên class. |
| Vừa | [Users.js:411](../src/frontend/src/features/admin/pages/Users.js#L411) và [Users.js:437](../src/frontend/src/features/admin/pages/Users.js#L437): checkbox chọn tất cả/chọn từng người dùng | CSS chỉ căn ô th/td chứa checkbox, chưa có skin cho chính input. Mẫu CSS thực tế: appearance:auto, accent-color:auto, cursor default; không có rule riêng ngoài reset. Hai vị trí JSX, số checkbox hàng phụ thuộc dữ liệu. | Quy định tối thiểu kích thước, màu accent, vùng bấm và focus thống nhất; không nhất thiết phải thay control native. |
| Vừa | Nội dung Markdown qua [MarkdownRenderer.js:80](../src/frontend/src/components/common/MarkdownRenderer.js#L80), hiển thị trong [Lesson.js:964](../src/frontend/src/features/lessons/pages/Lesson.js#L964) | Bộ render hỗ trợ table, blockquote thường, hr, ul/ol nhưng skin chưa đầy đủ. Mẫu trong đúng wrapper bài học: table/th/td không border/padding/nền, border-collapse:separate và border-spacing mặc định; blockquote thường không viền/thụt lề; hr còn border inset; ul/ol chưa có padding thụt đầu dòng do reset toàn cục về 0. | Bổ sung skin nội dung Markdown chung cho bảng, trích dẫn thường, đường kẻ, danh sách và áp dụng nhất quán với preview admin. Không động vào sanitizer. |

Tổng nhóm nút đang được route sử dụng: **5 vị trí JSX** chưa có skin riêng, gồm 1 nút TakeExam, 2 nút CourseDetail và 2 nút Roadmap. Không tính font hoặc reset toàn cục là skin nút.

## Đã có CSS nhưng vẫn dùng một phần giao diện native

| Thành phần | Vị trí đại diện | Phần còn do trình duyệt vẽ |
| --- | --- | --- |
| Hộp thông báo/xác nhận/nhập liệu hệ thống | [Users.js:170](../src/frontend/src/features/admin/pages/Users.js#L170), [Users.js:210](../src/frontend/src/features/admin/pages/Users.js#L210), [Labs.js:205](../src/frontend/src/features/admin/pages/Labs.js#L205), [Tools.js:57](../src/frontend/src/features/admin/pages/Tools.js#L57), [CourseDetail.js:532](../src/frontend/src/features/admin/pages/CourseDetail.js#L532) | Rà AST thấy **26 lời gọi**: 13 alert, 12 confirm, 1 prompt trong 7 file quản trị. Đây là dialog trình duyệt, CSS của trang không tạo skin cho chúng. Một số confirm xóa chỉ là nhánh dự phòng: giao diện DeleteButton đã tự xác nhận và gọi handler với confirmed=true, nên không phải cả 26 lời gọi đều hiện trong luồng thường. |
| Nút chọn file trong quản trị tài liệu | [Resources.js:268](../src/frontend/src/features/admin/pages/Resources.js#L268) | Input ngoài đã có admin-search-input, nhưng nút bên trong ::file-selector-button chưa có CSS. Đo được appearance:auto, nền xám và border outset. Hộp chọn file của hệ điều hành cũng là giao diện hệ thống. |
| Dropdown | [DropdownSelect.js](../src/frontend/src/components/ui/DropdownSelect.js), các vị trí trong tools/admin/CLI | Đã thay 20 select gốc bằng combobox/listbox dùng chung có menu cuộn, animation, bàn phím và theme. Không còn popup select native trong giao diện; appearance:auto chỉ giữ cho fallback ở chế độ forced-colors. |
| Radio mức độ khóa học, checkbox trong cấu hình CLI | [Courses.js:399](../src/frontend/src/features/admin/pages/Courses.js#L399), [CliLabConfigEditor.js:295](../src/frontend/src/features/admin/components/labs/CliLabConfigEditor.js#L295), [InitialStateBuilder.js:218](../src/frontend/src/features/admin/components/labs/InitialStateBuilder.js#L218) | Đã đổi accent-color; radio còn có kích thước 16px/cursor. Hình radio, ô vuông và dấu tích vẫn là native. Khác với checkbox Users chưa có rule riêng. |
| Mũi tên mở/đóng details | [Home.js:715](../src/frontend/src/features/home/pages/Home.js#L715), [GradingSpecBuilder.js:357](../src/frontend/src/features/admin/components/labs/GradingSpecBuilder.js#L357) | Wrapper/summary đã có CSS, nhưng summary còn display:list-item và marker disclosure-closed của trình duyệt. Mục advanced trong CLI đã có chevron riêng và ẩn marker, không xếp chung là thiếu CSS. |
| Mũi tên tăng/giảm ô số | [Courses.js:375](../src/frontend/src/features/admin/pages/Courses.js#L375), [ExamEditor.jsx:219](../src/frontend/src/features/admin/pages/exams/ExamEditor.jsx#L219), [Tools.js:268](../src/frontend/src/features/admin/pages/Tools.js#L268), một số input CLI | Input ngoài đã được tạo skin; nút tăng/giảm còn là native. VLSM đã ẩn riêng spinner bằng CSS tại [VLSM_Calculator.css:423](../src/frontend/src/features/tools/styles/VLSM_Calculator.css#L423); CLI inline chỉ giảm opacity của spinner. |
| Nắm kéo textarea | [Lesson.css:1000](../src/frontend/src/features/lessons/styles/Lesson.css#L1000), các textarea biên tập admin | Khung textarea có CSS, resize:vertical chủ động giữ nắm kéo của trình duyệt. Không phải textarea chưa có CSS. |
| Scrollbar của trang/overlay auth | App và Auth/Auth.css | Thanh cuộn gốc vẫn scrollbar-color:auto, scrollbar-width:auto; không có skin scrollbar gốc. Một số vùng Lesson, VLSM và các panel khác đã có scrollbar riêng, nên không kết luận toàn bộ scrollbar chưa được chỉnh. |

## Mã dự phòng, chưa xác nhận xuất hiện trong UI hiện tại

[TopologyEditor.js:44](../src/frontend/src/features/admin/components/labs/TopologyEditor.js#L44) có nút “Dùng mẫu mạng 2 Router + 2 PC” mang class acm-btn nhưng không có CSS cho class này. Nhánh lỗi trả trực tiếp network-editor-error, nằm ngoài section network-editor nên không nhận rule .network-editor button. Mẫu CSS cho thấy nút mặc định.

Tuy nhiên không tìm thấy nơi import/sử dụng TopologyEditor trong mã hiện tại ngoài file định nghĩa; đây là component tương thích cũ. Không tính nút này vào 5 nút trên các route đang dùng.

## Những chỗ không nên báo nhầm là thiếu CSS

- Nút “Thử lưu lại”, “Thử tải lại”, “Gắn mốc” và nút player trong bài học nhận CSS qua selector cha, dù không có className trên từng nút.
- Input tìm tài liệu, tìm khóa học admin, toolbar đề thi và nút rich-text có selector cha tạo skin.
- Link “Mở ảnh / Mở file” trong chi tiết lab được .exam-view-details a tạo skin.
- Toggle chế độ quiz PortLookup có input checkbox native bị ẩn; phần nhìn thấy là slider tùy chỉnh.
- Upload ảnh khóa học/đề thi/lab dùng input file ẩn hoặc vùng bấm tùy chỉnh. Vấn đề nút file nhìn thấy rõ ở Resources không áp dụng cho mọi upload.
- Markdown có callout NOTE/TIP/WARNING và khối CLI được tạo skin riêng; phát hiện ở trên là các cấu trúc Markdown thường còn thiếu, không phải toàn bộ Markdown.
- Focus mặc định của trình duyệt vẫn có ích cho bàn phím. Không nên xóa outline chỉ để loại bỏ vẻ ngoài native nếu chưa thay bằng focus rõ ràng.

## Cách kiểm tra và giới hạn

- Rà AST của mã component: 411 node control JSX, gồm 276 button, 79 input, 20 select, 10 textarea, 12 a, 7 details và 7 summary. Đây là số vị trí trong nguồn, gồm mã dự phòng và control lặp theo dữ liệu; không phải số control đang hiện trên một trang.
- Đối chiếu class, style trực tiếp, selector cha, reset và CSS nhập vào ứng dụng. Không chỉ tìm phần tử thiếu className.
- Dùng Playwright kiểm tra trực tiếp màn hình khóa học không tồn tại; hai nút lỗi chỉ nhận reset chung, không nhận skin riêng.
- Kiểm thêm 78 mẫu control bằng DOM tạm với stylesheet thực tế, rồi xóa toàn bộ mẫu. Các trường hợp admin và trạng thái riêng tư được kiểm qua nguồn/mẫu CSS, chưa đi qua thao tác thật trong tài khoản admin.
- Kiểm riêng nội dung Markdown và pseudo-element file-selector-button; không mở hộp chọn file, hộp xác nhận xóa hay gửi dữ liệu.
- Không đổi font, mã ứng dụng, CSS, xác thực hay dữ liệu. Không chạy test/build vì đây là kiểm tra chỉ đọc; chỉ thêm báo cáo và nhật ký.

Thứ tự xử lý hợp lý: nút lỗi ở route đang dùng → skin nội dung Markdown và checkbox Users → dialog hệ thống/file upload nếu muốn đồng nhất → các chi tiết native còn lại theo chủ đích thiết kế.
