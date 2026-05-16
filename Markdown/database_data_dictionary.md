# Từ Điển Dữ Liệu Các Bảng Chính (Data Dictionary)

Dưới đây là đặc tả chi tiết của các bảng dữ liệu cốt lõi trong hệ thống, được thiết kế theo đúng yêu cầu trình bày trong đồ án tốt nghiệp.

## 1. Bảng `users` (Lưu trữ thông tin người dùng)

| Tên trường dữ liệu (Column Name) | Kiểu dữ liệu (Data Type) | Loại khóa (Key) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Integer | PK | Tự động tăng (Auto Increment) | Mã định danh duy nhất của người dùng |
| `full_name` | VarChar(100) | | Nullable | Họ và tên đầy đủ của người dùng |
| `email` | VarChar(150) | | Unique, Not Null | Địa chỉ email dùng để đăng nhập |
| `password_hash` | VarChar(255) | | Not Null | Mật khẩu đã được mã hóa (Bcrypt) |
| `avatar_url` | Text | | Nullable | Đường dẫn ảnh đại diện của người dùng |
| `role` | Enum | | Default: 'STUDENT' | Vai trò ('STUDENT' hoặc 'ADMIN') |
| `level` | Integer | | Default: 1 | Cấp độ học tập (dựa trên EXP/điểm số) |
| `streak` | Integer | | Default: 0 | Chuỗi ngày học liên tiếp |
| `total_study_time`| Integer | | Default: 0 | Tổng thời gian học tập (tính bằng phút) |
| `is_active` | Boolean | | Default: True | Trạng thái tài khoản (bị khóa hay không) |
| `last_login` | DateTime | | Nullable | Thời điểm đăng nhập gần nhất |
| `created_at` | DateTime | | Default: Now() | Thời điểm tạo tài khoản |

## 2. Bảng `courses` (Lưu trữ thông tin khóa học)

| Tên trường dữ liệu (Column Name) | Kiểu dữ liệu (Data Type) | Loại khóa (Key) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | VarChar(10) | PK | Not Null | Mã định danh khóa học (VD: c1, c2) |
| `code` | VarChar(10) | | Not Null | Mã học phần (VD: ITN, SRWE) |
| `title` | VarChar(200) | | Not Null | Tên khóa học (VD: Introduction to Networks) |
| `description` | Text | | Nullable | Mô tả chi tiết nội dung khóa học |
| `thumbnail_url` | Text | | Nullable | Đường dẫn ảnh bìa của khóa học |
| `level` | VarChar(50) | | Default: 'BEGINNER' | Mức độ khó của khóa học |
| `status` | VarChar(50) | | Default: 'DRAFT' | Trạng thái ('DRAFT', 'PUBLISHED') |
| `order_index` | Integer | | Default: 0 | Thứ tự hiển thị khóa học |
| `created_at` | DateTime | | Default: Now() | Thời gian tạo khóa học |

## 3. Bảng `modules` (Lưu trữ các chương/học phần)

| Tên trường dữ liệu (Column Name) | Kiểu dữ liệu (Data Type) | Loại khóa (Key) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | VarChar(10) | PK | Not Null | Mã định danh chương (VD: m1, m2) |
| `course_id` | VarChar(10) | FK | OnDelete: Cascade | Khóa ngoại liên kết tới bảng `courses` |
| `title` | VarChar(200) | | Not Null | Tên của học phần / chương |
| `description` | Text | | Nullable | Giới thiệu nội dung của chương |
| `order_index` | Integer | | Not Null | Thứ tự của chương trong khóa học |
| `created_at` | DateTime | | Default: Now() | Thời gian tạo học phần |

## 4. Bảng `lessons` (Lưu trữ bài học lý thuyết/video)

| Tên trường dữ liệu (Column Name) | Kiểu dữ liệu (Data Type) | Loại khóa (Key) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Integer | PK | Auto Increment | Mã bài học |
| `module_id` | VarChar(10) | FK | OnDelete: Cascade | Khóa ngoại liên kết tới bảng `modules` |
| `title` | VarChar(200) | | Not Null | Tiêu đề của bài học |
| `section_number`| VarChar(20) | | Nullable | Số thứ tự bài (VD: 1.1, 1.2) |
| `content_html` | Text | | Nullable | Nội dung bài giảng bằng định dạng HTML |
| `video_url` | Text | | Nullable | Link video bài giảng (YouTube URL) |
| `video_duration`| VarChar(20) | | Nullable | Thời lượng hiển thị của video |
| `order_index` | Integer | | Not Null | Thứ tự bài học trong một chương |

## 5. Bảng `labs` (Lưu trữ bài thực hành mạng)

| Tên trường dữ liệu (Column Name) | Kiểu dữ liệu (Data Type) | Loại khóa (Key) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Integer | PK | Auto Increment | Mã bài thực hành |
| `title` | VarChar(1000)| | Not Null | Tiêu đề bài lab |
| `category` | VarChar(50) | | Nullable | Thể loại thực hành (VD: Routing, Switching) |
| `difficulty` | Enum | | Default: 'EASY' | Độ khó ('EASY', 'MEDIUM', 'HARD') |
| `topology_img_url`| Text | | Nullable | Đường dẫn ảnh sơ đồ mạng (Topology) |
| `file_url` | Text | | Nullable | File bài tập (.pka, .pkt tải xuống) |
| `steps` | Json | | Nullable | Dữ liệu cấu trúc các bước thực hành |
| `course_id` | VarChar(10) | FK | Nullable | Liên kết khóa học (Nếu Lab thuộc Course) |
| `module_id` | VarChar(10) | FK | Nullable | Liên kết học phần (Nếu Lab thuộc Module) |

## 6. Bảng `exams` (Lưu trữ thông tin bài thi khảo thí)

| Tên trường dữ liệu (Column Name) | Kiểu dữ liệu (Data Type) | Loại khóa (Key) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Integer | PK | Auto Increment | Mã kỳ thi |
| `title` | VarChar(200) | | Not Null | Tiêu đề bài thi (VD: Midterm Exam) |
| `exam_code` | VarChar(20) | | Nullable | Mã code của kỳ thi |
| `total_questions`| Integer | | Not Null | Tổng số câu hỏi của bài thi |
| `duration_minutes`| Integer | | Not Null | Thời gian làm bài (phút) |
| `passing_score` | Integer | | Default: 70 | Điểm tối thiểu để vượt qua (thường là 70%) |
| `course_id` | VarChar(10) | FK | Nullable | Liên kết khóa học bài thi thuộc về |
| `status` | VarChar(20) | | Default: 'DRAFT' | Trạng thái hiển thị của bài thi |

## 7. Bảng `user_progress` (Lưu trữ tiến độ học tập người dùng)

| Tên trường dữ liệu (Column Name) | Kiểu dữ liệu (Data Type) | Loại khóa (Key) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Integer | PK | Auto Increment | Mã bản ghi tiến độ |
| `user_id` | Integer | FK | OnDelete: Cascade | Khóa ngoại tới bảng `users` |
| `course_id` | VarChar(10) | FK | OnDelete: Cascade | Khóa ngoại tới bảng `courses` |
| `module_id` | VarChar(10) | FK | Nullable | Khóa ngoại tới bảng `modules` |
| `lesson_id` | Integer | FK | Nullable | Khóa ngoại tới bảng `lessons` |
| `status` | Enum | | Default: 'LOCKED' | Trạng thái ('LOCKED', 'ACTIVE', 'COMPLETED') |
| `progress_percent`| Integer | | Default: 0 | Phần trăm hoàn thành (%) |
| `updated_at` | DateTime | | Auto Update | Cập nhật lần cuối khi tiến độ thay đổi |

## 8. Bảng `exam_results` (Lưu trữ lịch sử và kết quả làm bài thi)

| Tên trường dữ liệu (Column Name) | Kiểu dữ liệu (Data Type) | Loại khóa (Key) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Integer | PK | Auto Increment | Mã bản ghi kết quả |
| `user_id` | Integer | FK | OnDelete: Cascade | Khóa ngoại tới người dùng làm bài (`users`) |
| `exam_id` | Integer | FK | OnDelete: Cascade | Khóa ngoại tới bài thi (`exams`) |
| `score` | Integer | | Not Null | Số điểm / số câu trả lời đúng |
| `percentage` | Decimal(5,2)| | Not Null | Tỉ lệ phần trăm đạt được (%) |
| `is_passed` | Boolean | | Not Null | Kết quả trượt/đỗ (True = Đỗ) |
| `answers` | Json | | Not Null | Lịch sử cụ thể các đáp án user đã chọn |
| `time_spent` | Integer | | Not Null | Thời gian đã làm bài (tính bằng giây) |
| `taken_at` | DateTime | | Default: Now() | Thời điểm nộp bài |
